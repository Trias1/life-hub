"use client"

import { useEffect, useRef, useState } from "react"
import { Download, MoreVertical, Upload } from "lucide-react"
import { menuLinkClass } from "./bookmark-utils"

/** ⋮ menu next to "New bookmark" with CSV import and export. */
export function BookmarkListMenu({ importAction }: { importAction: (formData: FormData) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", escape)
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape) }
  }, [open])

  async function upload(formData: FormData) {
    setImporting(true)
    try {
      await importAction(formData)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <form ref={formRef} action={upload} className="hidden">
        <label htmlFor="bookmark-import">Import CSV</label>
        <input ref={fileRef} id="bookmark-import" required name="file" type="file" accept=".csv,text/csv" onChange={(event) => { if (event.target.files?.length) formRef.current?.requestSubmit() }} />
      </form>
      <button type="button" aria-label="Import or export bookmarks" aria-haspopup="menu" aria-expanded={open} disabled={importing} onClick={() => setOpen((value) => !value)} className="button-secondary min-h-0 px-2 py-2 disabled:opacity-60">
        {importing ? <span className="px-1 text-xs">Importing…</span> : <MoreVertical size={16} />}
      </button>
      {open && (
        <div role="menu" className="issue-menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); fileRef.current?.click() }}><Upload size={14} />Import CSV</button>
          <a role="menuitem" href="/api/bookmarks/export" onClick={() => setOpen(false)} className={menuLinkClass}><Download size={14} />Export CSV</a>
          <p className="border-t border-[var(--line)] px-[0.6rem] pb-1 pt-2 text-[0.72rem] text-[var(--muted)]">CSV columns: title, url, collection, tags (tags separated by |).</p>
        </div>
      )}
    </div>
  )
}
