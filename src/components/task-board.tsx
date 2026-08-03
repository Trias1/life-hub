"use client"

import { useMemo, useState } from "react"
import { TaskDetails, type TaskAdvancedProps } from "./task-details"

type TaskStatus = "todo" | "in_progress" | "review" | "done" | "cancelled"
type TaskPriority = "low" | "medium" | "high"
type DueFilter = "all" | "overdue" | "next_7_days" | "no_date"
type Task = {
  id: string
  title: string
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
    <form id={`task-form-${task.id}`} action={action} className="mt-4 flex items-center gap-2">
      <input type="hidden" name="id" value={task.id} />
      <label className="sr-only" htmlFor={`status-${task.id}`}>Status for {task.title}</label>
      <select id={`status-${task.id}`} name="status" defaultValue={task.status} className="field-control min-h-0 py-2 text-xs">
        {columns.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
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
    <section className="mt-8">
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
          <select id="task-status-filter" value={status} onChange={(event) => setStatus(event.target.value as "all" | TaskStatus)} className="field-control">
            <option value="all">All statuses</option>
            {columns.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label className="sr-only" htmlFor="task-priority-filter">Filter by priority</label>
          <select id="task-priority-filter" value={priority} onChange={(event) => setPriority(event.target.value as "all" | TaskPriority)} className="field-control">
            <option value="all">All priorities</option>
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
          </select>
          <label className="sr-only" htmlFor="task-assignee-filter">Filter by assignee</label>
          <select id="task-assignee-filter" value={assignee} onChange={(event) => setAssignee(event.target.value)} className="field-control">
            <option value="all">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {assignees.map((id) => <option key={id} value={id}>Member {shortId(id)}</option>)}
          </select>
          <label className="sr-only" htmlFor="task-due-filter">Filter by due date</label>
          <select id="task-due-filter" value={due} onChange={(event) => setDue(event.target.value as DueFilter)} className="field-control">
            <option value="all">Any due date</option>
            <option value="overdue">Overdue</option>
            <option value="next_7_days">Next 7 days</option>
            <option value="no_date">No due date</option>
          </select>
          {hasFilters && <button type="button" onClick={clearFilters} className="button-quiet min-h-0 whitespace-nowrap px-2 text-xs">Clear</button>}
        </div>
      </div>

      {view === "list" ? (
        <div className="mt-4 space-y-3">
          {filteredTasks.length ? filteredTasks.map((task) => (
            <article key={task.id} className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{task.title}</p>
                {details(task, true)}
              </div>
              {editor(task)}
              <TaskDetails taskId={task.id} assigneeId={task.assignee_id} advanced={advanced} />
            </article>
          )) : <div className="empty-state surface"><h2 className="font-semibold">No matching tasks</h2><p>Try a different search or filter.</p></div>}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          {columns.map(([columnStatus, label]) => {
            const columnTasks = filteredTasks.filter((task) => task.status === columnStatus)
            return (
              <div key={columnStatus} className="surface-muted min-h-48 p-4" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveTask(columnStatus) }}>
                <div className="toolbar">
                  <div>
                    <h2 className="font-semibold">{label}</h2>
                    <p className="mt-1 text-xs text-zinc-500">{columnStatus === "todo" ? "Ready to start" : columnStatus === "in_progress" ? "Currently active" : columnStatus === "review" ? "Ready for a final check" : columnStatus === "done" ? "Completed work" : "No longer active"}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-zinc-500">{columnTasks.length}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {columnTasks.length ? columnTasks.map((task) => (
                    <article key={task.id} draggable onDragStart={() => setDraggedTask(task.id)} onDragEnd={() => setDraggedTask(null)} className="surface cursor-grab p-4 active:cursor-grabbing">
                      <p className="font-medium">{task.title}</p>
                      {details(task)}
                      {editor(task)}
              <TaskDetails taskId={task.id} assigneeId={task.assignee_id} advanced={advanced} />
                    </article>
                  )) : <p className="py-6 text-center text-sm text-zinc-400">Drop tasks here.</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
