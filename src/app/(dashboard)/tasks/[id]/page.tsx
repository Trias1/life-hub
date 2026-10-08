import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { TaskDetails, type TaskActivityItem } from "@/components/task-details"
import { memberName, statusLabel, todayKey, isOpenStatus, type TaskStatus } from "@/components/tasks/task-meta"
import { formatDate, formatDateTime } from "@/lib/format-date"
import { relativeTime } from "@/lib/relative-time"
import { getWorkspaceContext } from "@/lib/workspace/server"
import {
  assignTask, attachTaskFile, createChecklistItem, createTaskComment, createTaskLabel, deleteTaskPermanently, detachTaskFile,
  restoreTask, toggleChecklistItem, toggleTaskLabel, trashTask, updateTask, updateTaskStatus,
} from "../actions"

/** Turns a stored activity action ("Moved to in_progress") into a sentence fragment. */
function describe(action: string) {
  if (action.startsWith("Moved to ")) return "changed the status to " + statusLabel(action.slice(9))
  if (action === "Trashed") return "moved this task to the trash"
  if (action === "Updated") return "edited this task"
  return action.charAt(0).toLowerCase() + action.slice(1) + " this task"
}

export default async function TaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const { id } = await params
  const { error, success } = await searchParams
  if (!z.string().uuid().safeParse(id).success) notFound()
  const context = await getWorkspaceContext()
  if (!context) return null
  const supabase = context.supabase

  const { data: task } = await supabase
    .from("tasks")
    .select("id,title,description,status,priority,due_date,assignee_id,created_by,created_at,updated_at,deleted_at")
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle()
  if (!task) notFound()

  const [{ data: members }, { data: labels }, { data: assignments }, { data: checklist }, { data: comments }, { data: attachmentRows }, { data: timeline }, { data: availableFiles }, { data: profile }] = await Promise.all([
    supabase.from("workspace_members").select("user_id,role").eq("workspace_id", context.workspaceId).order("created_at"),
    supabase.from("task_labels").select("id,name,color").eq("workspace_id", context.workspaceId).order("name"),
    supabase.from("task_label_assignments").select("label_id").eq("task_id", task.id),
    supabase.from("task_checklist_items").select("id,title,is_completed").eq("task_id", task.id).order("position"),
    supabase.from("task_comments").select("id,author_id,body,created_at").eq("task_id", task.id).order("created_at", { ascending: true }),
    supabase.from("task_attachments").select("id,file_id").eq("task_id", task.id),
    supabase.from("activity_logs").select("id,actor_id,action,created_at").eq("workspace_id", context.workspaceId).eq("entity_type", "task").eq("entity_id", task.id).order("created_at", { ascending: true }).limit(200),
    supabase.from("files").select("id,name,mime_type,size_bytes").eq("workspace_id", context.workspaceId).is("trashed_at", null).order("name"),
    supabase.from("profiles").select("display_name").eq("id", context.user.id).maybeSingle(),
  ])
  const fileIds = (attachmentRows ?? []).map((row) => row.file_id)
  const { data: attachmentFiles } = fileIds.length
    ? await supabase.from("files").select("id,name,mime_type,size_bytes").eq("workspace_id", context.workspaceId).in("id", fileIds)
    : { data: [] as Array<{ id: string; name: string; mime_type: string; size_bytes: number }> }
  const filesById = new Map((attachmentFiles ?? []).map((file) => [file.id, file]))
  const attachments = (attachmentRows ?? []).flatMap((row) => { const file = filesById.get(row.file_id); return file ? [{ id: row.id, file }] : [] })

  const now = new Date()
  // Profiles are only readable by their owner, so other people appear as short member ids.
  const ownName = profile?.display_name ?? context.user.email?.split("@")[0] ?? "You"
  const nameOf = (userId: string | null) => !userId ? "A former member" : userId === context.user.id ? ownName : memberName(userId, context.user.id)
  const stamp = (value: string) => ({ at: formatDateTime(value), label: relativeTime(value, now) })
  // Comments are shown in full, so their "Commented on" log entries would only repeat them.
  const activity: TaskActivityItem[] = [
    ...(timeline ?? []).filter((item) => item.action !== "Commented on").map((item) => ({ kind: "event" as const, id: item.id, author: nameOf(item.actor_id), text: describe(item.action), sortKey: item.created_at, ...stamp(item.created_at) })),
    ...(comments ?? []).map((comment) => ({ kind: "comment" as const, id: comment.id, author: nameOf(comment.author_id), text: comment.body, sortKey: comment.created_at, ...stamp(comment.created_at) })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  const state = task.deleted_at ? "trash" : isOpenStatus(task.status) ? "open" : "closed"
  const backHref = state === "trash" ? "/tasks?view=trash" : state === "closed" ? "/tasks?view=closed" : "/tasks"

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb">
        <Link href={backHref}>Tasks</Link>
        <span aria-hidden>/</span>
        <span className="truncate">{task.title}</span>
      </nav>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
      <div className="mt-5">
        <TaskDetails
          task={{ id: task.id, title: task.title, description: task.description ?? "", status: task.status as TaskStatus, priority: task.priority, dueDate: task.due_date, assigneeId: task.assignee_id }}
          state={state}
          workspaceId={context.workspaceId}
          canDeletePermanently={task.created_by === context.user.id}
          authorName={nameOf(task.created_by)}
          created={stamp(task.created_at)}
          updated={stamp(task.updated_at)}
          due={task.due_date ? { label: formatDate(task.due_date + "T00:00:00+07:00"), overdue: state === "open" && task.due_date < todayKey(now) } : null}
          members={(members ?? []).map((member) => ({ value: member.user_id, label: member.user_id === context.user.id ? "You" : memberName(member.user_id, context.user.id) }))}
          labels={labels ?? []}
          selectedLabelIds={(assignments ?? []).map((row) => row.label_id)}
          checklist={checklist ?? []}
          attachments={attachments}
          files={availableFiles ?? []}
          activity={activity}
          actions={{ assignTask, attachTaskFile, createChecklistItem, createTaskComment, createTaskLabel, deleteTaskPermanently, detachTaskFile, restoreTask, toggleChecklistItem, toggleTaskLabel, trashTask, updateTask, updateTaskStatus }}
        />
      </div>
    </div>
  )
}
