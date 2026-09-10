import Link from "next/link"
import { getWorkspaceContext } from "@/lib/workspace/server"

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function formatBytes(value: number) {
  if (value < 1024) return value + " B"
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB"
  if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + " MB"
  return (value / (1024 * 1024 * 1024)).toFixed(1) + " GB"
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ space?: string | string[] }> }) {
  const context = await getWorkspaceContext()
  if (!context) return null
  const supabase = context.supabase
  const workspaceId = context.workspaceId
  const user = context.user
  const now = new Date()
  const nowIso = now.toISOString()
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const params = await searchParams
  const requestedSpace = typeof params.space === "string" ? params.space : ""
  const spaceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedSpace) ? requestedSpace : null
  const tasksQuery = supabase.from("tasks").select("id,title,status,due_date", { count: "exact" }).eq("workspace_id", workspaceId).eq("status", "todo").is("deleted_at", null)
  const notesQuery = supabase.from("notes").select("id,title,content,folder,updated_at", { count: "exact" }).eq("workspace_id", workspaceId).is("deleted_at", null).is("archived_at", null)
  const filesQuery = supabase.from("files").select("id,name,mime_type,size_bytes,updated_at", { count: "exact" }).eq("workspace_id", workspaceId).is("trashed_at", null)
  const recentNotesQuery = supabase.from("notes").select("id,title,content,folder,updated_at").eq("workspace_id", workspaceId).is("deleted_at", null).is("archived_at", null)
  const recentFilesQuery = supabase.from("files").select("id,name,updated_at").eq("workspace_id", workspaceId).is("trashed_at", null)
  const storageFilesQuery = supabase.from("files").select("size_bytes").eq("workspace_id", workspaceId).is("trashed_at", null)
  if (spaceId) {
    tasksQuery.eq("space_id", spaceId)
    notesQuery.eq("space_id", spaceId)
    filesQuery.eq("space_id", spaceId)
    recentNotesQuery.eq("space_id", spaceId)
    recentFilesQuery.eq("space_id", spaceId)
    storageFilesQuery.eq("space_id", spaceId)
  }
  const [tasks, events, notes, files, unread, activity, recentNotes, recentFiles, upcomingEvents, storageFiles, members, profile] = await Promise.all([
    tasksQuery.order("due_date", { ascending: true, nullsFirst: false }).limit(4),
    supabase.from("calendar_events").select("id,title,starts_at,ends_at", { count: "exact" }).eq("workspace_id", workspaceId).gte("starts_at", nowIso).lte("starts_at", nextWeek).order("starts_at", { ascending: true }).limit(4),
    notesQuery.order("updated_at", { ascending: false }).limit(4),
    filesQuery.order("updated_at", { ascending: false }).limit(4),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).eq("is_read", false),
    supabase.from("activity_logs").select("id,action,entity_type,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(5),
    recentNotesQuery.order("updated_at", { ascending: false }).limit(3),
    recentFilesQuery.order("updated_at", { ascending: false }).limit(3),
    supabase.from("calendar_events").select("id,title,starts_at,ends_at").eq("workspace_id", workspaceId).gte("starts_at", nowIso).order("starts_at", { ascending: true }).limit(4),
    storageFilesQuery,
    supabase.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ])
  const displayName = profile.data?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "there"
  const storageBytes = (storageFiles.data ?? []).reduce((total, file) => total + Number(file.size_bytes ?? 0), 0)
  const continueItems = [
    ...(tasks.data ?? []).map((item) => ({ id: item.id, title: item.title, type: "Task", detail: item.due_date ? "Due " + item.due_date : "Open task", time: item.due_date ? new Date(item.due_date).getTime() : 0 })),
    ...(recentNotes.data ?? []).map((item) => ({ id: item.id, title: item.title, type: "Note", detail: stripHtml(item.content) || "No content yet", time: new Date(item.updated_at).getTime() })),
    ...(recentFiles.data ?? []).map((item) => ({ id: item.id, title: item.name, type: "File", detail: "Workspace file", time: new Date(item.updated_at).getTime() })),
  ].sort((a, b) => b.time - a.time).slice(0, 5)
  const cards = [
    { label: "Open tasks", value: tasks.count ?? 0, detail: tasks.data?.filter((item) => item.due_date).length + " with due dates", href: "/tasks" },
    { label: "Upcoming events", value: events.count ?? 0, detail: "Next 7 days", href: "/calendar" },
    { label: "Active notes", value: notes.count ?? 0, detail: "Updated recently", href: "/notes" },
    { label: "Workspace files", value: files.count ?? 0, detail: formatBytes(storageBytes) + " stored", href: "/files" },
  ]

  return <div className="page-container"><header data-dashboard-widget="welcome" className="page-header"><div><p className="eyebrow">Workspace overview</p><h1 className="page-title">Good to see you, {displayName}.</h1><p className="page-description">Pick up where you left off or make one small thing useful today.</p></div><span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700">{unread.count ?? 0} unread</span></header><section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <Link key={card.label} href={card.href} data-dashboard-widget={card.label} className="surface metric-card block h-32 overflow-hidden transition hover:-translate-y-0.5"><p className="metric-label">{card.label}</p><p className="metric-value">{card.value}</p><p className="mt-2 text-xs text-zinc-400">{card.detail}</p></Link>)}</section><section className="mt-8 grid gap-4 md:grid-cols-[1.35fr_0.65fr]"><article className="surface flex h-[360px] min-h-0 flex-col overflow-hidden p-6"><div className="toolbar shrink-0"><div><p className="eyebrow">Continue working</p><h2 className="mt-1 text-lg font-semibold">Your latest workspace context</h2></div><Link href="/notes" className="button-quiet min-h-0 px-2 py-1 text-xs">Open notes</Link></div>{continueItems.length ? <div className="mt-5 min-h-0 flex-1 overflow-y-auto space-y-2">{continueItems.map((item) => <Link key={item.type + item.id} href={item.type === "Note" ? "/notes?note=" + item.id : item.type === "Task" ? "/tasks" : "/files"} className="flex items-center gap-3 rounded-xl border p-3 transition hover:bg-[var(--surface-muted)]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-xs font-bold text-[var(--accent)]">{item.type.slice(0, 1)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="mt-1 block truncate text-xs text-zinc-500">{item.detail}</span></span><span className="text-xs text-zinc-400">{item.type}</span></Link>)}</div> : <div className="empty-state mt-5"><h3 className="font-semibold">Nothing to continue yet</h3><p>Create a note or task to start your workspace trail.</p></div>}</article><article className="surface-muted h-[360px] overflow-hidden p-6"><p className="eyebrow">Quick actions</p><h2 className="mt-1 text-lg font-semibold">Make progress quickly</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Keep capture lightweight; details can come later.</p><div className="mt-5 grid gap-2"><Link href="/notes" className="button-primary">Create a note</Link><Link href="/tasks" className="button-secondary">Add a task</Link><Link href="/calendar" className="button-secondary">Plan an event</Link></div></article></section><section className="mt-8 grid gap-4 md:grid-cols-2"><article className="surface flex h-[360px] min-h-0 flex-col overflow-hidden p-6"><div className="toolbar shrink-0"><div><p className="eyebrow">Recent notes</p><h2 className="mt-1 text-lg font-semibold">Ideas worth reopening</h2></div><Link href="/notes" className="button-quiet min-h-0 px-2 py-1 text-xs">View all</Link></div>{recentNotes.data?.length ? <div className="mt-5 min-h-0 flex-1 overflow-y-auto space-y-3">{recentNotes.data.map((note) => <Link key={note.id} href={["/notes?note=", note.id].join("")} className="block rounded-xl border p-3 transition hover:bg-[var(--surface-muted)]"><p className="truncate text-sm font-semibold">{note.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{stripHtml(note.content) || "No content yet."}</p><p className="mt-2 text-[11px] text-zinc-400">Updated {new Date(note.updated_at).toLocaleDateString()} · {note.folder}</p></Link>)}</div> : <p className="mt-5 text-sm text-zinc-500">Your recent notes will appear here.</p>}</article><article className="surface flex h-[360px] min-h-0 flex-col overflow-hidden p-6"><div className="toolbar shrink-0"><div><p className="eyebrow">Upcoming events</p><h2 className="mt-1 text-lg font-semibold">What is next</h2></div><Link href="/calendar" className="button-quiet min-h-0 px-2 py-1 text-xs">Calendar</Link></div>{upcomingEvents.data?.length ? <div className="mt-5 min-h-0 flex-1 overflow-y-auto space-y-3">{upcomingEvents.data.map((event) => <Link key={event.id} href="/calendar" className="flex items-center gap-3 rounded-xl border p-3 transition hover:bg-[var(--surface-muted)]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-xs font-bold text-[var(--accent)]">{new Date(event.starts_at).getDate()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{event.title}</span><span className="mt-1 block text-xs text-zinc-500">{new Date(event.starts_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span></span></Link>)}</div> : <p className="mt-5 text-sm text-zinc-500">No upcoming events scheduled.</p>}</article></section><section className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"><article data-dashboard-widget="activity" className="surface p-6"><div className="toolbar"><div><p className="eyebrow">Activity feed</p><h2 className="mt-1 text-lg font-semibold">Recent workspace movement</h2></div><Link href="/activity" className="button-quiet min-h-0 px-2 py-1 text-xs">View activity</Link></div>{activity.data?.length ? <div className="mt-5 space-y-3">{activity.data.map((item) => <div key={item.id} className="border-b border-zinc-200 pb-3 last:border-0 last:pb-0"><p className="text-sm font-medium">{item.action} <span className="font-normal text-zinc-400">· {item.entity_type}</span></p><p className="mt-1 text-xs text-zinc-500">{new Date(item.created_at).toLocaleString()}</p></div>)}</div> : <p className="mt-5 text-sm text-zinc-500">Your recent workspace activity will appear here.</p>}</article><article className="surface-muted p-6"><p className="eyebrow">Workspace health</p><h2 className="mt-1 text-lg font-semibold">A quick pulse</h2><div className="mt-5 space-y-4"><div><div className="flex items-center justify-between text-sm"><span className="text-zinc-500">Storage used</span><span className="font-semibold">{formatBytes(storageBytes)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/60"><div className="h-full w-[12%] rounded-full bg-[var(--accent)]" /></div></div><div className="flex items-center justify-between border-t pt-4 text-sm"><span className="text-zinc-500">Workspace members</span><span className="font-semibold">{members.count ?? 0}</span></div><div className="flex items-center justify-between text-sm"><span className="text-zinc-500">Unread notifications</span><span className="font-semibold">{unread.count ?? 0}</span></div></div></article></section></div>
}
