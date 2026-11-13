"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import { ChevronDown, Plus } from "lucide-react"
import { ancestorRows, childrenByParent } from "@/lib/note-tree.mjs"

export type PageNode = { id: string; title: string; parentId: string | null }
type Props = {
  pages: PageNode[]
  currentId: string
  canAdd: boolean
  addSubPage: (formData: FormData) => Promise<void>
}

/** The page tree around the open note: its top-level page and every sub-page below it. */
export function NotePages({ pages, currentId, canAdd, addSubPage }: Props) {
  const rows = useMemo(() => pages.map((page) => ({ id: page.id, title: page.title, parent_id: page.parentId })), [pages])
  const children = useMemo(() => childrenByParent(rows), [rows])
  // Open the path to the current note; other branches start closed so long trees stay short.
  const [collapsed, setCollapsed] = useState(() => {
    const open = new Set([currentId, ...ancestorRows(rows, currentId).map((row) => row.id)])
    return new Set(rows.filter((row) => !open.has(row.id) && children.has(row.id)).map((row) => row.id))
  })
  const [adding, setAdding] = useState(false)
  const toggle = (id: string) => setCollapsed((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const renderNode = (row: { id: string; title: string }) => {
    const kids = children.get(row.id) ?? []
    const open = !collapsed.has(row.id)
    const current = row.id === currentId
    return (
      <li key={row.id}>
        <div className="note-tree-row" data-current={current || undefined}>
          {kids.length ? (
            <button type="button" className="note-tree-twist" onClick={() => toggle(row.id)} aria-expanded={open} aria-label={(open ? "Collapse " : "Expand ") + row.title}>
              <ChevronDown size={14} aria-hidden />
            </button>
          ) : <span className="note-tree-twist" aria-hidden />}
          <Link href={"/notes/" + row.id} className="note-tree-link" aria-current={current ? "page" : undefined}>{row.title}</Link>
          {kids.length > 0 && <span className="note-tree-count" aria-label={kids.length + (kids.length === 1 ? " sub-page" : " sub-pages")}>{kids.length}</span>}
        </div>
        {kids.length > 0 && open && <ul className="note-tree">{kids.map((kid) => renderNode(kid))}</ul>}
      </li>
    )
  }

  return (
    <nav className="note-pages-panel" aria-label="Pages">
      <p className="note-pages-label">Pages</p>
      <ul className="note-tree">{(children.get(null) ?? []).map((row) => renderNode(row))}</ul>
      {canAdd && (adding ? (
        <form action={addSubPage} className="note-tree-form">
          <input type="hidden" name="parentId" value={currentId} />
          <input name="title" required maxLength={160} autoFocus placeholder="Sub-page title" aria-label="Sub-page title" className="field-control" onKeyDown={(event) => { if (event.key === "Escape") setAdding(false) }} />
          <AddButton />
        </form>
      ) : (
        <button type="button" className="note-tree-add" onClick={() => setAdding(true)}><Plus size={14} aria-hidden />Add sub-page</button>
      ))}
    </nav>
  )
}

function AddButton() {
  const { pending } = useFormStatus()
  return <button className="button-primary min-h-0 px-3 py-1.5 text-sm disabled:opacity-60" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
}
