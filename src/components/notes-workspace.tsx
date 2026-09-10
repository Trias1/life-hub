"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import { NoteEditor } from "@/components/note-editor"
import { Star } from "lucide-react"
import { useImageUpload } from "@/hooks/use-image-upload"
import "@uiw/react-md-editor/markdown-editor.css"

const MarkdownEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false })

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

type Note = { id: string; title: string; content: string; folder: string; tags: string[]; is_favorite: boolean; updated_at: string; archived_at: string | null; deleted_at: string | null }
type Version = { id: string; note_id: string; title: string; content: string; created_at: string }
type FormAction = (formData: FormData) => Promise<void>
type EditAction = (formData: FormData) => Promise<{ error?: string; title?: string; content?: string }>
type Props = { workspaceId: string; notes: Note[]; versions: Version[]; selectedNoteId?: string; view: "active" | "archived" | "trash"; updateNote: EditAction; restoreNoteVersion: EditAction; archiveNote: FormAction; trashNote: FormAction; restoreNote: FormAction; deleteNotePermanently: FormAction; toggleFavorite: FormAction }

export function NotesWorkspace({ workspaceId, notes, versions, selectedNoteId, view, updateNote, restoreNoteVersion, archiveNote, trashNote, restoreNote, deleteNotePermanently, toggleFavorite }: Props) {
  const initial = notes.find((note) => note.id === selectedNoteId) ?? notes[0]
  const [selectedId, setSelectedId] = useState(initial?.id ?? "")
  const [draft, setDraft] = useState({ title: initial?.title ?? "", content: initial?.content ?? "" })
  const [savedDraft, setSavedDraft] = useState(draft)
  const [status, setStatus] = useState("")
  const { processImages } = useImageUpload()
  const selected = notes.find((note) => note.id === selectedId)
  const folders = useMemo(() => Array.from(new Set(notes.map((note) => note.folder))).sort(), [notes])
  const selectedVersions = useMemo(() => versions.filter((version) => version.note_id === selectedId).slice(0, 8), [selectedId, versions])
  const pinnedNotes = notes.filter((note) => note.is_favorite)
  const recentNotes = notes.filter((note) => !note.is_favorite)
  const [notesPage, setNotesPage] = useState(1)
  const notesPerPage = 5
  const notesTotalPages = Math.max(1, Math.ceil(recentNotes.length / notesPerPage))
  const pagedRecentNotes = recentNotes.slice((notesPage - 1) * notesPerPage, notesPage * notesPerPage)

  useEffect(() => {
    const next = notes.find((note) => note.id === selectedNoteId) ?? notes[0]
    const nextDraft = { title: next?.title ?? "", content: next?.content ?? "" }
    setSelectedId(next?.id ?? "")
    setDraft(nextDraft)
    setSavedDraft(nextDraft)
    setStatus("")
  }, [notes, selectedNoteId])

  function selectNote(note: Note) {
    setSelectedId(note.id)
    const nextDraft = { title: note.title, content: note.content }
    setDraft(nextDraft)
    setSavedDraft(nextDraft)
    setStatus("")
  }

  useEffect(() => {
    if (!selected || draft.title === savedDraft.title && draft.content === savedDraft.content) return
    const timeout = window.setTimeout(() => {
      void (async () => {
        setStatus("Uploading images…")
        try {
          const content = await processImages(draft.content, workspaceId)
          const formData = new FormData()
          formData.set("id", selected.id)
          formData.set("title", draft.title)
          formData.set("content", content)
          const result = await updateNote(formData)
          if (result.error) {
            setStatus(result.error)
            return
          }
          const nextDraft = { title: draft.title, content }
          setDraft(nextDraft)
          setSavedDraft(nextDraft)
          setStatus("Saved")
        } catch (error) {
          setStatus("Image upload failed: " + (error instanceof Error ? error.message : "Unknown error"))
        }
      })()
    }, 800)
    return () => window.clearTimeout(timeout)
  }, [draft, savedDraft, selected, updateNote])

  async function copyLink() {
    if (!selected) return
    await navigator.clipboard.writeText(window.location.origin + "/notes?note=" + selected.id)
    setStatus("Workspace link copied")
  }

  async function restore(version: Version) {
    const formData = new FormData()
    formData.set("noteId", selectedId)
    formData.set("versionId", version.id)
    const result = await restoreNoteVersion(formData)
    if (result.error) {
      setStatus(result.error)
      return
    }
    const nextDraft = { title: result.title ?? version.title, content: result.content ?? version.content }
    setDraft(nextDraft)
    setSavedDraft(nextDraft)
    setStatus("Version restored")
  }

  function noteButton(note: Note) {
    return <button key={note.id} type="button" onClick={() => selectNote(note)} className={'w-full rounded-xl px-3 py-3 text-left transition ' + (note.id === selectedId ? "bg-[var(--surface-muted)]" : "hover:bg-[var(--surface-muted)]/70")}><div className="flex items-start gap-2"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{note.title}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-zinc-500">{stripHtml(note.content) || "No content yet."}</span></span>{note.is_favorite && <Star size={12} className="shrink-0 fill-[var(--accent)] text-[var(--accent)]" aria-label="Pinned" />}</div>{note.tags?.length ? <span className="mt-2 flex flex-wrap gap-1">{note.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] text-zinc-500">#{tag}</span>)}</span> : null}</button>
  }

  if (!notes.length) return <div className="empty-state surface mt-8"><h2 className="font-semibold">No notes in {view}</h2><p>{view === "active" ? "Create your first note above and keep the important stuff close." : "Items moved here will appear in this view."}</p></div>

  return <section className="surface mt-8 overflow-hidden"><div className="notes-workspace-grid grid min-h-[34rem] lg:grid-cols-[12rem_15rem_minmax(0,1fr)]"><aside className="notes-folders-panel border-b p-4 lg:border-b-0 lg:border-r"><p className="eyebrow">Folders</p><button type="button" className="mt-4 block text-sm font-semibold text-[var(--accent)]">All notes <span className="text-zinc-500">{notes.length}</span></button>{folders.map((folder) => <p key={folder} className="mt-3 truncate text-sm text-zinc-500">{folder}</p>)}<p className="mt-8 text-xs leading-5 text-zinc-400">Choose a folder while capturing a note. New folders can be added from the capture form.</p></aside><div className="border-b p-3 lg:border-b-0 lg:border-r"><div className="flex items-center justify-between px-3"><p className="eyebrow">Notes</p><span className="text-xs text-zinc-500">{notes.length}</span></div>{pinnedNotes.length ? <div className="mt-4"><p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Pinned</p><div className="mt-2 space-y-1">{pinnedNotes.map(noteButton)}</div></div> : null}<div className="mt-4"><p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Recent</p><div className="mt-2 space-y-1">{(recentNotes.length ? pagedRecentNotes : pinnedNotes).map(noteButton)}</div>{recentNotes.length > notesPerPage && <div className="mt-3 flex items-center justify-between px-3 text-xs text-zinc-500"><button type="button" onClick={() => setNotesPage((value) => Math.max(1, value - 1))} disabled={notesPage <= 1} className="button-quiet min-h-0 px-2 py-1 text-xs disabled:opacity-40">Prev</button><span>Page {notesPage} of {notesTotalPages}</span><button type="button" onClick={() => setNotesPage((value) => Math.min(notesTotalPages, value + 1))} disabled={notesPage >= notesTotalPages} className="button-quiet min-h-0 px-2 py-1 text-xs disabled:opacity-40">Next</button></div>}</div></div><div className="min-w-0 p-5">{selected ? <><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-zinc-500">{selected.folder} · Updated {new Date(selected.updated_at).toLocaleDateString()}</p>{selected.tags?.length ? <div className="mt-2 flex flex-wrap gap-1">{selected.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] text-zinc-500">#{tag}</span>)}</div> : null}</div><div className="flex items-center gap-2"><button type="button" onClick={() => void copyLink()} className="button-quiet min-h-0 px-2 py-1 text-xs">Share</button><form action={toggleFavorite}><input type="hidden" name="id" value={selected.id} /><input type="hidden" name="favorite" value={selected.is_favorite ? "false" : "true"} /><button className="button-quiet min-h-0 px-2 py-1 text-xs">{selected.is_favorite ? "Unpin" : "Pin"}</button></form></div></div><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} aria-label="Note title" className="mt-4 w-full bg-transparent text-2xl font-semibold outline-none" /><NoteEditor value={draft.content} onChange={(content) => setDraft({ ...draft, content })} workspaceId={workspaceId} placeholder="Write something…" height={320} /><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div className="flex gap-2">{view === "active" && <><form action={archiveNote}><input type="hidden" name="id" value={selected.id} /><button className="button-quiet min-h-0 px-2 py-1 text-xs">Archive</button></form><form action={trashNote}><input type="hidden" name="id" value={selected.id} /><button className="button-quiet min-h-0 px-2 py-1 text-xs text-red-600">Trash</button></form></>}{view === "archived" && <form action={restoreNote}><input type="hidden" name="id" value={selected.id} /><input type="hidden" name="from" value="archived" /><button className="button-secondary min-h-0 px-2 py-1 text-xs">Restore</button></form>}{view === "trash" && <><form action={restoreNote}><input type="hidden" name="id" value={selected.id} /><input type="hidden" name="from" value="trash" /><button className="button-secondary min-h-0 px-2 py-1 text-xs">Restore</button></form><form action={deleteNotePermanently} onSubmit={(event) => { if (!window.confirm("Delete this note permanently? This cannot be undone.")) event.preventDefault() }}><input type="hidden" name="id" value={selected.id} /><button className="button-quiet min-h-0 px-2 py-1 text-xs text-red-600">Delete permanently</button></form></>}</div><span role="status" className="text-xs text-zinc-500">{status || (draft.title === savedDraft.title && draft.content === savedDraft.content ? "Saved" : "Saving…")}</span></div><details className="mt-5 border-t pt-4"><summary className="cursor-pointer text-sm font-semibold">Version history ({selectedVersions.length})</summary><div className="mt-3 space-y-2">{selectedVersions.length ? selectedVersions.map((version) => <div key={version.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{version.title}</p><p className="mt-1 text-xs text-zinc-500">{new Date(version.created_at).toLocaleString()}</p></div><button type="button" onClick={() => void restore(version)} className="button-secondary min-h-0 px-2 py-1 text-xs">Restore</button></div>) : <p className="text-sm text-zinc-500">Edits will appear here after migration 0013 runs.</p>}</div></details></> : null}</div></div></section>
}
