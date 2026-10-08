"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { Select } from "@/components/ui/select"
import { AssigneeBadge, LabelChip, PriorityChip } from "@/components/tasks/task-chip"
import { taskStatuses, type TaskLabel, type TaskStatus } from "@/components/tasks/task-meta"

export type BoardTask = {
  id: string
  title: string
  status: TaskStatus
  priority: string
  dueLabel: string | null
  overdue: boolean
  assigneeName: string | null
  labels: TaskLabel[]
}
type TaskAction = (formData: FormData) => Promise<void>

const columnHints: Record<TaskStatus, string> = { todo: "Ready to start", in_progress: "Currently active", review: "Ready for a final check", done: "Completed work", cancelled: "No longer active" }

/** Kanban view of the task list: drag a card (or use its status menu on touch screens) to change status. */
export function TaskBoard({ tasks, action }: { tasks: BoardTask[]; action: TaskAction }) {
  const [pending, setPending] = useState<Record<string, TaskStatus>>({})
  const [dragged, setDragged] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null)
  const [, startTransition] = useTransition()
  const statusOf = (task: BoardTask) => pending[task.id] ?? task.status

  function move(taskId: string, status: TaskStatus) {
    const task = tasks.find((item) => item.id === taskId)
    if (!task || statusOf(task) === status) return
    setPending((current) => ({ ...current, [taskId]: status }))
    const formData = new FormData()
    formData.set("id", taskId)
    formData.set("status", status)
    formData.set("from", "board")
    startTransition(async () => {
      try { await action(formData) } finally { setPending(({ [taskId]: _done, ...rest }) => rest) }
    })
  }

  return (
    <div className="task-board-kanban mt-4 min-w-0">
      {taskStatuses.map(([columnStatus, label]) => {
        const columnTasks = tasks.filter((task) => statusOf(task) === columnStatus)
        return (
          <section key={columnStatus} aria-label={label} className={"task-board-column rounded-[var(--radius-card)] border bg-[var(--surface-muted)] p-3" + (dropTarget === columnStatus ? " border-[var(--accent)]" : " border-[var(--line)]")} onDragOver={(event) => { event.preventDefault(); setDropTarget(columnStatus) }} onDragLeave={() => setDropTarget((current) => current === columnStatus ? null : current)} onDrop={(event) => { event.preventDefault(); setDropTarget(null); if (dragged) move(dragged, columnStatus); setDragged(null) }}>
            <header className="flex items-start justify-between gap-2 px-1">
              <div>
                <h2 className="text-sm font-semibold">{label}</h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{columnHints[columnStatus]}</p>
              </div>
              <span className="issue-tab-count">{columnTasks.length}</span>
            </header>
            <ul className="task-board-column-tasks mt-3 space-y-2">
              {columnTasks.length ? columnTasks.map((task) => (
                <li key={task.id} draggable onDragStart={() => setDragged(task.id)} onDragEnd={() => { setDragged(null); setDropTarget(null) }} className={"task-board-card cursor-grab rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-3 active:cursor-grabbing" + (dragged === task.id ? " opacity-60" : "")}>
                  <Link href={"/tasks/" + task.id} className="issue-row-title text-sm">{task.title}</Link>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <PriorityChip priority={task.priority} />
                    {task.labels.map((item) => <LabelChip key={item.id} name={item.name} color={item.color} />)}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
                    <span className={task.overdue ? "font-semibold text-red-600" : ""}>{task.dueLabel ? (task.overdue ? "Overdue · " : "Due ") + task.dueLabel : "No due date"}</span>
                    {task.assigneeName && <AssigneeBadge name={task.assigneeName} />}
                  </div>
                  <label className="sr-only" htmlFor={"board-status-" + task.id}>Status for {task.title}</label>
                  <Select id={"board-status-" + task.id} value={statusOf(task)} onChange={(value) => move(task.id, value as TaskStatus)} className="field-control mt-2 min-h-0 py-1.5 text-xs" options={taskStatuses.map(([value, text]) => ({ value, label: text }))} />
                </li>
              )) : <li className="py-6 text-center text-xs text-[var(--muted)]">Drop tasks here</li>}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
