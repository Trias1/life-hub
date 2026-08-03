"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { actionFailure } from "@/lib/actions/server"
import { getWorkspaceContext, recordActivity } from "@/lib/workspace/server"

const schema = z.object({ title: z.string().trim().min(1).max(160), url: z.string().url().startsWith("https://"), collection: z.string().trim().min(1).max(80), tags: z.string().max(500) })

function tags(value: string) {
  return Array.from(new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 12)
}

export async function createBookmark(formData: FormData): Promise<void> {
  const input = schema.safeParse({ title: formData.get("title"), url: formData.get("url"), collection: formData.get("collection") ?? "General", tags: formData.get("tags") ?? "" })
  if (!input.success) actionFailure("/bookmarks", "create bookmark")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/bookmarks", "access the active workspace")

  const { data: bookmark, error } = await context.supabase.from("bookmarks").insert({ title: input.data.title, url: input.data.url, collection: input.data.collection, tags: tags(input.data.tags), workspace_id: context.workspaceId, creator_id: context.user.id }).select("id").single()
  if (error) actionFailure("/bookmarks", "create bookmark", error)
  await recordActivity(context, { action: "Created", entityType: "bookmark", entityId: bookmark.id })
  revalidatePath("/bookmarks")
  revalidatePath("/activity")
}

export async function toggleBookmarkFavorite(formData: FormData): Promise<void> {
  const input = z.object({ id: z.string().uuid(), favorite: z.enum(["true", "false"]) }).safeParse({ id: formData.get("id"), favorite: formData.get("favorite") })
  if (!input.success) actionFailure("/bookmarks", "update bookmark")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/bookmarks", "access the active workspace")

  const { error } = await context.supabase.from("bookmarks").update({ is_favorite: input.data.favorite === "true" }).eq("id", input.data.id).eq("workspace_id", context.workspaceId).eq("creator_id", context.user.id)
  if (error) actionFailure("/bookmarks", "update bookmark", error)
  revalidatePath("/bookmarks")
}

export async function archiveBookmark(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"))
  if (!id.success) actionFailure("/bookmarks", "archive bookmark")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/bookmarks", "access the active workspace")

  const { error } = await context.supabase.from("bookmarks").update({ archived_at: new Date().toISOString() }).eq("id", id.data).eq("workspace_id", context.workspaceId).eq("creator_id", context.user.id)
  if (error) actionFailure("/bookmarks", "archive bookmark", error)
  await recordActivity(context, { action: "Archived", entityType: "bookmark", entityId: id.data })
  revalidatePath("/bookmarks")
  revalidatePath("/activity")
}

export async function importBookmarks(formData: FormData): Promise<void> {
  const value = formData.get("file")
  if (!(value instanceof File) || value.size > 1_000_000) actionFailure("/bookmarks", "import bookmarks")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/bookmarks", "access the active workspace")

  const lines = (await value.text()).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const rows = lines[0]?.toLowerCase().startsWith("title,") ? lines.slice(1) : lines
  const records = rows.map((line) => {
    const [title, url, collection = "General", tagText = ""] = line.split(",").map((item) => item.trim())
    return schema.safeParse({ title, url, collection, tags: tagText })
  }).filter((result) => result.success).map((result) => ({ title: result.data.title, url: result.data.url, collection: result.data.collection, tags: tags(result.data.tags), workspace_id: context.workspaceId, creator_id: context.user.id }))
  if (!records.length) actionFailure("/bookmarks", "import bookmarks")

  const { error } = await context.supabase.from("bookmarks").insert(records)
  if (error) actionFailure("/bookmarks", "import bookmarks", error)
  await recordActivity(context, { action: "Imported", entityType: records.length + " bookmarks" })
  revalidatePath("/bookmarks")
  revalidatePath("/activity")
}


const updateSchema = schema.extend({ id: z.string().uuid() })

export async function updateBookmark(formData: FormData): Promise<void> {
  const input = updateSchema.safeParse({ id: formData.get("id"), title: formData.get("title"), url: formData.get("url"), collection: formData.get("collection") ?? "General", tags: formData.get("tags") ?? "" })
  if (!input.success) actionFailure("/bookmarks", "update bookmark")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/bookmarks", "access the active workspace")

  const { error } = await context.supabase.from("bookmarks").update({ title: input.data.title, url: input.data.url, collection: input.data.collection, tags: tags(input.data.tags), updated_at: new Date().toISOString() }).eq("id", input.data.id).eq("workspace_id", context.workspaceId).eq("creator_id", context.user.id)
  if (error) actionFailure("/bookmarks", "update bookmark", error)
  await recordActivity(context, { action: "Updated", entityType: "bookmark", entityId: input.data.id })
  revalidatePath("/bookmarks")
  revalidatePath("/activity")
}

export async function restoreBookmark(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"))
  if (!id.success) actionFailure("/bookmarks", "restore bookmark")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/bookmarks", "access the active workspace")

  const { error } = await context.supabase.from("bookmarks").update({ archived_at: null, updated_at: new Date().toISOString() }).eq("id", id.data).eq("workspace_id", context.workspaceId).eq("creator_id", context.user.id)
  if (error) actionFailure("/bookmarks", "restore bookmark", error)
  await recordActivity(context, { action: "Restored", entityType: "bookmark", entityId: id.data })
  revalidatePath("/bookmarks")
  revalidatePath("/activity")
}
