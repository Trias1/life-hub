"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { actionFailure, validationFailure } from "@/lib/actions/server"
import { getWorkspaceContext, recordActivity } from "@/lib/workspace/server"
import { parseCsv } from "@/lib/csv.mjs"

const schema = z.object({ title: z.string().trim().min(1).max(160), url: z.string().url().startsWith("https://"), collection: z.string().trim().min(1).max(80), tags: z.string().max(500) })

/** Failures go back to the bookmark the form was on, or to the list when the id is unusable. */
function detailPath(value: FormDataEntryValue | null) {
  const id = z.string().uuid().safeParse(value)
  return id.success ? "/bookmarks/" + id.data : "/bookmarks"
}

function revalidateBookmark(id: string) {
  revalidatePath("/bookmarks")
  revalidatePath("/bookmarks/" + id)
}

function tags(value: string) {
  return Array.from(new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 12)
}

export async function createBookmark(formData: FormData): Promise<void> {
  const input = schema.safeParse({ title: formData.get("title"), url: formData.get("url"), collection: formData.get("collection") ?? "General", tags: formData.get("tags") ?? "" })
  if (!input.success) validationFailure("/bookmarks/new", input.error.issues)
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/bookmarks/new", "access the active workspace")

  const { data: bookmark, error } = await context.supabase.from("bookmarks").insert({ title: input.data.title, url: input.data.url, collection: input.data.collection, tags: tags(input.data.tags), workspace_id: context.workspaceId, creator_id: context.user.id }).select("id").single()
  if (error) actionFailure("/bookmarks/new", "create bookmark", error)
  await recordActivity(context, { action: "Created", entityType: "bookmark", entityId: bookmark.id })
  revalidatePath("/bookmarks")
  revalidatePath("/activity")
  redirect("/bookmarks/" + bookmark.id + "?success=Bookmark%20created")
}

export async function toggleBookmarkFavorite(formData: FormData): Promise<void> {
  const input = z.object({ id: z.string().uuid(), favorite: z.enum(["true", "false"]) }).safeParse({ id: formData.get("id"), favorite: formData.get("favorite") })
  const back = detailPath(formData.get("id"))
  if (!input.success) validationFailure(back, input.error.issues)
  const context = await getWorkspaceContext()
  if (!context) actionFailure(back, "access the active workspace")

  const { error } = await context.supabase.from("bookmarks").update({ is_favorite: input.data.favorite === "true" }).eq("id", input.data.id).eq("workspace_id", context.workspaceId).eq("creator_id", context.user.id)
  if (error) actionFailure(back, "update bookmark", error)
  revalidateBookmark(input.data.id)
}

export async function archiveBookmark(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"))
  const back = detailPath(formData.get("id"))
  if (!id.success) actionFailure(back, "archive bookmark")
  const context = await getWorkspaceContext()
  if (!context) actionFailure(back, "access the active workspace")

  const { error } = await context.supabase.from("bookmarks").update({ archived_at: new Date().toISOString() }).eq("id", id.data).eq("workspace_id", context.workspaceId).eq("creator_id", context.user.id)
  if (error) actionFailure(back, "archive bookmark", error)
  await recordActivity(context, { action: "Archived", entityType: "bookmark", entityId: id.data })
  revalidateBookmark(id.data)
  revalidatePath("/activity")
}

export async function importBookmarks(formData: FormData): Promise<void> {
  const value = formData.get("file")
  if (!(value instanceof File) || value.size > 1_000_000) actionFailure("/bookmarks", "import bookmarks")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/bookmarks", "access the active workspace")

  let rows: string[][]
  try {
    const parsed = parseCsv(await value.text())
    rows = parsed[0]?.map((item) => item.trim().toLowerCase()).join(",") === "title,url,collection,tags" ? parsed.slice(1) : parsed
  } catch (error) {
    actionFailure("/bookmarks", "import bookmarks", error instanceof Error ? error : null)
  }
  const records = rows.map(([title = "", url = "", collection = "General", tagText = ""]) => {
    return schema.safeParse({ title, url, collection, tags: tagText })
  }).filter((result) => result.success).map((result) => ({ title: result.data.title, url: result.data.url, collection: result.data.collection, tags: tags(result.data.tags.replaceAll("|", ",")), workspace_id: context.workspaceId, creator_id: context.user.id }))
  if (!records.length) actionFailure("/bookmarks", "import bookmarks")

  const { error } = await context.supabase.from("bookmarks").insert(records)
  if (error) actionFailure("/bookmarks", "import bookmarks", error)
  await recordActivity(context, { action: "Imported", entityType: records.length + " bookmarks" })
  revalidatePath("/bookmarks")
  revalidatePath("/activity")
  redirect("/bookmarks?success=" + encodeURIComponent("Imported " + records.length + (records.length === 1 ? " bookmark" : " bookmarks")))
}


const updateSchema = schema.extend({ id: z.string().uuid() })

export async function updateBookmark(formData: FormData): Promise<void> {
  const input = updateSchema.safeParse({ id: formData.get("id"), title: formData.get("title"), url: formData.get("url"), collection: formData.get("collection") ?? "General", tags: formData.get("tags") ?? "" })
  const back = detailPath(formData.get("id"))
  if (!input.success) validationFailure(back, input.error.issues)
  const context = await getWorkspaceContext()
  if (!context) actionFailure(back, "access the active workspace")

  const { error } = await context.supabase.from("bookmarks").update({ title: input.data.title, url: input.data.url, collection: input.data.collection, tags: tags(input.data.tags), updated_at: new Date().toISOString() }).eq("id", input.data.id).eq("workspace_id", context.workspaceId).eq("creator_id", context.user.id)
  if (error) actionFailure(back, "update bookmark", error)
  await recordActivity(context, { action: "Updated", entityType: "bookmark", entityId: input.data.id })
  revalidateBookmark(input.data.id)
  revalidatePath("/activity")
}

export async function restoreBookmark(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"))
  const back = detailPath(formData.get("id"))
  if (!id.success) actionFailure(back, "restore bookmark")
  const context = await getWorkspaceContext()
  if (!context) actionFailure(back, "access the active workspace")

  const { error } = await context.supabase.from("bookmarks").update({ archived_at: null, updated_at: new Date().toISOString() }).eq("id", id.data).eq("workspace_id", context.workspaceId).eq("creator_id", context.user.id)
  if (error) actionFailure(back, "restore bookmark", error)
  await recordActivity(context, { action: "Restored", entityType: "bookmark", entityId: id.data })
  revalidateBookmark(id.data)
  revalidatePath("/activity")
}
