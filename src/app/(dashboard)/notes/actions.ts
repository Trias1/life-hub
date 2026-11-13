"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { actionFailure } from "@/lib/actions/server"
import { getWorkspaceContext, recordActivity } from "@/lib/workspace/server"
import { FIELD, decryptField, encryptField } from "@/lib/data-crypto.mjs"
import { IMPORT_LIMITS, entryHtml, parseNotesFile } from "@/lib/notes-import.mjs"
import { descendantIds } from "@/lib/note-tree.mjs"
import { DOCUMENT_LIMITS, documentToNote } from "@/lib/document-import"
import { checkRequestLimit } from "@/lib/request-rate-limit.mjs"

// Note HTML: room for long runbooks imported from Markdown or Word.
const NOTE_CONTENT_MAX = 150_000
const noteSchema = z.object({ title: z.string().trim().min(1).max(160), content: z.string().max(NOTE_CONTENT_MAX), folder: z.string().trim().min(1).max(80), tags: z.string().max(500) })
// "" means top level (no parent).
const parentIdSchema = z.union([z.literal(""), z.string().uuid()])
const updateSchema = z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(160), content: z.string().max(NOTE_CONTENT_MAX), folder: z.string().trim().min(1).max(80).optional(), tags: z.string().max(500).optional(), parentId: parentIdSchema.optional() })
const versionSchema = z.object({ noteId: z.string().uuid(), versionId: z.string().uuid() })
const lifecycleSchema = z.object({ id: z.string().uuid(), from: z.enum(["archived", "trash"]) })
type NoteActionResult = { error?: string; title?: string; content?: string }
type Context = NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>

/** The note and all of its sub-pages. Sub-pages always share the author (enforced in 0035), so this is scoped to the caller's own notes. */
async function ownSubtree(context: Context, id: string): Promise<string[]> {
  const { data, error } = await context.supabase.from("notes").select("id,parent_id").eq("workspace_id", context.workspaceId).eq("author_id", context.user.id)
  if (error) throw error
  return [id, ...descendantIds(data ?? [], id)]
}

/** An active note of yours in this workspace that a sub-page can go under. */
async function findOwnActiveNote(context: Context, id: string) {
  const { data } = await context.supabase.from("notes").select("id,folder").eq("id", id).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).is("deleted_at", null).is("archived_at", null).maybeSingle()
  return data
}

function parentErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "23514") return error.message?.includes("levels") ? "Sub-pages can be nested at most 10 levels deep." : "A note can't go under itself or one of its own sub-pages."
  if (error.code === "42501" || error.code === "23503") return "Sub-pages can only go under your own active notes."
  return "Note could not be saved."
}

function parseTags(value: string) {
  return Array.from(new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 12)
}

export async function createNote(formData: FormData): Promise<void> {
  // A sub-page ("Add sub-page" in the Pages panel) sends only a title and its parent.
  const parentId = parentIdSchema.optional().safeParse(formData.get("parentId") ?? undefined)
  if (!parentId.success) actionFailure("/notes/new", "create note")
  const failurePath = parentId.data ? "/notes/" + parentId.data : "/notes/new"
  const context = await getWorkspaceContext()
  if (!context) actionFailure(failurePath, "access the active workspace")
  const parent = parentId.data ? await findOwnActiveNote(context, parentId.data) : null
  if (parentId.data && !parent) actionFailure(failurePath, "add a sub-page", new Error("Parent note not found"))

  const input = noteSchema.safeParse({ title: formData.get("title"), content: formData.get("content") ?? "", folder: formData.get("folder") ?? parent?.folder ?? "General", tags: formData.get("tags") ?? "" })
  if (!input.success) actionFailure(failurePath, parent ? "add a sub-page" : "create note")

  const { data: note, error } = await context.supabase.from("notes").insert({ title: input.data.title, content: encryptField(FIELD.NOTE_CONTENT, input.data.content), folder: input.data.folder, tags: parseTags(input.data.tags), parent_id: parent?.id ?? null, workspace_id: context.workspaceId, author_id: context.user.id }).select("id").single()
  if (error) actionFailure(failurePath, "save note", error)
  if (parent) revalidatePath("/notes/" + parent.id)
  await recordActivity(context, { action: "Created", entityType: "note", entityId: note.id })
  revalidatePath("/notes")
  revalidatePath("/activity")
  redirect("/notes/" + note.id + "?success=Note%20created")
}

