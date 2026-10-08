import Link from "next/link"
import { addDaysToKey, dayKey, formatTime, isDayKey } from "@/components/calendar/calendar-format"
import { EventFields } from "@/components/calendar/event-fields"
import { SubmitButton } from "@/components/calendar/submit-button"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { createEvent } from "../actions"

const pad = (value: number) => String(value).padStart(2, "0")

/** Start/end defaults as picker strings: 09:00–10:00 on a chosen day, otherwise the next full hour today. */
function defaultRange(date: string | undefined) {
  if (isDayKey(date)) return { startsAt: date + "T09:00", endsAt: date + "T10:00" }
  const now = new Date()
  const today = dayKey(now)
  const hour = Number(formatTime(now).slice(0, 2)) + 1
  const at = (offset: number) => (hour + offset >= 24 ? addDaysToKey(today, 1) + "T" + pad(hour + offset - 24) : today + "T" + pad(hour + offset)) + ":00"
  return { startsAt: at(0), endsAt: at(1) }
}

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ error?: string; date?: string }> }) {
  const { error, date } = await searchParams
  const context = await getWorkspaceContext()
  if (!context) return null

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb">
        <Link href="/calendar">Calendar</Link>
        <span aria-hidden>/</span>
        <span>New</span>
      </nav>
      <h1 className="issue-title mt-4">New event</h1>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} Check that the event ends after it starts.</p>}
      <form action={createEvent} className="issue-form mt-6">
        <EventFields idPrefix="event" defaults={defaultRange(date)} autoFocus />
        <div className="issue-form-actions">
          <SubmitButton label="Create event" pendingLabel="Creating…" />
          <Link href="/calendar" className="button-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
