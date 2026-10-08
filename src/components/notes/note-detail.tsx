"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Archive, Copy, History, MoreVertical, Pin, PinOff, RotateCcw, SquarePen, Trash2 } from "lucide-react"
import { Select } from "@/components/ui/select"
import { useImageUpload } from "@/hooks/use-image-upload"
import { noteFolders } from "./note-content"
import { NoteDescriptionEditor } from "./note-description-editor"
import { NoteViewer } from "./note-viewer"
import { TagChip } from "./tag-chip"

type Note = { id: string; title: string; content: string; folder: string; tags: string[]; is_favorite: boolean; archived_at: string | null; deleted_at: string | null }
type Version = { id: string; title: string; createdLabel: string; createdAt: string; createdIso: string }
type FormAction = (formData: FormData) => Promise<void>
type EditAction = (formData: FormData) => Promise<{ error?: string; title?: string; content?: string }>
type Props = {
  note: Note
  versions: Version[]
  workspaceId: string
  folders: string[]
  canEdit: boolean
  authorName: string
  createdLabel: string
  createdAt: string
  createdIso: string
  updatedLabel: string
  actions: { updateNote: EditAction; restoreNoteVersion: EditAction; archiveNote: FormAction; trashNote: FormAction; restoreNote: FormAction; deleteNotePermanently: FormAction; toggleFavorite: FormAction }
}