export async function updateNote(formData: FormData): Promise<NoteActionResult> {
  const input = updateSchema.safeParse({ id: formData.get("id"), title: formData.get("title"), content: formData.get("content"), folder: formData.get("folder") ?? undefined, tags: formData.get("tags") ?? undefined, parentId: formData.get("parentId") ?? undefined })
  if (!input.success) return { error: "A title and valid content are required." }
  const context = await getWorkspaceContext()
  if (!context) return { error: "No active workspace found." }

  const { data: note, error: noteError } = await context.supabase.from("notes").select("id,workspace_id,title,content,folder,tags,parent_id").eq("id", input.data.id).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).maybeSingle()
  if (noteError || !note) return { error: "Only the note author can edit this note." }
  const folder = input.data.folder ?? note.folder
  const tags = input.data.tags === undefined ? note.tags : parseTags(input.data.tags)
  const oldContent = decryptField(FIELD.NOTE_CONTENT, note.content)
  const textChanged = note.title !== input.data.title || oldContent !== input.data.content
  const parentId = input.data.parentId === undefined ? note.parent_id : input.data.parentId || null
  const parentChanged = parentId !== note.parent_id
  if (parentChanged && parentId) {
    // Checked here for a clear message; the database enforces the same rules (0035).
    if (!(await findOwnActiveNote(context, parentId))) return { error: "Sub-pages can only go under your own active notes." }
    if ((await ownSubtree(context, note.id)).includes(parentId)) return { error: "A note can't go under itself or one of its own sub-pages." }
  }
  const detailsChanged = parentChanged || folder !== note.folder || JSON.stringify(tags) !== JSON.stringify(note.tags)
  if (!textChanged && !detailsChanged) return { title: note.title, content: oldContent }

  const { error: updateError } = await context.supabase.from("notes").update({ title: input.data.title, content: encryptField(FIELD.NOTE_CONTENT, input.data.content), folder, tags, parent_id: parentId, updated_at: new Date().toISOString() }).eq("id", note.id).eq("author_id", context.user.id)
  if (updateError) return { error: parentErrorMessage(updateError) }
  revalidatePath("/notes/" + note.id)
  if (note.parent_id) revalidatePath("/notes/" + note.parent_id)
  if (parentId) revalidatePath("/notes/" + parentId)
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
  data.set("content", decryptField(FIELD.NOTE_CONTENT, version.content))
  return updateNote(data)
}

export async function archiveNote(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"))
  if (!id.success) actionFailure("/notes", "archive note")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/notes", "access the active workspace")

  // Sub-pages go with their page, like closing a folder.
  const ids = await ownSubtree(context, id.data).catch((error) => actionFailure("/notes", "archive note", error))
  const { error } = await context.supabase.from("notes").update({ archived_at: new Date().toISOString() }).in("id", ids).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).is("archived_at", null).is("deleted_at", null)
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

  const ids = await ownSubtree(context, id.data).catch((error) => actionFailure("/notes", "trash note", error))
  const { error } = await context.supabase.from("notes").update({ deleted_at: new Date().toISOString() }).in("id", ids).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).is("deleted_at", null)
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

  // Bring its sub-pages back too, and make it top-level if its own parent is still archived or in the trash.
  const subPages = (await ownSubtree(context, result.data.id).catch((error) => actionFailure(sourcePath, "restore sub-pages", error))).slice(1)
  if (subPages.length) {
    const restore = context.supabase.from("notes").update(update).in("id", subPages).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id)
    const { error: subError } = input.data.from === "archived" ? await restore.not("archived_at", "is", null).is("deleted_at", null) : await restore.not("deleted_at", "is", null)
    if (subError) actionFailure(sourcePath, "restore sub-pages", subError)
  }
  const { data: restored } = await context.supabase.from("notes").select("parent_id").eq("id", result.data.id).maybeSingle()
  if (restored?.parent_id && !(await findOwnActiveNote(context, restored.parent_id))) {
    await context.supabase.from("notes").update({ parent_id: null }).eq("id", result.data.id).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id)
  }

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

  // Its sub-pages are in the trash with it; any that were restored on their own become top-level (0035).
  const ids = await ownSubtree(context, note.id).catch((error) => actionFailure("/notes?view=trash", "delete note permanently", error))
  const { data: deleted, error } = await context.supabase.from("notes").delete().in("id", ids).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).not("deleted_at", "is", null).select("id")
  if (error || !deleted?.some((row) => row.id === note.id)) actionFailure("/notes?view=trash", "delete note permanently", error ?? new Error("Note not found"))

  await recordActivity(context, { action: "Deleted permanently", entityType: "note", entityId: note.id })
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

