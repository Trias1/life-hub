"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { actionFailure } from "@/lib/actions/server"
import { getStorageForWorkspace } from "@/lib/storage/storage"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { disconnectWorkspaceDriveConnection, disconnectGoogleAccount } from "@/lib/google-drive-auth"

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  username: z.string().trim().max(40).refine((value) => !/[\u0000-\u001F\u007F]/.test(value)),
  bio: z.string().trim().max(400),
})
const generalSettingsSchema = z.object({
  language: z.literal("English"),
  timezone: z.enum(["Asia/Jakarta", "UTC"]),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
  timeFormat: z.enum(["24-hour", "12-hour"]),
})
const preferenceBoolean = z.enum(["true", "false"]).transform((value) => value === "true")
const notificationPreferencesSchema = z.object({ mentionsEnabled: preferenceBoolean, tasksEnabled: preferenceBoolean, calendarEnabled: preferenceBoolean, notesEnabled: preferenceBoolean, filesEnabled: preferenceBoolean, bookmarksEnabled: preferenceBoolean })
const returnPathSchema = z.enum(["/profile", "/settings"])
const avatarTypes = new Set(["image/png", "image/jpeg", "image/webp"])
const maxAvatarSize = 2 * 1024 * 1024

function getReturnPath(formData: FormData) {
  return returnPathSchema.safeParse(formData.get("returnPath")).data ?? "/profile"
}

function storageError(error: unknown) {
  return error instanceof Error ? error : { message: String(error) }
}

export async function updateProfile(formData: FormData): Promise<void> {
  const returnPath = getReturnPath(formData)
  const input = profileSchema.safeParse({ displayName: formData.get("displayName"), username: formData.get("username") ?? "", bio: formData.get("bio") ?? "" })
  if (!input.success) actionFailure(returnPath, "save profile")
  const context = await getWorkspaceContext()
  if (!context) actionFailure(returnPath, "access the active workspace")

  const { error } = await context.supabase.from("profiles").upsert({ id: context.user.id, display_name: input.data.displayName, username: input.data.username || null, bio: input.data.bio, updated_at: new Date().toISOString() })
  if (error) actionFailure(returnPath, "save profile", error)
  revalidatePath("/settings")
  revalidatePath("/profile")
  revalidatePath("/", "layout")
  redirect(returnPath)
}

export async function uploadProfileAvatar(formData: FormData): Promise<void> {
  const returnPath = getReturnPath(formData)
  const value = formData.get("avatar")
  if (!(value instanceof File) || value.size === 0 || value.size > maxAvatarSize || !avatarTypes.has(value.type)) actionFailure(returnPath, "upload profile photo")

  const context = await getWorkspaceContext()
  if (!context) actionFailure(returnPath, "access the active workspace")
  const storage = getStorageForWorkspace(context.workspaceId)

  let uploaded: Awaited<ReturnType<typeof storage.upload>>
  try {
    const folderId = await storage.ensureFolder(["avatars"])
    uploaded = await storage.upload({ name: context.user.id + "-avatar", mimeType: value.type, body: Buffer.from(await value.arrayBuffer()), sizeBytes: value.size, parentId: folderId })
  } catch (error) {
    actionFailure(returnPath, "upload profile photo", storageError(error))
  }

  const { error } = await context.supabase.from("profiles").upsert({ id: context.user.id, avatar_url: "google-drive:" + uploaded.id, avatar_google_file_id: uploaded.id, avatar_workspace_id: context.workspaceId, updated_at: new Date().toISOString() })
  if (error) {
    try {
      await storage.delete(uploaded.id)
    } catch {
      console.error("Could not remove orphaned Google Drive avatar")
    }
    actionFailure(returnPath, "save profile photo", error)
  }

  // ponytail: old profile references are user-writable; reclaim orphan avatars only with trusted ownership metadata.
  revalidatePath("/profile")
  revalidatePath("/settings")
  redirect(returnPath)
}


