"use server"

import { createHash, randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { actionFailure, validationFailure } from "@/lib/actions/server"
import { sendWorkspaceInvitation } from "@/lib/email.mjs"
import { createNotification, getWorkspaceContext, recordActivity } from "@/lib/workspace/server"

const inviteSchema = z.object({ email: z.string().email(), role: z.enum(["user", "admin"]) })
const roleSchema = z.object({ userId: z.string().uuid(), role: z.enum(["user", "admin"]) })
const idSchema = z.object({ id: z.string().uuid() })

async function adminContext() {
  const context = await getWorkspaceContext()
  return context?.role === "admin" || context?.role === "super_admin" ? context : null
}

async function requireMemberManagement(context: NonNullable<Awaited<ReturnType<typeof adminContext>>>, userId: string, role: "user" | "admin" | null, operation: string) {
  const { data, error } = await context.supabase.rpc("can_manage_workspace_member", { target_workspace_id: context.workspaceId, target_user_id: userId, requested_role: role })
  if (error || !data) actionFailure("/team", operation, error)
}

export async function inviteMember(formData: FormData): Promise<void> {
  const input = inviteSchema.safeParse({ email: formData.get("email"), role: formData.get("role") })
  if (!input.success) validationFailure("/team/invite", input.error.issues)
  const context = await adminContext()
  if (!context) actionFailure("/team/invite", "create invitation")
  if (input.data.role === "admin" && context.role !== "super_admin") actionFailure("/team/invite", "create admin invitation")

  const token = randomUUID()
  const { error } = await context.supabase.from("workspace_invitations").insert({ workspace_id: context.workspaceId, email: input.data.email.toLowerCase(), role: input.data.role, token_hash: createHash("sha256").update(token).digest("hex"), created_by: context.user.id })
  if (error) actionFailure("/team/invite", "create invitation", error)
  await recordActivity(context, { action: "Invited " + input.data.email.toLowerCase(), entityType: "member" })
  let emailStatus = "not_configured"
  try {
    emailStatus = await sendWorkspaceInvitation({ email: input.data.email.toLowerCase(), token, role: input.data.role })
  } catch (emailError) {
    console.error("Could not send workspace invitation", emailError instanceof Error ? emailError.message : "unknown error")
    emailStatus = "failed"
  }
  revalidatePath("/team")
  revalidatePath("/activity")
  const success = emailStatus === "sent" ? "Invitation email sent." : "Invitation created. Share the link below with the person you invited."
  redirect("/team?tab=invitations&success=" + encodeURIComponent(success) + "&invite=" + encodeURIComponent(token) + "&email=" + emailStatus)
}

export async function changeMemberRole(formData: FormData): Promise<void> {
  const input = roleSchema.safeParse({ userId: formData.get("userId"), role: formData.get("role") })
  if (!input.success) actionFailure("/team", "change member role")
  const context = await adminContext()
  if (!context || input.data.userId === context.user.id) actionFailure("/team", "change member role")
  await requireMemberManagement(context, input.data.userId, input.data.role, "change member role")

  const { error } = await context.supabase.from("workspace_members").update({ role: input.data.role }).eq("workspace_id", context.workspaceId).eq("user_id", input.data.userId)
  if (error) actionFailure("/team", "change member role", error)
  await createNotification(context, { recipientId: input.data.userId, type: "team", message: "Your workspace role is now " + input.data.role + "." })
  await recordActivity(context, { action: "Changed member role", entityType: "member", entityId: input.data.userId, notify: false })
  revalidatePath("/team")
  revalidatePath("/activity")
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const input = idSchema.safeParse({ id: formData.get("id") })
  if (!input.success) actionFailure("/team?tab=invitations", "revoke invitation")
  const context = await adminContext()
  if (!context) actionFailure("/team?tab=invitations", "revoke invitation")

  const { data: invitation, error: invitationError } = await context.supabase.from("workspace_invitations").select("role").eq("id", input.data.id).eq("workspace_id", context.workspaceId).maybeSingle()
  if (invitationError || !invitation || (invitation.role === "admin" && context.role !== "super_admin")) actionFailure("/team?tab=invitations", "revoke invitation", invitationError)

  const { error } = await context.supabase.from("workspace_invitations").delete().eq("id", input.data.id).eq("workspace_id", context.workspaceId)
  if (error) actionFailure("/team?tab=invitations", "revoke invitation", error)
  revalidatePath("/team")
}

export async function removeMember(formData: FormData): Promise<void> {
  const input = idSchema.safeParse({ id: formData.get("id") })
  if (!input.success) actionFailure("/team", "remove member")
  const context = await adminContext()
  if (!context || input.data.id === context.user.id) actionFailure("/team", "remove member")
  await requireMemberManagement(context, input.data.id, null, "remove member")

  await createNotification(context, { recipientId: input.data.id, type: "team", message: "You were removed from this workspace." })
  const { error } = await context.supabase.from("workspace_members").delete().eq("workspace_id", context.workspaceId).eq("user_id", input.data.id)
  if (error) actionFailure("/team", "remove member", error)
  await recordActivity(context, { action: "Removed member", entityType: "member", entityId: input.data.id })
  revalidatePath("/team")
  revalidatePath("/activity")
}