const importOptionsSchema = z.object({ folder: z.string().trim().min(1).max(80), tags: z.string().max(500) })
const importedStamp = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" })

function importFailure(message: string): never {
  redirect("/notes/import?error=" + encodeURIComponent(message))
}

/**
 * Creates notes from a plain-text list ("title : text" per note). The file is re-read here with the
 * same parser the preview used. A title that matches one of your active notes (ignoring case) is
 * appended to that note, and its previous content is kept in the version history.
 */
export async function importNotes(formData: FormData): Promise<void> {
  const text = formData.get("text")
  if (typeof text !== "string" || !text.trim()) importFailure("Choose a .txt file with at least one \"title : text\" line.")
  if (new TextEncoder().encode(text).byteLength > IMPORT_LIMITS.bytes) importFailure("That file is larger than 200 KB. Split it into smaller files.")
  const options = importOptionsSchema.safeParse({ folder: formData.get("folder") || "General", tags: formData.get("tags") ?? "" })
  if (!options.success) importFailure("Use a folder name of up to 80 characters and fewer tags.")
  const { entries } = parseNotesFile(text)
  if (!entries.length) importFailure("No notes found. Write each one as \"title : text\" on its own line.")
  if (entries.length > IMPORT_LIMITS.entries) importFailure("That file has more than 100 notes. Split it into smaller files.")
  const context = await getWorkspaceContext()
  if (!context) importFailure("Your session expired. Sign in again.")

  const { data: existing, error: existingError } = await context.supabase.from("notes").select("id,title,content,workspace_id").eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).is("deleted_at", null).is("archived_at", null).order("updated_at", { ascending: false })
  if (existingError) actionFailure("/notes/import", "import notes", existingError)
  const byTitle = new Map<string, NonNullable<typeof existing>[number]>()
  for (const note of existing ?? []) if (!byTitle.has(note.title.trim().toLowerCase())) byTitle.set(note.title.trim().toLowerCase(), note)
  const tags = parseTags(options.data.tags)
  const stamp = importedStamp.format(new Date())
  let created = 0
  let appended = 0
  const failed: string[] = []

  for (const entry of entries) {
    const html = entryHtml(entry)
    const match = byTitle.get(entry.title.toLowerCase())
    if (match) {
      let previous: string
      try {
        previous = decryptField(FIELD.NOTE_CONTENT, match.content)
      } catch {
        failed.push(entry.title)
        continue
      }
      const next = previous + "<hr><p>Imported " + stamp + "</p>" + html
      if (next.length > NOTE_CONTENT_MAX) {
        failed.push(entry.title)
        continue
      }
      // Keep what was there before, so the import can be undone from the note's history.
      const { error: versionError } = await context.supabase.from("note_versions").insert({ note_id: match.id, workspace_id: match.workspace_id, editor_id: context.user.id, title: match.title, content: match.content })
      const { error } = versionError ? { error: versionError } : await context.supabase.from("notes").update({ content: encryptField(FIELD.NOTE_CONTENT, next), updated_at: new Date().toISOString() }).eq("id", match.id).eq("author_id", context.user.id)
      if (error) failed.push(entry.title)
      else appended++
    } else {
      if (html.length > NOTE_CONTENT_MAX) {
        failed.push(entry.title)
        continue
      }
      const { error } = await context.supabase.from("notes").insert({ title: entry.title, content: encryptField(FIELD.NOTE_CONTENT, html), folder: options.data.folder, tags, workspace_id: context.workspaceId, author_id: context.user.id })
      if (error) failed.push(entry.title)
      else created++
    }
  }

  if (created + appended) await recordActivity(context, { action: "Imported " + (created + appended) + (created + appended === 1 ? " note" : " notes"), entityType: "note", link: "/notes" })
  revalidatePath("/notes")
  revalidatePath("/activity")
  const summary = [created && created + " new", appended && appended + " added to existing notes"].filter(Boolean).join(", ")
  if (failed.length) redirect("/notes?error=" + encodeURIComponent((summary ? "Imported " + summary + ". " : "") + "Could not import: " + failed.slice(0, 5).join(", ") + (failed.length > 5 ? " and " + (failed.length - 5) + " more" : "") + " (too long or unreadable)."))
  redirect("/notes?success=" + encodeURIComponent("Imported " + summary))
}

const reorderSchema = z.object({ parentId: z.string().uuid(), order: z.array(z.string().uuid()).min(1).max(500) })

