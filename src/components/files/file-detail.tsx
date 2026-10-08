"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { Copy, Download, ExternalLink, FileUp, History, MoreVertical, RotateCcw, Star, StarOff, Trash2 } from "lucide-react"
import { Select } from "@/components/ui/select"
import { UPLOAD_ACCEPT, UPLOAD_MAX_BYTES, formatBytes } from "./file-kind"
import { FileKindIcon } from "./file-kind-icon"

type FileInfo = { id: string; name: string; mimeType: string; folder: string; isFavorite: boolean; trashed: boolean }
type Version = { id: string; name: string; size: string; typeLabel: string; uploaderName: string; createdAt: string; createdLabel: string }
type FormAction = (formData: FormData) => Promise<void>
type Props = {
  file: FileInfo
  typeLabel: string
  size: string
  downloadUrl: string | null
  imagePreviewUrl: string | null
  canEdit: boolean
  uploaderName: string
  createdAt: string
  createdLabel: string
  updatedLabel: string
  trashedLabel: string | null
  shareStatus: string
  shareToken: string | null
  versions: Version[]
  actions: { toggleFavorite: FormAction; trashFile: FormAction; restoreFile: FormAction; permanentlyDeleteFile: FormAction; uploadFileVersion: FormAction; createFileShare: FormAction }
}

function PendingButton({ children, pendingText, className, disabled }: { children: React.ReactNode; pendingText: string; className: string; disabled?: boolean }) {
  const { pending } = useFormStatus()
  return <button disabled={disabled || pending} className={className + " disabled:opacity-60"}>{pending ? pendingText : children}</button>
}

