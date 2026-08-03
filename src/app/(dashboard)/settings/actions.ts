"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { actionFailure } from "@/lib/actions/server"
import { getStorageForWorkspace } from "@/lib/storage/storage"
import { getWorkspaceContext } from "@/lib/workspace/server"

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  username: z.string().trim().max(40).refine((value) => !/[\u0000-\u001F\u007F]/.test(value)),
  bio: z.string().trim().max(400),
})
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

  const { data: existingProfile, error: existingProfileError } = await context.supabase.from("profiles").select("avatar_url,avatar_google_file_id").eq("id", context.user.id).maybeSingle()
  if (existingProfileError) actionFailure(returnPath, "load profile", existingProfileError)

  let uploaded: Awaited<ReturnType<typeof storage.upload>>
  try {
    const folderId = await storage.ensureFolder(["avatars"])
    uploaded = await storage.upload({ name: context.user.id + "-avatar", mimeType: value.type, body: Buffer.from(await value.arrayBuffer()), sizeBytes: value.size, parentId: folderId })
  } catch (error) {
    actionFailure(returnPath, "upload profile photo", storageError(error))
  }

  const { error } = await context.supabase.from("profiles").upsert({ id: context.user.id, avatar_url: "google-drive:" + uploaded.id, avatar_google_file_id: uploaded.id, updated_at: new Date().toISOString() })
  if (error) {
    try {
      await storage.delete(uploaded.id)
    } catch (rollbackError) {
      console.error("Could not remove orphaned Google Drive avatar", rollbackError)
    }
    actionFailure(returnPath, "save profile photo", error)
  }

  if (existingProfile?.avatar_google_file_id) {
    try {
      await storage.delete(existingProfile.avatar_google_file_id)
    } catch (cleanupError) {
      console.error("Could not remove previous Google Drive avatar", cleanupError)
    }
  }

  revalidatePath("/profile")
  revalidatePath("/settings")
  redirect(returnPath)
}