/** Saves the order of a page's sub-pages (drag and drop in the Pages panel). Only the author's own sub-pages. */
export async function reorderSubPages(parentId: string, order: string[]): Promise<{ error?: string }> {
  const input = reorderSchema.safeParse({ parentId, order })
  if (!input.success || new Set(input.data.order).size !== input.data.order.length) return { error: "That order could not be saved." }
  const context = await getWorkspaceContext()
  if (!context) return { error: "No active workspace found." }

  const { data: children, error } = await context.supabase.from("notes").select("id").eq("parent_id", input.data.parentId).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).is("deleted_at", null).is("archived_at", null)
  if (error) return { error: "That order could not be saved." }
  const own = new Set((children ?? []).map((row) => row.id))
  if (own.size !== input.data.order.length || input.data.order.some((id) => !own.has(id))) return { error: "The sub-pages changed. Reload and try again." }

  const results = await Promise.all(input.data.order.map((id, index) => context.supabase.from("notes").update({ sort_order: index }).eq("id", id).eq("parent_id", input.data.parentId).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id)))
  if (results.some((result) => result.error)) return { error: "That order could not be saved." }
  revalidatePath("/notes")
  revalidatePath("/notes/" + input.data.parentId)
  for (const id of input.data.order) revalidatePath("/notes/" + id)
  return {}
}

/**
 * Markdown, Word (.docx) and plain-text files, one note each, optionally under one of your notes.
 * The files are converted here on the server (the browser only previews names), never stored.
 */
export async function importDocuments(formData: FormData): Promise<void> {
  const files = formData.getAll("files").filter((value): value is File => typeof value === "object" && value !== null && "arrayBuffer" in value && (value as File).size > 0)
  if (!files.length) importFailure("Choose at least one .md, .docx or .txt file.")
  if (files.length > DOCUMENT_LIMITS.files) importFailure("Choose up to " + DOCUMENT_LIMITS.files + " files at a time.")
  const options = importOptionsSchema.safeParse({ folder: formData.get("folder") || "General", tags: formData.get("tags") ?? "" })
  const parentId = parentIdSchema.optional().safeParse(formData.get("parentId") || undefined)
  if (!options.success || !parentId.success) importFailure("Use a folder name of up to 80 characters and fewer tags.")
  const context = await getWorkspaceContext()
  if (!context) importFailure("Your session expired. Sign in again.")
  const denied = await checkRequestLimit(context.supabase, "upload")
  if (denied) importFailure(denied.status === 429 ? "Too many imports. Wait a minute and try again." : "Couldn't check the request limit. Try again in a minute.")
  const parent = parentId.data ? await findOwnActiveNote(context, parentId.data) : null
  if (parentId.data && !parent) importFailure("The note to put these under wasn't found. Pick another one.")

  const tags = parseTags(options.data.tags)
  const created: string[] = []
  const failed: string[] = []
  for (const file of files) {
    const note = await documentToNote(file)
    if ("error" in note) {
      failed.push(note.error)
      continue
    }
    if (!note.html.replace(/<[^>]*>/g, "").trim()) {
      failed.push(file.name + " is empty")
      continue
    }
    if (note.html.length > NOTE_CONTENT_MAX) {
      failed.push(file.name + " is too long for one note (split it into smaller files)")
      continue
    }
    const { data, error } = await context.supabase.from("notes").insert({ title: note.title, content: encryptField(FIELD.NOTE_CONTENT, note.html), folder: parent?.folder ?? options.data.folder, tags, parent_id: parent?.id ?? null, workspace_id: context.workspaceId, author_id: context.user.id }).select("id").single()
    if (error || !data) failed.push(file.name + " couldn't be saved")
    else created.push(data.id)
  }

  if (created.length) await recordActivity(context, { action: "Imported " + created.length + (created.length === 1 ? " document" : " documents"), entityType: "note", link: parent ? "/notes/" + parent.id : "/notes" })
  revalidatePath("/notes")
  revalidatePath("/activity")
  if (parent) revalidatePath("/notes/" + parent.id)
  const summary = created.length + (created.length === 1 ? " note" : " notes") + " imported"
  if (failed.length) {
    const message = (created.length ? summary + ". " : "") + "Not imported: " + failed.slice(0, 5).join("; ") + (failed.length > 5 ? " and " + (failed.length - 5) + " more" : "") + "."
    redirect((created.length ? "/notes" : "/notes/import") + "?error=" + encodeURIComponent(message))
  }
  redirect((created.length === 1 ? "/notes/" + created[0] : parent ? "/notes/" + parent.id : "/notes") + "?success=" + encodeURIComponent(summary))
}
