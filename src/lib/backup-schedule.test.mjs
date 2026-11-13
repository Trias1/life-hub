import assert from "node:assert/strict"
import test from "node:test"
import { isDue, latestSlot, nextSlot, wibStamp } from "./backup-schedule.mjs"

// 2026-11-14 10:30 WIB (Saturday) = 03:30 UTC
const now = new Date("2026-11-14T03:30:00Z")
const wib = (date) => wibStamp(date)

test("daily: the latest 02:00 WIB is today, the next is tomorrow", () => {
  const schedule = { frequency: "daily", hour: 2, weekday: 0, month_day: 1 }
  assert.equal(wib(latestSlot(schedule, now)), "2026-11-14-0200")
  assert.equal(wib(nextSlot(schedule, now)), "2026-11-15-0200")
  const evening = { ...schedule, hour: 22 }
  assert.equal(wib(latestSlot(evening, now)), "2026-11-13-2200")
})

test("weekly: the chosen weekday at the chosen hour", () => {
  const monday = { frequency: "weekly", hour: 2, weekday: 1, month_day: 1 }
  assert.equal(wib(latestSlot(monday, now)), "2026-11-09-0200")
  assert.equal(wib(nextSlot(monday, now)), "2026-11-16-0200")
  const saturdayLater = { ...monday, weekday: 6, hour: 23 }
  assert.equal(wib(latestSlot(saturdayLater, now)), "2026-11-07-2300")
})

test("monthly: the chosen day of the month, rolling into the previous month when needed", () => {
  const fifteenth = { frequency: "monthly", hour: 2, weekday: 0, month_day: 15 }
  assert.equal(wib(latestSlot(fifteenth, now)), "2026-10-15-0200")
  assert.equal(wib(nextSlot(fifteenth, now)), "2026-11-15-0200")
  const january = new Date("2027-01-03T00:00:00Z")
  assert.equal(wib(latestSlot(fifteenth, january)), "2026-12-15-0200")
})

test("due once per slot: after the last run, or after the schedule was saved", () => {
  const schedule = { frequency: "daily", hour: 2, weekday: 0, month_day: 1 }
  assert.equal(isDue({ ...schedule, last_run_at: "2026-11-13T19:05:00Z" }, now), false)
  assert.equal(isDue({ ...schedule, last_run_at: "2026-11-12T19:05:00Z" }, now), true)
  assert.equal(isDue({ ...schedule, last_run_at: null, updated_at: "2026-11-14T03:00:00Z" }, now), false, "saved after today's slot: wait for tomorrow")
  assert.equal(isDue({ ...schedule, last_run_at: null, updated_at: "2026-11-13T10:00:00Z" }, now), true)
  assert.equal(isDue({ ...schedule, frequency: "off" }, now), false)
})
