import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { EventDetail, type EventState } from "@/components/calendar/event-detail"
import { dayKey, eventWhen } from "@/components/calendar/calendar-format"
import { expandCalendarEvents } from "@/lib/calendar/recurrence"
import { formatDateTime } from "@/lib/format-date"
import { relativeTime } from "@/lib/relative-time"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { addEventAttendee, deleteEvent, removeEventAttendee, respondEventAttendee, updateEvent } from "../actions"

function activityText(action: string) {
  if (action === "Created") return "created this event"
  if (action === "Updated") return "edited this event"
  return action.charAt(0).toLowerCase() + action.slice(1) + " this event"
}

export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const { id } = await params
  const { error, success } = await searchParams
  if (!z.string().uuid().safeParse(id).success) notFound()
  const context = await getWorkspaceContext()
  if (!context) return null

  const { data: event } = await context.supabase
    .from("calendar_events")
    .select("id,workspace_id,creator_id,title,description,starts_at,ends_at,recurrence_rule,color,reminder_minutes,reminder_sent_for,created_at,updated_at")
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle()
  if (!event) notFound()

  const [{ data: attendees }, { data: members }, { data: activityRows }, { data: profile }] = await Promise.all([
    context.supabase.from("calendar_event_attendees").select("id,event_id,user_id,email,response").eq("event_id", event.id),
    context.supabase.from("workspace_members").select("user_id,role").eq("workspace_id", context.workspaceId).order("created_at"),
    context.supabase.from("activity_logs").select("id,actor_id,action,created_at").eq("workspace_id", context.workspaceId).eq("entity_type", "calendar event").eq("entity_id", event.id).order("created_at", { ascending: false }).limit(30),
    context.supabase.from("profiles").select("display_name").eq("id", context.user.id).maybeSingle(),
  ])

  const now = new Date()
  const myName = profile?.display_name ?? context.user.email?.split("@")[0] ?? "You"
  const isCreator = event.creator_id === context.user.id
  // Profiles are only readable by their owner, so other people stay anonymous.
  const nameFor = (userId: string | null) => (userId === context.user.id ? myName : "A workspace member")
  const myEmail = context.user.email?.toLowerCase() ?? ""
  const next = event.recurrence_rule ? expandCalendarEvents([event], now, 400).find((occurrence) => new Date(occurrence.ends_at) >= now) : null
  const state: EventState = event.recurrence_rule ? "recurring" : new Date(event.ends_at) < now ? "past" : "upcoming"

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb">
        <Link href="/calendar">Calendar</Link>
        <span aria-hidden>/</span>
        <span className="truncate">{event.title}</span>
      </nav>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
      <div className="mt-5">
        <EventDetail
          event={{ id: event.id, title: event.title, description: event.description ?? "", starts_at: event.starts_at, ends_at: event.ends_at, recurrence_rule: event.recurrence_rule, color: event.color, reminder_minutes: event.reminder_minutes }}
          state={state}
          canEdit={isCreator}
          creatorName={nameFor(event.creator_id)}
          createdAt={formatDateTime(event.created_at)}
          createdLabel={relativeTime(event.created_at, now)}
          updatedLabel={relativeTime(event.updated_at, now) + " · " + formatDateTime(event.updated_at)}
          whenLabel={(event.recurrence_rule ? "From " : "") + eventWhen(event.starts_at, event.ends_at)}
          nextLabel={next ? eventWhen(next.starts_at, next.ends_at) + " (" + relativeTime(next.starts_at, now) + ")" : null}
          dayKey={dayKey(next?.starts_at ?? event.starts_at)}
          attendees={(attendees ?? []).map((attendee) => ({
            id: attendee.id,
            userId: attendee.user_id,
            response: attendee.response,
            isMe: attendee.user_id === context.user.id || (Boolean(attendee.email) && attendee.email === myEmail),
            label: attendee.email ?? (attendee.user_id === context.user.id ? myName : attendee.user_id ? "Member " + attendee.user_id.slice(0, 8) : "Workspace attendee"),
          }))}
          members={(members ?? []).map((member) => ({ value: member.user_id, label: member.user_id === context.user.id ? myName + " (you)" : "Member " + member.user_id.slice(0, 8) }))}
          activity={(activityRows ?? []).map((row) => ({ id: row.id, actor: nameFor(row.actor_id), action: activityText(row.action), at: formatDateTime(row.created_at), label: relativeTime(row.created_at, now) }))}
          actions={{ updateEvent, deleteEvent, addEventAttendee, removeEventAttendee, respondEventAttendee }}
        />
      </div>
    </div>
  )
}
