import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { expandCalendarEvents, type CalendarEventSource } from "@/lib/calendar/recurrence"
import { notificationEnabled } from "@/lib/notification-preferences.mjs"

export const runtime = "nodejs"

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const expected = Buffer.from("Bearer " + secret)
  const received = Buffer.from(request.headers.get("authorization") ?? "")
  return received.length === expected.length && timingSafeEqual(received, expected)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = createAdminClient()
  const now = new Date()
  const { data: sourceEvents, error } = await supabase.from("calendar_events").select("id,workspace_id,title,description,starts_at,ends_at,recurrence_rule,color,reminder_minutes,reminder_sent_for,creator_id").gt("reminder_minutes", 0).limit(1000)
  if (error) return NextResponse.json({ error: "Could not load calendar reminders" }, { status: 500 })
  const events = (sourceEvents ?? []) as CalendarEventSource[]
  const attendees = events.length ? await supabase.from("calendar_event_attendees").select("event_id,user_id").in("event_id", events.map((event) => event.id)) : { data: [] as Array<{ event_id: string; user_id: string | null }>, error: null }
  if (attendees.error) return NextResponse.json({ error: "Could not load calendar attendees" }, { status: 500 })
  const recipientsByEvent = new Map<string, string[]>()
  for (const event of events) recipientsByEvent.set(event.id, [event.creator_id ?? ""])
  for (const attendee of attendees.data ?? []) if (attendee.user_id) recipientsByEvent.set(attendee.event_id, [...(recipientsByEvent.get(attendee.event_id) ?? []), attendee.user_id])
  const recipientIds = Array.from(new Set(Array.from(recipientsByEvent.values()).flat().filter(Boolean)))
  const preferencesResult = recipientIds.length ? await supabase.from("notification_preferences").select("user_id,calendar_enabled").in("user_id", recipientIds) : { data: [], error: null }
  if (preferencesResult.error) return NextResponse.json({ error: "Could not load notification preferences" }, { status: 500 })
  const preferencesByUser = new Map((preferencesResult.data ?? []).map((preferences) => [preferences.user_id, preferences]))

  const dueEvents = expandCalendarEvents(events, now, 2).filter((event) => {
    const startsAt = new Date(event.starts_at)
    const hasPassedTooLong = !event.recurrence_rule && startsAt.getTime() < now.getTime() - 24 * 60 * 60 * 1000
    const reminderDue = startsAt.getTime() - Number(event.reminder_minutes ?? 0) * 60 * 1000 <= now.getTime()
    const alreadySent = event.reminder_sent_for && Math.abs(new Date(event.reminder_sent_for).getTime() - startsAt.getTime()) < 1000
    return !hasPassedTooLong && reminderDue && !alreadySent
  })
  let sent = 0
  for (const event of dueEvents) {
    const recipients = Array.from(new Set((recipientsByEvent.get(event.source_id) ?? []).filter((recipientId) => recipientId && notificationEnabled(preferencesByUser.get(recipientId) ?? null, "calendar"))))
    const message = "Reminder: " + event.title + " starts " + new Date(event.starts_at).toLocaleString() + "."
    const { error: notificationError } = recipients.length ? await supabase.from("notifications").insert(recipients.map((recipientId) => ({ workspace_id: event.workspace_id, recipient_id: recipientId, actor_id: event.creator_id, type: "calendar", message, priority: "high", resource_type: "calendar event", resource_id: event.source_id, resource_name: event.title, link: "/calendar/" + event.source_id }))) : { error: null }
    if (notificationError) continue
    const { error: updateError } = await supabase.from("calendar_events").update({ reminder_sent_for: event.starts_at }).eq("id", event.source_id)
    if (!updateError) sent += 1
  }
  return NextResponse.json({ checked: events.length, due: dueEvents.length, sent })
}
