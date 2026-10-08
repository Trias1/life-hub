"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { actionFailure } from "@/lib/actions/server"
import { getWorkspaceContext, recordActivity } from "@/lib/workspace/server"

const noteSchema = z.object({ title: z.string().trim().min(1).max(160), content: z.string().max(10000), folder: z.string().trim().min(1).max(80), tags: z.string().max(500) })
const updateSchema = z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(160), content: z.string().max(10000), folder: z.string().trim().min(1).max(80).optional(), tags: z.string().max(500).optional() })
const versionSchema = z.object({ noteId: z.string().uuid(), versionId: z.string().uuid() })
const lifecycleSchema = z.object({ id: z.string().uuid(), from: z.enum(["archived", "trash"]) })
type NoteActionResult = { error?: string; title?: string; content?: string }

function parseTags(value: string) {
  return Array.from(new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 12)
}

export async function createNote(formData: FormData): Promise<void> {
  const input = noteSchema.safeParse({ title: formData.get("title"), content: formData.get("content") ?? "", folder: formData.get("folder") ?? "General", tags: formData.get("tags") ?? "" })
  if (!input.success) actionFailure("/notes/new", "create note")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/notes/new", "access the active workspace")

  const { data: note, error } = await context.supabase.from("notes").insert({ title: input.data.title, content: input.data.content, folder: input.data.folder, tags: parseTags(input.data.tags), workspace_id: context.workspaceId, author_id: context.user.id }).select("id").single()
  if (error) actionFailure("/notes/new", "save note", error)
  await recordActivity(context, { action: "Created", entityType: "note", entityId: note.id })
  revalidatePath("/notes")
  revalidatePath("/activity")
  redirect("/notes/" + note.id + "?success=Note%20created")
}

export async function updateNote(formData: FormData): Promise<NoteActionResult> {
  const input = updateSchema.safeParse({ id: formData.get("id"), title: formData.get("title"), content: formData.get("content"), folder: formData.get("folder") ?? undefined, tags: formData.get("tags") ?? undefined })
  if (!input.success) return { error: "A title and valid content are required." }
  const context = await getWorkspaceContext()
  if (!context) return { error: "No active workspace found." }

  const { data: note, error: noteError } = await context.supabase.from("notes").select("id,workspace_id,title,content,folder,tags").eq("id", input.data.id).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).maybeSingle()
  if (noteError || !note) return { error: "Only the note author can edit this note." }
  const folder = input.data.folder ?? note.folder
  const tags = input.data.tags === undefined ? note.tags : parseTags(input.data.tags)
  const textChanged = note.title !== input.data.title || note.content !== input.data.content
  const detailsChanged = folder !== note.folder || JSON.stringify(tags) !== JSON.stringify(note.tags)
  if (!textChanged && !detailsChanged) return { title: note.title, content: note.content }

  const { error: updateError } = await context.supabase.from("notes").update({ title: input.data.title, content: input.data.content, folder, tags, updated_at: new Date().toISOString() }).eq("id", note.id).eq("author_id", context.user.id)
  if (updateError) return { error: "Note could not be saved." }
  revalidatePath("/notes/" + note.id)
  if (!textChanged) {
    revalidatePath("/notes")
    return { title: input.data.title, content: input.data.content }
  }
  const { error: versionError } = await context.supabase.from("note_versions").insert({ note_id: note.id, workspace_id: note.workspace_id, editor_id: context.user.id, title: note.title, content: note.content })
  if (versionError) return { error: "Note saved, but version history could not be recorded." }
  await recordActivity(context, { action: "Updated", entityType: "note", entityId: note.id, resourceName: input.data.title, link: "/notes/" + note.id })
  revalidatePath("/notes")
  revalidatePath("/activity")
  return { title: input.data.title, content: input.data.content }
}

export async function restoreNoteVersion(formData: FormData): Promise<NoteActionResult> {
  const input = versionSchema.safeParse({ noteId: formData.get("noteId"), versionId: formData.get("versionId") })
  if (!input.success) return { error: "Invalid version." }
  const context = await getWorkspaceContext()
  if (!context) return { error: "No active workspace found." }

  const { data: version, error } = await context.supabase.from("note_versions").select("title,content,workspace_id").eq("id", input.data.versionId).eq("note_id", input.data.noteId).eq("workspace_id", context.workspaceId).maybeSingle()
  if (error || !version) return { error: "Version not found." }
  const data = new FormData()
  data.set("id", input.data.noteId)
  data.set("title", version.title)
  data.set("content", version.content)
  return updateNote(data)
}

