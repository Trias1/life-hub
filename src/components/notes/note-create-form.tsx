"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Select } from "@/components/ui/select"
import { useImageUpload } from "@/hooks/use-image-upload"
import { noteFolders } from "./note-content"
import { NoteDescriptionEditor } from "./note-description-editor"
import { TagChip } from "./tag-chip"

const DRAFT_KEY = "lifehub:note-draft"
type Draft = { title: string; content: string; folder: string; tags: string }
const emptyDraft: Draft = { title: "", content: "", folder: "General", tags: "" }

export function NoteCreateForm({ action, workspaceId, folders }: { action: (formData: FormData) => Promise<void>; workspaceId: string; folders: string[] }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { processImages } = useImageUpload()
  const folderOptions = Array.from(new Set([...noteFolders, ...folders])).map((value) => ({ value, label: value }))
  const tagList = Array.from(new Set(draft.tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 12)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY)
      if (saved) setDraft({ ...emptyDraft, ...(JSON.parse(saved) as Partial<Draft>) })
    } catch {
      window.localStorage.removeItem(DRAFT_KEY)
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    const isEmpty = !draft.title && !draft.content && draft.folder === "General" && !draft.tags
    try {
      if (isEmpty) window.localStorage.removeItem(DRAFT_KEY)
      else window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {}
    if (!isEmpty) setStatus("Draft saved on this device")
  }, [draft, loaded])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.title.trim()) return setStatus("Add a title before creating the note.")
    setSubmitting(true)
    setStatus("")
    try {
      const formData = new FormData()
      formData.set("title", draft.title.trim())
      formData.set("content", await processImages(draft.content, workspaceId))
      formData.set("folder", draft.folder)
      formData.set("tags", draft.tags)
      await action(formData)
    } catch (error) {
      // redirect() from the server action surfaces as a thrown navigation; let it through,
      // and drop the local draft only when it leads to the new note (not back to this form).
      if (error && typeof error === "object" && "digest" in error) {
        if (!String(error.digest).includes("/notes/new")) window.localStorage.removeItem(DRAFT_KEY)
        throw error
      }
      setStatus("Could not create the note: " + (error instanceof Error ? error.message : "unknown error"))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="issue-form mt-6">
      <div className="issue-form-field">
        <label htmlFor="note-title" className="issue-form-label">Title <span className="font-normal text-[var(--muted)]">(required)</span></label>
        <input id="note-title" required maxLength={160} autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="field-control" />
      </div>
      <div className="issue-form-field issue-form-narrow">
        <label htmlFor="note-folder" className="issue-form-label">Folder</label>
        <Select id="note-folder" value={draft.folder} onChange={(folder) => setDraft({ ...draft, folder })} options={folderOptions} className="field-control" />
      </div>
      <div className="issue-form-field">
        <p id="note-description-label" className="issue-form-label">Description</p>
        <NoteDescriptionEditor value={draft.content} onChange={(content) => setDraft((current) => ({ ...current, content }))} minHeight={180} labelledBy="note-description-label" />
      </div>
      <div className="issue-form-field issue-form-narrow">
        <label htmlFor="note-tags" className="issue-form-label">Labels</label>
        <input id="note-tags" value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="Separate labels with commas" className="field-control" />
        {tagList.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{tagList.map((tag) => <TagChip key={tag} tag={tag} />)}</div>}
      </div>
      <div className="issue-form-actions">
        <button disabled={submitting} className="button-primary disabled:opacity-60">{submitting ? "Creating…" : "Create note"}</button>
        <Link href="/notes" className="button-secondary">Cancel</Link>
        <span role="status" className="text-xs text-[var(--muted)]">{status}</span>
      </div>
    </form>
  )
}
