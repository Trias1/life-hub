"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { friendlyPasswordError, passwordProblem } from "@/lib/password-rules.mjs"
import { createClient } from "@/lib/supabase/server"

// Current password only needs to be non-empty: accounts created before the 8-character minimum must still be able to change it.
const schema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().max(128).refine((value) => !passwordProblem(value)), confirmPassword: z.string() }).refine((value) => value.newPassword === value.confirmPassword, { path: ["confirmPassword"] })

function fail(message: string): never { redirect("/security?error=" + encodeURIComponent(message)) }

export async function updatePassword(formData: FormData): Promise<void> {
  const input = schema.safeParse({ currentPassword: formData.get("currentPassword"), newPassword: formData.get("newPassword"), confirmPassword: formData.get("confirmPassword") })
  if (!input.success) fail(passwordProblem(String(formData.get("newPassword") ?? "")) ?? "Enter your current password, and type the new password the same way twice.")
  if (input.data.newPassword === input.data.currentPassword) fail("Choose a new password that is different from the current one.")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) fail("Your session expired. Sign in again before changing your password.")
  // Checking the current password is a sign-in, so throttle it per user (bucket from migration 0030).
  const { data: limit, error: limitError } = await supabase.rpc("consume_request_rate_limit", { p_bucket: "password" })
  // Fail closed: if the limiter can't answer, don't allow an unthrottled password guess.
  if (limitError || !limit || limit.allowed !== true) fail("Too many attempts. Wait a minute and try again.")
  // Checking the current password is a sign-in, so Supabase also wants the Turnstile token from the form.
  const captchaToken = formData.get("captchaToken")
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: input.data.currentPassword, options: typeof captchaToken === "string" && captchaToken ? { captchaToken } : undefined })
  if (verifyError && /captcha/i.test(verifyError.message)) fail("The security check didn't pass. Wait a moment and try again.")
  if (verifyError) fail("Your current password is incorrect.")
  const { error } = await supabase.auth.updateUser({ password: input.data.newPassword })
  if (error) fail(friendlyPasswordError(error.message) ?? "Could not update your password. Please try again.")
  // End every other session, so a stolen cookie stops working after a password change.
  await supabase.auth.signOut({ scope: "others" })
  revalidatePath("/security")
  redirect("/security?success=Password%20updated")
}

/** Ends every session except this browser, e.g. after using a shared or lost device. */
export async function signOutOtherSessions(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { error } = await supabase.auth.signOut({ scope: "others" })
  if (error) fail("Could not sign out other sessions. Please try again.")
  redirect("/security?success=" + encodeURIComponent("Signed out of all other sessions"))
}
