"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { actionFailure } from "@/lib/actions/server"
import { createNotification, getWorkspaceContext, recordActivity } from "@/lib/workspace/server"
import { FIELD, encryptField } from "@/lib/data-crypto.mjs"

// DateTimePicker submits "YYYY-MM-DDTHH:mm" with no zone: read it as Jakarta wall time, whatever zone the server runs in.
const jakartaDate = z.preprocess((value) => typeof value === "string" && /^d{4}-d{2}-d{2}Td{2}:d{2}(:d{2})?$/.test(value) ? value + "+07:00" : value, z.coerce.date())

const eventSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(1000).default(""),
  startsAt: jakartaDate,
  endsAt: jakartaDate,
  recurrence: z.enum(["daily", "weekly", "monthly"]).optional(),
  color: z.enum(["indigo", "blue", "emerald", "rose"]).default("indigo"),
  reminder: z.coerce.number().int().min(0).max(10080).default(0),
}).refine((value) => value.endsAt > value.startsAt)

function parseEvent(formData: FormData) {
  return eventSchema.safeParse({ title: formData.get("title"), description: formData.get("description") ?? "", startsAt: formData.get("startsAt"), endsAt: formData.get("endsAt"), recurrence: formData.get("recurrence") || undefined, color: formData.get("color") || "indigo", reminder: formData.get("reminder") || 0 })
}

export async function createEvent(formData: FormData): Promise<void> {
  const input = parseEvent(formData)
  if (!input.success) actionFailure("/calendar/new", "create event")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/calendar/new", "access the active workspace")

  const { data: event, error } = await context.supabase.from("calendar_events").insert({ title: input.data.title, description: encryptField(FIELD.EVENT_DESCRIPTION, input.data.description), starts_at: input.data.startsAt.toISOString(), ends_at: input.data.endsAt.toISOString(), recurrence_rule: input.data.recurrence ?? null, color: input.data.color, reminder_minutes: input.data.reminder, workspace_id: context.workspaceId, creator_id: context.user.id }).select("id").single()
  if (error) actionFailure("/calendar/new", "create event", error)
  await recordActivity(context, { action: "Created", entityType: "calendar event", entityId: event.id })
  revalidatePath("/calendar")
  revalidatePath("/activity")
  redirect("/calendar/" + event.id + "?success=Event%20created")
}

export async function updateEvent(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"))
  const input = parseEvent(formData)
  if (!id.success) actionFailure("/calendar", "update event")
  const eventPath = "/calendar/" + id.data
  if (!input.success) actionFailure(eventPath, "update event")
  const context = await getWorkspaceContext()
  if (!context) actionFailure(eventPath, "access the active workspace")

  const { data: event, error } = await context.supabase.from("calendar_events").update({ title: input.data.title, description: encryptField(FIELD.EVENT_DESCRIPTION, input.data.description), starts_at: input.data.startsAt.toISOString(), ends_at: input.data.endsAt.toISOString(), recurrence_rule: input.data.recurrence ?? null, color: input.data.color, reminder_minutes: input.data.reminder, reminder_sent_for: null }).eq("id", id.data).eq("workspace_id", context.workspaceId).eq("creator_id", context.user.id).select("id").single()
  if (error) actionFailure(eventPath, "update event", error)
  await recordActivity(context, { action: "Updated", entityType: "calendar event", entityId: event.id })
  revalidatePath("/calendar")
  revalidatePath(eventPath)
  revalidatePath("/activity")
  redirect(eventPath + "?success=Event%20updated")
}

export async function deleteEvent(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"))
  if (!id.success) actionFailure("/calendar", "delete event")
  const eventPath = "/calendar/" + id.data
  const context = await getWorkspaceContext()
  if (!context) actionFailure(eventPath, "access the active workspace")

  const { error } = await context.supabase.from("calendar_events").delete().eq("id", id.data).eq("workspace_id", context.workspaceId).eq("creator_id", context.user.id)
  if (error) actionFailure(eventPath, "delete event", error)
  await recordActivity(context, { action: "Deleted", entityType: "calendar event", entityId: id.data })
  revalidatePath("/calendar")
  revalidatePath(eventPath)
  revalidatePath("/activity")
  redirect("/calendar?success=Event%20deleted")
}

const attendeeSchema = z.object({ eventId: z.string().uuid(), userId: z.string().uuid().optional(), email: z.string().email().optional() }).refine((value) => Boolean(value.userId || value.email))
const attendeeResponseSchema = z.object({ id: z.string().uuid(), response: z.enum(["pending", "accepted", "declined"]) })

