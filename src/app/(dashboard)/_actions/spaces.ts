"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { actionFailure } from "@/lib/actions/server"
import { getWorkspaceContext, recordActivity } from "@/lib/workspace/server"
import { FIELD, encryptField } from "@/lib/data-crypto.mjs"

const schema = z.object({ name: z.string().trim().min(1).max(80), color: z.enum(["indigo", "blue", "emerald", "rose"]).default("indigo"), icon: z.string().trim().min(1).max(30), description: z.string().trim().max(240) })

export async function createSpace(formData: FormData): Promise<void> {
  const input = schema.safeParse({ name: formData.get("name"), color: formData.get("color") || "indigo", icon: formData.get("icon") || "folder", description: formData.get("description") || "" })
  if (!input.success) actionFailure("/dashboard", "create space")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/dashboard", "access the active workspace")

  const { data: space, error } = await context.supabase.from("spaces").insert({ name: input.data.name, color: input.data.color, icon: input.data.icon, description: encryptField(FIELD.SPACE_DESCRIPTION, input.data.description), workspace_id: context.workspaceId, creator_id: context.user.id }).select("id").single()
  if (error) actionFailure("/dashboard", "create space", error)
  await recordActivity(context, { action: "Created", entityType: "space", entityId: space.id })
  revalidatePath("/dashboard")
  revalidatePath("/activity")
  redirect("/dashboard")
}


const updateSchema = schema.extend({ id: z.string().uuid() })

async function getOwnedSpaceContext(formData: FormData, operation: string) {
  const id = z.string().uuid().safeParse(formData.get("id"))
  if (!id.success) actionFailure("/dashboard", operation)
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/dashboard", "access the active workspace")
  return { id: id.data, context }
}

export async function updateSpace(formData: FormData): Promise<void> {
  const input = updateSchema.safeParse({ id: formData.get("id"), name: formData.get("name"), color: formData.get("color") || "indigo", icon: formData.get("icon") || "folder", description: formData.get("description") || "" })
  if (!input.success) actionFailure("/dashboard", "update space")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/dashboard", "access the active workspace")
  const { error } = await context.supabase.from("spaces").update({ name: input.data.name, color: input.data.color, icon: input.data.icon, description: encryptField(FIELD.SPACE_DESCRIPTION, input.data.description), updated_at: new Date().toISOString() }).eq("id", input.data.id).eq("workspace_id", context.workspaceId).eq("creator_id", context.user.id)
  if (error) actionFailure("/dashboard", "update space", error)
  await recordActivity(context, { action: "Updated", entityType: "space", entityId: input.data.id })
  revalidatePath("/dashboard")
  revalidatePath("/activity")
  redirect("/dashboard")
}

export async function archiveSpace(formData: FormData): Promise<void> {
  const { id, context } = await getOwnedSpaceContext(formData, "archive space")
  const { error } = await context.supabase.from("spaces").update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", context.workspaceId).eq("creator_id", context.user.id)
  if (error) actionFailure("/dashboard", "archive space", error)
  await recordActivity(context, { action: "Archived", entityType: "space", entityId: id })
  revalidatePath("/dashboard")
  revalidatePath("/activity")
  redirect("/dashboard")
}

export async function deleteSpace(formData: FormData): Promise<void> {
  const { id, context } = await getOwnedSpaceContext(formData, "delete space")
  const { error } = await context.supabase.from("spaces").delete().eq("id", id).eq("workspace_id", context.workspaceId).eq("creator_id", context.user.id)
  if (error) actionFailure("/dashboard", "delete space", error)
  await recordActivity(context, { action: "Deleted", entityType: "space", entityId: id })
  revalidatePath("/dashboard")
  revalidatePath("/activity")
  redirect("/dashboard")
}
