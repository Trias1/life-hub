"use server"

import { revalidatePath } from "next/cache"
import { createHash, randomUUID } from "node:crypto"
import { redirect } from "next/navigation"
import { z } from "zod"
import { actionFailure } from "@/lib/actions/server"
import { getStorageForWorkspace } from "@/lib/storage/storage"
import { getWorkspaceContext, recordActivity } from "@/lib/workspace/server"

const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain", "application/zip", "application/x-zip-compressed", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "video/mp4", "audio/mpeg", "audio/wav"])
const folderSchema = z.string().trim().min(1).max(80).default("General")

function storageError(error: unknown) {
  return error instanceof Error ? error : { message: String(error) }
}

export async function uploadFile(formData: FormData): Promise<void> {
  const value = formData.get("file")
  const folder = folderSchema.safeParse(formData.get("folder") ?? "General")
  if (!(value instanceof File) || value.size === 0 || value.size > MAX_SIZE || !ALLOWED_TYPES.has(value.type) || !folder.success) actionFailure("/files", "upload file")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/files", "access the active workspace")
  const storage = getStorageForWorkspace(context.workspaceId)

  const safeName = value.name.replace(/[^a-zA-Z0-9._-]/g, "-")
  let uploaded: Awaited<ReturnType<typeof storage.upload>>
  try {
    const parentId = await storage.ensureFolder(["workspaces", context.workspaceId, "files"])
    uploaded = await storage.upload({ name: safeName, mimeType: value.type, body: Buffer.from(await value.arrayBuffer()), sizeBytes: value.size, parentId })
  } catch (error) {
    actionFailure("/files", "upload file", storageError(error))
  }

  const { data: file, error } = await context.supabase.from("files").insert({ workspace_id: context.workspaceId, uploader_id: context.user.id, storage_path: "google-drive:" + uploaded.id, google_file_id: uploaded.id, storage_provider: "google-drive", name: value.name, mime_type: value.type, size_bytes: value.size, folder: folder.data }).select("id").single()
  if (error) {
    try {
      await storage.delete(uploaded.id)
    } catch (rollbackError) {
      console.error("Could not remove orphaned Google Drive upload", rollbackError)
    }
    actionFailure("/files", "save file metadata", error)
  }

  await recordActivity(context, { action: "Uploaded", entityType: "file", entityId: file.id })
  revalidatePath("/files")
  revalidatePath("/activity")
}

export async function toggleFileFavorite(formData: FormData): Promise<void> {
  const input = z.object({ id: z.string().uuid(), favorite: z.enum(["true", "false"]) }).safeParse({ id: formData.get("id"), favorite: formData.get("favorite") })
  if (!input.success) actionFailure("/files", "update file")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/files", "access the active workspace")

  const { error } = await context.supabase.from("files").update({ is_favorite: input.data.favorite === "true" }).eq("id", input.data.id).eq("workspace_id", context.workspaceId).eq("uploader_id", context.user.id)
  if (error) actionFailure("/files", "update file", error)
  await recordActivity(context, { action: input.data.favorite === "true" ? "Favorited" : "Unfavorited", entityType: "file", entityId: input.data.id })
  revalidatePath("/files")
  revalidatePath("/activity")
}

export async function trashFile(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"))
  if (!id.success) actionFailure("/files", "trash file")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/files", "access the active workspace")

  const { error } = await context.supabase.from("files").update({ trashed_at: new Date().toISOString() }).eq("id", id.data).eq("workspace_id", context.workspaceId).eq("uploader_id", context.user.id)
  if (error) actionFailure("/files", "trash file", error)
  await recordActivity(context, { action: "Trashed", entityType: "file", entityId: id.data })
  revalidatePath("/files")
  revalidatePath("/activity")
}


export async function restoreFile(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"))
  if (!id.success) actionFailure("/files?trash=true", "restore file")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/files?trash=true", "access the active workspace")

  const { error } = await context.supabase.from("files").update({ trashed_at: null }).eq("id", id.data).eq("workspace_id", context.workspaceId).eq("uploader_id", context.user.id)
  if (error) actionFailure("/files?trash=true", "restore file", error)
  await recordActivity(context, { action: "Restored", entityType: "file", entityId: id.data })
  revalidatePath("/files")
  revalidatePath("/activity")
}