export async function archiveNote(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"))
  if (!id.success) actionFailure("/notes", "archive note")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/notes", "access the active workspace")

  const { error } = await context.supabase.from("notes").update({ archived_at: new Date().toISOString() }).eq("id", id.data).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id)
  if (error) actionFailure("/notes", "archive note", error)
  await recordActivity(context, { action: "Archived", entityType: "note", entityId: id.data })
  revalidatePath("/notes")
  revalidatePath("/notes/" + id.data)
  revalidatePath("/activity")
  redirect("/notes?success=Note%20archived")
}

export async function trashNote(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"))
  if (!id.success) actionFailure("/notes", "trash note")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/notes", "access the active workspace")

  const { error } = await context.supabase.from("notes").update({ deleted_at: new Date().toISOString() }).eq("id", id.data).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id)
  if (error) actionFailure("/notes", "trash note", error)
  await recordActivity(context, { action: "Trashed", entityType: "note", entityId: id.data })
  revalidatePath("/notes")
  revalidatePath("/notes/" + id.data)
  revalidatePath("/activity")
  redirect("/notes?success=Note%20moved%20to%20trash")
}

export async function restoreNote(formData: FormData): Promise<void> {
  const input = lifecycleSchema.safeParse({ id: formData.get("id"), from: formData.get("from") })
  if (!input.success) actionFailure("/notes", "restore note")
  const sourcePath = "/notes?view=" + input.data.from
  const context = await getWorkspaceContext()
  if (!context) actionFailure(sourcePath, "access the active workspace")

  const update = { archived_at: null, deleted_at: null, updated_at: new Date().toISOString() }
  const result = input.data.from === "archived"
    ? await context.supabase.from("notes").update(update).eq("id", input.data.id).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).not("archived_at", "is", null).is("deleted_at", null).select("id").maybeSingle()
    : await context.supabase.from("notes").update(update).eq("id", input.data.id).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).not("deleted_at", "is", null).select("id").maybeSingle()
  if (result.error || !result.data) actionFailure(sourcePath, "restore note", result.error ?? new Error("Note not found"))

  await recordActivity(context, { action: "Restored", entityType: "note", entityId: result.data.id })
  revalidatePath("/notes")
  revalidatePath("/activity")
  revalidatePath("/notes/" + result.data.id)
  redirect("/notes/" + result.data.id + "?success=Note%20restored")
}

export async function deleteNotePermanently(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"))
  if (!id.success) actionFailure("/notes?view=trash", "delete note permanently")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/notes?view=trash", "access the active workspace")

  const { data: note, error: readError } = await context.supabase.from("notes").select("id").eq("id", id.data).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).not("deleted_at", "is", null).maybeSingle()
  if (readError || !note) actionFailure("/notes?view=trash", "delete note permanently", readError ?? new Error("Note not found"))

  const { data: deleted, error } = await context.supabase.from("notes").delete().eq("id", note.id).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).not("deleted_at", "is", null).select("id").maybeSingle()
  if (error || !deleted) actionFailure("/notes?view=trash", "delete note permanently", error ?? new Error("Note not found"))

  await recordActivity(context, { action: "Deleted permanently", entityType: "note", entityId: deleted.id })
  revalidatePath("/notes")
  revalidatePath("/activity")
  redirect("/notes?view=trash&success=Note%20deleted%20permanently")
}

export async function toggleNoteFavorite(formData: FormData): Promise<void> {
  const input = z.object({ id: z.string().uuid(), favorite: z.enum(["true", "false"]) }).safeParse({ id: formData.get("id"), favorite: formData.get("favorite") })
  if (!input.success) actionFailure("/notes", "update note")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/notes", "access the active workspace")

  const { error } = await context.supabase.from("notes").update({ is_favorite: input.data.favorite === "true" }).eq("id", input.data.id).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id)
  if (error) actionFailure("/notes", "update note", error)
  await recordActivity(context, { action: input.data.favorite === "true" ? "Favorited" : "Unfavorited", entityType: "note", entityId: input.data.id })
  revalidatePath("/notes")
  revalidatePath("/notes/" + input.data.id)
  revalidatePath("/activity")
}
