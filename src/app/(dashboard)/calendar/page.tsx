import Link from "next/link"
import { CalendarDays, Repeat } from "lucide-react"
import { expandCalendarEvents } from "@/lib/calendar/recurrence"
import { CalendarBoard, type CalendarView } from "@/components/calendar-board"
import { addDaysToKey, colorLabel, colorTone, dayKey, eventWhen } from "@/components/calendar/calendar-format"
import { relativeTime } from "@/lib/relative-time"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { getGoogleCalendarEvents } from "@/lib/google-drive-auth"

const views: CalendarView[] = ["agenda", "month", "week", "day"]

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; view?: string }> }) {
  const { error, success, view } = await searchParams
  const context = await getWorkspaceContext()
  if (!context) return null
  const [{ data: sourceEvents }, googleEvents] = await Promise.all([
    context.supabase.from("calendar_events").select("id,workspace_id,creator_id,title,description,starts_at,ends_at,recurrence_rule,color,reminder_minutes,reminder_sent_for").eq("workspace_id", context.workspaceId).order("starts_at"),
    getGoogleCalendarEvents(context.user.id),
  ])
  const now = new Date()
  const allEvents = expandCalendarEvents(sourceEvents ?? [], now, 90)
  const todayKey = dayKey(now)
  const tomorrowKey = addDaysToKey(todayKey, 1)
  const upcoming = allEvents
    .filter((event) => new Date(event.starts_at) >= now && (dayKey(event.starts_at) === todayKey || dayKey(event.starts_at) === tomorrowKey))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 6)

  return (
    <div className="page-container">
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

      <div className="issue-page-head">
        <h1 className="issue-title">Calendar</h1>
        <Link href="/calendar/new" className="button-primary min-h-0 px-3.5 py-2">New event</Link>
      </div>

      <CalendarBoard
        events={allEvents.map((event) => ({ id: event.id, sourceId: event.source_id, title: event.title, startsAt: event.starts_at, endsAt: event.ends_at, color: event.color, recurrence: event.recurrence_rule }))}
        googleEvents={googleEvents.map((event) => ({ id: event.id, title: event.title, startsAt: event.startsAt, endsAt: event.endsAt, htmlLink: event.htmlLink }))}
        todayKey={todayKey}
        initialView={views.includes(view as CalendarView) ? view as CalendarView : "agenda"}
      />

      <section className="mt-10" aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="issue-section-title">Today and tomorrow</h2>
        {upcoming.length ? (
          <ul className="issue-list">
            {upcoming.map((event) => (
              <li key={event.id} className="issue-row">
                {event.recurrence_rule ? <Repeat size={16} className="issue-row-icon" aria-hidden /> : <CalendarDays size={16} className="issue-row-icon" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <Link href={"/calendar/" + event.source_id} className="issue-row-title">{event.title}</Link>
                  <p className="issue-row-meta">{eventWhen(event.starts_at, event.ends_at)}</p>
                </div>
                <div className="issue-row-side">
                  <span className="tag-chip" data-tone={colorTone(event.color)}>{colorLabel(event.color)}</span>
                  <span>{relativeTime(event.starts_at, now)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="issue-empty">
            <h2>Nothing scheduled for today or tomorrow</h2>
            <p>Plan a focus block, a meeting, or a reminder so it has a place on the day.</p>
            <Link href="/calendar/new" className="button-primary mt-4">New event</Link>
          </div>
        )}
      </section>
    </div>
  )
}
