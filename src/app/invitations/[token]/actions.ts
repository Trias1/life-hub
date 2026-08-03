"use server"

import { createHash } from "node:crypto"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export async function acceptInvitation(formData: FormData): Promise<void> {
  const token = z.string().uuid().safeParse(formData.get("token"))
  if (!token.success) redirect("/login?error=Invalid%20invitation")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?error=Sign%20in%20before%20accepting%20the%20invitation")
  const tokenHash = createHash("sha256").update(token.data).digest("hex")
  const { error } = await supabase.rpc("accept_workspace_invitation", { invitation_token_hash: tokenHash })
  if (error) redirect("/invitations/" + token.data + "?error=" + encodeURIComponent("This invitation is invalid, expired, or belongs to a different email."))
  redirect("/dashboard")
}
