import { getWorkspaceContext } from "@/lib/workspace/server"
import { TaskBoard } from "@/components/task-board"
import { assignTask, attachTaskFile, createChecklistItem, createTask, createTaskComment, createTaskLabel, detachTaskFile, toggleChecklistItem, toggleTaskLabel, updateTaskStatus } from "./actions"

export default async function TasksPage() {
  const context = await getWorkspaceContext()
  if (!context) return null

  const { data: tasks } = await context.supabase
    .from("tasks")
    .select("id,title,status,priority,due_date,assignee_id")
    .eq("workspace_id", context.workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const taskRows = tasks ?? []
  const taskIds = taskRows.map((task) => task.id)
  const { data: members } = await context.supabase.from("workspace_members").select("user_id,role").eq("workspace_id", context.workspaceId).order("created_at")
  const { data: labels } = await context.supabase.from("task_labels").select("id,name,color").eq("workspace_id", context.workspaceId).order("name")
  const { data: assignments } = taskIds.length ? await context.supabase.from("task_label_assignments").select("task_id,label_id").in("task_id", taskIds) : { data: [] as Array<{ task_id: string; label_id: string }> }
  const { data: checklist } = taskIds.length ? await context.supabase.from("task_checklist_items").select("id,task_id,title,is_completed").in("task_id", taskIds).order("position") : { data: [] as Array<{ id: string; task_id: string; title: string; is_completed: boolean }> }
  const { data: comments } = taskIds.length ? await context.supabase.from("task_comments").select("id,task_id,author_id,body,created_at").in("task_id", taskIds).order("created_at", { ascending: true }) : { data: [] as Array<{ id: string; task_id: string; author_id: string; body: string; created_at: string }> }
  const { data: attachmentRows } = taskIds.length ? await context.supabase.from("task_attachments").select("id,task_id,file_id").in("task_id", taskIds) : { data: [] as Array<{ id: string; task_id: string; file_id: string }> }
  const attachmentFileIds = Array.from(new Set((attachmentRows ?? []).map((attachment) => attachment.file_id)))
  const { data: attachmentFiles } = attachmentFileIds.length ? await context.supabase.from("files").select("id,name,mime_type,size_bytes").in("id", attachmentFileIds) : { data: [] as Array<{ id: string; name: string; mime_type: string; size_bytes: number }> }
  const filesById = new Map((attachmentFiles ?? []).map((file) => [file.id, file]))
  const taskAttachments = (attachmentRows ?? []).flatMap((attachment) => { const file = filesById.get(attachment.file_id); return file ? [{ ...attachment, file }] : [] })
  const { data: timeline } = taskIds.length ? await context.supabase.from("activity_logs").select("id,action,entity_id,created_at").eq("workspace_id", context.workspaceId).eq("entity_type", "task").in("entity_id", taskIds).order("created_at", { ascending: false }) : { data: [] as Array<{ id: string; action: string; entity_id: string; created_at: string }> }
  const { data: availableFiles } = await context.supabase.from("files").select("id,name,mime_type,size_bytes").eq("workspace_id", context.workspaceId).is("trashed_at", null).order("name")
  const openTasks = taskRows.filter((task) => task.status !== "done" && task.status !== "cancelled").length
  const dueTasks = taskRows.filter((task) => task.due_date && task.status !== "done" && task.status !== "cancelled").length

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <p className="eyebrow">Plan and execute</p>
          <h1 className="page-title">Tasks</h1>
          <p className="page-description">Keep ownership, priority, and the next action visible without adding noise.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">{openTasks} open</span>
          <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600">{dueTasks} scheduled</span>
        </div>
      </header>

      <section className="surface mt-8 p-5">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Quick add</p>
            <h2 className="mt-1 text-lg font-semibold">Create a task</h2>
            <p className="mt-1 text-sm text-zinc-500">Start with the outcome, then set the urgency and date.</p>
          </div>
          <span className="text-sm text-zinc-500">{taskRows.length} total</span>
        </div>
        <form action={createTask} className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="sr-only" htmlFor="task-title">Task title</label>
          <input id="task-title" required name="title" placeholder="What needs to happen?" className="field-control" />
          <label className="sr-only" htmlFor="task-priority">Task priority</label>
          <select id="task-priority" name="priority" defaultValue="medium" className="field-control">
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
          </select>
          <label className="sr-only" htmlFor="task-due-date">Due date</label>
          <input id="task-due-date" name="dueDate" type="date" className="field-control" />
          <label className="sr-only" htmlFor="task-assignee">Task assignee</label>
          <select id="task-assignee" name="assigneeId" defaultValue="" className="field-control">
            <option value="">Unassigned</option>
            {(members ?? []).map((member) => <option key={member.user_id} value={member.user_id}>Member {member.user_id.slice(0, 8)}</option>)}
          </select>
          <button className="button-primary">Add task</button>
        </form>
      </section>
      <form action={createTaskLabel} className="mt-4 flex flex-wrap gap-2 border-t pt-4">
        <input required name="name" placeholder="New label" className="field-control min-h-0 py-2 text-xs" />
        <select name="color" defaultValue="indigo" className="field-control min-h-0 py-2 text-xs"><option value="indigo">Neutral</option><option value="blue">Blue</option><option value="emerald">Emerald</option><option value="rose">Rose</option><option value="amber">Amber</option></select>
        <button className="button-secondary min-h-0 px-3 py-2 text-xs">Create label</button>
      </form>

      <TaskBoard tasks={taskRows} action={updateTaskStatus} advanced={{ members: members ?? [], labels: labels ?? [], assignments: assignments ?? [], checklist: checklist ?? [], comments: comments ?? [], files: availableFiles ?? [], attachments: taskAttachments, timeline: timeline ?? [], actions: { assignTask, attachTaskFile, createChecklistItem, createTaskComment, detachTaskFile, toggleChecklistItem, toggleTaskLabel } }} />
    </div>
  )
}
