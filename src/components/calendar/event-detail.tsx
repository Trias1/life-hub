"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { CalendarDays, CalendarPlus, Copy, History, MoreVertical, Trash2 } from "lucide-react"
import { Select } from "@/components/ui/select"
import { colorLabel, colorTone, reminderLabel, repeatLabel } from "./calendar-format"
import { EventFields } from "./event-fields"
import { SubmitButton } from "./submit-button"

type FormAction = (formData: FormData) => Promise<void>
export type EventState = "upcoming" | "past" | "recurring"
type CalendarEvent = { id: string; title: string; description: string; starts_at: string; ends_at: string; recurrence_rule: string | null; color: string; reminder_minutes: number | null }
type Attendee = { id: string; label: string; response: string; isMe: boolean; userId: string | null }
type ActivityItem = { id: string; actor: string; action: string; at: string; label: string }
type Props = {
  event: CalendarEvent
  state: EventState
  canEdit: boolean
  creatorName: string
  createdAt: string
  createdLabel: string
  updatedLabel: string
  whenLabel: string
  nextLabel: string | null
  dayKey: string
  attendees: Attendee[]
  members: Array<{ value: string; label: string }>
  activity: ActivityItem[]
  actions: { updateEvent: FormAction; deleteEvent: FormAction; addEventAttendee: FormAction; removeEventAttendee: FormAction; respondEventAttendee: FormAction }
}

const stateLabels: Record<EventState, string> = { upcoming: "Upcoming", past: "Past", recurring: "Recurring" }
const responseOptions = [{ value: "pending", label: "Pending" }, { value: "accepted", label: "Accept" }, { value: "declined", label: "Decline" }]

/** DateTimePicker value in Asia/Jakarta wall time, matching how the server parses it back. */
const jakartaParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
function localDateTime(value: string) {
  const part = Object.fromEntries(jakartaParts.formatToParts(new Date(value)).map((item) => [item.type, item.value]))
  return part.year + "-" + part.month + "-" + part.day + "T" + part.hour + ":" + part.minute
}

