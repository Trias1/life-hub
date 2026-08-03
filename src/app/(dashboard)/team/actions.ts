"use server"

import { createHash, randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { actionFailure } from "@/lib/actions/server"
import { createNotification, getWorkspaceContext, recordActivity } from "@/lib/workspace/server"

const inviteSchema = z.object({ email: z.string().email(), role: z.enum(["user", "admin"]) })
const roleSchema = z.object({ userId: z.string().uuid(), role: z.enum(["user", "admin"]) })
const idSchema = z.object({ id: z.string().uuid() })

async function adminContext() {
  const context = await getWorkspaceContext()
  return context?.role === "admin" || context?.role === "super_admin" ? context : null
}

export async function inviteMember(formData: FormData): Promise<void> {
  const input = inviteSchema.safeParse({ email: formData.get("email"), role: formData.get("role") })
  if (!input.success) actionFailure("/team", "create invitation")
  const context = await adminContext()
  if (!context) actionFailure("/team", "create invitation")

  const token = randomUUID()
  const { error } = await context.supabase.from("workspace_invitations").insert({ workspace_id: context.workspaceId, email: input.data.email.toLowerCase(), role: input.data.role, token_hash: createHash("sha256").update(token).digest("hex"), created_by: context.user.id })
  if (error) actionFailure("/team", "create invitation", error)
  await recordActivity(context, { action: "Invited " + input.data.email.toLowerCase(), entityType: "member" })
  revalidatePath("/team")
  revalidatePath("/activity")
  redirect("/team?invite=" + encodeURIComponent(token))
}

export async function changeMemberRole(formData: FormData): Promise<void> {
  const input = roleSchema.safeParse({ userId: formData.get("userId"), role: formData.get("role") })
  if (!input.success) actionFailure("/team", "change member role")
  const context = await adminContext()
  if (!context || input.data.userId === context.user.id) actionFailure("/team", "change member role")

  const { error } = await context.supabase.from("workspace_members").update({ role: input.data.role }).eq("workspace_id", context.workspaceId).eq("user_id", input.data.userId)
  if (error) actionFailure("/team", "change member role", error)
  await createNotification(context, { recipientId: input.data.userId, type: "team", message: "Your workspace role is now " + input.data.role + "." })
  await recordActivity(context, { action: "Changed member role", entityType: "member", entityId: input.data.userId, notify: false })
  revalidatePath("/team")
  revalidatePath("/activity")
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const input = idSchema.safeParse({ id: formData.get("id") })
  if (!input.success) actionFailure("/team", "revoke invitation")
  const context = await adminContext()
  if (!context) actionFailure("/team", "revoke invitation")

  const { error } = await context.supabase.from("workspace_invitations").delete().eq("id", input.data.id).eq("workspace_id", context.workspaceId)
  if (error) actionFailure("/team", "revoke invitation", error)
  revalidatePath("/team")
}

export async function removeMember(formData: FormData): Promise<void> {
  const input = idSchema.safeParse({ id: formData.get("id") })
  if (!input.success) actionFailure("/team", "remove member")
  const context = await adminContext()
  if (!context || input.data.id === context.user.id) actionFailure("/team", "remove member")

  await createNotification(context, { recipientId: input.data.id, type: "team", message: "You were removed from this workspace." })
  const { error } = await context.supabase.from("workspace_members").delete().eq("workspace_id", context.workspaceId).eq("user_id", input.data.id)
  if (error) actionFailure("/team", "remove member", error)
  await recordActivity(context, { action: "Removed member", entityType: "member", entityId: input.data.id })
  revalidatePath("/team")
  revalidatePath("/activity")
}
