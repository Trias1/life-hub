"use client"

import { useMemo, useState } from "react"
import { DateTimePicker } from "@/components/date-time-picker"
import { Select } from "@/components/ui/select"
import { ChevronLeft, ChevronRight } from "lucide-react"

type CalendarEvent = { id: string; source_id: string; occurrence_index: number; title: string; description: string; starts_at: string; ends_at: string; recurrence_rule: string | null; color: string; reminder_minutes: number | null; creator_id?: string }
type CalendarAttendee = { id: string; event_id: string; user_id: string | null; email: string | null; response: string }
type CalendarView = "agenda" | "month" | "week" | "day"
type FormAction = (formData: FormData) => Promise<void>
type Props = { events: CalendarEvent[]; attendees: CalendarAttendee[]; members: Array<{ user_id: string; role: string }>; currentUserId: string; currentUserEmail: string; updateEvent: FormAction; deleteEvent: FormAction; addEventAttendee: FormAction; removeEventAttendee: FormAction; respondEventAttendee: FormAction }

function localDateTime(value: string) {
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, "0")
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes())
}

function attendeeLabel(attendee: CalendarAttendee) {
  return attendee.email ?? (attendee.user_id ? "Member " + attendee.user_id.slice(0, 8) : "Workspace attendee")
}

