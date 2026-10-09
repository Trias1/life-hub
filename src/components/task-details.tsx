"use client"

import Link from "next/link"
import { useEffect, useRef, useState, useTransition } from "react"
import { CircleCheck, CircleDot, CircleSlash, Copy, History, MessageSquare, MoreVertical, Paperclip, RotateCcw, SquarePen, Trash2 } from "lucide-react"
import { NoteDescriptionEditor } from "@/components/notes/note-description-editor"
import { NoteViewer } from "@/components/notes/note-viewer"
import { LabelChip, PriorityChip } from "@/components/tasks/task-chip"
import { labelColorOptions, priorityOptions, statusLabel, taskStatuses, type TaskLabel, type TaskStatus } from "@/components/tasks/task-meta"
import { Select } from "@/components/ui/select"
import { useImageUpload } from "@/hooks/use-image-upload"

type TaskAction = (formData: FormData) => Promise<void>
type TaskFile = { id: string; name: string; mime_type: string; size_bytes: number }
type Stamp = { at: string; label: string }
export type TaskActivityItem = { kind: "event" | "comment"; id: string; author: string; text: string; sortKey: string } & Stamp
type Props = {
  task: { id: string; title: string; description: string; status: TaskStatus; priority: string; dueDate: string | null; assigneeId: string | null }
  state: "open" | "closed" | "trash"
  workspaceId: string
  canDeletePermanently: boolean
  authorName: string
  created: Stamp
  updated: Stamp
  due: { label: string; overdue: boolean } | null
  members: Array<{ value: string; label: string }>
  labels: TaskLabel[]
  selectedLabelIds: string[]
  checklist: Array<{ id: string; title: string; is_completed: boolean }>
  attachments: Array<{ id: string; file: TaskFile }>
  files: TaskFile[]
  activity: TaskActivityItem[]
  actions: Record<"assignTask" | "attachTaskFile" | "createChecklistItem" | "createTaskComment" | "createTaskLabel" | "deleteTaskPermanently" | "detachTaskFile" | "restoreTask" | "toggleChecklistItem" | "toggleTaskLabel" | "trashTask" | "updateTask" | "updateTaskStatus", TaskAction>
}

const VISIBLE_ACTIVITY = 12

function formatBytes(value: number) {
  if (value < 1024) return value + " B"
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB"
  return (value / (1024 * 1024)).toFixed(1) + " MB"
}