export function EventDetail({ event, state, canEdit, creatorName, createdAt, createdLabel, updatedLabel, whenLabel, nextLabel, dayKey, attendees, members, activity, actions }: Props) {
  const [editing, setEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [showAllActivity, setShowAllActivity] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const shownActivity = showAllActivity ? activity : activity.slice(0, 5)
  const hiddenCount = activity.length - shownActivity.length
  const inviteOptions = members.filter((member) => !attendees.some((attendee) => attendee.userId === member.value))

  useEffect(() => {
    if (!menuOpen) return
    const close = (mouse: MouseEvent) => { if (!menuRef.current?.contains(mouse.target as Node)) setMenuOpen(false) }
    const escape = (key: KeyboardEvent) => { if (key.key === "Escape") setMenuOpen(false) }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", escape)
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape) }
  }, [menuOpen])

  async function copyLink() {
    setMenuOpen(false)
    await navigator.clipboard.writeText(window.location.origin + "/calendar/" + event.id)
    setMessage("Link copied")
  }

  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />

  return (
    <div className="issue-layout issue-detail">
      <article className="issue-main min-w-0">
        {editing ? (
          <form action={actions.updateEvent} className="issue-form">
            {hidden("id", event.id)}
            {event.recurrence_rule && <p className="issue-banner" style={{ marginBottom: 0 }}>Changes apply to every occurrence in this series.</p>}
            <EventFields
              idPrefix="edit-event"
              autoFocus
              defaults={{ title: event.title, description: event.description, startsAt: localDateTime(event.starts_at), endsAt: localDateTime(event.ends_at), recurrence: event.recurrence_rule ?? "", reminder: String(event.reminder_minutes ?? 0), color: event.color }}
            />
            <div className="issue-form-actions">
              <SubmitButton label="Save changes" pendingLabel="Saving…" />
              <button type="button" onClick={() => setEditing(false)} className="button-secondary">Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <header className="issue-header">
              <h1 className="issue-title">{event.title}</h1>
              <div className="flex shrink-0 items-center gap-2">
                {canEdit && <button type="button" onClick={() => { setMessage(""); setEditing(true) }} className="button-secondary min-h-0 px-3 py-1.5">Edit</button>}
                <div ref={menuRef} className="relative">
                  <button type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="button-quiet min-h-0 px-2 py-1.5"><MoreVertical size={16} /></button>
                  {menuOpen && (
                    <div role="menu" className="issue-menu">
                      <button type="button" role="menuitem" onClick={() => void copyLink()}><Copy size={14} />Copy link</button>
                      <Link href={"/calendar/new?date=" + dayKey} role="menuitem" className="flex w-full items-center gap-[0.55rem] rounded-[0.45rem] px-[0.6rem] py-2 text-[0.85rem] hover:bg-[var(--surface-muted)]"><CalendarPlus size={14} />New event this day</Link>
                      {canEdit && (
                        <form action={actions.deleteEvent} onSubmit={(submit) => { if (!window.confirm(event.recurrence_rule ? "Delete this event and every occurrence in the series? This cannot be undone." : "Delete this event? This cannot be undone.")) submit.preventDefault() }}>
                          {hidden("id", event.id)}
                          <button role="menuitem" className="text-red-600"><Trash2 size={14} />{event.recurrence_rule ? "Delete event series" : "Delete event"}</button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </header>
            <p className="issue-meta">
              <span className={"issue-state" + (state === "recurring" ? " bg-[var(--surface-muted)] text-[var(--accent)]" : "")} data-state={state === "upcoming" ? "active" : state === "past" ? "archived" : "recurring"}>{stateLabels[state]}</span>
              <CalendarDays size={14} aria-hidden />
              <span>Event created <time dateTime={createdAt} title={createdAt}>{createdLabel}</time> by <strong>{creatorName}</strong></span>
            </p>
            {message && <p role="status" className="mt-3 text-xs text-[var(--muted)]">{message}</p>}
            <div className="issue-body">
              {event.description.trim()
                ? <p className="note-prose whitespace-pre-wrap">{event.description}</p>
                : <p className="note-prose-empty">No description.</p>}
            </div>
          </>
        )}
      </article>

      <aside className="issue-sidebar">
        <div className="issue-sidebar-block col-span-full">
          <p className="issue-sidebar-label">When</p>
          <p className="mt-1.5 text-sm">{whenLabel}</p>
          {nextLabel && <p className="mt-1 text-xs text-[var(--muted)]">Next: {nextLabel}</p>}
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Repeat</p>
          <p className="mt-1.5 text-sm">{repeatLabel(event.recurrence_rule)}</p>
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Reminder</p>
          <p className="mt-1.5 text-sm">{reminderLabel(event.reminder_minutes)}</p>
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Colour</p>
          <p className="mt-1.5"><span className="tag-chip" data-tone={colorTone(event.color)}>{colorLabel(event.color)}</span></p>
        </div>
        {/* Phones lay blocks out two per row and drop the border on the last two; keep it on this one. */}
        <div className="issue-sidebar-block" style={{ borderBottom: "1px solid var(--line)" }}>
          <p className="issue-sidebar-label">Last updated</p>
          <p className="mt-1.5 text-sm">{updatedLabel}</p>
        </div>
        <div className="issue-sidebar-block col-span-full">
          <p className="issue-sidebar-label">Attendees <span className="font-normal text-[var(--muted)]">{attendees.length}</span></p>
          {attendees.length ? (
            <ul className="mt-2 space-y-2">
              {attendees.map((attendee) => (
                <li key={attendee.id} className="text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate" title={attendee.label}>{attendee.label}{attendee.isMe ? " (you)" : ""}</span>
                    <span className="tag-chip capitalize" data-tone={attendee.response === "accepted" ? "emerald" : attendee.response === "declined" ? "rose" : "amber"}>{attendee.response}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {attendee.isMe && (
                      <form action={actions.respondEventAttendee} className="flex items-center gap-1">
                        {hidden("id", attendee.id)}
                        <Select name="response" defaultValue={attendee.response} options={responseOptions} className="field-control min-h-0 px-2 py-1 text-xs" />
                        <SubmitButton label="Save" pendingLabel="Saving…" className="button-quiet min-h-0 px-2 py-1 text-xs" />
                      </form>
                    )}
                    {canEdit && (
                      <form action={actions.removeEventAttendee}>
                        {hidden("eventId", event.id)}
                        {hidden("id", attendee.id)}
                        <button className="text-xs text-[var(--muted)] hover:text-red-500">Remove</button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-1.5 text-sm text-[var(--muted)]">None</p>}
          {canEdit && (
            <form action={actions.addEventAttendee} className="mt-3 grid gap-2">
              {hidden("eventId", event.id)}
              <Select name="userId" defaultValue="" options={[{ value: "", label: "Invite workspace member" }, ...inviteOptions]} className="field-control" />
              <input type="email" name="email" placeholder="Or external email" aria-label="External attendee email" className="field-control" />
              <SubmitButton label="Add attendee" pendingLabel="Adding…" className="button-secondary min-h-0 px-3 py-1.5 text-sm" />
            </form>
          )}
        </div>
      </aside>

      <section className="issue-activity" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="issue-section-title">Activity</h2>
        <ol className="issue-timeline">
          {shownActivity.map((item) => (
            <li key={item.id}>
              <History size={14} aria-hidden />
              <div className="issue-timeline-text"><p><strong>{item.actor}</strong> {item.action} · <time dateTime={item.at} title={item.at}>{item.label}</time></p></div>
            </li>
          ))}
          {hiddenCount > 0 && <li><button type="button" onClick={() => setShowAllActivity(true)} className="issue-timeline-more">Show {hiddenCount} older {hiddenCount === 1 ? "entry" : "entries"}</button></li>}
          {!activity.some((item) => item.action === "created this event") && (
            <li><CalendarDays size={14} aria-hidden /><div className="issue-timeline-text"><p><strong>{creatorName}</strong> created this event · <time dateTime={createdAt} title={createdAt}>{createdLabel}</time></p></div></li>
          )}
        </ol>
      </section>
    </div>
  )
}
