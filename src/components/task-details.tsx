"use client"

import Link from "next/link"
import { Select } from "@/components/ui/select"

const labelStyles: Record<string, string> = {
  indigo: "bg-zinc-100 text-zinc-700",
  blue: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  rose: "bg-rose-50 text-rose-700",
  amber: "bg-amber-50 text-amber-700",
}

type TaskAction = (formData: FormData) => Promise<void>
type TaskFile = { id: string; name: string; mime_type: string; size_bytes: number }
type TaskAttachment = { id: string; task_id: string; file_id: string; file: TaskFile }
type TaskTimelineItem = { id: string; action: string; entity_id: string; created_at: string }

export type TaskAdvancedProps = {
  members: Array<{ user_id: string; role: string }>
  labels: Array<{ id: string; name: string; color: string }>
  assignments: Array<{ task_id: string; label_id: string }>
  checklist: Array<{ id: string; task_id: string; title: string; is_completed: boolean }>
  comments: Array<{ id: string; task_id: string; author_id: string; body: string; created_at: string }>
  files: TaskFile[]
  attachments: TaskAttachment[]
  timeline: TaskTimelineItem[]
  actions: { assignTask: TaskAction; attachTaskFile: TaskAction; detachTaskFile: TaskAction; toggleTaskLabel: TaskAction; createChecklistItem: TaskAction; toggleChecklistItem: TaskAction; createTaskComment: TaskAction; trashTask: TaskAction; updateTask: TaskAction }
}

function shortId(value: string) {
  return value.slice(0, 8)
}

function formatBytes(value: number) {
  if (value < 1024) return value + " B"
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB"
  return (value / (1024 * 1024)).toFixed(1) + " MB"
}

