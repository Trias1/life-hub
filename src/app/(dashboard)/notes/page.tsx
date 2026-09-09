import { getWorkspaceContext } from "@/lib/workspace/server"
import Link from "next/link"
import { NoteComposer } from "@/components/note-composer"
import { NotesWorkspace } from "@/components/notes-workspace"
import { archiveNote, createNote, deleteNotePermanently, restoreNote, restoreNoteVersion, toggleNoteFavorite, trashNote, updateNote } from "./actions"

type NotesView = "active" | "archived" | "trash"

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; view?: NotesView; favorite?: string; note?: string }> }) {
  const { error, success, view = "active", favorite = "false", note } = await searchParams
  const currentView: NotesView = ["active", "archived", "trash"].includes(view) ? view : "active"
  const context = await getWorkspaceContext(); if (!context) return null; const supabase = context.supabase; const workspaceIds = [context.workspaceId]
  let notesQuery = supabase.from("notes").select("id,title,content,folder,tags,is_favorite,updated_at,archived_at,deleted_at").in("workspace_id", workspaceIds)
  if (favorite === "true") notesQuery = notesQuery.eq("is_favorite", true); if (currentView === "active") notesQuery = notesQuery.is("deleted_at", null).is("archived_at", null); if (currentView === "archived") notesQuery = notesQuery.is("deleted_at", null).not("archived_at", "is", null); if (currentView === "trash") notesQuery = notesQuery.not("deleted_at", "is", null)
  const { data: notes } = workspaceIds.length ? await notesQuery.order("updated_at", { ascending: false }) : { data: [] }
  const { data: versions } = notes?.length ? await supabase.from("note_versions").select("id,note_id,title,content,created_at").in("note_id", notes.map((item) => item.id)).order("created_at", { ascending: false }).limit(80) : { data: [] }
  return <div className="page-container"><header className="page-header"><div><p className="eyebrow">Knowledge base</p><h1 className="page-title">Notes</h1><p className="page-description">Capture ideas, decisions, and working context in one quiet place.</p></div><span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700">{notes?.length ?? 0} notes</span></header><nav aria-label="Notes views" className="mt-6 flex flex-wrap gap-2">{([['active', 'Active'], ['archived', 'Archived'], ['trash', 'Trash']] as const).map(([key, label]) => <Link key={key} href={key === "active" ? "/notes" : "/notes?view=" + key} className={currentView === key ? "button-secondary" : "button-quiet"}>{label}</Link>)}</nav>{error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}{currentView === "active" && <section className="surface mt-8 p-4"><div className="toolbar"><div><p className="eyebrow">Quick capture</p><h2 className="mt-1 text-lg font-semibold">Capture quickly</h2></div><span className="text-xs text-zinc-400">Markdown-friendly</span></div><NoteComposer action={createNote} /></section>}<NotesWorkspace notes={notes ?? []} versions={versions ?? []} selectedNoteId={note} view={currentView} updateNote={updateNote} restoreNoteVersion={restoreNoteVersion} archiveNote={archiveNote} trashNote={trashNote} restoreNote={restoreNote} deleteNotePermanently={deleteNotePermanently} toggleFavorite={toggleNoteFavorite} /></div>
}
