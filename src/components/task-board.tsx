"use client"

import { useMemo, useState } from "react"
import { X } from "lucide-react"
import { TaskDetails, type TaskAdvancedProps } from "./task-details"
import { Select } from "@/components/ui/select"

type TaskStatus = "todo" | "in_progress" | "review" | "done" | "cancelled"
type TaskPriority = "low" | "medium" | "high"
type DueFilter = "all" | "overdue" | "next_7_days" | "no_date"
type Task = {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date?: string | null
  assignee_id?: string | null
}
type TaskAction = (formData: FormData) => Promise<void>

type Column = readonly [TaskStatus, string]
const columns: Column[] = [
  ["todo", "Todo"],
  ["in_progress", "In progress"],
  ["review", "Review"],
  ["done", "Done"],
  ["cancelled", "Cancelled"],
]
const statusLabels: Record<TaskStatus, string> = {
  todo: "Todo",
  review: "Review",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
}
const priorityStyles: Record<TaskPriority, string> = {
  low: "bg-zinc-100 text-zinc-600",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-rose-50 text-rose-700",
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function isOpen(task: Task) {
  return task.status !== "done" && task.status !== "cancelled"
}

function isOverdue(task: Task, today: string) {
  return Boolean(task.due_date && task.due_date < today && isOpen(task))
}

function isDueSoon(task: Task, today: string) {
  if (!task.due_date || !isOpen(task)) return false
  const end = new Date(`${today}T00:00:00`)
  end.setDate(end.getDate() + 7)
  return task.due_date >= today && task.due_date <= dateKey(end)
}

function formatDueDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function shortId(value: string) {
  return value.slice(0, 8)
}

export function TaskBoard({ tasks, action, advanced }: { tasks: Task[]; action: TaskAction; advanced: TaskAdvancedProps }) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | TaskStatus>("all")
  const [priority, setPriority] = useState<"all" | TaskPriority>("all")
  const [assignee, setAssignee] = useState("all")
  const [due, setDue] = useState<DueFilter>("all")
  const [view, setView] = useState<"board" | "list">("board")
  const [draggedTask, setDraggedTask] = useState<string | null>(null)
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null)
  const today = dateKey(new Date())
  const assignees = useMemo(() => [...new Set(tasks.map((task) => task.assignee_id).filter((id): id is string => Boolean(id)))], [tasks])
  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return tasks.filter((task) => {
      const matchesQuery = !normalizedQuery || task.title.toLowerCase().includes(normalizedQuery)
      const matchesStatus = status === "all" || task.status === status
      const matchesPriority = priority === "all" || task.priority === priority
      const matchesAssignee = assignee === "all" || (assignee === "unassigned" ? !task.assignee_id : task.assignee_id === assignee)
      const matchesDue = due === "all" || (due === "overdue" && isOverdue(task, today)) || (due === "next_7_days" && isDueSoon(task, today)) || (due === "no_date" && !task.due_date)
      return matchesQuery && matchesStatus && matchesPriority && matchesAssignee && matchesDue
    })
  }, [assignee, due, priority, query, status, tasks, today])
  const hasFilters = Boolean(query || status !== "all" || priority !== "all" || assignee !== "all" || due !== "all")
  const clearFilters = () => {
    setQuery("")
    setStatus("all")
    setPriority("all")
    setAssignee("all")
    setDue("all")
  }
  const details = (task: Task, showStatus = false) => (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      {showStatus && <span className="rounded-full bg-zinc-100 px-2 py-1 font-semibold text-zinc-600">{statusLabels[task.status]}</span>}
      <span className={`rounded-full px-2 py-1 font-semibold ${priorityStyles[task.priority]}`}>{task.priority} priority</span>
      {task.assignee_id ? <span className="rounded-full bg-zinc-100 px-2 py-1 font-semibold text-zinc-700">Assigned · {shortId(task.assignee_id)}</span> : <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-500">Unassigned</span>}
      {task.due_date && <span className={isOverdue(task, today) ? "font-semibold text-rose-600" : "text-zinc-500"}>{isOverdue(task, today) ? "Overdue" : "Due"} {formatDueDate(task.due_date)}</span>}
    </div>
  )
  const editor = (task: Task) => (
    <form id={`task-form-${task.id}`} action={action} onClick={(event) => event.stopPropagation()} className="mt-4 flex items-center gap-2">
      <input type="hidden" name="id" value={task.id} />
      <label className="sr-only" htmlFor={`status-${task.id}`}>Status for {task.title}</label>
      <Select id={`status-${task.id}`} name="status" defaultValue={task.status} className="field-control min-h-0 py-2 text-xs" options={columns.map(([value, label]) => ({ value, label }))} />
      <button className="button-quiet min-h-0 px-2 py-1 text-xs">Save</button>
    </form>
  )
  const moveTask = (nextStatus: TaskStatus) => {
    if (!draggedTask) return
    const form = document.getElementById(`task-form-${draggedTask}`) as HTMLFormElement | null
    const select = form?.elements.namedItem("status") as HTMLSelectElement | null
    if (!form || !select) return
    select.value = nextStatus
    form.requestSubmit()
    setDraggedTask(null)
  }

  return (
    <section>
      <div className="surface p-4">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Workspace queue</p>
            <p className="mt-1 text-sm text-zinc-500">Showing {filteredTasks.length} of {tasks.length} tasks</p>
          </div>
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
            <button type="button" onClick={() => setView("board")} className={view === "board" ? "button-secondary min-h-0 px-3 py-1.5 text-xs" : "button-quiet min-h-0 px-3 py-1.5 text-xs"}>Board</button>
            <button type="button" onClick={() => setView("list")} className={view === "list" ? "button-secondary min-h-0 px-3 py-1.5 text-xs" : "button-quiet min-h-0 px-3 py-1.5 text-xs"}>List</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))_auto]">
          <label className="sr-only" htmlFor="task-search">Search tasks</label>
          <input id="task-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" className="field-control" />
          <label className="sr-only" htmlFor="task-status-filter">Filter by status</label>
          <Select id="task-status-filter" value={status} onChange={(value) => setStatus(value as "all" | TaskStatus)} className="field-control" options={[{ value: "all", label: "All statuses" }, ...columns.map(([value, label]) => ({ value, label }))]} />
          <label className="sr-only" htmlFor="task-priority-filter">Filter by priority</label>
          <Select id="task-priority-filter" value={priority} onChange={(value) => setPriority(value as "all" | TaskPriority)} className="field-control" options={[{ value: "all", label: "All priorities" }, { value: "low", label: "Low priority" }, { value: "medium", label: "Medium priority" }, { value: "high", label: "High priority" }]} />
          <label className="sr-only" htmlFor="task-assignee-filter">Filter by assignee</label>
          <Select id="task-assignee-filter" value={assignee} onChange={setAssignee} className="field-control" options={[{ value: "all", label: "All assignees" }, { value: "unassigned", label: "Unassigned" }, ...assignees.map((id) => ({ value: id, label: "Member " + shortId(id) }))]} />
          <label className="sr-only" htmlFor="task-due-filter">Filter by due date</label>
          <Select id="task-due-filter" value={due} onChange={(value) => setDue(value as DueFilter)} className="field-control" options={[{ value: "all", label: "Any due date" }, { value: "overdue", label: "Overdue" }, { value: "next_7_days", label: "Next 7 days" }, { value: "no_date", label: "No due date" }]} />
          {hasFilters && <button type="button" onClick={clearFilters} className="button-quiet min-h-0 whitespace-nowrap px-2 text-xs">Clear</button>}
        </div>
      </div>

      {view === "list" ? (
        <div className="task-board-column-tasks mt-4 space-y-3">
          {filteredTasks.length ? filteredTasks.map((task) => (
            <article id={`task-${task.id}`} key={task.id} className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{task.title}</p>
                {task.description && <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-500">{task.description}</p>}
                {details(task, true)}
              </div>
              {editor(task)}
              <TaskDetails taskId={task.id} title={task.title} description={task.description} priority={task.priority} dueDate={task.due_date} assigneeId={task.assignee_id} advanced={advanced} />
            </article>
          )) : <div className="empty-state surface"><h2 className="font-semibold">No matching tasks</h2><p>Try a different search or filter.</p></div>}
        </div>
      ) : (
        <div className="task-board-kanban mt-4">
          {columns.map(([columnStatus, label]) => {
            const columnTasks = filteredTasks.filter((task) => task.status === columnStatus)
            return (
              <div key={columnStatus} className={"task-board-column surface-muted min-h-48 p-4" + (columnStatus === "cancelled" ? " task-board-column-cancelled" : "")} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveTask(columnStatus) }}>
                <div className="toolbar">
                  <div>
                    <h2 className="font-semibold">{label}</h2>
                    <p className="mt-1 text-xs text-zinc-500">{columnStatus === "todo" ? "Ready to start" : columnStatus === "in_progress" ? "Currently active" : columnStatus === "review" ? "Ready for a final check" : columnStatus === "done" ? "Completed work" : "No longer active"}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-zinc-500">{columnTasks.length}</span>
                </div>
                <div className="task-board-column-tasks mt-4 space-y-3">
                  {columnTasks.length ? columnTasks.map((task) => (
                    <article id={`task-${task.id}`} key={task.id} draggable onDragStart={() => setDraggedTask(task.id)} onDragEnd={() => setDraggedTask(null)} className="task-board-card surface cursor-grab p-4 active:cursor-grabbing" onClick={() => setDrawerTaskId(task.id)}>
                      <p className="font-medium">{task.title}</p>
                      {details(task)}
                      {editor(task)}
                    </article>
                  )) : <p className="py-6 text-center text-sm text-zinc-400">Drop tasks here.</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === "board" && drawerTaskId && (() => {
        const drawerTask = tasks.find((task) => task.id === drawerTaskId)
        if (!drawerTask) return null
        return (
          <>
            <button type="button" className="task-drawer-backdrop" onClick={() => setDrawerTaskId(null)} aria-label="Close task details" />
            <aside className="task-drawer" role="dialog" aria-modal="true" aria-labelledby="task-drawer-title">
              <div className="task-drawer-header">
                <div className="min-w-0">
                  <h2 id="task-drawer-title" className="truncate text-lg font-semibold">{drawerTask.title}</h2>
                  <span className={"mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold " + priorityStyles[drawerTask.priority]}>{drawerTask.priority} priority</span>
                </div>
                <button type="button" className="task-drawer-close" onClick={() => setDrawerTaskId(null)} aria-label="Close task details"><X size={18} /></button>
              </div>
              <div className="task-drawer-content">
                <TaskDetails taskId={drawerTask.id} title={drawerTask.title} description={drawerTask.description} priority={drawerTask.priority} dueDate={drawerTask.due_date} assigneeId={drawerTask.assignee_id} advanced={advanced} />
              </div>
            </aside>
          </>
        )
      })()}
    </section>
  )
}
