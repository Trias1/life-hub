import Link from "next/link"
import { redirect } from "next/navigation"
import { CircleCheck, CircleDot, CircleSlash, Columns3, List, MessageSquare, Paperclip, RotateCcw, Search, Trash2 } from "lucide-react"
import { TaskBoard, type BoardTask } from "@/components/task-board"
import { AssigneeBadge, LabelChip, PriorityChip } from "@/components/tasks/task-chip"
import { TaskHashRedirect } from "@/components/tasks/task-hash-redirect"
import { addDays, closedStatuses, isOpenStatus, memberName, openStatuses, priorityOptions, statusLabel, taskStatuses, todayKey, type TaskLabel, type TaskStatus } from "@/components/tasks/task-meta"
import { Select } from "@/components/ui/select"
import { formatDayMonth } from "@/lib/format-date"
import { relativeTime } from "@/lib/relative-time"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { restoreTask, updateTaskStatus } from "./actions"

type State = "open" | "closed" | "all" | "trash"
type Sort = "created" | "updated" | "due" | "priority" | "title"
type Due = "" | "overdue" | "next_7_days" | "no_date"
const PER_PAGE = 20
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; view?: string; task?: string; layout?: string; q?: string; status?: string; priority?: string; assignee?: string; due?: string; label?: string; sort?: string; page?: string }> }) {
  const params = await searchParams
  // Old links pointed at /tasks?task=<id>.
  if (params.task && uuid.test(params.task)) redirect("/tasks/" + params.task)

  const layout = params.layout === "board" ? "board" : "list"
  // The board shows every status as a column, so it always works on all active tasks.
  const state: State = layout === "board" ? "all" : params.view === "closed" || params.view === "all" || params.view === "trash" ? params.view : "open"
  const sort: Sort = params.sort === "updated" || params.sort === "due" || params.sort === "priority" || params.sort === "title" ? params.sort : "created"
  const q = (params.q ?? "").trim().slice(0, 100)
  const status = taskStatuses.some(([key]) => key === params.status) ? params.status as TaskStatus : ""
  const priority = priorityOptions.some((option) => option.value === params.priority) ? params.priority as string : ""
  const assignee = params.assignee === "me" || params.assignee === "unassigned" || (params.assignee && uuid.test(params.assignee)) ? params.assignee : ""
  const due: Due = params.due === "overdue" || params.due === "next_7_days" || params.due === "no_date" ? params.due : ""
  const label = params.label && uuid.test(params.label) ? params.label : ""
  const context = await getWorkspaceContext()
  if (!context) return null
  const supabase = context.supabase
  const now = new Date()
  const today = todayKey(now)

  const counted = (scope: State) => {
    let query = supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspaceId)
    if (scope === "trash") return query.not("deleted_at", "is", null)
    query = query.is("deleted_at", null)
    if (scope === "open") query = query.in("status", openStatuses)
    if (scope === "closed") query = query.in("status", closedStatuses)
    return query
  }

  const [openCount, closedCount, allCount, trashCount, { data: labels }, { data: members }, labelTasks] = await Promise.all([
    counted("open"),
    counted("closed"),
    counted("all"),
    counted("trash"),
    supabase.from("task_labels").select("id,name,color").eq("workspace_id", context.workspaceId).order("name"),
    supabase.from("workspace_members").select("user_id").eq("workspace_id", context.workspaceId).order("created_at"),
    label ? supabase.from("task_label_assignments").select("task_id").eq("label_id", label) : Promise.resolve({ data: null }),
  ])
  const counts: Record<State, number> = { open: openCount.count ?? 0, closed: closedCount.count ?? 0, all: allCount.count ?? 0, trash: trashCount.count ?? 0 }
  const labelTaskIds = (labelTasks.data ?? []).map((row) => row.task_id)

  let tasksQuery = supabase.from("tasks").select("id,title,status,priority,due_date,assignee_id,created_by,created_at,updated_at,deleted_at").eq("workspace_id", context.workspaceId)
  if (state === "trash") tasksQuery = tasksQuery.not("deleted_at", "is", null)
  else tasksQuery = tasksQuery.is("deleted_at", null)
  if (state === "open") tasksQuery = tasksQuery.in("status", openStatuses)
  if (state === "closed") tasksQuery = tasksQuery.in("status", closedStatuses)
  if (q) tasksQuery = tasksQuery.ilike("title", "%" + q.replace(/[%_\\]/g, (character) => "\\" + character) + "%")
  if (status) tasksQuery = tasksQuery.eq("status", status)
  if (priority) tasksQuery = tasksQuery.eq("priority", priority)
  if (assignee === "unassigned") tasksQuery = tasksQuery.is("assignee_id", null)
  else if (assignee) tasksQuery = tasksQuery.eq("assignee_id", assignee === "me" ? context.user.id : assignee)
  if (due === "overdue") tasksQuery = tasksQuery.lt("due_date", today).in("status", openStatuses)
  if (due === "next_7_days") tasksQuery = tasksQuery.gte("due_date", today).lte("due_date", addDays(today, 7)).in("status", openStatuses)
  if (due === "no_date") tasksQuery = tasksQuery.is("due_date", null)
  if (label) tasksQuery = tasksQuery.in("id", labelTaskIds.length ? labelTaskIds : ["00000000-0000-0000-0000-000000000000"])
  if (sort === "title") tasksQuery = tasksQuery.order("title", { ascending: true })
  else if (sort === "due") tasksQuery = tasksQuery.order("due_date", { ascending: true, nullsFirst: false })
  else tasksQuery = tasksQuery.order(sort === "updated" ? "updated_at" : "created_at", { ascending: false })

  const { data: tasks, error: tasksError } = await tasksQuery.limit(500)
  const ordered = sort === "priority" ? [...(tasks ?? [])].sort((a, b) => (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3)) : tasks ?? []
  const totalPages = layout === "board" ? 1 : Math.max(1, Math.ceil(ordered.length / PER_PAGE))
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1))
  const shown = layout === "board" ? ordered : ordered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const shownIds = shown.map((task) => task.id)

  const [{ data: assignments }, { data: comments }, { data: attachments }, { data: checklist }] = shownIds.length
    ? await Promise.all([
      supabase.from("task_label_assignments").select("task_id,label_id").in("task_id", shownIds),
      supabase.from("task_comments").select("task_id").in("task_id", shownIds),
      supabase.from("task_attachments").select("task_id").in("task_id", shownIds),
      supabase.from("task_checklist_items").select("task_id,is_completed").in("task_id", shownIds),
    ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }] as const
  const labelsById = new Map((labels ?? []).map((item) => [item.id, item as TaskLabel]))
  const taskLabels = (taskId: string) => (assignments ?? []).flatMap((row) => row.task_id === taskId && labelsById.has(row.label_id) ? [labelsById.get(row.label_id) as TaskLabel] : [])
  const countFor = (rows: ReadonlyArray<{ task_id: string }> | null, taskId: string) => (rows ?? []).filter((row) => row.task_id === taskId).length
  const dueText = (value: string | null) => value ? formatDayMonth(value + "T00:00:00+07:00") : null
  const isOverdue = (task: { due_date: string | null; status: string }) => Boolean(task.due_date && task.due_date < today && isOpenStatus(task.status))
  const filtered = Boolean(q || status || priority || assignee || due || label)
  const activeLabel = label ? labelsById.get(label) : undefined

  const href = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams()
    const merged = { layout: layout === "board" ? "board" : undefined, view: layout === "list" && state !== "open" ? state : undefined, q: q || undefined, status: status || undefined, priority: priority || undefined, assignee: assignee || undefined, due: due || undefined, label: label || undefined, sort: sort === "created" ? undefined : sort, ...changes }
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value)
    const query = next.toString()
    return "/tasks" + (query ? "?" + query : "")
  }
  const memberOptions = (members ?? []).filter((member) => member.user_id !== context.user.id).map((member) => ({ value: member.user_id, label: memberName(member.user_id, context.user.id) }))

  return (
    <div className="page-container">
      <TaskHashRedirect />
      {params.error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
      {(tasksError) && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Could not load tasks. Please try again.</p>}
      {params.success && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{params.success}</p>}

      <div className="issue-page-head">
        <h1 className="issue-title">Tasks</h1>
        <div className="flex shrink-0 items-center gap-2">
          <nav aria-label="Layout" className="flex rounded-[var(--radius-control)] border border-[var(--line)] p-0.5">
            <Link href={href({ layout: undefined, page: undefined })} aria-current={layout === "list" ? "page" : undefined} title="List" className={"inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold " + (layout === "list" ? "bg-[var(--surface-muted)] text-[var(--foreground)]" : "text-[var(--muted)]")}><List size={14} aria-hidden /><span className="max-sm:sr-only">List</span></Link>
            <Link href={href({ layout: "board", view: undefined, page: undefined })} aria-current={layout === "board" ? "page" : undefined} title="Board" className={"inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold " + (layout === "board" ? "bg-[var(--surface-muted)] text-[var(--foreground)]" : "text-[var(--muted)]")}><Columns3 size={14} aria-hidden /><span className="max-sm:sr-only">Board</span></Link>
          </nav>
          <Link href="/tasks/new" className="button-primary min-h-0 px-3.5 py-2">New task</Link>
        </div>
      </div>
      <div className="issue-list-head">
        <nav aria-label="Task views" className="issue-tabs">
          {([["open", "Open"], ["closed", "Closed"], ["all", "All"], ["trash", "Trash"]] as const).map(([key, text]) => (
            <Link key={key} href={href({ layout: undefined, view: key === "open" ? undefined : key, page: undefined })} aria-current={state === key ? "page" : undefined} className={"issue-tab" + (state === key ? " is-active" : "")}>
              {text}<span className="issue-tab-count">{counts[key]}</span>
            </Link>
          ))}
        </nav>
      </div>

      <form method="get" className="issue-filter">
        {layout === "board" && <input type="hidden" name="layout" value="board" />}
        {layout === "list" && state !== "open" && <input type="hidden" name="view" value={state} />}
        {label && <input type="hidden" name="label" value={label} />}
        <label className="issue-search">
          <Search size={15} aria-hidden />
          <span className="sr-only">Search tasks by title</span>
          <input name="q" defaultValue={q} placeholder="Search by title…" />
        </label>
        <Select name="status" defaultValue={status} placeholder="Any status" className="field-control issue-filter-select" options={[{ value: "", label: "Any status" }, ...taskStatuses.map(([value, text]) => ({ value, label: text }))]} />
        <Select name="sort" defaultValue={sort} className="field-control issue-filter-select" options={[{ value: "created", label: "Created date" }, { value: "updated", label: "Updated date" }, { value: "due", label: "Due date" }, { value: "priority", label: "Priority" }, { value: "title", label: "Title" }]} />
        <button className="issue-filter-apply button-secondary min-h-0 px-3.5 py-2">Apply</button>
        <div className="col-span-full grid grid-cols-2 gap-2 sm:grid-cols-[repeat(3,minmax(0,11rem))]">
          <Select name="priority" defaultValue={priority} placeholder="Any priority" className="field-control issue-filter-select" options={[{ value: "", label: "Any priority" }, ...priorityOptions.map((option) => ({ value: option.value, label: option.label + " priority" }))]} />
          <Select name="assignee" defaultValue={assignee} placeholder="Any assignee" className="field-control issue-filter-select" options={[{ value: "", label: "Any assignee" }, { value: "me", label: "Assigned to me" }, { value: "unassigned", label: "Unassigned" }, ...memberOptions]} />
          <Select name="due" defaultValue={due} placeholder="Any due date" className="field-control issue-filter-select" options={[{ value: "", label: "Any due date" }, { value: "overdue", label: "Overdue" }, { value: "next_7_days", label: "Due in 7 days" }, { value: "no_date", label: "No due date" }]} />
        </div>
      </form>

      {filtered && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          Showing {ordered.length} {ordered.length === 1 ? "task" : "tasks"}
          {activeLabel && <>with label <LabelChip name={activeLabel.name} color={activeLabel.color} /></>}
          <Link href={href({ q: undefined, status: undefined, priority: undefined, assignee: undefined, due: undefined, label: undefined, page: undefined })} className="underline">Clear filters</Link>
        </p>
      )}

      {layout === "board" ? (
        <TaskBoard
          action={updateTaskStatus}
          tasks={shown.map((task): BoardTask => ({ id: task.id, title: task.title, status: task.status as TaskStatus, priority: task.priority, dueLabel: dueText(task.due_date), overdue: isOverdue(task), assigneeName: task.assignee_id ? memberName(task.assignee_id, context.user.id) : null, labels: taskLabels(task.id) }))}
        />
      ) : shown.length ? (
        <ul className="issue-list">
          {shown.map((task) => {
            const Icon = state === "trash" ? Trash2 : task.status === "done" ? CircleCheck : task.status === "cancelled" ? CircleSlash : CircleDot
            const items = (checklist ?? []).filter((row) => row.task_id === task.id)
            const commentCount = countFor(comments, task.id)
            const attachmentCount = countFor(attachments, task.id)
            const overdue = isOverdue(task)
            return (
              <li key={task.id} className="issue-row">
                <Icon size={16} className={"issue-row-icon" + (task.status === "done" && state !== "trash" ? " text-[var(--accent)]" : "")} aria-label={statusLabel(task.status)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link href={"/tasks/" + task.id} className="issue-row-title">{task.title}</Link>
                    <PriorityChip priority={task.priority} />
                    {taskLabels(task.id).map((item) => <Link key={item.id} href={href({ label: item.id, page: undefined })}><LabelChip name={item.name} color={item.color} /></Link>)}
                  </div>
                  <p className="issue-row-meta">
                    {statusLabel(task.status)} · created {relativeTime(task.created_at, now)} by {task.created_by ? memberName(task.created_by, context.user.id) : "a former member"}
                    {task.due_date && <> · <span className={overdue ? "font-semibold text-red-600" : ""}>{overdue ? "Overdue · " : "Due "}{dueText(task.due_date)}</span></>}
                    {items.length > 0 && <> · {items.filter((item) => item.is_completed).length}/{items.length} checklist</>}
                  </p>
                </div>
                <div className="issue-row-side">
                  <div className="flex items-center gap-2.5">
                    {state === "trash" ? (
                      <form action={restoreTask}><input type="hidden" name="taskId" value={task.id} /><button className="button-secondary min-h-0 px-2.5 py-1 text-xs" aria-label={`Restore ${task.title}`}><RotateCcw size={12} className="mr-1" aria-hidden />Restore</button></form>
                    ) : <>
                      {commentCount > 0 && <div className="inline-flex items-center gap-1" title={commentCount + " comments"}><MessageSquare size={13} aria-hidden />{commentCount}</div>}
                      {attachmentCount > 0 && <div className="inline-flex items-center gap-1" title={attachmentCount + " attachments"}><Paperclip size={13} aria-hidden />{attachmentCount}</div>}
                      {task.assignee_id && <AssigneeBadge name={memberName(task.assignee_id, context.user.id)} />}
                    </>}
                  </div>
                  <span>updated {relativeTime(task.updated_at, now)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="issue-empty">
          <h2>{filtered ? "No tasks match these filters" : state === "open" ? "No open tasks" : state === "closed" ? "No closed tasks" : state === "trash" ? "Trash is empty" : "No tasks yet"}</h2>
          <p>{filtered ? "Try a different title, status, or filter." : state === "trash" ? "Deleted tasks stay here until restored or permanently removed." : "Write down the outcome you want, then set an owner, priority, and due date."}</p>
          {!filtered && (state === "open" || state === "all") && <Link href="/tasks/new" className="button-primary mt-4">New task</Link>}
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
          {page > 1 ? <Link href={href({ page: String(page - 1) })} className="button-secondary min-h-0 px-3 py-1.5">Previous</Link> : <span />}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages ? <Link href={href({ page: String(page + 1) })} className="button-secondary min-h-0 px-3 py-1.5">Next</Link> : <span />}
        </nav>
      )}
    </div>
  )
}
