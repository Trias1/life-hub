"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { RECOVERY_CODE_COUNT, hashRecoveryCode, newRecoveryCode, normalizeRecoveryCode } from "@/lib/mfa-recovery.mjs"

async function signedInUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null
  return error || !userId ? null : { supabase, userId, aal: data?.claims?.aal }
}

/** How many unused recovery codes you have (0 when none were made). */
export async function getRecoveryCodeCount(): Promise<{ remaining: number } | { error: string }> {
  const user = await signedInUser()
  if (!user || user.aal !== "aal2") return { error: "Sign in with your authenticator first." }
  const { count, error } = await createAdminClient().from("mfa_recovery_codes").select("id", { count: "exact", head: true }).eq("user_id", user.userId).is("used_at", null)
  return error ? { error: "Couldn't load your recovery codes." } : { remaining: count ?? 0 }
}

/**
 * Replaces your recovery codes with 10 new ones and returns them once. Needs a session that passed
 * the authenticator step (aal2) and at least one active authenticator.
 */
export async function createRecoveryCodes(): Promise<{ codes: string[] } | { error: string }> {
  const user = await signedInUser()
  if (!user || user.aal !== "aal2") return { error: "Enter a code from your authenticator first (sign out and back in)." }
  const { data: factors } = await user.supabase.auth.mfa.listFactors()
  if (!factors?.totp.length) return { error: "Set up an authenticator app before making recovery codes." }

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode)
  const admin = createAdminClient()
  const { error: deleteError } = await admin.from("mfa_recovery_codes").delete().eq("user_id", user.userId)
  if (deleteError) return { error: "Couldn't create recovery codes. Try again." }
  const { error } = await admin.from("mfa_recovery_codes").insert(codes.map((code) => ({ user_id: user.userId, code_hash: hashRecoveryCode(user.userId, normalizeRecoveryCode(code)!) })))
  if (error) return { error: "Couldn't create recovery codes. Try again." }
  return { codes }
}

/**
 * Signs in without the phone: a valid unused recovery code turns two-factor off for this account
 * (every authenticator is removed, which also ends all sessions), so the owner signs in again with
 * the password and sets up a new authenticator. Attempts share the password throttle (5 a minute).
 */
export async function redeemRecoveryCode(formData: FormData): Promise<{ error: string } | { done: true }> {
  const user = await signedInUser()
  if (!user) return { error: "Your session expired. Sign in again." }
  const { data: limit, error: limitError } = await user.supabase.rpc("consume_request_rate_limit", { p_bucket: "password" })
  // Fail closed, like the password check: no answer from the limiter means no guess.
  if (limitError || !limit || (limit as { allowed?: boolean }).allowed !== true) return { error: "Too many attempts. Wait a minute and try again." }

  const code = normalizeRecoveryCode(formData.get("code"))
  if (!code) return { error: "Recovery codes have 16 letters and numbers, like K7QM-2XPA-9RTB-WN4D." }
  const admin = createAdminClient()
  // Mark it used in the same statement that finds it, so a code can't be spent twice at once.
  const { data: used, error } = await admin.from("mfa_recovery_codes").update({ used_at: new Date().toISOString() }).eq("user_id", user.userId).eq("code_hash", hashRecoveryCode(user.userId, code)).is("used_at", null).select("id")
  if (error) return { error: "Couldn't check that code. Try again." }
  if (!used?.length) return { error: "That recovery code isn't valid or was already used." }

  const { data: listed, error: listError } = await admin.auth.admin.mfa.listFactors({ userId: user.userId })
  if (listError) return { error: "Couldn't turn off two-factor. Try again." }
  for (const factor of listed?.factors ?? []) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.userId })
    if (deleteError) return { error: "Couldn't turn off two-factor. Try again." }
  }
  // The remaining codes belonged to the removed authenticators; new ones come with the next setup.
  await admin.from("mfa_recovery_codes").delete().eq("user_id", user.userId)
  await user.supabase.auth.signOut({ scope: "local" })
  return { done: true }
}
