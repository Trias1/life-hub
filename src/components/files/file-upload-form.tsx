"use client"

import Link from "next/link"
import { useState } from "react"
import { useFormStatus } from "react-dom"
import { UPLOAD_ACCEPT, UPLOAD_MAX_BYTES, formatBytes } from "./file-kind"

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return <button disabled={disabled || pending} className="button-primary disabled:opacity-60">{pending ? "Uploading…" : "Upload"}</button>
}

export function FileUploadForm({ action, folders }: { action: (formData: FormData) => Promise<void>; folders: string[] }) {
  const [problem, setProblem] = useState("")

  function check(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setProblem(file && file.size > UPLOAD_MAX_BYTES ? file.name + " is " + formatBytes(file.size) + ". Files can be up to " + formatBytes(UPLOAD_MAX_BYTES) + "." : "")
  }

  return (
    <form action={action} className="issue-form mt-6">
      <div className="issue-form-field">
        <label htmlFor="upload-file" className="issue-form-label">File <span className="font-normal text-[var(--muted)]">(required)</span></label>
        <input id="upload-file" required name="file" type="file" accept={UPLOAD_ACCEPT} onChange={check} aria-describedby="upload-file-hint" className="field-control min-w-0 max-w-full text-sm" />
        <p id="upload-file-hint" className="text-xs text-[var(--muted)]">Images, PDF, documents, ZIP, audio, or video · max {formatBytes(UPLOAD_MAX_BYTES)}</p>
        {problem && <p role="alert" className="text-xs text-red-600">{problem}</p>}
      </div>
      <div className="issue-form-field issue-form-narrow">
        <label htmlFor="upload-folder" className="issue-form-label">Folder</label>
        <input id="upload-folder" required name="folder" defaultValue="General" maxLength={80} list="upload-folder-options" placeholder="Folder" className="field-control" />
        <datalist id="upload-folder-options">{folders.map((folder) => <option key={folder} value={folder} />)}</datalist>
        <p className="text-xs text-[var(--muted)]">Pick an existing folder or type a new name.</p>
      </div>
      <div className="issue-form-actions">
        <SubmitButton disabled={Boolean(problem)} />
        <Link href="/files" className="button-secondary">Cancel</Link>
      </div>
    </form>
  )
}
