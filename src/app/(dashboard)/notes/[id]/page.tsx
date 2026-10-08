import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { NoteDetail } from "@/components/notes/note-detail"
import { relativeTime } from "@/lib/relative-time"
import { formatDateTime } from "@/lib/format-date"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { archiveNote, deleteNotePermanently, restoreNote, restoreNoteVersion, toggleNoteFavorite, trashNote, updateNote } from "../actions"

export default async function NotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const { id } = await params
  const { error, success } = await searchParams
  if (!z.string().uuid().safeParse(id).success) notFound()
  const context = await getWorkspaceContext()
  if (!context) return null

  const { data: note } = await context.supabase
    .from("notes")
    .select("id,title,content,folder,tags,is_favorite,author_id,created_at,updated_at,archived_at,deleted_at")
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle()
  if (!note) notFound()

  const [{ data: versions }, { data: folderRows }, { data: profile }] = await Promise.all([
    context.supabase.from("note_versions").select("id,title,created_at").eq("note_id", note.id).order("created_at", { ascending: false }).limit(20),
    context.supabase.from("notes").select("folder").eq("workspace_id", context.workspaceId).is("deleted_at", null),
    context.supabase.from("profiles").select("display_name").eq("id", context.user.id).maybeSingle(),
  ])
  const isAuthor = note.author_id === context.user.id
  // Profiles are only readable by their owner, so other authors stay anonymous.
  const authorName = isAuthor ? profile?.display_name ?? context.user.email?.split("@")[0] ?? "You" : "A workspace member"
  const now = new Date()
  const backHref = note.deleted_at ? "/notes?view=trash" : note.archived_at ? "/notes?view=archived" : "/notes"

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb">
        <Link href={backHref}>Notes</Link>
        <span aria-hidden>/</span>
        <span className="truncate">{note.title}</span>
      </nav>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
      <div className="mt-5">
        <NoteDetail
          note={{ ...note, tags: note.tags ?? [] }}
          versions={(versions ?? []).map((version) => ({ id: version.id, title: version.title, createdAt: formatDateTime(version.created_at), createdIso: version.created_at, createdLabel: relativeTime(version.created_at, now) }))}
          workspaceId={context.workspaceId}
          folders={Array.from(new Set((folderRows ?? []).map((row) => row.folder)))}
          canEdit={isAuthor}
          authorName={authorName}
          createdAt={formatDateTime(note.created_at)}
          createdIso={note.created_at}
          createdLabel={relativeTime(note.created_at, now)}
          updatedLabel={relativeTime(note.updated_at, now) + " · " + formatDateTime(note.updated_at)}
          actions={{ updateNote, restoreNoteVersion, archiveNote, trashNote, restoreNote, deleteNotePermanently, toggleFavorite: toggleNoteFavorite }}
        />
      </div>
    </div>
  )
}
