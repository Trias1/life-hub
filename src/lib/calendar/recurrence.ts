export type CalendarEventSource = {
  id: string
  workspace_id: string
  title: string
  description: string
  starts_at: string
  ends_at: string
  recurrence_rule: string | null
  color: string
  reminder_minutes: number | null
  reminder_sent_for?: string | null
  creator_id: string
}

export type CalendarEventInstance = CalendarEventSource & {
  source_id: string
  occurrence_index: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  const day = next.getDate()
  next.setDate(1)
  next.setMonth(next.getMonth() + months)
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(day, lastDay))
  return next
}

function nextDate(date: Date, rule: string) {
  if (rule === "daily") return addDays(date, 1)
  if (rule === "weekly") return addDays(date, 7)
  if (rule === "monthly") return addMonths(date, 1)
  return null
}

function skipBefore(date: Date, rule: string, rangeStart: Date) {
  let occurrence = new Date(date)
  let index = 0
  if (occurrence < rangeStart) {
    if (rule === "daily") index = Math.max(0, Math.floor((rangeStart.getTime() - occurrence.getTime()) / DAY_MS))
    else if (rule === "weekly") index = Math.max(0, Math.floor((rangeStart.getTime() - occurrence.getTime()) / (7 * DAY_MS)))
    else index = Math.max(0, (rangeStart.getFullYear() - occurrence.getFullYear()) * 12 + rangeStart.getMonth() - occurrence.getMonth())
    occurrence = rule === "monthly" ? addMonths(occurrence, index) : addDays(occurrence, rule === "weekly" ? index * 7 : index)
    while (occurrence < rangeStart) {
      const next = nextDate(occurrence, rule)
      if (!next) break
      occurrence = next
      index += 1
    }
  }
  return { date: occurrence, index }
}

export function expandCalendarEvents(events: CalendarEventSource[], now = new Date(), days = 90): CalendarEventInstance[] {
  const rangeStart = new Date(now)
  const rangeEnd = addDays(rangeStart, days)
  return events.flatMap((event) => {
    const rule = event.recurrence_rule
    if (!rule) return [{ ...event, source_id: event.id, occurrence_index: 0 }]
    const duration = new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()
    const skipped = skipBefore(new Date(event.starts_at), rule, rangeStart)
    const instances: CalendarEventInstance[] = []
    let occurrence = skipped.date
    let index = skipped.index
    while (occurrence <= rangeEnd && index < skipped.index + 400) {
      const endsAt = new Date(occurrence.getTime() + duration)
      instances.push({ ...event, id: event.id + ":" + index, source_id: event.id, occurrence_index: index, starts_at: occurrence.toISOString(), ends_at: endsAt.toISOString() })
      const next = nextDate(occurrence, rule)
      if (!next) break
      occurrence = next
      index += 1
    }
    return instances
  })
}