export async function permanentlyDeleteFile(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"))
  if (!id.success) actionFailure("/files?trash=true", "delete file permanently")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/files?trash=true", "access the active workspace")

  const { data: file, error: readError } = await context.supabase.from("files").select("id,google_file_id").eq("id", id.data).eq("workspace_id", context.workspaceId).eq("uploader_id", context.user.id).maybeSingle()
  if (readError || !file) actionFailure("/files?trash=true", "find file", readError ?? new Error("File not found"))

  if (file.google_file_id) {
    try {
      await getStorageForWorkspace(context.workspaceId).delete(file.google_file_id)
    } catch (error) {
      actionFailure("/files?trash=true", "delete file from Google Drive", storageError(error))
    }
  }

  const { error: deleteError } = await context.supabase.from("files").delete().eq("id", id.data).eq("workspace_id", context.workspaceId).eq("uploader_id", context.user.id)
  if (deleteError) actionFailure("/files?trash=true", "delete file metadata", deleteError)
  await recordActivity(context, { action: "Deleted permanently", entityType: "file", entityId: id.data })
  revalidatePath("/files")
  revalidatePath("/activity")
}

export async function uploadFileVersion(formData: FormData): Promise<void> {
  const fileId = z.string().uuid().safeParse(formData.get("fileId"))
  const value = formData.get("version")
  if (!fileId.success || !(value instanceof File) || value.size === 0 || value.size > MAX_SIZE || !ALLOWED_TYPES.has(value.type)) actionFailure("/files", "upload file version")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/files", "access the active workspace")

  const { data: file, error: fileError } = await context.supabase.from("files").select("id").eq("id", fileId.data).eq("workspace_id", context.workspaceId).eq("uploader_id", context.user.id).maybeSingle()
  if (fileError || !file) actionFailure("/files", "find file", fileError ?? new Error("File not found"))
  const storage = getStorageForWorkspace(context.workspaceId)
  let uploaded: Awaited<ReturnType<typeof storage.upload>>
  try {
    const parentId = await storage.ensureFolder(["workspaces", context.workspaceId, "files", "versions", file.id])
    uploaded = await storage.upload({ name: value.name.replace(/[^a-zA-Z0-9._-]/g, "-"), mimeType: value.type, body: Buffer.from(await value.arrayBuffer()), sizeBytes: value.size, parentId })
  } catch (error) {
    actionFailure("/files", "upload file version", storageError(error))
  }

  const { error } = await context.supabase.from("file_versions").insert({ file_id: file.id, workspace_id: context.workspaceId, uploader_id: context.user.id, storage_path: "google-drive:" + uploaded.id, name: value.name, mime_type: value.type, size_bytes: value.size }).select("id").single()
  if (error) {
    try {
      await storage.delete(uploaded.id)
    } catch (rollbackError) {
      console.error("Could not remove orphaned Google Drive file version", rollbackError)
    }
    actionFailure("/files", "save file version metadata", error)
  }
  await recordActivity(context, { action: "Uploaded version", entityType: "file", entityId: file.id })
  revalidatePath("/files")
  revalidatePath("/activity")
}

export async function createFileShare(formData: FormData): Promise<void> {
  const input = z.object({ id: z.string().uuid(), expires: z.enum(["never", "1d", "7d", "30d"]) }).safeParse({ id: formData.get("id"), expires: formData.get("expires") })
  if (!input.success) actionFailure("/files", "share file")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/files", "access the active workspace")
  const { data: file, error: fileError } = await context.supabase.from("files").select("id").eq("id", input.data.id).eq("workspace_id", context.workspaceId).maybeSingle()
  if (fileError || !file) actionFailure("/files", "find file", fileError ?? new Error("File not found"))

  const token = randomUUID()
  const expiresAt = input.data.expires === "never" ? null : new Date(Date.now() + Number(input.data.expires.slice(0, -1)) * (input.data.expires.endsWith("d") ? 24 * 60 * 60 * 1000 : 0)).toISOString()
  const { error } = await context.supabase.from("file_shares").insert({ file_id: file.id, workspace_id: context.workspaceId, token_hash: createHash("sha256").update(token).digest("hex"), permission: "view", expires_at: expiresAt, created_by: context.user.id })
  if (error) actionFailure("/files", "share file", error)
  await recordActivity(context, { action: "Shared", entityType: "file", entityId: file.id })
  redirect("/files?share=" + encodeURIComponent(token))
}
