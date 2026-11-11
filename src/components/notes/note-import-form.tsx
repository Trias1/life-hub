"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { FileText, Upload } from "lucide-react"
import { Select } from "@/components/ui/select"
import { SubmitButton } from "@/components/calendar/submit-button"
import { IMPORT_LIMITS, parseNotesFile } from "@/lib/notes-import.mjs"
import { noteFolders } from "./note-content"

type ImportAction = (formData: FormData) => Promise<void>

/** Pick a Notepad file, preview the notes it makes, then import. The server re-reads the same text. */
export function NoteImportForm({ action, existingTitles, folders }: { action: ImportAction; existingTitles: string[]; folders: string[] }) {
  const [text, setText] = useState("")
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [folder, setFolder] = useState("General")
  const [tags, setTags] = useState("")
  const existing = useMemo(() => new Set(existingTitles), [existingTitles])
  const parsed = useMemo(() => parseNotesFile(text), [text])
  const appendCount = parsed.entries.filter((entry) => existing.has(entry.title.toLowerCase())).length
  const tooMany = parsed.entries.length > IMPORT_LIMITS.entries
  const folderOptions = Array.from(new Set([...noteFolders, ...folders])).map((value) => ({ value, label: value }))

  const pickFile = async (file: File | undefined) => {
    setError("")
    setText("")
    setFileName(file?.name ?? "")
    if (!file) return
    if (file.size > IMPORT_LIMITS.bytes) return setError("That file is larger than 200 KB. Split it into smaller files.")
    if (!/\.(txt|md)$/i.test(file.name) && file.type && file.type !== "text/plain") return setError("Choose a plain-text file (.txt) saved from Notepad.")
    const content = await file.text()
    setText(content)
    if (!parseNotesFile(content).entries.length) setError("No notes found. Write each one as \"title : text\" on its own line.")
  }

  return (
    <form action={action} className="mt-6 grid max-w-3xl gap-6">
      <input type="hidden" name="text" value={text} />
      <div className="issue-form-field">
        <label htmlFor="import-file" className="issue-form-label">File</label>
        <input id="import-file" type="file" accept=".txt,.md,text/plain" className="sr-only" onChange={(event) => void pickFile(event.target.files?.[0])} />
        <label htmlFor="import-file" className="note-import-drop">
          <Upload size={18} aria-hidden />
          <span>{fileName || "Choose a .txt file"}</span>
        </label>
        <p className="text-xs text-[var(--muted)]">One note per line as <code>title : text</code>. Lines starting with <code>-</code>, <code>*</code> or <code>1.</code> under a title go into that note. Up to 200 KB and 100 notes.</p>
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      </div>

      {parsed.entries.length > 0 && (
        <>
          <section aria-labelledby="import-preview-heading" className="grid gap-3">
            <h2 id="import-preview-heading" className="issue-section-title">
              Preview · {parsed.entries.length - appendCount} new, {appendCount} added to existing{parsed.skipped.length ? ", " + parsed.skipped.length + " lines skipped" : ""}
            </h2>
            {tooMany && <p role="alert" className="text-sm font-medium text-danger">That file has more than 100 notes. Split it into smaller files.</p>}
            <ul className="issue-list">
              {parsed.entries.map((entry) => {
                const appending = existing.has(entry.title.toLowerCase())
                return (
                  <li key={entry.title} className="issue-row">
                    <FileText size={16} className="issue-row-icon" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="issue-row-title">{entry.title}</p>
                      <p className="issue-row-meta truncate">{entry.lines.join(" · ")}</p>
                    </div>
                    <span className="tag-chip" data-tone={appending ? "amber" : "teal"}>{appending ? "Add to existing" : "New"}</span>
                  </li>
                )
              })}
            </ul>
            {parsed.skipped.length > 0 && (
              <details className="text-sm text-[var(--muted)]">
                <summary className="cursor-pointer">Skipped lines (no title before them)</summary>
                <ul className="mt-2 grid gap-1">
                  {parsed.skipped.map((line) => <li key={line.line}><span className="font-mono">Line {line.line}:</span> {line.text}</li>)}
                </ul>
              </details>
            )}
          </section>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="issue-form-field">
              <label htmlFor="import-folder" className="issue-form-label">Folder for new notes</label>
              <Select id="import-folder" name="folder" value={folder} onChange={setFolder} options={folderOptions} className="field-control" />
            </div>
            <div className="issue-form-field">
              <label htmlFor="import-tags" className="issue-form-label">Tags for new notes</label>
              <input id="import-tags" name="tags" value={tags} onChange={(event) => setTags(event.target.value)} maxLength={500} placeholder="akun, project" className="field-control" />
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <SubmitButton label={parsed.entries.length ? "Import " + parsed.entries.length + (parsed.entries.length === 1 ? " note" : " notes") : "Import"} pendingLabel="Importing…" disabled={!parsed.entries.length || tooMany} className="button-primary disabled:cursor-not-allowed disabled:opacity-50" />
        <Link href="/notes" className="button-secondary">Cancel</Link>
      </div>
    </form>
  )
}
