"use client"

import Link from "next/link"
import { type ReactNode, useEffect, useState } from "react"
import { ChevronDown, CornerDownRight, Pin, SquarePen } from "lucide-react"

export type NoteListRow = {
  id: string
  title: string
  folder: string
  /** Label links, rendered on the server (keeps the editor code out of this page). */
  tags: ReactNode
  isFavorite: boolean
  createdLabel: string
  updatedLabel: string
  depth: number
  childCount: number
  /** Shown in search results, where sub-pages appear without their parent. */
  parentTitle?: string
}

const STORAGE_KEY = "lifehub:notes-collapsed"

/** Rows in display order, minus everything below a collapsed note (rows are depth-first). */
function visibleRows(rows: NoteListRow[], collapsed: Set<string>) {
  const out: NoteListRow[] = []
  let hiddenBelow = Infinity
  for (const row of rows) {
    if (row.depth > hiddenBelow) continue
    hiddenBelow = collapsed.has(row.id) && row.childCount ? row.depth : Infinity
    out.push(row)
  }
  return out
}

/** The notes list; sub-pages sit under their page and can be folded away (remembered on this device). */
export function NoteList({ rows }: { rows: NoteListRow[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")
      // Browser storage is only readable after hydration.
      if (Array.isArray(saved)) setCollapsed(new Set(saved.filter((value) => typeof value === "string")))
    } catch {}
  }, [])
  const toggle = (id: string) => setCollapsed((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next].slice(-200))) } catch {}
    return next
  })

  const visible = visibleRows(rows, collapsed)

  return (
    <ul className="issue-list">
      {visible.map((row) => {
        const open = !collapsed.has(row.id)
        const Icon = row.depth ? CornerDownRight : SquarePen
        return (
          <li key={row.id} className="issue-row" data-depth={Math.min(row.depth, 4) || undefined}>
            {row.childCount > 0 ? (
              <button type="button" className="issue-row-twist" onClick={() => toggle(row.id)} aria-expanded={open} aria-label={(open ? "Collapse " : "Expand ") + row.title}><ChevronDown size={14} aria-hidden /></button>
            ) : rows.some((other) => other.childCount > 0) ? <span className="issue-row-spacer" aria-hidden /> : null}
            <Icon size={16} className="issue-row-icon" aria-hidden />
            <div className="min-w-0 flex-1">
              <Link href={"/notes/" + row.id} className="issue-row-title">{row.title}</Link>
              <p className="issue-row-meta">
                {row.folder}
                {row.childCount > 0 && <> · {row.childCount} {row.childCount === 1 ? "sub-page" : "sub-pages"}</>}
                {row.parentTitle && <> · in {row.parentTitle}</>}
                {" · created "}{row.createdLabel}
              </p>
              {row.tags}
            </div>
            <div className="issue-row-side">
              {row.isFavorite && <span className="issue-pin" title="Pinned"><Pin size={13} aria-hidden /><span className="sr-only">Pinned</span></span>}
              <span>updated {row.updatedLabel}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