export function FileDetail({ file, typeLabel, size, downloadUrl, imagePreviewUrl, canEdit, uploaderName, createdAt, createdLabel, updatedLabel, trashedLabel, shareStatus, shareToken, versions, actions }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [versionProblem, setVersionProblem] = useState("")
  const [showAllActivity, setShowAllActivity] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const shownVersions = showAllActivity ? versions : versions.slice(0, 5)
  const hiddenCount = versions.length - shownVersions.length
  const state = file.trashed ? "trash" : "active"
  const sharePath = shareToken ? "/api/shared/files/" + shareToken + "?inline=1" : null

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false) }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", escape)
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape) }
  }, [menuOpen])

  async function copy(path: string, done: string) {
    setMenuOpen(false)
    try {
      await navigator.clipboard.writeText(window.location.origin + path)
      setMessage(done)
    } catch {
      setMessage("Could not copy. Select the link and copy it manually.")
    }
  }

  function checkVersion(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0]
    setVersionProblem(chosen && chosen.size > UPLOAD_MAX_BYTES ? chosen.name + " is " + formatBytes(chosen.size) + ". Files can be up to " + formatBytes(UPLOAD_MAX_BYTES) + "." : "")
  }

  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />

  return (
    <div className="issue-layout issue-detail">
      <article className="issue-main min-w-0">
        {sharePath && (
          <div role="status" className="issue-banner">
            <span className="min-w-0">Share link ready. Anyone with this link can view the file until it expires:{" "}
              <a href={sharePath} target="_blank" rel="noreferrer" className="break-all font-semibold underline">{sharePath}</a>
            </span>
            <button type="button" onClick={() => void copy(sharePath, "Share link copied")} className="button-secondary min-h-0 px-3 py-1.5 text-xs"><Copy size={13} className="mr-1.5" />Copy link</button>
          </div>
        )}
        {file.trashed && (
          <div role="status" className="issue-banner">
            <span>This file is in the trash{trashedLabel ? " (moved " + trashedLabel + ")" : ""}. It is hidden from the file list.</span>
            {canEdit && (
              <span className="flex flex-wrap gap-2">
                <form action={actions.restoreFile}>{hidden("id", file.id)}<PendingButton pendingText="Restoring…" className="button-secondary min-h-0 px-3 py-1.5 text-xs"><RotateCcw size={13} className="mr-1.5" />Restore</PendingButton></form>
                <form action={actions.permanentlyDeleteFile} onSubmit={(event) => { if (!window.confirm("Delete \"" + file.name + "\" permanently? It is also removed from Google Drive. This cannot be undone.")) event.preventDefault() }}>{hidden("id", file.id)}<PendingButton pendingText="Deleting…" className="button-quiet min-h-0 px-3 py-1.5 text-xs text-red-600">Delete permanently</PendingButton></form>
              </span>
            )}
          </div>
        )}

        <header className="issue-header">
          <h1 className="issue-title min-w-0 [overflow-wrap:anywhere]">{file.name}</h1>
          <div className="flex shrink-0 items-center gap-2">
            {downloadUrl && !file.trashed && <a href={downloadUrl} target="_blank" rel="noreferrer" className="button-secondary min-h-0 px-3 py-1.5"><Download size={14} className="mr-1.5" aria-hidden />Download</a>}
            <div ref={menuRef} className="relative">
              <button type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="button-quiet min-h-0 px-2 py-1.5"><MoreVertical size={16} /></button>
              {menuOpen && (
                <div role="menu" className="issue-menu">
                  <button type="button" role="menuitem" onClick={() => void copy("/files/" + file.id, "Link copied")}><Copy size={14} />Copy link</button>
                  {canEdit && !file.trashed && <>
                    <form action={actions.toggleFavorite} onSubmit={() => setMenuOpen(false)}>{hidden("id", file.id)}{hidden("favorite", file.isFavorite ? "false" : "true")}<button role="menuitem">{file.isFavorite ? <StarOff size={14} /> : <Star size={14} />}{file.isFavorite ? "Remove from favourites" : "Add to favourites"}</button></form>
                    <form action={actions.trashFile} onSubmit={() => setMenuOpen(false)}>{hidden("id", file.id)}<button role="menuitem" className="text-red-600"><Trash2 size={14} />Move to trash</button></form>
                  </>}
                </div>
              )}
            </div>
          </div>
        </header>
        <p className="issue-meta">
          <span className="issue-state" data-state={state}>{file.trashed ? "Trash" : "Active"}</span>
          <span className="tag-chip" data-tone="indigo">{typeLabel}</span>
          {file.isFavorite && <Star size={14} fill="currentColor" role="img" aria-label="Favourite" className="text-[var(--foreground)]" />}
          <span>Uploaded <time dateTime={createdAt} title={createdAt}>{createdLabel}</time> by <strong>{uploaderName}</strong></span>
        </p>
        {message && <p role="status" className="mt-3 text-xs text-[var(--muted)]">{message}</p>}

        <div className="issue-body">
          {imagePreviewUrl ? (
            <a href={imagePreviewUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-muted)]">
              <Image src={imagePreviewUrl} alt={file.name} width={1200} height={800} unoptimized className="mx-auto h-auto max-h-[70vh] w-auto max-w-full object-contain" />
            </a>
          ) : (
            <div className="grid place-items-center gap-3 rounded-[var(--radius-control)] border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--muted)]">
              <FileKindIcon mimeType={file.mimeType} name={file.name} size={36} aria-hidden />
              <p>{downloadUrl ? "No inline preview for this file type." : "This file is not stored in Google Drive, so it cannot be opened here."}</p>
              {downloadUrl && file.mimeType === "application/pdf" && <a href={downloadUrl + "?inline=1"} target="_blank" rel="noreferrer" className="button-secondary min-h-0 px-3 py-1.5 text-xs"><ExternalLink size={13} className="mr-1.5" aria-hidden />Open PDF</a>}
              {downloadUrl && file.mimeType !== "application/pdf" && <a href={downloadUrl} target="_blank" rel="noreferrer" className="button-secondary min-h-0 px-3 py-1.5 text-xs"><Download size={13} className="mr-1.5" aria-hidden />Download</a>}
            </div>
          )}
        </div>
      </article>

      <aside className="issue-sidebar">
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Size</p>
          <p className="mt-1.5 text-sm">{size}</p>
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Type</p>
          <p className="mt-1.5 text-sm [overflow-wrap:anywhere]">{typeLabel} <span className="text-[var(--muted)]">· {file.mimeType}</span></p>
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Folder</p>
          <p className="mt-1.5 text-sm [overflow-wrap:anywhere]"><Link href={"/files?folder=" + encodeURIComponent(file.folder)} className="hover:underline">{file.folder}</Link></p>
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Uploaded</p>
          <p className="mt-1.5 text-sm">{createdLabel} · {createdAt}</p>
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Last updated</p>
          <p className="mt-1.5 text-sm">{updatedLabel}</p>
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Shared link</p>
          <p className="mt-1.5 text-sm">{shareStatus}</p>
          {!file.trashed && (
            <form action={actions.createFileShare} className="mt-2 flex flex-wrap items-center gap-2">
              {hidden("id", file.id)}
              <Select name="expires" defaultValue="7d" className="field-control min-h-0 w-auto flex-1 px-2 py-1 text-xs" options={[{ value: "1d", label: "Expires in 1 day" }, { value: "7d", label: "Expires in 7 days" }, { value: "30d", label: "Expires in 30 days" }, { value: "never", label: "Never expires" }]} />
              <PendingButton pendingText="Creating…" className="button-secondary min-h-0 px-2.5 py-1 text-xs">Create link</PendingButton>
            </form>
          )}
        </div>
      </aside>

      <section className="issue-activity" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="issue-section-title">Activity</h2>
        {canEdit && !file.trashed && (
          <form action={actions.uploadFileVersion} className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
            {hidden("fileId", file.id)}
            <label htmlFor="version-file" className="sr-only">New version</label>
            <input id="version-file" required name="version" type="file" accept={UPLOAD_ACCEPT} onChange={checkVersion} className="field-control min-h-0 min-w-0 max-w-full flex-1 py-1.5 text-xs sm:max-w-sm" />
            <PendingButton disabled={Boolean(versionProblem)} pendingText="Uploading…" className="button-secondary min-h-0 px-3 py-1.5 text-xs">Upload new version</PendingButton>
            {versionProblem && <p role="alert" className="w-full text-xs text-red-600">{versionProblem}</p>}
          </form>
        )}
        <ol className="issue-timeline">
          {shownVersions.map((version) => (
            <li key={version.id}>
              <History size={14} aria-hidden />
              <div className="issue-timeline-text">
                <p><strong>{version.uploaderName}</strong> uploaded a new version · <time dateTime={version.createdAt} title={version.createdAt}>{version.createdLabel}</time></p>
                <p className="issue-timeline-detail [overflow-wrap:anywhere]">{version.name} · {version.typeLabel} · {version.size}</p>
              </div>
              <a href={"/api/file-versions/" + version.id + "/download"} target="_blank" rel="noreferrer" className="issue-timeline-action">Download</a>
            </li>
          ))}
          {hiddenCount > 0 && <li><button type="button" onClick={() => setShowAllActivity(true)} className="issue-timeline-more">Show {hiddenCount} older {hiddenCount === 1 ? "version" : "versions"}</button></li>}
          <li><FileUp size={14} aria-hidden /><div className="issue-timeline-text"><p><strong>{uploaderName}</strong> uploaded this file · <time dateTime={createdAt} title={createdAt}>{createdLabel}</time></p></div></li>
        </ol>
      </section>
    </div>
  )
}
