import Link from "next/link"
import { Bookmark, CalendarDays, CircleDot, Database, SquarePen } from "lucide-react"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { relativeTime } from "@/lib/relative-time"

const TIME_ZONE = "Asia/Jakarta"
const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
const longDate = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" })
const weekdayShort = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "short" })
const dayOfMonth = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric" })
const timeOfDay = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" })
const shortDay = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short" })

/** Midnight in Jakarta for the day containing `date`. */
function jakartaMidnight(date: Date) {
  return new Date(dayKeyFormat.format(date) + "T00:00:00+07:00")
}

function formatBytes(value: number) {
  if (value < 1024) return value + " B"
  if (value < 1024 * 1024) return Math.round(value / 1024) + " KB"
  if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + " MB"
  return (value / (1024 * 1024 * 1024)).toFixed(1) + " GB"
}

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(now))
  return hour < 11 ? "Good morning" : hour < 15 ? "Good afternoon" : hour < 19 ? "Good evening" : "Good night"
}

const plural = (count: number, one: string, many = one + "s") => count + " " + (count === 1 ? one : many)

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ space?: string | string[] }> }) {
  const context = await getWorkspaceContext()
  if (!context) return null
  const { supabase, workspaceId, user } = context
  const now = new Date()
  const today = jakartaMidnight(now)
  const todayKey = dayKeyFormat.format(now)
  const weekStart = new Date(today.getTime() - WEEKDAYS.indexOf(weekdayShort.format(now)) * DAY_MS)
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS)
  const weekEndKey = dayKeyFormat.format(new Date(weekEnd.getTime() - 1))
  const activityStart = new Date(today.getTime() - 6 * DAY_MS)
  const params = await searchParams
  const requestedSpace = typeof params.space === "string" ? params.space : ""
  const spaceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedSpace) ? requestedSpace : null

  let openTasksQuery = supabase.from("tasks").select("id,title,status,priority,due_date", { count: "exact" }).eq("workspace_id", workspaceId).in("status", ["todo", "in_progress", "review"]).is("deleted_at", null)
  let doneTasksQuery = supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "done").is("deleted_at", null).gte("completed_at", weekStart.toISOString())
  // Counts run as separate head queries: the lists below are capped for display.
  let overdueQuery = supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("status", ["todo", "in_progress", "review"]).is("deleted_at", null).lt("due_date", todayKey)
  let dueSoonQuery = supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("status", ["todo", "in_progress", "review"]).is("deleted_at", null).gte("due_date", todayKey).lte("due_date", weekEndKey)
  let editedNotesQuery = supabase.from("notes").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null).is("archived_at", null).gte("updated_at", weekStart.toISOString())
  let notesQuery = supabase.from("notes").select("id,title,updated_at", { count: "exact" }).eq("workspace_id", workspaceId).is("deleted_at", null).is("archived_at", null)
  let storageQuery = supabase.from("files").select("size_bytes").eq("workspace_id", workspaceId).is("trashed_at", null)
  if (spaceId) {
    openTasksQuery = openTasksQuery.eq("space_id", spaceId)
    doneTasksQuery = doneTasksQuery.eq("space_id", spaceId)
    overdueQuery = overdueQuery.eq("space_id", spaceId)
    dueSoonQuery = dueSoonQuery.eq("space_id", spaceId)
    editedNotesQuery = editedNotesQuery.eq("space_id", spaceId)
    notesQuery = notesQuery.eq("space_id", spaceId)
    storageQuery = storageQuery.eq("space_id", spaceId)
  }

  const [openTasks, doneTasks, overdueTasks, dueSoonTasks, editedNotes, weekEvents, notes, activity, storageFiles, settings, bookmarks, profile] = await Promise.all([
    openTasksQuery.order("due_date", { ascending: true, nullsFirst: false }).limit(5),
    doneTasksQuery,
    overdueQuery,
    dueSoonQuery,
    editedNotesQuery,
    supabase.from("calendar_events").select("id,title,starts_at,ends_at").eq("workspace_id", workspaceId).gte("starts_at", weekStart.toISOString()).lt("starts_at", weekEnd.toISOString()).order("starts_at", { ascending: true }).limit(50),
    notesQuery.order("updated_at", { ascending: false }).limit(4),
    supabase.from("activity_logs").select("created_at").eq("workspace_id", workspaceId).gte("created_at", activityStart.toISOString()).order("created_at", { ascending: false }).limit(1000),
    storageQuery,
    supabase.from("workspace_settings").select("storage_limit_bytes").eq("workspace_id", workspaceId).maybeSingle(),
    supabase.from("bookmarks").select("id,title").eq("workspace_id", workspaceId).eq("is_favorite", true).is("archived_at", null).order("updated_at", { ascending: false }).limit(3),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ])

  const displayName = profile.data?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "there"
  const openCount = openTasks.count ?? 0
  const doneCount = doneTasks.count ?? 0
  const focusTotal = openCount + doneCount
  const dueThisWeek = dueSoonTasks.count ?? 0
  const overdue = overdueTasks.count ?? 0
  const eventCount = weekEvents.data?.length ?? 0
  const storageBytes = (storageFiles.data ?? []).reduce((total, file) => total + Number(file.size_bytes ?? 0), 0)
  const storageLimit = Number(settings.data?.storage_limit_bytes ?? 107374182400)
  const storagePercent = storageLimit ? Math.min(100, (storageBytes / storageLimit) * 100) : 0
  const notesThisWeek = editedNotes.count ?? 0

  const week = WEEKDAYS.map((label, index) => {
    const start = new Date(weekStart.getTime() + index * DAY_MS)
    const end = new Date(start.getTime() + DAY_MS)
    const events = (weekEvents.data ?? []).filter((event) => new Date(event.starts_at) >= start && new Date(event.starts_at) < end).length
    return { key: dayKeyFormat.format(start), label, day: dayOfMonth.format(start), isToday: start.getTime() === today.getTime(), events }
  })
  const upcoming = (weekEvents.data ?? []).filter((event) => new Date(event.ends_at) >= now).slice(0, 3)

  const activityDays = Array.from({ length: 7 }, (_, index) => {
    const start = new Date(activityStart.getTime() + index * DAY_MS)
    const end = new Date(start.getTime() + DAY_MS)
    const count = (activity.data ?? []).filter((item) => new Date(item.created_at) >= start && new Date(item.created_at) < end).length
    return { key: dayKeyFormat.format(start), label: weekdayShort.format(start), count, isToday: start.getTime() === today.getTime() }
  })
  const activityTotal = activityDays.reduce((total, day) => total + day.count, 0)
  const activityMax = Math.max(1, ...activityDays.map((day) => day.count))

  return (
    <div className="page-container">
      <header data-dashboard-widget="welcome" className="dash-head">
        <div className="min-w-0">
          <p className="text-sm text-[var(--muted)]">{longDate.format(now)}</p>
          <h1 className="dash-greeting">{greeting(now)}, {displayName}</h1>
        </div>
        <nav aria-label="Create" className="dash-actions">
          <Link href="/notes/new" className="button-secondary"><SquarePen size={15} aria-hidden />Note</Link>
          <Link href="/tasks/new" className="button-secondary"><CircleDot size={15} aria-hidden />Task</Link>
          <Link href="/calendar/new" className="button-secondary"><CalendarDays size={15} aria-hidden />Event</Link>
        </nav>
      </header>

      <section aria-label="Overview" className="dash-stats">
        <Link href="/tasks" className="dash-stat">
          <span className="dash-stat-label"><CircleDot size={14} aria-hidden />Open tasks</span>
          <strong>{openCount}</strong>
          <span className={"dash-stat-note" + (overdue ? " is-alert" : "")}>{overdue ? overdue + " overdue" : dueThisWeek ? dueThisWeek + " due this week" : "Nothing due this week"}</span>
        </Link>
        <Link href="/calendar" className="dash-stat">
          <span className="dash-stat-label"><CalendarDays size={14} aria-hidden />This week</span>
          <strong>{eventCount}</strong>
          <span className="dash-stat-note">{eventCount === 1 ? "event planned" : "events planned"}</span>
        </Link>
        <Link href="/notes" data-dashboard-widget="notes" className="dash-stat">
          <span className="dash-stat-label"><SquarePen size={14} aria-hidden />Notes</span>
          <strong>{notes.count ?? 0}</strong>
          <span className="dash-stat-note">{notesThisWeek ? notesThisWeek + " edited this week" : "No edits this week"}</span>
        </Link>
        <Link href="/files" data-dashboard-widget="storage" className="dash-stat">
          <span className="dash-stat-label"><Database size={14} aria-hidden />Storage</span>
          <strong>{formatBytes(storageBytes)}</strong>
          <span className="dash-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(storagePercent)} aria-label={"Storage used: " + formatBytes(storageBytes) + " of " + formatBytes(storageLimit)}><span style={{ width: Math.max(storagePercent, storageBytes ? 1.5 : 0) + "%" }} /></span>
        </Link>
      </section>

      <div className="dash-cards">
        <section data-dashboard-widget="tasks" className="dash-card dash-card-wide" aria-labelledby="dash-focus">
          <div className="dash-card-head"><h2 id="dash-focus">Focus this week</h2><span>{focusTotal ? doneCount + " of " + focusTotal + " done" : "All clear"}</span></div>
          <div className="dash-progress" aria-hidden><span style={{ width: (focusTotal ? (doneCount / focusTotal) * 100 : 0) + "%" }} /></div>
          {openTasks.data?.length ? (
            <ul className="dash-task-list">
              {openTasks.data.map((task) => (
                <li key={task.id}>
                  <CircleDot size={15} className="shrink-0 text-[var(--muted)]" aria-hidden />
                  <Link href={"/tasks/" + task.id} className="min-w-0 flex-1 truncate font-medium hover:underline">{task.title}</Link>
                  <span className="dash-priority" data-priority={task.priority}>{task.priority}</span>
                  {task.due_date && <span className={"dash-due" + (task.due_date < todayKey ? " is-overdue" : "")}>{shortDay.format(new Date(task.due_date + "T00:00:00+07:00"))}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="dash-empty">No open tasks. <Link href="/tasks/new">Create a task</Link></p>}
        </section>

        <section data-dashboard-widget="calendar" className="dash-card" aria-labelledby="dash-week">
          <div className="dash-card-head"><h2 id="dash-week">This week</h2><Link href="/calendar">Calendar</Link></div>
          <ol className="dash-week">
            {week.map((day) => (
              <li key={day.key}>
                <Link href={"/calendar/new?date=" + day.key} className={"dash-day" + (day.isToday ? " is-today" : "")} aria-label={day.label + " " + day.day + (day.events ? ", " + plural(day.events, "event") : "") + (day.isToday ? ", today" : "")}>
                  <span>{day.label}</span><strong>{day.day}</strong><i aria-hidden className={day.events ? "has-events" : ""} />
                </Link>
              </li>
            ))}
          </ol>
          {upcoming.length ? (
            <ul className="mt-3 space-y-2">
              {upcoming.map((event) => (
                <li key={event.id} className="flex min-w-0 items-baseline gap-2 text-sm"><span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">{weekdayShort.format(new Date(event.starts_at))} {timeOfDay.format(new Date(event.starts_at))}</span><Link href={"/calendar/" + event.id} className="truncate font-medium hover:underline">{event.title}</Link></li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-[var(--muted)]">Nothing planned. <Link href="/calendar/new" className="font-semibold text-[var(--foreground)] underline underline-offset-2">Plan an event</Link></p>}
        </section>

        <section data-dashboard-widget="activity" className="dash-card dash-card-wide" aria-labelledby="dash-activity">
          <div className="dash-card-head"><h2 id="dash-activity">Activity, last 7 days</h2><Link href="/activity">{plural(activityTotal, "change")}</Link></div>
          <ol className="dash-bars">
            {activityDays.map((day) => (
              <li key={day.key} title={day.label + ": " + plural(day.count, "change")}>
                <span className="dash-bar-track"><span className={"dash-bar" + (day.isToday ? " is-today" : "")} style={{ height: Math.max(4, (day.count / activityMax) * 100) + "%" }} /></span>
                <span className="dash-bar-label">{day.label}</span>
                <span className="sr-only">{plural(day.count, "change")}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="dash-card" aria-labelledby="dash-notes">
          <div className="dash-card-head"><h2 id="dash-notes">Recent notes</h2><Link href="/notes">View all</Link></div>
          {notes.data?.length ? (
            <ul className="dash-mini-list">
              {notes.data.map((note) => (
                <li key={note.id}><SquarePen size={14} aria-hidden /><Link href={"/notes/" + note.id} className="min-w-0 flex-1 truncate hover:underline">{note.title}</Link><time dateTime={note.updated_at}>{relativeTime(note.updated_at, now)}</time></li>
              ))}
            </ul>
          ) : <p className="dash-empty">No notes yet. <Link href="/notes/new">Write a note</Link></p>}
          {bookmarks.data?.length ? (
            <ul className="dash-mini-list dash-bookmarks">
              {bookmarks.data.map((bookmark) => (
                <li key={bookmark.id}><Bookmark size={14} aria-hidden /><Link href={"/bookmarks/" + bookmark.id} className="min-w-0 flex-1 truncate hover:underline">{bookmark.title}</Link></li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  )
}
