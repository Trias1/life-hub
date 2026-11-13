"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import { ChevronDown, GripVertical, Plus } from "lucide-react"
import { ancestorRows, childrenByParent } from "@/lib/note-tree.mjs"

export type PageNode = { id: string; title: string; parentId: string | null; sortOrder: number | null; createdAt: string }
type Props = {
  pages: PageNode[]
  currentId: string
  canAdd: boolean
  addSubPage: (formData: FormData) => Promise<void>
  /** Set when the open note is yours: its tree is yours too, so sub-pages can be reordered. */
  reorder?: (parentId: string, order: string[]) => Promise<{ error?: string }>
}
type Row = { id: string; title: string; parent_id: string | null; sort_order: number | null; created_at: string }

/** The page tree around the open note: its top-level page and every sub-page below it. */
export function NotePages({ pages, currentId, canAdd, addSubPage, reorder }: Props) {
  const router = useRouter()
  // Local copy so a drop shows at once; the server copy comes back with router.refresh().
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const rows = useMemo<Row[]>(() => pages.map((page) => ({ id: page.id, title: page.title, parent_id: page.parentId, sort_order: overrides[page.id] ?? page.sortOrder, created_at: page.createdAt })), [pages, overrides])
  const children = useMemo(() => childrenByParent(rows), [rows])
  // Open the path to the current note; other branches start closed so long trees stay short.
  const [collapsed, setCollapsed] = useState(() => {
    const open = new Set([currentId, ...ancestorRows(rows, currentId).map((row) => row.id)])
    return new Set(rows.filter((row) => !open.has(row.id) && children.has(row.id)).map((row) => row.id))
  })
  const [adding, setAdding] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const toggle = (id: string) => setCollapsed((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  async function move(id: string, targetIndex: number) {
    const row = rows.find((item) => item.id === id)
    if (!reorder || !row?.parent_id) return
    const siblings = (children.get(row.parent_id) ?? []).map((item) => item.id)
    const from = siblings.indexOf(id)
    const to = Math.max(0, Math.min(siblings.length - 1, targetIndex))
    if (from === -1 || from === to) return
    siblings.splice(to, 0, ...siblings.splice(from, 1))
    setOverrides((current) => ({ ...current, ...Object.fromEntries(siblings.map((siblingId, index) => [siblingId, index])) }))
    setMessage(row.title + " moved to position " + (to + 1) + " of " + siblings.length)
    const result = await reorder(row.parent_id, siblings)
    if (result.error) {
      setOverrides({})
      setMessage(result.error)
    }
    router.refresh()
  }

  const renderNode = (row: Row, index: number) => {
    const kids = children.get(row.id) ?? []
    const open = !collapsed.has(row.id)
    const current = row.id === currentId
    const movable = Boolean(reorder && row.parent_id)
    return (
      <li
        key={row.id}
        draggable={movable}
        onDragStart={movable ? (event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", row.id); setDragging(row.id) } : undefined}
        onDragEnd={() => setDragging(null)}
        onDragOver={(event) => {
          const draggedRow = rows.find((item) => item.id === dragging)
          if (!draggedRow || draggedRow.id === row.id || draggedRow.parent_id !== row.parent_id) return
          event.preventDefault()
          event.stopPropagation()
        }}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          const id = dragging
          setDragging(null)
          if (id) void move(id, index)
        }}
        data-dragging={dragging === row.id || undefined}
      >
        <div className="note-tree-row" data-current={current || undefined}>
          {kids.length ? (
            <button type="button" className="note-tree-twist" onClick={() => toggle(row.id)} aria-expanded={open} aria-label={(open ? "Collapse " : "Expand ") + row.title}>
              <ChevronDown size={14} aria-hidden />
            </button>
          ) : <span className="note-tree-twist" aria-hidden />}
          <Link
            href={"/notes/" + row.id}
            className="note-tree-link"
            aria-current={current ? "page" : undefined}
            aria-keyshortcuts={movable ? "Alt+ArrowUp Alt+ArrowDown" : undefined}
            onKeyDown={movable ? (event) => {
              if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return
              event.preventDefault()
              void move(row.id, index + (event.key === "ArrowUp" ? -1 : 1))
            } : undefined}
          >{row.title}</Link>
          {kids.length > 0 && <span className="note-tree-count" aria-label={kids.length + (kids.length === 1 ? " sub-page" : " sub-pages")}>{kids.length}</span>}
          {movable && <span className="note-tree-grip" aria-hidden title="Drag to reorder (or Alt+↑/↓)"><GripVertical size={13} /></span>}
        </div>
        {kids.length > 0 && open && <ul className="note-tree">{kids.map((kid, kidIndex) => renderNode(kid, kidIndex))}</ul>}
      </li>
    )
  }

  return (
    <nav className="note-pages-panel" aria-label="Pages">
      <p className="note-pages-label">Pages</p>
      <ul className="note-tree">{(children.get(null) ?? []).map((row, index) => renderNode(row, index))}</ul>
      <p role="status" className="sr-only">{message}</p>
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