async function getEventContext(formData: FormData, operation: string) {
  const eventId = z.string().uuid().safeParse(formData.get("eventId"))
  if (!eventId.success) actionFailure("/calendar", operation)
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/calendar", "access the active workspace")
  const { data: event, error } = await context.supabase.from("calendar_events").select("id,creator_id,title").eq("id", eventId.data).eq("workspace_id", context.workspaceId).maybeSingle()
  if (error || !event) actionFailure("/calendar", operation, error ?? new Error("Event not found"))
  return { context, event }
}

export async function addEventAttendee(formData: FormData): Promise<void> {
  const input = attendeeSchema.safeParse({ eventId: formData.get("eventId"), userId: formData.get("userId") || undefined, email: formData.get("email")?.toString().trim().toLowerCase() || undefined })
  const eventId = z.string().uuid().safeParse(formData.get("eventId"))
  if (!input.success) actionFailure(eventId.success ? "/calendar/" + eventId.data : "/calendar", "add event attendee")
  const { context, event } = await getEventContext(formData, "add event attendee")
  const eventPath = "/calendar/" + event.id
  if (event.creator_id !== context.user.id) actionFailure(eventPath, "add event attendee")
  if (input.data.userId) {
    const { data: member, error: memberError } = await context.supabase.from("workspace_members").select("user_id").eq("workspace_id", context.workspaceId).eq("user_id", input.data.userId).maybeSingle()
    if (memberError || !member) actionFailure(eventPath, "add event attendee", memberError ?? new Error("Member not found"))
    const { data: existing } = await context.supabase.from("calendar_event_attendees").select("id").eq("event_id", event.id).eq("user_id", input.data.userId).maybeSingle()
    if (existing) actionFailure(eventPath, "add event attendee", new Error("Attendee already added"))
  } else if (input.data.email) {
    const { data: existing } = await context.supabase.from("calendar_event_attendees").select("id").eq("event_id", event.id).eq("email", input.data.email).maybeSingle()
    if (existing) actionFailure(eventPath, "add event attendee", new Error("Attendee already added"))
  }
  const { error } = await context.supabase.from("calendar_event_attendees").insert({ event_id: event.id, user_id: input.data.userId ?? null, email: input.data.email ?? null })
  if (error) actionFailure(eventPath, "add event attendee", error)
  if (input.data.userId) await createNotification(context, { recipientId: input.data.userId, type: "calendar", message: "You were invited to " + event.title + ".", resourceType: "calendar event", resourceId: event.id, link: eventPath })
  await recordActivity(context, { action: "Added attendee to", entityType: "calendar event", entityId: event.id, notify: false })
  revalidatePath("/calendar")
  revalidatePath(eventPath)
  revalidatePath("/activity")
}

export async function removeEventAttendee(formData: FormData): Promise<void> {
  const input = z.object({ id: z.string().uuid(), eventId: z.string().uuid() }).safeParse({ id: formData.get("id"), eventId: formData.get("eventId") })
  if (!input.success) actionFailure("/calendar", "remove event attendee")
  const { context, event } = await getEventContext(formData, "remove event attendee")
  const eventPath = "/calendar/" + event.id
  if (event.creator_id !== context.user.id) actionFailure(eventPath, "remove event attendee")
  const { error } = await context.supabase.from("calendar_event_attendees").delete().eq("id", input.data.id).eq("event_id", event.id)
  if (error) actionFailure(eventPath, "remove event attendee", error)
  await recordActivity(context, { action: "Removed attendee from", entityType: "calendar event", entityId: event.id, notify: false })
  revalidatePath("/calendar")
  revalidatePath(eventPath)
  revalidatePath("/activity")
}

export async function respondEventAttendee(formData: FormData): Promise<void> {
  const input = attendeeResponseSchema.safeParse({ id: formData.get("id"), response: formData.get("response") })
  if (!input.success) actionFailure("/calendar", "respond to event")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/calendar", "access the active workspace")
  const { data: attendee, error: attendeeError } = await context.supabase.from("calendar_event_attendees").select("id,event_id,user_id,email").eq("id", input.data.id).maybeSingle()
  if (attendeeError || !attendee) actionFailure("/calendar", "find event attendee", attendeeError ?? new Error("Attendee not found"))
  const eventPath = "/calendar/" + attendee.event_id
  if (attendee.user_id !== context.user.id && attendee.email !== context.user.email?.toLowerCase()) actionFailure(eventPath, "respond to event")
  const { error } = await context.supabase.from("calendar_event_attendees").update({ response: input.data.response }).eq("id", attendee.id)
  if (error) actionFailure(eventPath, "respond to event", error)
  await recordActivity(context, { action: "Responded " + input.data.response + " to", entityType: "calendar event", entityId: attendee.event_id, notify: false })
  revalidatePath("/calendar")
  revalidatePath(eventPath)
  revalidatePath("/activity")
}
