// Calendar dates are grouped and labelled in one fixed zone (the same one format-date.ts uses),
// so the server render and the browser agree on which day an event belongs to.
const LOCALE = "en-GB"
const TIME_ZONE = "Asia/Jakarta"

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
const timeFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const shortDayFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" })
const keyLongFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" })
const keyShortFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
const keyMonthFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "long", year: "numeric" })

export const repeatOptions = [{ value: "", label: "Does not repeat" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]
export const reminderOptions = [{ value: "0", label: "No reminder" }, { value: "10", label: "10 minutes before" }, { value: "30", label: "30 minutes before" }, { value: "1440", label: "1 day before" }]
export const colorOptions = [{ value: "indigo", label: "Neutral" }, { value: "blue", label: "Blue" }, { value: "emerald", label: "Emerald" }, { value: "rose", label: "Rose" }]

/** Maps a stored event colour onto a tag-chip tone defined in globals.css. */
export function colorTone(color: string) {
  return color === "blue" ? "sky" : color === "emerald" ? "emerald" : color === "rose" ? "rose" : "indigo"
}
export function colorLabel(color: string) {
  return colorOptions.find((option) => option.value === color)?.label ?? "Neutral"
}
export function repeatLabel(rule: string | null) {
  return repeatOptions.find((option) => option.value === (rule ?? ""))?.label ?? "Does not repeat"
}
export function reminderLabel(minutes: number | null) {
  return reminderOptions.find((option) => option.value === String(minutes ?? 0))?.label ?? (minutes ? minutes + " minutes before" : "No reminder")
}

/** "2026-10-14" for the calendar day an instant falls on. */
export function dayKey(value: string | Date) {
  return dayKeyFormat.format(new Date(value))
}
export function formatTime(value: string | Date) {
  return timeFormat.format(new Date(value))
}
/** "Tue 14 Oct · 08:00–09:00", or with both days when the event spans midnight. */
export function eventWhen(startsAt: string, endsAt: string) {
  const sameDay = dayKey(startsAt) === dayKey(endsAt)
  return shortDayFormat.format(new Date(startsAt)) + " · " + formatTime(startsAt) + "–" + (sameDay ? "" : shortDayFormat.format(new Date(endsAt)) + " ") + formatTime(endsAt)
}

const keyDate = (key: string) => new Date(key + "T00:00:00Z")
export function addDaysToKey(key: string, days: number) {
  const date = keyDate(key)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export function addMonthsToKey(key: string, months: number) {
  const date = keyDate(key)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)).toISOString().slice(0, 10)
}
/** 0 = Sunday. */
export function weekdayOfKey(key: string) {
  return keyDate(key).getUTCDay()
}
export function daysInMonthOfKey(key: string) {
  const date = keyDate(key)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
}
export const formatKeyLong = (key: string) => keyLongFormat.format(keyDate(key))
export const formatKeyShort = (key: string) => keyShortFormat.format(keyDate(key))
export const formatKeyMonth = (key: string) => keyMonthFormat.format(keyDate(key))
export const isDayKey = (value: string | undefined): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(keyDate(value).getTime()) && keyDate(value).toISOString().slice(0, 10) === value)