export async function deleteWorkspace(formData: FormData): Promise<void> {
  const input = z.object({ confirmation: z.string().trim().min(1) }).safeParse({ confirmation: formData.get("confirmation") })
  if (!input.success) actionFailure("/settings", "delete workspace")

  const context = await getWorkspaceContext()
  if (!context) actionFailure("/settings", "delete workspace")
  const { data: workspace, error: workspaceError } = await context.supabase.from("workspaces").select("id,name,owner_id").eq("id", context.workspaceId).maybeSingle()
  if (workspaceError || !workspace || workspace.owner_id !== context.user.id || input.data.confirmation !== workspace.name) actionFailure("/settings", "delete workspace")

  const admin = createAdminClient()
  const nextWorkspace = context.memberships.find((membership) => membership.workspace_id !== context.workspaceId)
  const { error } = await admin.from("workspaces").delete().eq("id", context.workspaceId).eq("owner_id", context.user.id)
  if (error) actionFailure("/settings", "delete workspace", error)

  const { error: profileError } = await admin.from("profiles").update({ active_workspace_id: nextWorkspace?.workspace_id ?? null, updated_at: new Date().toISOString() }).eq("id", context.user.id)
  if (profileError) actionFailure("/settings", "select remaining workspace", profileError)

  revalidatePath("/", "layout")
  redirect(nextWorkspace ? "/dashboard" : "/onboarding")
}
export async function disconnectGoogleDrive(): Promise<void> {
  const context = await getWorkspaceContext()
  if (!context || !["admin", "super_admin"].includes(context.role)) actionFailure("/settings", "disconnect Google Drive")
  try {
    await disconnectWorkspaceDriveConnection(context.workspaceId)
  } catch (error) {
    actionFailure("/settings", "disconnect Google Drive", storageError(error))
  }
  revalidatePath("/settings")
  revalidatePath("/files")
  redirect("/settings?google=disconnected")
}

export async function saveGeneralSettings(formData: FormData): Promise<void> {
  const input = generalSettingsSchema.safeParse({ language: formData.get("language"), timezone: formData.get("timezone"), dateFormat: formData.get("dateFormat"), timeFormat: formData.get("timeFormat") })
  if (!input.success) actionFailure("/settings", "save general settings")
  const context = await getWorkspaceContext()
  if (!context || !["admin", "super_admin"].includes(context.role)) actionFailure("/settings", "save general settings")
  const { error } = await context.supabase.from("workspace_settings").upsert({ workspace_id: context.workspaceId, language: input.data.language, timezone: input.data.timezone, date_format: input.data.dateFormat, time_format: input.data.timeFormat, updated_at: new Date().toISOString() })
  if (error) actionFailure("/settings", "save general settings", error)
  revalidatePath("/settings")
}

export async function saveNotificationPreferences(formData: FormData): Promise<void> {
  const input = notificationPreferencesSchema.safeParse(Object.fromEntries(["mentionsEnabled", "tasksEnabled", "calendarEnabled", "notesEnabled", "filesEnabled", "bookmarksEnabled"].map((key) => [key, formData.get(key)])))
  if (!input.success) actionFailure("/settings", "save notification preferences")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/settings", "save notification preferences")
  const { error } = await context.supabase.from("notification_preferences").upsert({ user_id: context.user.id, mentions_enabled: input.data.mentionsEnabled, tasks_enabled: input.data.tasksEnabled, calendar_enabled: input.data.calendarEnabled, notes_enabled: input.data.notesEnabled, files_enabled: input.data.filesEnabled, bookmarks_enabled: input.data.bookmarksEnabled, updated_at: new Date().toISOString() })
  if (error) actionFailure("/settings", "save notification preferences", error)
  revalidatePath("/settings")
}

export async function disconnectGoogleAccountAction(): Promise<void> {
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/profile", "disconnect Google")
  try {
    await disconnectGoogleAccount(context.user.id)
  } catch (error) {
    actionFailure("/profile", "disconnect Google", error instanceof Error ? error : null)
  }
  revalidatePath("/profile")
  redirect("/profile?google=disconnected")
}
