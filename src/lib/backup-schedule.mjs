// When a workspace backup is due. Times are in WIB (Asia/Jakarta, UTC+7, no daylight saving).
// An hourly job asks isDue() for each workspace; a backup runs once per scheduled slot.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * @typedef {{ frequency: "off" | "daily" | "weekly" | "monthly", hour: number, weekday: number, month_day: number,
 *   last_run_at?: string | null, updated_at?: string | null }} BackupSchedule
 */

/** A WIB calendar date and hour as a real instant. */
function wibInstant(year, month, day, hour) {
  return new Date(Date.UTC(year, month, day, hour) - WIB_OFFSET_MS)
}

/**
 * The most recent scheduled time at or before `now`, or null when backups are off.
 * @param {BackupSchedule} schedule
 * @param {Date} [now]
 * @returns {Date | null}
 */
export function latestSlot(schedule, now = new Date()) {
  if (schedule.frequency === "off") return null
  const local = new Date(now.getTime() + WIB_OFFSET_MS)
  const year = local.getUTCFullYear()
  const month = local.getUTCMonth()
  const day = local.getUTCDate()
  let slot
  if (schedule.frequency === "daily") {
    slot = wibInstant(year, month, day, schedule.hour)
    if (slot > now) slot = new Date(slot.getTime() - DAY_MS)
  } else if (schedule.frequency === "weekly") {
    const back = (local.getUTCDay() - schedule.weekday + 7) % 7
    slot = wibInstant(year, month, day - back, schedule.hour)
    if (slot > now) slot = new Date(slot.getTime() - 7 * DAY_MS)
  } else {
    slot = wibInstant(year, month, schedule.month_day, schedule.hour)
    if (slot > now) slot = wibInstant(year, month - 1, schedule.month_day, schedule.hour)
  }
  return slot
}

/**
 * The next scheduled time after `now`, or null when backups are off.
 * @param {BackupSchedule} schedule
 * @param {Date} [now]
 * @returns {Date | null}
 */
export function nextSlot(schedule, now = new Date()) {
  const latest = latestSlot(schedule, now)
  if (!latest) return null
  if (schedule.frequency === "daily") return new Date(latest.getTime() + DAY_MS)
  if (schedule.frequency === "weekly") return new Date(latest.getTime() + 7 * DAY_MS)
  const local = new Date(latest.getTime() + WIB_OFFSET_MS)
  return wibInstant(local.getUTCFullYear(), local.getUTCMonth() + 1, schedule.month_day, schedule.hour)
}

/**
 * True when a scheduled time has passed since the last backup (or, before the first one, since the
 * schedule was saved). Missed slots (e.g. the job was down) run once at the next hourly check.
 * @param {BackupSchedule} schedule
 * @param {Date} [now]
 */
export function isDue(schedule, now = new Date()) {
  const slot = latestSlot(schedule, now)
  if (!slot) return false
  const since = schedule.last_run_at ?? schedule.updated_at
  return !since || new Date(since) < slot
}

/** "2026-11-14-0200" in WIB, for backup file names. @param {Date} date */
export function wibStamp(date) {
  const local = new Date(date.getTime() + WIB_OFFSET_MS).toISOString()
  return local.slice(0, 10) + "-" + local.slice(11, 13) + local.slice(14, 16)
}