export function TaskDetails({ taskId, title, description, priority, dueDate, assigneeId, advanced }: { taskId: string; title: string; description: string; priority: "low" | "medium" | "high"; dueDate?: string | null; assigneeId?: string | null; advanced: TaskAdvancedProps }) {
  const selectedLabelIds = new Set(advanced.assignments.filter((item) => item.task_id === taskId).map((item) => item.label_id))
  const checklist = advanced.checklist.filter((item) => item.task_id === taskId)
  const comments = advanced.comments.filter((item) => item.task_id === taskId)
  const attachments = advanced.attachments.filter((item) => item.task_id === taskId)
  const attachedFileIds = new Set(attachments.map((item) => item.file_id))
  const timeline = advanced.timeline.filter((item) => item.entity_id === taskId).slice(0, 5)

  return <div className="mt-4 space-y-4 border-t pt-3">
    <details>
      <summary className="cursor-pointer text-xs font-semibold text-zinc-600">Edit task</summary>
      <form action={advanced.actions.updateTask} className="mt-3 grid gap-3">
        <input type="hidden" name="taskId" value={taskId} />
        <label className="grid gap-1 text-xs font-medium" htmlFor={"title-" + taskId}>Title<input id={"title-" + taskId} required maxLength={160} name="title" defaultValue={title} className="field-control" /></label>
        <label className="grid gap-1 text-xs font-medium" htmlFor={"description-" + taskId}>Description<textarea id={"description-" + taskId} maxLength={10000} name="description" defaultValue={description} rows={3} className="field-control resize-y" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium" htmlFor={"priority-" + taskId}>Priority<Select id={"priority-" + taskId} name="priority" defaultValue={priority} className="field-control" options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} /></label>
          <label className="grid gap-1 text-xs font-medium" htmlFor={"due-date-" + taskId}>Due date<input id={"due-date-" + taskId} name="dueDate" type="date" defaultValue={dueDate ?? ""} className="field-control" /></label>
        </div>
        <button className="button-secondary justify-self-start">Save changes</button>
      </form>
    </details>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Labels</span>
      {advanced.labels.map((label) => <form key={label.id} action={advanced.actions.toggleTaskLabel}><input type="hidden" name="taskId" value={taskId} /><input type="hidden" name="labelId" value={label.id} /><button className={"rounded-full px-2 py-1 text-[11px] font-semibold " + (selectedLabelIds.has(label.id) ? labelStyles[label.color] ?? labelStyles.indigo : "bg-zinc-100 text-zinc-500")}>{label.name}</button></form>)}
      {!advanced.labels.length && <span className="text-xs text-zinc-400">Create a label above.</span>}
    </div>
    <form action={advanced.actions.assignTask} className="flex items-center gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400" htmlFor={"assignee-" + taskId}>Assignee</label>
      <Select id={"assignee-" + taskId} name="assigneeId" defaultValue={assigneeId ?? ""} className="field-control min-h-0 py-1 text-xs" options={[{ value: "", label: "Unassigned" }, ...advanced.members.map((member) => ({ value: member.user_id, label: "Member " + shortId(member.user_id) }))]} />
      <button className="button-quiet min-h-0 px-2 py-1 text-xs">Save</button>
    </form>
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Checklist</p>
      <div className="mt-2 space-y-1">
        {checklist.map((item) => <form key={item.id} action={advanced.actions.toggleChecklistItem} className="flex items-center gap-2"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="completed" value={String(item.is_completed)} /><button className={"text-left text-xs " + (item.is_completed ? "text-zinc-400 line-through" : "text-zinc-700")}>{item.is_completed ? "✓" : "○"} {item.title}</button></form>)}
        {!checklist.length && <p className="text-xs text-zinc-400">No checklist items yet.</p>}
      </div>
      <form action={advanced.actions.createChecklistItem} className="mt-2 flex gap-2"><input type="hidden" name="taskId" value={taskId} /><input required name="title" placeholder="Add checklist item" className="field-control min-h-0 py-1 text-xs" /><button className="button-quiet min-h-0 px-2 py-1 text-xs">Add</button></form>
    </div>
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Attachments</p>
      <div className="mt-2 space-y-1">
        {attachments.map((attachment) => <div key={attachment.id} className="flex items-center gap-2 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs"><Link href={"/api/files/" + attachment.file.id + "/download"} target="_blank" className="min-w-0 flex-1 truncate font-medium hover:underline">{attachment.file.name}</Link><span className="text-zinc-400">{formatBytes(Number(attachment.file.size_bytes))}</span><form action={advanced.actions.detachTaskFile}><input type="hidden" name="taskId" value={taskId} /><input type="hidden" name="fileId" value={attachment.file_id} /><button className="text-zinc-400 hover:text-red-600" aria-label={"Remove " + attachment.file.name}>Remove</button></form></div>)}
        {!attachments.length && <p className="text-xs text-zinc-400">No files attached.</p>}
      </div>
      {advanced.files.filter((file) => !attachedFileIds.has(file.id)).length ? <form action={advanced.actions.attachTaskFile} className="mt-2 flex gap-2"><input type="hidden" name="taskId" value={taskId} /><Select name="fileId" defaultValue="" required className="field-control min-h-0 py-1 text-xs" options={[{ value: "", label: "Attach existing file" }, ...advanced.files.filter((file) => !attachedFileIds.has(file.id)).map((file) => ({ value: file.id, label: file.name }))]} /><button className="button-quiet min-h-0 px-2 py-1 text-xs">Attach</button></form> : <Link href="/files" className="mt-2 inline-block text-xs text-zinc-500 hover:underline">Upload a file in Files first.</Link>}
    </div>
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Comments</p>
      <div className="mt-2 space-y-2">{comments.slice(-3).map((comment) => <div key={comment.id} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs"><p className="text-zinc-700">{comment.body}</p><p className="mt-1 text-[10px] text-zinc-400">{shortId(comment.author_id)} · {new Date(comment.created_at).toLocaleDateString()}</p></div>)}</div>
      <form action={advanced.actions.createTaskComment} className="mt-2 flex gap-2"><input type="hidden" name="taskId" value={taskId} /><input required name="body" placeholder="Add a comment" className="field-control min-h-0 py-1 text-xs" /><button className="button-quiet min-h-0 px-2 py-1 text-xs">Comment</button></form>
    </div>
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Timeline</p>
      <div className="mt-2 space-y-2">{timeline.length ? timeline.map((item) => <div key={item.id} className="flex items-start gap-2 text-xs"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" /><div><p className="text-zinc-700">{item.action} task</p><p className="mt-0.5 text-[10px] text-zinc-400">{new Date(item.created_at).toLocaleString()}</p></div></div>) : <p className="text-xs text-zinc-400">No timeline activity yet.</p>}</div>
    </div>
    <form action={advanced.actions.trashTask} className="flex justify-end border-t pt-3"><input type="hidden" name="taskId" value={taskId} /><button className="button-quiet min-h-0 px-2 py-1 text-xs text-red-600" aria-label={`Move ${title} to trash`}>Move to trash</button></form>
  </div>
}