export function CalendarBoard({ events, attendees, members, currentUserId, currentUserEmail, updateEvent, deleteEvent, addEventAttendee, removeEventAttendee, respondEventAttendee }: Props) {
  const [view, setView] = useState<CalendarView>("agenda")
  const [displayDate, setDisplayDate] = useState(() => new Date())
  const prevMonth = () => setDisplayDate((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1))
  const nextMonth = () => setDisplayDate((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1))
  const goToToday = () => setDisplayDate(new Date())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const today = useMemo(() => new Date(), [])
  const selected = events.find((event) => event.id === selectedId)
  const selectedSourceId = selected?.source_id ?? selected?.id
  const selectedAttendees = attendees.filter((attendee) => attendee.event_id === selectedSourceId)
  const canManageAttendees = selected?.creator_id === currentUserId
  const monthDays = useMemo(() => {
    const start = new Date(displayDate.getFullYear(), displayDate.getMonth(), 1)
    const end = new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 0)
    const days = []
    for (let index = 1; index <= end.getDate(); index += 1)
      days.push(new Date(displayDate.getFullYear(), displayDate.getMonth(), index))
    return { start, days }
  }, [displayDate])
  const eventsForDay = (date: Date) => events.filter((event) => new Date(event.starts_at).toDateString() === date.toDateString())
  const eventCard = (event: CalendarEvent) => (
    <button
      key={event.id}
      type="button"
      onClick={() => setSelectedId(event.id)}
      className="surface flex w-full flex-col gap-2 p-5 text-left transition hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <span>
        <span className="block font-semibold">{event.title}</span>
        <span className="mt-1 block text-sm text-[var(--muted)]">
          {new Date(event.starts_at).toLocaleString()} Â· {new Date(event.ends_at).toLocaleString()}
        </span>
      </span>
      <span className="w-fit rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)]">
        {event.recurrence_rule ? "Recurring" : "Scheduled"}
      </span>
    </button>
  )

  return (
    <section className="mt-8">
      {/* Toolbar */}
      <div className="toolbar mb-4">
        <div>
          <p className="eyebrow">{displayDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
          <h2 className="mt-1 text-lg font-semibold">Your schedule</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg bg-[var(--surface-muted)] p-1">
          {(["agenda", "month", "week", "day"] as CalendarView[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={view === item ? "button-secondary min-h-0 px-3 py-1.5 text-xs capitalize" : "button-quiet min-h-0 px-3 py-1.5 text-xs capitalize"}
            >
              {item}
            </button>
          ))}
          </div>
          {view === "month" && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={prevMonth} className="button-secondary min-h-0 p-2" aria-label="Previous month"><ChevronLeft size={16} /></button>
              <button type="button" onClick={goToToday} className="button-secondary min-h-0 px-3 py-1.5 text-xs">Today</button>
              <button type="button" onClick={nextMonth} className="button-secondary min-h-0 p-2" aria-label="Next month"><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      </div>

      {/* Agenda view */}
      {view === "agenda" ? (
        <div>
          {events.length ? (
            <div className="space-y-3">{events.map(eventCard)}</div>
          ) : (
            <div className="empty-state surface">
              <h2 className="font-semibold">Your calendar is clear</h2>
              <p>Add an event above to start building your agenda.</p>
            </div>
          )}
        </div>

      /* Month view */
      ) : view === "month" ? (
        <div className="surface overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-[var(--surface-muted)] text-center text-xs font-semibold text-[var(--muted)]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="p-3">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: monthDays.start.getDay() }).map((_, index) => (
              <div key={"empty-" + index} className="min-h-24 border-b border-r bg-[var(--surface-muted)]/50" />
            ))}
            {monthDays.days.map((date) => (
              <div key={date.toISOString()} className="min-h-24 border-b border-r p-2">
                <p className={
                  date.toDateString() === today.toDateString()
                    ? "grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-xs font-semibold text-[var(--on-accent)]"
                    : "text-xs font-semibold text-[var(--muted)]"
                }>
                  {date.getDate()}
                </p>
                <div className="mt-2 space-y-1">
                  {eventsForDay(date).slice(0, 2).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedId(event.id)}
                      className="block w-full truncate rounded bg-[var(--accent)] px-1.5 py-1 text-left text-xs text-[var(--on-accent)] opacity-80 hover:opacity-100"
                    >
                      {event.title}
                    </button>
                  ))}
                  {eventsForDay(date).length > 2 && (
                    <p className="text-[10px] text-[var(--muted)]">+{eventsForDay(date).length - 2} more</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      /* Week / Day view */
      ) : (
        <div className="surface p-6">
          <p className="text-sm text-[var(--muted)]">
            {view === "week" ? "Weekly view" : "Day view"} for your schedule.
          </p>
          {events.length ? (
            <div className="mt-5 space-y-3">{events.slice(0, view === "week" ? 7 : 3).map(eventCard)}</div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">No events in this view.</p>
          )}
        </div>
      )}

      {/* Event detail drawer */}
      {selected && (
        <aside className="surface mt-4 border-[var(--accent)] p-5" aria-label="Event details">
          <div className="toolbar">
            <div>
              <p className="eyebrow">Event drawer</p>
              <h3 className="mt-1 text-lg font-semibold">Edit event{selected.recurrence_rule ? " series" : ""}</h3>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} className="button-quiet min-h-0 px-2 py-1 text-xs">Close</button>
          </div>

          <form action={updateEvent} className="mt-5 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={selectedSourceId} />
            <label className="field-label sm:col-span-2">Title<input required name="title" defaultValue={selected.title} className="field-control" /></label>
            <label className="field-label sm:col-span-2">Description<textarea name="description" defaultValue={selected.description} maxLength={1000} className="field-control min-h-24 resize-y" /></label>
            <label className="field-label">Starts<DateTimePicker name="startsAt" defaultValue={localDateTime(selected.starts_at)} required /></label>
            <label className="field-label">Ends<DateTimePicker name="endsAt" defaultValue={localDateTime(selected.ends_at)} required /></label>
            <label className="field-label">Repeat<Select name="recurrence" defaultValue={selected.recurrence_rule ?? ""} className="field-control" options={[{ value: "", label: "Does not repeat" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} /></label>
            <label className="field-label">Reminder<Select name="reminder" defaultValue={String(selected.reminder_minutes ?? 0)} className="field-control" options={[{ value: "0", label: "No reminder" }, { value: "10", label: "10 minutes before" }, { value: "30", label: "30 minutes before" }, { value: "1440", label: "1 day before" }]} /></label>
            <label className="field-label">Color<Select name="color" defaultValue={selected.color} className="field-control" options={[{ value: "indigo", label: "Neutral" }, { value: "blue", label: "Blue" }, { value: "emerald", label: "Emerald" }, { value: "rose", label: "Rose" }]} /></label>
            <div className="flex items-center gap-2 sm:col-span-2">
              <button className="button-primary">Save changes</button>
            </div>
          </form>

          <section className="mt-6 border-t pt-5">
            <p className="eyebrow">Attendees</p>
            <div className="mt-3 space-y-2">
              {selectedAttendees.length ? selectedAttendees.map((attendee) => (
                <div key={attendee.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{attendeeLabel(attendee)}</span>
                  <span className="text-xs capitalize text-[var(--muted)]">{attendee.response}</span>
                  {canManageAttendees && (
                    <form action={removeEventAttendee}>
                      <input type="hidden" name="eventId" value={selectedSourceId} />
                      <input type="hidden" name="id" value={attendee.id} />
                      <button className="text-xs text-[var(--muted)] hover:text-red-500">Remove</button>
                    </form>
                  )}
                  {(attendee.user_id === currentUserId || attendee.email === currentUserEmail.toLowerCase()) && (
                    <form action={respondEventAttendee} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={attendee.id} />
                      <Select name="response" defaultValue={attendee.response} className="field-control min-h-0 px-2 py-1 text-xs" options={[{ value: "pending", label: "Pending" }, { value: "accepted", label: "Accept" }, { value: "declined", label: "Decline" }]} />
                      <button className="button-quiet min-h-0 px-2 py-1 text-xs">Save</button>
                    </form>
                  )}
                </div>
              )) : <p className="text-sm text-[var(--muted)]">No attendees yet.</p>}
            </div>
            {canManageAttendees && (
              <form action={addEventAttendee} className="mt-3 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="eventId" value={selectedSourceId} />
                <Select name="userId" defaultValue="" className="field-control" options={[{ value: "", label: "Invite workspace member" }, ...members.filter((member) => !selectedAttendees.some((attendee) => attendee.user_id === member.user_id)).map((member) => ({ value: member.user_id, label: "Member " + member.user_id.slice(0, 8) }))]} />
                <div className="flex gap-2">
                  <input type="email" name="email" placeholder="Or external email" className="field-control" />
                  <button className="button-secondary">Add</button>
                </div>
              </form>
            )}
          </section>

          <form action={deleteEvent} className="mt-5">
            <input type="hidden" name="id" value={selectedSourceId} />
            <button className="button-quiet min-h-0 px-3 py-2 text-xs text-red-500">Delete event series</button>
          </form>
        </aside>
      )}
    </section>
  )
}