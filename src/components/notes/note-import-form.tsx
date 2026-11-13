"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { FileText, Upload } from "lucide-react"
import { Select } from "@/components/ui/select"
import { SubmitButton } from "@/components/calendar/submit-button"
import { IMPORT_LIMITS, parseNotesFile } from "@/lib/notes-import.mjs"
import { MARKDOWN_LIMITS, markdownToNoteHtml, titleFromFileName } from "@/lib/markdown-note.mjs"
import { noteFolders } from "./note-content"

type ImportAction = (formData: FormData) => Promise<void>
type Picked = { name: string; kind: "markdown" | "word" | "text"; title: string; detail: string; error?: string }
const MAX_TOTAL_BYTES = 10 * 1024 * 1024

const kindOf = (name: string): Picked["kind"] | null => /\.(md|markdown)$/i.test(name) ? "markdown" : /\.docx$/i.test(name) ? "word" : /\.txt$/i.test(name) ? "text" : null

/**
 * Import notes from files. Markdown, Word (.docx) and plain text become one note each (the server
 * converts them again; the browser only previews). A single .txt written as "title : text" lines can
 * instead make one note per line, as before.
 */
export function NoteImportForm({ importList, importDocuments, existingTitles, folders, parents }: { importList: ImportAction; importDocuments: ImportAction; existingTitles: string[]; folders: string[]; parents: { value: string; label: string }[] }) {
  const [picked, setPicked] = useState<Picked[]>([])
  const [listText, setListText] = useState("")
  const [mode, setMode] = useState<"documents" | "list">("documents")
  const [error, setError] = useState("")
  const [folder, setFolder] = useState("General")
  const [tags, setTags] = useState("")
  const [parentId, setParentId] = useState("")
  const existing = useMemo(() => new Set(existingTitles), [existingTitles])
  const parsed = useMemo(() => parseNotesFile(listText), [listText])
  const listMode = mode === "list" && parsed.entries.length > 0
  const appendCount = parsed.entries.filter((entry) => existing.has(entry.title.toLowerCase())).length
  const tooMany = parsed.entries.length > IMPORT_LIMITS.entries
  const folderOptions = Array.from(new Set([...noteFolders, ...folders])).map((value) => ({ value, label: value }))
  const ready = picked.filter((file) => !file.error)

  async function pick(list: FileList | null) {
    setError("")
    setListText("")
    setMode("documents")
    const files = Array.from(list ?? [])
    if (!files.length) return setPicked([])
    if (files.length > MARKDOWN_LIMITS.files) return setError("Choose up to " + MARKDOWN_LIMITS.files + " files at a time.")
    if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) return setError("These files are larger than 10 MB together. Import fewer at a time.")
    const next: Picked[] = []
    for (const file of files) {
      const kind = kindOf(file.name)
      if (!kind) {
        next.push({ name: file.name, kind: "text", title: file.name, detail: "", error: "Use .md, .docx or .txt (save .doc files as .docx)" })
        continue
      }
      const limit = kind === "word" ? 5 * 1024 * 1024 : MARKDOWN_LIMITS.bytes
      if (file.size > limit) {
        next.push({ name: file.name, kind, title: titleFromFileName(file.name), detail: "", error: "Larger than " + (kind === "word" ? "5 MB" : "200 KB") })
        continue
      }
      if (kind === "markdown") {
        const converted = markdownToNoteHtml(await file.text())
        next.push({ name: file.name, kind, title: converted.title || titleFromFileName(file.name), detail: converted.headings + (converted.headings === 1 ? " heading" : " headings"), error: converted.html.length > MARKDOWN_LIMITS.html ? "Too long for one note; split the file" : undefined })
      } else if (kind === "text") {
        const text = await file.text()
        next.push({ name: file.name, kind, title: titleFromFileName(file.name), detail: "Plain text" })
        // One .txt in the "title : text" format can still make one note per line.
        if (files.length === 1 && parseNotesFile(text).entries.length > 1) {
          setListText(text)
          setMode("list")
        }
      } else {
        next.push({ name: file.name, kind, title: titleFromFileName(file.name), detail: "Word document (title from its first Heading 1, if any)" })
      }
    }
    setPicked(next)
  }

  return (
    <form action={listMode ? importList : importDocuments} className="mt-6 grid max-w-3xl gap-6">
      {listMode && <input type="hidden" name="text" value={listText} />}
      <div className="issue-form-field">
        <label htmlFor="import-file" className="issue-form-label">Files</label>
        <input id="import-file" name={listMode ? undefined : "files"} type="file" multiple accept=".md,.markdown,.docx,.txt,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(event) => void pick(event.target.files)} />
        <label htmlFor="import-file" className="note-import-drop">
          <Upload size={18} aria-hidden />
          <span>{picked.length ? picked.length + (picked.length === 1 ? " file chosen" : " files chosen") : "Choose .md, .docx or .txt files"}</span>
        </label>
        <p className="text-xs text-[var(--muted)]">Each file becomes one note: headings show up in &quot;On this page&quot;, code blocks and lists are kept, tables become lists. Up to {MARKDOWN_LIMITS.files} files; Markdown and text up to 200 KB, Word up to 5 MB (images are left out).</p>
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      </div>

      {parsed.entries.length > 1 && picked.length === 1 && picked[0].kind === "text" && (
        <fieldset className="issue-form-field">
          <legend className="issue-form-label">This .txt has &quot;title : text&quot; lines</legend>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="txt-mode" checked={mode === "list"} onChange={() => setMode("list")} />One note per title ({parsed.entries.length} notes)</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="txt-mode" checked={mode === "documents"} onChange={() => setMode("documents")} />The whole file as one note</label>
        </fieldset>
      )}

      {listMode ? (
        <section aria-labelledby="import-preview-heading" className="grid gap-3">
          <h2 id="import-preview-heading" className="issue-section-title">
            Preview · {parsed.entries.length - appendCount} new, {appendCount} added to existing{parsed.skipped.length ? ", " + parsed.skipped.length + (parsed.skipped.length === 1 ? " line skipped" : " lines skipped") : ""}
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
                    <p className="issue-row-meta truncate">{entry.lines.map((line) => line.replace(/^([-*•]|\d+[.)])\s+/, "")).join(" · ")}</p>
                  </div>
                  <span className="tag-chip" data-tone={appending ? "amber" : "teal"}>{appending ? "Add to existing" : "New"}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : picked.length > 0 && (
        <section aria-labelledby="import-preview-heading" className="grid gap-3">
          <h2 id="import-preview-heading" className="issue-section-title">Preview · {ready.length} {ready.length === 1 ? "note" : "notes"}</h2>
          <ul className="issue-list">
            {picked.map((file) => (
              <li key={file.name} className="issue-row">
                <FileText size={16} className="issue-row-icon" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="issue-row-title">{file.title}</p>
                  <p className="issue-row-meta truncate">{file.name}{file.detail ? " · " + file.detail : ""}</p>
                  {file.error && <p className="mt-1 text-xs font-medium text-danger">{file.error}</p>}
                </div>
                <span className="tag-chip" data-tone={file.error ? "rose" : file.kind === "word" ? "sky" : file.kind === "markdown" ? "violet" : "teal"}>{file.error ? "Skipped" : file.kind === "word" ? "Word" : file.kind === "markdown" ? "Markdown" : "Text"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(listMode || ready.length > 0) && (
        <div className="grid gap-5 sm:grid-cols-2">
          {!listMode && parents.length > 0 && (
            <div className="issue-form-field sm:col-span-2">
              <label htmlFor="import-parent" className="issue-form-label">Put under</label>
              <Select id="import-parent" name="parentId" value={parentId} onChange={setParentId} options={[{ value: "", label: "Nothing (top-level notes)" }, ...parents]} className="field-control" />
              <p className="text-xs text-[var(--muted)]">The imported notes become sub-pages of this note and use its folder.</p>
            </div>
          )}
          {(listMode || !parentId) && (
            <div className="issue-form-field">
              <label htmlFor="import-folder" className="issue-form-label">Folder for new notes</label>
              <Select id="import-folder" name="folder" value={folder} onChange={setFolder} options={folderOptions} className="field-control" />
            </div>
          )}
          <div className="issue-form-field">
            <label htmlFor="import-tags" className="issue-form-label">Tags for new notes</label>
            <input id="import-tags" name="tags" value={tags} onChange={(event) => setTags(event.target.value)} maxLength={500} placeholder="akun, project" className="field-control" />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {listMode
          ? <SubmitButton label={"Import " + parsed.entries.length + (parsed.entries.length === 1 ? " note" : " notes")} pendingLabel="Importing…" disabled={tooMany} className="button-primary disabled:cursor-not-allowed disabled:opacity-50" />
          : <SubmitButton label={ready.length ? "Import " + ready.length + (ready.length === 1 ? " note" : " notes") : "Import"} pendingLabel="Importing…" disabled={!ready.length || ready.length !== picked.length} className="button-primary disabled:cursor-not-allowed disabled:opacity-50" />}
        <Link href="/notes" className="button-secondary">Cancel</Link>
      </div>
      {!listMode && ready.length > 0 && ready.length !== picked.length && <p className="text-sm text-[var(--muted)]">Remove the skipped files from your selection to import the rest.</p>}
    </form>
  )
}
