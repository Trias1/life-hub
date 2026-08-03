"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Archive, Bell, Check, CheckCheck, ChevronDown, Search, Trash2 } from "lucide-react"

type Notification = { id: string; message: string; type: string; is_read: boolean; created_at: string; priority: "low" | "normal" | "high" | "urgent"; resource_name: string | null; link: string | null }
type Action = (formData: FormData) => Promise<void>
type Props = { notifications: Notification[]; markRead: Action; markSelectedRead: Action; archiveSelected: Action; deleteSelected: Action }

const tabs = ["all", "unread", "mentions", "system"] as const
type Tab = typeof tabs[number]

function isSystem(type: string) { return ["system", "security", "billing", "workspace"].includes(type) }
function time(value: string) { return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round((new Date(value).getTime() - Date.now()) / 60000), "minute") }

export function NotificationsCenter({ notifications, markRead, markSelectedRead, archiveSelected, deleteSelected }: Props) {
  const [tab, setTab] = useState<Tab>("all")
  const [query, setQuery] = useState("")
  const [priority, setPriority] = useState("all")
  const [sort, setSort] = useState("latest")
  const [selected, setSelected] = useState<string[]>([])
  const [visible, setVisible] = useState(20)
  const sentinel = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => notifications.filter((item) => {
    const matchesTab = tab === "all" || tab === "unread" && !item.is_read || tab === "mentions" && item.type === "mention" || tab === "system" && isSystem(item.type)
    const matchesQuery = !query || (item.message + " " + (item.resource_name ?? "") + " " + item.type).toLowerCase().includes(query.toLowerCase())
    return matchesTab && matchesQuery && (priority === "all" || item.priority === priority)
  }).sort((left, right) => sort === "unread" ? Number(left.is_read) - Number(right.is_read) : new Date(right.created_at).getTime() - new Date(left.created_at).getTime()), [notifications, priority, query, sort, tab])

  useEffect(() => { setVisible(20); setSelected([]) }, [tab, query, priority, sort])
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible((count) => Math.min(count + 20, filtered.length)) }, { rootMargin: "180px" })
    const current = sentinel.current
    if (current) observer.observe(current)
    return () => observer.disconnect()
  }, [filtered.length])

  const shown = filtered.slice(0, visible)
  const selectedValue = JSON.stringify(selected)
  const toggle = (id: string) => setSelected((value) => value.includes(id) ? value.filter((item) => item !== id) : [...value, id])

  return <section className="mt-7"><div className="flex flex-col gap-3 border-y py-3 lg:flex-row lg:items-center"><div className="flex flex-wrap gap-1">{tabs.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={tab === item ? "button-secondary min-h-0 px-3 py-2 capitalize" : "button-quiet min-h-0 px-3 py-2 capitalize"}>{item}</button>)}</div><label className="relative flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="field-control pl-9" placeholder="Search notifications" /></label><div className="flex gap-2"><label className="sr-only" htmlFor="notification-priority">Priority</label><select id="notification-priority" value={priority} onChange={(event) => setPriority(event.target.value)} className="field-control min-h-0 py-2 text-sm"><option value="all">All priority</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select><label className="sr-only" htmlFor="notification-sort">Sort</label><select id="notification-sort" value={sort} onChange={(event) => setSort(event.target.value)} className="field-control min-h-0 py-2 text-sm"><option value="latest">Latest</option><option value="unread">Unread first</option></select></div></div>{selected.length > 0 && <div className="surface mt-4 flex flex-wrap items-center gap-2 p-3"><span className="mr-auto text-sm font-semibold">{selected.length} selected</span><form action={markSelectedRead}><input type="hidden" name="ids" value={selectedValue} /><button className="button-secondary min-h-0 gap-1.5 px-3 py-2"><CheckCheck size={15} />Read</button></form><form action={archiveSelected}><input type="hidden" name="ids" value={selectedValue} /><button className="button-secondary min-h-0 gap-1.5 px-3 py-2"><Archive size={15} />Archive</button></form><form action={deleteSelected}><input type="hidden" name="ids" value={selectedValue} /><button className="button-secondary min-h-0 gap-1.5 px-3 py-2 text-red-600"><Trash2 size={15} />Delete</button></form></div>}<div className="mt-5 space-y-2">{shown.length ? shown.map((item) => { const body = <><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">{item.type.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{item.message}</span>{item.resource_name && <span className="text-zinc-500">? {item.resource_name}</span>}{item.priority !== "normal" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">{item.priority}</span>}</span><span className="mt-1 flex items-center gap-2 text-xs text-zinc-500"><span className="capitalize">{item.type}</span><span>{time(item.created_at)}</span></span></span>{!item.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" aria-label="Unread" />}</>; return <article key={item.id} className={"surface group flex items-start gap-3 p-4 transition hover:-translate-y-px " + (!item.is_read ? "border-[var(--accent)]/35" : "opacity-75")}><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} className="mt-3 h-4 w-4 accent-[var(--accent)]" aria-label={"Select notification: " + item.message} />{item.link ? <Link href={item.link} className="flex min-w-0 flex-1 items-start gap-3">{body}</Link> : <div className="flex min-w-0 flex-1 items-start gap-3">{body}</div>}{!item.is_read && <form action={markRead} className="opacity-0 transition group-hover:opacity-100"><input type="hidden" name="id" value={item.id} /><button className="button-quiet min-h-0 p-2" aria-label="Mark as read"><Check size={15} /></button></form>}</article> }) : <div className="empty-state surface"><Bell className="mx-auto h-9 w-9 text-[var(--accent)]" /><h2 className="mt-4 font-semibold">You?re all caught up</h2><p>No unread notifications match this view.</p><Link href="/activity" className="button-primary mt-5">View Activity Timeline</Link></div>}</div>{shown.length < filtered.length && <div ref={sentinel} className="flex justify-center py-6"><ChevronDown className="animate-bounce text-zinc-400" aria-label="Loading more notifications" /></div>}</section>
}
