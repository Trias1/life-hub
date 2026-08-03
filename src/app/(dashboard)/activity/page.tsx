import Link from "next/link"
import { getWorkspaceContext } from "@/lib/workspace/server"

type ActivityView = "grouped" | "timeline"
type ActivityGroup = "Today" | "Yesterday" | "Last 7 Days" | "Older"
type ActivityLog = { id: string; action: string; entity_type: string; created_at: string }

const groupOrder: ActivityGroup[] = ["Today", "Yesterday", "Last 7 Days", "Older"]

function startOfDay(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

function activityGroup(createdAt: string, now: Date): ActivityGroup {
  const date = new Date(createdAt)
  const today = startOfDay(now)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const lastSevenDays = new Date(today)
  lastSevenDays.setDate(lastSevenDays.getDate() - 6)

  if (date >= today) return "Today"
  if (date >= yesterday) return "Yesterday"
  if (date >= lastSevenDays) return "Last 7 Days"
  return "Older"
}

function entityLabel(value: string) {
  return value.replaceAll("_", " ")
}

function ActivityItem({ log }: { log: ActivityLog }) {
  return <article className="surface flex gap-4 p-5"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-zinc-1000" /><div><p className="font-medium">{log.action} <span className="text-zinc-400">&middot;</span> {entityLabel(log.entity_type)}</p><p className="mt-1 text-sm text-zinc-500">{new Date(log.created_at).toLocaleString()}</p></div></article>
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ q?: string; entity?: string; group?: string }> }) {
  const { q = "", entity = "all", group = "grouped" } = await searchParams
  const query = q.trim().slice(0, 80).toLowerCase()
  const view: ActivityView = group === "timeline" ? "timeline" : "grouped"
  const context = await getWorkspaceContext()
  if (!context) return null

  const { data } = await context.supabase.from("activity_logs").select("id,action,entity_type,created_at").eq("workspace_id", context.workspaceId).order("created_at", { ascending: false }).limit(50)
  const logs = (data ?? []) as ActivityLog[]
  const entityTypes = Array.from(new Set(logs.map((log) => log.entity_type))).sort()
  const filteredLogs = logs.filter((log) => (entity === "all" || log.entity_type === entity) && (!query || (log.action + " " + log.entity_type).toLowerCase().includes(query)))
  const now = new Date()
  const groupedLogs = filteredLogs.reduce<Record<ActivityGroup, ActivityLog[]>>((groups, log) => {
    const key = activityGroup(log.created_at, now)
    return { ...groups, [key]: [...groups[key], log] }
  }, { Today: [], Yesterday: [], "Last 7 Days": [], Older: [] })

  return <div className="page-container"><header className="page-header"><div><p className="eyebrow">Workspace history</p><h1 className="page-title">Activity</h1><p className="page-description">A lightweight timeline of changes across your workspace.</p></div><span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700">{filteredLogs.length} events</span></header><form method="get" className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto]"><label className="sr-only" htmlFor="activity-search">Search activity</label><input id="activity-search" name="q" defaultValue={q} placeholder="Search activity" className="field-control" /><label className="sr-only" htmlFor="activity-entity">Filter by type</label><select id="activity-entity" name="entity" defaultValue={entity} className="field-control"><option value="all">All types</option>{entityTypes.map((item) => <option key={item} value={item}>{entityLabel(item)}</option>)}</select><label className="sr-only" htmlFor="activity-group">Activity layout</label><select id="activity-group" name="group" defaultValue={view} className="field-control"><option value="grouped">Grouped</option><option value="timeline">Timeline</option></select><button className="button-secondary">Filter</button><Link href="/activity" className="button-quiet">Clear</Link></form><section className="mt-8">{filteredLogs.length ? view === "grouped" ? <div className="space-y-8">{groupOrder.map((label) => groupedLogs[label].length ? <section key={label}><div className="mb-3 flex items-center gap-3"><h2 className="text-sm font-semibold text-zinc-700">{label}</h2><span className="text-xs text-zinc-400">{groupedLogs[label].length}</span></div><div className="space-y-3">{groupedLogs[label].map((log) => <ActivityItem key={log.id} log={log} />)}</div></section> : null)}</div> : <div className="space-y-3">{filteredLogs.map((log) => <ActivityItem key={log.id} log={log} />)}</div> : <div className="empty-state surface"><h2 className="font-semibold">{logs.length ? "No activity matches" : "No activity yet"}</h2><p>{logs.length ? "Try a different search or filter." : "Workspace changes will appear here as you create content."}</p></div>}</section></div>
}