/** Issue-style task page: title, description, checklist, attachments, sidebar details and activity. */
export function TaskDetails({ task, state, workspaceId, canDeletePermanently, authorName, created, updated, due, members, labels, selectedLabelIds, checklist, attachments, files, activity, actions }: Props) {
  const { processImages } = useImageUpload()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: task.title, description: task.description })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingField, setEditingField] = useState<"" | "priority" | "due" | "labels">("")
  const [showAllActivity, setShowAllActivity] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const active = state !== "trash"
  const selectedLabels = labels.filter((label) => selectedLabelIds.includes(label.id))
  const unattachedFiles = files.filter((file) => !attachments.some((attachment) => attachment.file.id === file.id))
  const doneItems = checklist.filter((item) => item.is_completed).length
  const shownActivity = showAllActivity ? activity : activity.slice(-VISIBLE_ACTIVITY)
  const hiddenCount = activity.length - shownActivity.length

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false) }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", escape)
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape) }
  }, [menuOpen])

  /** Calls a server action with the given fields; the action revalidates this page. */
  function run(action: TaskAction, fields: Record<string, string>) {
    const formData = new FormData()
    for (const [key, value] of Object.entries(fields)) formData.set(key, value)
    startTransition(async () => { await action(formData) })
  }

  const editFields = (changes: Partial<Record<"title" | "description" | "priority" | "dueDate", string>>) => ({ taskId: task.id, title: task.title, description: task.description, priority: task.priority, dueDate: task.dueDate ?? "", ...changes })

  async function save() {
    if (!draft.title.trim()) return setMessage("Add a title before saving.")
    setSaving(true)
    setMessage("")
    try {
      const formData = new FormData()
      for (const [key, value] of Object.entries(editFields({ title: draft.title.trim(), description: await processImages(draft.description, workspaceId) }))) formData.set(key, value)
      await actions.updateTask(formData)
      setEditing(false)
      setMessage("Changes saved")
    } catch (error) {
      if (error && typeof error === "object" && "digest" in error) throw error
      setMessage("Could not save: " + (error instanceof Error ? error.message : "unknown error"))
    } finally {
      setSaving(false)
    }
  }

  async function copyLink() {
    setMenuOpen(false)
    await navigator.clipboard.writeText(window.location.origin + "/tasks/" + task.id)
    setMessage("Link copied")
  }

  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />
  const editToggle = (field: "priority" | "due" | "labels") => active && <button type="button" onClick={() => setEditingField((current) => current === field ? "" : field)} className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)]">{editingField === field ? "Done" : "Edit"}</button>
  const sectionTitle = "flex items-center justify-between gap-3 text-sm font-semibold"

  return (
    <div className="issue-layout issue-detail">
      <article className="issue-main min-w-0">
        {state === "trash" && (
          <div role="status" className="issue-banner">
            <span>This task is in the trash.</span>
            <span className="flex flex-wrap gap-2">
              <form action={actions.restoreTask}>{hidden("taskId", task.id)}<button className="button-secondary min-h-0 px-3 py-1.5 text-xs"><RotateCcw size={13} className="mr-1.5" />Restore</button></form>
              {canDeletePermanently && <form action={actions.deleteTaskPermanently} onSubmit={(event) => { if (!window.confirm("Delete this task permanently? Its checklist, comments, and attachments go with it. This cannot be undone.")) event.preventDefault() }}>{hidden("taskId", task.id)}<button className="button-quiet min-h-0 px-3 py-1.5 text-xs text-red-600">Delete permanently</button></form>}
            </span>
          </div>
        )}

        {editing ? (
          <div className="issue-form">
            <div className="issue-form-field">
              <label htmlFor="edit-task-title" className="issue-form-label">Title <span className="font-normal text-[var(--muted)]">(required)</span></label>
              <input id="edit-task-title" autoFocus maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="field-control" />
            </div>
            <div className="issue-form-field">
              <p id="edit-task-description" className="issue-form-label">Description</p>
              <NoteDescriptionEditor value={draft.description} onChange={(description) => setDraft((current) => ({ ...current, description }))} minHeight={220} labelledBy="edit-task-description" />
            </div>
            <div className="issue-form-actions">
              <button type="button" onClick={() => void save()} disabled={saving} className="button-primary disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
              <button type="button" onClick={() => { setEditing(false); setMessage("") }} disabled={saving} className="button-secondary">Cancel</button>
              <span role="status" className="text-xs text-[var(--muted)]">{message}</span>
            </div>
          </div>
        ) : (
          <>
            <header className="issue-header">
              <h1 className="issue-title">{task.title}</h1>
              <div className="flex shrink-0 items-center gap-2">
                {active && <button type="button" onClick={() => { setDraft({ title: task.title, description: task.description }); setMessage(""); setEditing(true) }} className="button-secondary min-h-0 px-3 py-1.5">Edit</button>}
                <div ref={menuRef} className="relative">
                  <button type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="button-quiet min-h-0 px-2 py-1.5"><MoreVertical size={16} /></button>
                  {menuOpen && (
                    <div role="menu" className="issue-menu">
                      <button type="button" role="menuitem" onClick={() => void copyLink()}><Copy size={14} />Copy link</button>
                      {active && <>
                        {state === "open"
                          ? <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); run(actions.updateTaskStatus, { id: task.id, status: "done" }) }}><CircleCheck size={14} />Mark as done</button>
                          : <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); run(actions.updateTaskStatus, { id: task.id, status: "todo" }) }}><CircleDot size={14} />Reopen task</button>}
                        {task.status !== "cancelled" && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); run(actions.updateTaskStatus, { id: task.id, status: "cancelled" }) }}><CircleSlash size={14} />Cancel task</button>}
                        <form action={actions.trashTask} onSubmit={() => setMenuOpen(false)}>{hidden("taskId", task.id)}<button role="menuitem" className="text-red-600" aria-label={`Move ${task.title} to trash`}><Trash2 size={14} />Move to trash</button></form>
                      </>}
                    </div>
                  )}
                </div>
              </div>
            </header>
            <p className="issue-meta">
              <span className="issue-state" data-state={state === "open" ? "active" : state === "closed" ? "closed" : "trash"}>{state === "open" ? "Open" : state === "closed" ? "Closed" : "Trash"}</span>
              <span>{statusLabel(task.status)}</span>
              <span aria-hidden>·</span>
              <span>Task created <time dateTime={created.at} title={created.at}>{created.label}</time> by <strong>{authorName}</strong></span>
            </p>
            {message && <p role="status" className="mt-3 text-xs text-[var(--muted)]">{message}</p>}
            <div className="issue-body"><NoteViewer content={task.description} /></div>
          </>
        )}

        <section aria-labelledby="checklist-heading" className="mt-8 rounded-[var(--radius-card)] border border-[var(--line)]">
          <h2 id="checklist-heading" className={sectionTitle + " border-b border-[var(--line)] px-4 py-3"}>
            <span>Checklist</span>
            <span className="text-xs font-normal text-[var(--muted)]">{checklist.length ? doneItems + " of " + checklist.length + " done" : "No items"}</span>
          </h2>
          {checklist.length > 0 && (
            <ul className="divide-y divide-[var(--line)]">
              {checklist.map((item) => (
                <li key={item.id}>
                  <form action={actions.toggleChecklistItem}>{hidden("id", item.id)}{hidden("completed", String(item.is_completed))}
                    <button disabled={!active} aria-pressed={item.is_completed} className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-muted)] disabled:hover:bg-transparent">
                      <span aria-hidden className={"mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] " + (item.is_completed ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]" : "border-[var(--line)]")}>{item.is_completed ? "✓" : ""}</span>
                      <span className={"min-w-0 break-words " + (item.is_completed ? "text-[var(--muted)] line-through" : "")}>{item.title}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {active && (
            <form action={actions.createChecklistItem} className={"flex gap-2 px-4 py-3" + (checklist.length ? " border-t border-[var(--line)]" : "")}>
              {hidden("taskId", task.id)}
              <label className="sr-only" htmlFor="checklist-title">New checklist item</label>
              <input id="checklist-title" required maxLength={240} name="title" placeholder="Add a checklist item" className="field-control min-h-0 min-w-0 flex-1 py-1.5 text-sm" />
              <button className="button-secondary min-h-0 px-3 py-1.5 text-xs">Add</button>
            </form>
          )}
        </section>

        <section aria-labelledby="attachments-heading" className="mt-4 rounded-[var(--radius-card)] border border-[var(--line)]">
          <h2 id="attachments-heading" className={sectionTitle + " border-b border-[var(--line)] px-4 py-3"}>
            <span className="inline-flex items-center gap-1.5"><Paperclip size={14} aria-hidden />Attachments</span>
            <span className="text-xs font-normal text-[var(--muted)]">{attachments.length}</span>
          </h2>
          {attachments.length ? (
            <ul className="divide-y divide-[var(--line)]">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <a href={"/api/files/" + attachment.file.id + "/download"} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate font-medium hover:underline">{attachment.file.name}</a>
                  <span className="shrink-0 text-xs text-[var(--muted)]">{formatBytes(Number(attachment.file.size_bytes))}</span>
                  {active && <form action={actions.detachTaskFile}>{hidden("taskId", task.id)}{hidden("fileId", attachment.file.id)}<button className="text-xs text-[var(--muted)] hover:text-red-600" aria-label={"Remove " + attachment.file.name}>Remove</button></form>}
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-3 text-sm text-[var(--muted)]">No files attached.</p>}
          {active && (unattachedFiles.length ? (
            <form action={actions.attachTaskFile} className="flex gap-2 border-t border-[var(--line)] px-4 py-3">
              {hidden("taskId", task.id)}
              <div className="min-w-0 flex-1"><Select name="fileId" defaultValue="" required placeholder="Attach an existing file" className="field-control min-h-0 w-full py-1.5 text-sm" options={[{ value: "", label: "Attach an existing file" }, ...unattachedFiles.map((file) => ({ value: file.id, label: file.name }))]} /></div>
              <button className="button-secondary min-h-0 px-3 py-1.5 text-xs">Attach</button>
            </form>
          ) : <p className="border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]"><Link href="/files" className="underline">Upload a file in Files</Link> to attach it here.</p>)}
        </section>
      </article>

      <aside className="issue-sidebar">
        <div className="issue-sidebar-block">
          <label htmlFor="task-assignee" className="issue-sidebar-label">Assignee</label>
          {active
            ? <Select key={task.assigneeId ?? "none"} id="task-assignee" defaultValue={task.assigneeId ?? ""} onChange={(assigneeId) => run(actions.assignTask, { taskId: task.id, assigneeId })} className="field-control mt-2 min-h-0 py-1.5 text-sm" options={[{ value: "", label: "Unassigned" }, ...members]} />
            : <p className="mt-1.5 text-sm">{members.find((member) => member.value === task.assigneeId)?.label ?? "Unassigned"}</p>}
        </div>
        <div className="issue-sidebar-block">
          <label htmlFor="task-status" className="issue-sidebar-label">Status</label>
          {active
            ? <Select key={task.status} id="task-status" defaultValue={task.status} onChange={(status) => run(actions.updateTaskStatus, { id: task.id, status })} className="field-control mt-2 min-h-0 py-1.5 text-sm" options={taskStatuses.map(([value, text]) => ({ value, label: text }))} />
            : <p className="mt-1.5 text-sm">{statusLabel(task.status)}</p>}
        </div>
        <div className="issue-sidebar-block">
          <div className="flex items-center justify-between gap-2"><p className="issue-sidebar-label">Priority</p>{editToggle("priority")}</div>
          {editingField === "priority"
            ? <Select defaultValue={task.priority} onChange={(priority) => { setEditingField(""); run(actions.updateTask, editFields({ priority })) }} className="field-control mt-2 min-h-0 py-1.5 text-sm" options={priorityOptions} />
            : <div className="mt-2"><PriorityChip priority={task.priority} /></div>}
        </div>
        <div className="issue-sidebar-block">
          <div className="flex items-center justify-between gap-2"><p className="issue-sidebar-label">Due date</p>{editToggle("due")}</div>
          {editingField === "due" ? (
            <form className="mt-2 flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); const value = new FormData(event.currentTarget).get("dueDate"); setEditingField(""); run(actions.updateTask, editFields({ dueDate: typeof value === "string" ? value : "" })) }}>
              <input name="dueDate" type="date" aria-label="Due date" defaultValue={task.dueDate ?? ""} className="field-control min-h-0 py-1.5 text-sm" />
              <span className="flex gap-2"><button className="button-secondary min-h-0 px-2.5 py-1 text-xs">Save</button>{task.dueDate && <button type="button" onClick={() => { setEditingField(""); run(actions.updateTask, editFields({ dueDate: "" })) }} className="button-quiet min-h-0 px-2.5 py-1 text-xs">Remove</button>}</span>
            </form>
          ) : <p className={"mt-1.5 text-sm" + (due?.overdue ? " font-semibold text-red-600" : due ? "" : " text-[var(--muted)]")}>{due ? (due.overdue ? "Overdue · " : "") + due.label : "None"}</p>}
        </div>
        <div className="issue-sidebar-block max-lg:col-span-2">
          <div className="flex items-center justify-between gap-2"><p className="issue-sidebar-label">Labels</p>{editToggle("labels")}</div>
          {editingField === "labels" ? (
            <div className="mt-2 space-y-3">
              {labels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((label) => {
                    const selected = selectedLabelIds.includes(label.id)
                    return <form key={label.id} action={actions.toggleTaskLabel}>{hidden("taskId", task.id)}{hidden("labelId", label.id)}<button aria-pressed={selected} title={selected ? "Remove label" : "Add label"} className={"rounded-full" + (selected ? "" : " opacity-50 hover:opacity-80")}><LabelChip name={(selected ? "✓ " : "") + label.name} color={label.color} /></button></form>
                  })}
                </div>
              )}
              <form action={actions.createTaskLabel} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                {hidden("taskId", task.id)}
                <input required maxLength={40} name="name" placeholder="New label" aria-label="New label name" className="field-control col-span-2 min-h-0 py-1.5 text-sm" />
                <Select name="color" defaultValue="indigo" className="field-control min-h-0 py-1.5 text-sm" options={labelColorOptions} />
                <button className="button-secondary min-h-0 px-2.5 py-1 text-xs">Create</button>
              </form>
            </div>
          ) : selectedLabels.length
            ? <div className="mt-2 flex flex-wrap gap-1.5">{selectedLabels.map((label) => <Link key={label.id} href={"/tasks?view=all&label=" + label.id}><LabelChip name={label.name} color={label.color} /></Link>)}</div>
            : <p className="mt-1.5 text-sm text-[var(--muted)]">None</p>}
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Created</p>
          <p className="mt-1.5 text-sm"><time dateTime={created.at} title={created.at}>{created.label}</time></p>
        </div>
        <div className="issue-sidebar-block">
          <p className="issue-sidebar-label">Last updated</p>
          <p className="mt-1.5 text-sm"><time dateTime={updated.at} title={updated.at}>{updated.label}</time></p>
        </div>
      </aside>

      <section className="issue-activity" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="issue-section-title">Activity</h2>
        <ol className="issue-timeline" aria-label="Timeline">
          {hiddenCount > 0 && <li><button type="button" onClick={() => setShowAllActivity(true)} className="issue-timeline-more">Show {hiddenCount} older {hiddenCount === 1 ? "item" : "items"}</button></li>}
          {shownActivity.map((item) => item.kind === "comment" ? (
            <li key={"c" + item.id}>
              <MessageSquare size={14} aria-hidden />
              <div className="issue-timeline-text rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
                <p><strong>{item.author}</strong> · <time dateTime={item.at} title={item.at}>{item.label}</time></p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[var(--foreground)]">{item.text}</p>
              </div>
            </li>
          ) : (
            <li key={"e" + item.id}>
              {item.text.startsWith("created") ? <SquarePen size={14} aria-hidden /> : <History size={14} aria-hidden />}
              <div className="issue-timeline-text"><p><strong>{item.author}</strong> {item.text} · <time dateTime={item.at} title={item.at}>{item.label}</time></p></div>
            </li>
          ))}
          {!activity.length && <li><History size={14} aria-hidden /><div className="issue-timeline-text"><p>No activity yet.</p></div></li>}
        </ol>
        {active && (
          <form action={actions.createTaskComment} className="mt-4 flex flex-col gap-2">
            {hidden("taskId", task.id)}
            <label htmlFor="task-comment" className="sr-only">Add a comment</label>
            <textarea id="task-comment" required maxLength={2500} name="body" rows={3} placeholder="Add a comment…" className="field-control resize-y" />
            <div><button className="button-primary min-h-0 px-3.5 py-2">Comment</button></div>
          </form>
        )}
      </section>
    </div>
  )
}
