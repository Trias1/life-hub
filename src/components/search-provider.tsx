"use client"

import Link from "next/link"
import { createPortal } from "react-dom"
import { useEffect, useState } from "react"
import { Search, X } from "lucide-react"

type Result = { id: string; type: "note" | "task" | "file" | "bookmark"; title: string; subtitle: string; href: string }
const items = [{ label: "Dashboard", href: "/dashboard", group: "Workspace" }, { label: "Notes", href: "/notes", group: "Workspace" }, { label: "Tasks", href: "/tasks", group: "Workspace" }, { label: "Calendar", href: "/calendar", group: "Workspace" }, { label: "Files", href: "/files", group: "Workspace" }, { label: "Bookmarks", href: "/bookmarks", group: "Workspace" }, { label: "Notifications", href: "/notifications", group: "Workspace" }, { label: "Profile", href: "/profile", group: "People" }, { label: "Settings", href: "/settings", group: "Commands" }]

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const normalized = query.trim()
  useEffect(() => {
    const openSearch = () => { setOpen(true); setQuery("") }
    const onKeyDown = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); window.dispatchEvent(new CustomEvent("lifehub:open-search")) } }
    window.addEventListener("lifehub:open-search", openSearch)
    window.addEventListener("keydown", onKeyDown)
    return () => { window.removeEventListener("lifehub:open-search", openSearch); window.removeEventListener("keydown", onKeyDown) }
  }, [])
  useEffect(() => {
    if (!open || normalized.length < 2) { setResults([]); setLoading(false); setError(false); return }
    const controller = new AbortController(); setLoading(true); setError(false)
    const timer = window.setTimeout(async () => { try { const response = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`, { signal: controller.signal }); if (!response.ok) throw new Error("Search failed"); const payload = await response.json() as { results?: Result[] }; setResults(payload.results ?? []) } catch (cause) { if ((cause as Error).name !== "AbortError") { setResults([]); setError(true) } } finally { if (!controller.signal.aborted) setLoading(false) } }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [normalized, open])
  return <>{children}{open && typeof document !== "undefined" && createPortal(<div className="fixed inset-0 z-[999] flex items-center justify-center bg-zinc-950/40 px-4" onClick={() => setOpen(false)}><div className="relative max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] shadow-2xl" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-3 border-b border-[var(--line)] px-4"><Search size={19} className="text-[var(--muted)]" /><label className="sr-only" htmlFor="global-search">Search everything</label><input id="global-search" autoFocus maxLength={80} value={query} onChange={(event) => setQuery(event.target.value)} className="h-14 flex-1 bg-transparent text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]" placeholder="Search notes, files, tasks, bookmarks..." /><button type="button" onClick={() => setOpen(false)} className="button-quiet min-h-0 p-2" aria-label="Close search"><X size={18} /></button></div><div className="max-h-[60vh] overflow-y-auto p-2" aria-live="polite">{!normalized ? items.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-3 text-sm hover:bg-[var(--surface-muted)]"><span>{item.label}</span><span className="text-xs text-[var(--muted)]">{item.group}</span></Link>) : normalized.length < 2 ? <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">Type at least 2 characters.</p> : loading ? <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">Searching workspace...</p> : error ? <p className="px-3 py-8 text-center text-sm text-red-600">Could not search workspace.</p> : results.length ? results.map((item) => <Link key={`${item.type}:${item.id}`} href={item.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-sm hover:bg-[var(--surface-muted)]"><span className="flex items-center justify-between gap-3"><span className="truncate font-medium">{item.title}</span><span className="shrink-0 text-xs capitalize text-[var(--muted)]">{item.type}</span></span><span className="mt-1 block truncate text-xs text-[var(--muted)]">{item.subtitle}</span></Link>) : <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">No workspace results found.</p>}</div><div className="border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]">Search current workspace - Press Esc to close</div></div></div>, document.body)}</>}
