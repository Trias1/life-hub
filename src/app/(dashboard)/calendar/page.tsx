import { expandCalendarEvents } from "@/lib/calendar/recurrence"
import { CalendarBoard } from "@/components/calendar-board"
import { DateTimePicker } from "@/components/date-time-picker"
import { Select } from "@/components/ui/select"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { addEventAttendee, createEvent, deleteEvent, removeEventAttendee, respondEventAttendee, updateEvent } from "./actions"

function sameDay(first: Date, second: Date) {
  return first.toDateString() === second.toDateString()
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error, success } = await searchParams
  const context = await getWorkspaceContext()
  if (!context) return null
  const { data: sourceEvents } = await context.supabase.from("calendar_events").select("id,workspace_id,creator_id,title,description,starts_at,ends_at,recurrence_rule,color,reminder_minutes,reminder_sent_for").eq("workspace_id", context.workspaceId).order("starts_at")
  const eventRows = sourceEvents ?? []
  const allEvents = expandCalendarEvents(eventRows, new Date(), 90)
  const sourceEventIds = eventRows.map((event) => event.id)
  const { data: attendees } = sourceEventIds.length ? await context.supabase.from("calendar_event_attendees").select("id,event_id,user_id,email,response").in("event_id", sourceEventIds) : { data: [] as Array<{ id: string; event_id: string; user_id: string | null; email: string | null; response: string }> }
  const { data: members } = await context.supabase.from("workspace_members").select("user_id,role").eq("workspace_id", context.workspaceId).order("created_at")
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const upcoming = allEvents.filter((event) => new Date(event.starts_at) >= today && (sameDay(new Date(event.starts_at), today) || sameDay(new Date(event.starts_at), tomorrow))).slice(0, 6)

  return <div className="page-container"><header className="page-header"><div><p className="eyebrow">Time and focus</p><h1 className="page-title">Calendar</h1><p className="page-description">Plan work visually and give important moments a place on the day.</p></div><span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">{allEvents.length} scheduled</span></header>{error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}<section className="surface mt-8 p-5"><div className="toolbar"><div><p className="eyebrow">Quick event</p><h2 className="mt-1 text-lg font-semibold">Create in under 10 seconds</h2></div><p className="text-xs text-zinc-400">Agenda, month, week, and day views below</p></div><form action={createEvent} className="mt-5 grid gap-3 md:grid-cols-4"><label className="field-label md:col-span-4">Title<input required name="title" placeholder="Event title" className="field-control" /></label><label className="field-label md:col-span-2">Description<textarea name="description" maxLength={1000} className="field-control min-h-20 resize-y" /></label><label className="field-label">Starts<DateTimePicker name="startsAt" required /></label><label className="field-label">Ends<DateTimePicker name="endsAt" required /></label><label className="field-label">Repeat<Select name="recurrence" className="field-control" options={[{ value: "", label: "Does not repeat" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} /></label><label className="field-label">Reminder<Select name="reminder" className="field-control" options={[{ value: "0", label: "No reminder" }, { value: "10", label: "10 minutes before" }, { value: "30", label: "30 minutes before" }, { value: "1440", label: "1 day before" }]} /></label><label className="field-label">Color<Select name="color" defaultValue="indigo" className="field-control" options={[{ value: "indigo", label: "Neutral" }, { value: "blue", label: "Blue" }, { value: "emerald", label: "Emerald" }, { value: "rose", label: "Rose" }]} /></label><div className="md:col-span-3"><button className="button-primary">Create event</button></div></form></section><section className="mt-8 grid gap-4 lg:grid-cols-[1fr_18rem]"><CalendarBoard events={allEvents} attendees={attendees ?? []} members={members ?? []} currentUserId={context.user.id} currentUserEmail={context.user.email ?? ""} updateEvent={updateEvent} deleteEvent={deleteEvent} addEventAttendee={addEventAttendee} removeEventAttendee={removeEventAttendee} respondEventAttendee={respondEventAttendee} /><aside className="surface h-fit p-5"><p className="eyebrow">Upcoming</p><h2 className="mt-1 text-lg font-semibold">Today and tomorrow</h2>{upcoming.length ? <div className="mt-5 space-y-3">{upcoming.map((event) => <article key={event.id} className="rounded-xl border p-3"><p className="truncate text-sm font-semibold">{event.title}</p><p className="mt-1 text-xs text-zinc-500">{new Date(event.starts_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</p></article>)}</div> : <p className="mt-5 text-sm leading-6 text-zinc-500">Nothing scheduled for today or tomorrow.</p>}</aside></section></div>
}
