"use client"

import { addMinutes, differenceInMinutes, format, isValid, parse } from "date-fns"
import { useState } from "react"
import { DateTimePicker } from "@/components/date-time-picker"

const FORMAT = "yyyy-MM-dd'T'HH:mm"
const toDate = (value: string) => parse(value.slice(0, 16), FORMAT, new Date())

/** Start and end pickers that keep the event's length when the start moves, and flag an end that isn't after the start. */
export function EventTimeRange({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  const [start, setStart] = useState(startsAt)
  const [end, setEnd] = useState(endsAt)
  const startDate = toDate(start)
  const endDate = toDate(end)
  const invalid = isValid(startDate) && isValid(endDate) && endDate <= startDate

  const moveStart = (next: string) => {
    const nextDate = toDate(next)
    // Keep the current length (at least 30 minutes) so the end follows the start instead of falling behind it.
    const length = Math.max(30, isValid(startDate) && isValid(endDate) ? differenceInMinutes(endDate, startDate) : 60)
    setStart(next)
    if (isValid(nextDate)) setEnd(format(addMinutes(nextDate, length), FORMAT))
  }

  return (
    <>
      <div className="issue-form-field">
        <span className="issue-form-label">Starts</span>
        <DateTimePicker name="startsAt" value={start} onChange={moveStart} required />
      </div>
      <div className="issue-form-field">
        <span className="issue-form-label">Ends</span>
        <DateTimePicker name="endsAt" value={end} onChange={setEnd} required invalid={invalid} />
        {invalid
          ? <p role="alert" className="text-xs font-medium text-danger">The end must be after the start.</p>
          : <p className="text-xs text-[var(--muted)]">{formatLength(differenceInMinutes(endDate, startDate))}</p>}
      </div>
    </>
  )
}

function formatLength(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return ""
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = minutes % 60
  return "Lasts " + [days && days + "d", hours && hours + "h", rest && rest + "m"].filter(Boolean).join(" ")
}