export function NoteDetail({ note, versions, workspaceId, folders, canEdit, authorName, createdLabel, createdAt, createdIso, updatedLabel, actions }: Props) {
  const router = useRouter()
  const { processImages } = useImageUpload()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: note.title, content: note.content, folder: note.folder, tags: note.tags.join(", ") })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAllActivity, setShowAllActivity] = useState(false)
  const shownVersions = showAllActivity ? versions : versions.slice(0, 3)
  const hiddenCount = versions.length - shownVersions.length
  const menuRef = useRef<HTMLDivElement>(null)
  const state = note.deleted_at ? "trash" : note.archived_at ? "archived" : "active"
  const folderOptions = Array.from(new Set([...noteFolders, ...folders, note.folder])).map((value) => ({ value, label: value }))

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false) }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", escape)
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape) }
  }, [menuOpen])

  function startEditing() {
    setDraft({ title: note.title, content: note.content, folder: note.folder, tags: note.tags.join(", ") })
    setMessage("")
    setEditing(true)
  }

  async function save() {
    if (!draft.title.trim()) return setMessage("Add a title before saving.")
    setSaving(true)
    setMessage("")
    try {
      const formData = new FormData()
      formData.set("id", note.id)
      formData.set("title", draft.title.trim())
      formData.set("content", await processImages(draft.content, workspaceId))
      formData.set("folder", draft.folder)
      formData.set("tags", draft.tags)
      const result = await actions.updateNote(formData)
      if (result.error) return setMessage(result.error)
      setEditing(false)
      setMessage("Changes saved")
      router.refresh()
    } catch (error) {
      setMessage("Could not save: " + (error instanceof Error ? error.message : "unknown error"))
    } finally {
      setSaving(false)
    }
  }

  async function restoreVersion(version: Version) {
    if (!window.confirm("Restore \"" + version.title + "\" from " + version.createdLabel + "? The current text is kept in the history.")) return
    const formData = new FormData()
    formData.set("noteId", note.id)
    formData.set("versionId", version.id)
    const result = await actions.restoreNoteVersion(formData)
    setMessage(result.error ?? "Version restored")
    if (!result.error) router.refresh()
  }

  async function copyLink() {
    setMenuOpen(false)
    await navigator.clipboard.writeText(window.location.origin + "/notes/" + note.id)
    setMessage("Link copied")
  }

  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />

  return (
    <div className="issue-layout issue-detail">
      <article className="issue-main min-w-0">
        {state !== "active" && (
          <div role="status" className="issue-banner">
            <span>{state === "archived" ? "This note is archived. It is hidden from the active list." : "This note is in the trash."}</span>
            {canEdit && (
              <span className="flex gap-2">
                <form action={actions.restoreNote}>{hidden("id", note.id)}{hidden("from", state)}<button className="button-secondary min-h-0 px-3 py-1.5 text-xs"><RotateCcw size={13} className="mr-1.5" />Restore</button></form>
                {state === "trash" && <form action={actions.deleteNotePermanently} onSubmit={(event) => { if (!window.confirm("Delete this note permanently? This cannot be undone.")) event.preventDefault() }}>{hidden("id", note.id)}<button className="button-quiet min-h-0 px-3 py-1.5 text-xs text-red-600">Delete permanently</button></form>}
              </span>
            )}
          </div>
        )}

        {editing ? (
          <div className="issue-form">
            <div className="issue-form-field">
              <label htmlFor="edit-note-title" className="issue-form-label">Title <span className="font-normal text-[var(--muted)]">(required)</span></label>
              <input id="edit-note-title" autoFocus maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="field-control" />
            </div>
            <div className="issue-form-field">
              <p id="edit-note-description" className="issue-form-label">Description</p>
              <NoteDescriptionEditor value={draft.content} onChange={(content) => setDraft((current) => ({ ...current, content }))} minHeight={240} labelledBy="edit-note-description" />
            </div>
            <div className="issue-form-actions">
              <button type="button" onClick={() => void save()} disabled={saving} className="button-primary disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
              <button type="button" onClick={() => { setEditing(false); setMessage("") }} disabled={saving} className="button-secondary">Cancel</button>
              <span role="status" className="text-xs text-[var(--muted)]">{message}</span>
            </div>
          </div>
        ) : (
          <>
            <header className="issue-header">
              <h1 className="issue-title">{note.title}</h1>
              <div className="flex shrink-0 items-center gap-2">
                {canEdit && state === "active" && <button type="button" onClick={startEditing} className="button-secondary min-h-0 px-3 py-1.5">Edit</button>}
                <div ref={menuRef} className="relative">
                  <button type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="button-quiet min-h-0 px-2 py-1.5"><MoreVertical size={16} /></button>
                  {menuOpen && (
                    <div role="menu" className="issue-menu">
                      <button type="button" role="menuitem" onClick={() => void copyLink()}><Copy size={14} />Copy link</button>
                      {canEdit && state === "active" && <>
                        <form action={actions.toggleFavorite} onSubmit={() => setMenuOpen(false)}>{hidden("id", note.id)}{hidden("favorite", note.is_favorite ? "false" : "true")}<button role="menuitem">{note.is_favorite ? <PinOff size={14} /> : <Pin size={14} />}{note.is_favorite ? "Unpin" : "Pin to top"}</button></form>
                        <form action={actions.archiveNote}>{hidden("id", note.id)}<button role="menuitem"><Archive size={14} />Archive</button></form>
                        <form action={actions.trashNote}>{hidden("id", note.id)}<button role="menuitem" className="text-red-600"><Trash2 size={14} />Move to trash</button></form>
                      </>}
                    </div>
                  )}
                </div>
              </div>
            </header>
            <p className="issue-meta">
              <span className="issue-state" data-state={state}>{state === "active" ? "Active" : state === "archived" ? "Archived" : "Trash"}</span>
              <SquarePen size={14} aria-hidden />
              <span>Note created <time dateTime={createdIso} title={createdAt}>{createdLabel}</time> by <strong>{authorName}</strong></span>
            </p>
            {message && <p role="status" className="mt-3 text-xs text-[var(--muted)]">{message}</p>}
            <div className="issue-body"><NoteViewer content={note.content} /></div>
          </>
        )}


      </article>

      <aside className="issue-sidebar">
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Folder</p>
          {editing ? <Select value={draft.folder} onChange={(folder) => setDraft({ ...draft, folder })} options={folderOptions} className="field-control mt-2" /> : <p className="mt-1.5 text-sm">{note.folder}</p>}
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Labels</p>
          {editing ? <><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="design, planning" aria-label="Labels" className="field-control mt-2" /><p className="mt-1.5 text-xs text-[var(--muted)]">Separate labels with commas.</p></>
            : note.tags.length ? <div className="mt-2 flex flex-wrap gap-1.5">{note.tags.map((tag) => <Link key={tag} href={"/notes?label=" + encodeURIComponent(tag)}><TagChip tag={tag} /></Link>)}</div> : <p className="mt-1.5 text-sm text-[var(--muted)]">None</p>}
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Pinned</p>
          <p className="mt-1.5 text-sm">{note.is_favorite ? "Yes" : "No"}</p>
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Last updated</p>
          <p className="mt-1.5 text-sm">{updatedLabel}</p>
        </div>
      </aside>
      <section className="issue-activity" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="issue-section-title">Activity</h2>
        <ol className="issue-timeline">
          {shownVersions.map((version) => (
            <li key={version.id}>
              <History size={14} aria-hidden />
              <div className="issue-timeline-text">
                <p><strong>{authorName}</strong> edited this note · <time dateTime={version.createdIso} title={version.createdAt}>{version.createdLabel}</time></p>
                {version.title !== note.title && <p className="issue-timeline-detail">Title was “{version.title}”</p>}
              </div>
              {canEdit && state === "active" && <button type="button" onClick={() => void restoreVersion(version)} className="issue-timeline-action">Restore</button>}
            </li>
          ))}
          {hiddenCount > 0 && <li><button type="button" onClick={() => setShowAllActivity(true)} className="issue-timeline-more">Show {hiddenCount} older {hiddenCount === 1 ? "edit" : "edits"}</button></li>}
          <li><SquarePen size={14} aria-hidden /><div className="issue-timeline-text"><p><strong>{authorName}</strong> created this note · <time dateTime={createdIso} title={createdAt}>{createdLabel}</time></p></div></li>
        </ol>
      </section>
    </div>
  )
}
