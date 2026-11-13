import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { FIELD, decryptField } from "@/lib/data-crypto.mjs"
import { NoteDetail } from "@/components/notes/note-detail"
import { relativeTime } from "@/lib/relative-time"
import { formatDateTime } from "@/lib/format-date"
import { ancestorRows, childrenByParent, descendantIds, flattenTree } from "@/lib/note-tree.mjs"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { archiveNote, createNote, deleteNotePermanently, reorderSubPages, restoreNote, restoreNoteVersion, toggleNoteFavorite, trashNote, updateNote } from "../actions"

export default async function NotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const { id } = await params
  const { error, success } = await searchParams
  if (!z.string().uuid().safeParse(id).success) notFound()
  const context = await getWorkspaceContext()
  if (!context) return null

  const { data: note } = await context.supabase
    .from("notes")
    .select("id,title,content,folder,tags,is_favorite,author_id,parent_id,created_at,updated_at,archived_at,deleted_at")
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle()
  if (!note) notFound()
  const content = decryptField(FIELD.NOTE_CONTENT, note.content)

  const [{ data: versions }, { data: folderRows }, { data: profile }, { data: treeRows }] = await Promise.all([
    context.supabase.from("note_versions").select("id,title,created_at").eq("note_id", note.id).order("created_at", { ascending: false }).limit(20),
    context.supabase.from("notes").select("folder").eq("workspace_id", context.workspaceId).is("deleted_at", null),
    context.supabase.from("profiles").select("display_name").eq("id", context.user.id).maybeSingle(),
    // Active notes only (titles and links, no content) for the Pages panel, breadcrumb and the Parent picker.
    context.supabase.from("notes").select("id,title,parent_id,author_id,sort_order,created_at").eq("workspace_id", context.workspaceId).is("deleted_at", null).is("archived_at", null).order("created_at", { ascending: true }).limit(2000),
  ])
  const isAuthor = note.author_id === context.user.id
  // Profiles are only readable by their owner, so other authors stay anonymous.
  const authorName = isAuthor ? profile?.display_name ?? context.user.email?.split("@")[0] ?? "You" : "A workspace member"
  const now = new Date()
  const backHref = note.deleted_at ? "/notes?view=trash" : note.archived_at ? "/notes?view=archived" : "/notes"

  const active = !note.deleted_at && !note.archived_at
  const rows = treeRows ?? []
  const ancestors = active ? ancestorRows(rows, note.id) : []
  const rootId = ancestors[0]?.id ?? note.id
  const inTree = new Set([rootId, ...descendantIds(rows, rootId)])
  const pages = active ? rows.filter((row) => inTree.has(row.id)).map((row) => ({ id: row.id, title: row.title, parentId: row.parent_id, sortOrder: row.sort_order, createdAt: row.created_at })) : []
  const parent = ancestors.at(-1) ?? null
  const subPages = active ? (childrenByParent(rows).get(note.id) ?? []).map((row) => ({ id: row.id, title: row.title })) : []
  // A note can move under any of your own active notes except itself and its own sub-pages.
  const ownSubtree = new Set([note.id, ...descendantIds(rows, note.id)])
  const parentOptions = isAuthor
    ? flattenTree(rows.filter((row) => row.author_id === context.user.id && !ownSubtree.has(row.id))).map((row) => ({ value: row.id, label: "\u00a0\u00a0".repeat(row.depth) + row.title }))
    : []

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb">
        <Link href={backHref}>Notes</Link>
        {ancestors.map((ancestor) => <span key={ancestor.id} className="contents"><span aria-hidden>/</span><Link href={"/notes/" + ancestor.id} className="truncate">{ancestor.title}</Link></span>)}
        <span aria-hidden>/</span>
        <span className="truncate">{note.title}</span>
      </nav>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
      <div className="mt-5">
        <NoteDetail
          key={note.id}
          note={{ ...note, content, tags: note.tags ?? [] }}
          versions={(versions ?? []).map((version) => ({ id: version.id, title: version.title, createdAt: formatDateTime(version.created_at), createdIso: version.created_at, createdLabel: relativeTime(version.created_at, now) }))}
          workspaceId={context.workspaceId}
          folders={Array.from(new Set((folderRows ?? []).map((row) => row.folder)))}
          canEdit={isAuthor}
          authorName={authorName}
          createdAt={formatDateTime(note.created_at)}
          createdIso={note.created_at}
          createdLabel={relativeTime(note.created_at, now)}
          updatedLabel={relativeTime(note.updated_at, now) + " · " + formatDateTime(note.updated_at)}
          pages={pages}
          parent={parent ? { id: parent.id, title: parent.title } : null}
          subPages={subPages}
          parentOptions={parentOptions}
          actions={{ updateNote, restoreNoteVersion, archiveNote, trashNote, restoreNote, deleteNotePermanently, toggleFavorite: toggleNoteFavorite, createNote, reorderSubPages }}
        />
      </div>
    </div>
  )
}
