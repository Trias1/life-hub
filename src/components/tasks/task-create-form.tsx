"use client"

import Link from "next/link"
import { useState } from "react"
import { Check } from "lucide-react"
import { NoteDescriptionEditor } from "@/components/notes/note-description-editor"
import { Select } from "@/components/ui/select"
import { useImageUpload } from "@/hooks/use-image-upload"
import { LabelChip } from "./task-chip"
import { priorityOptions, type TaskLabel } from "./task-meta"

type Props = { action: (formData: FormData) => Promise<void>; workspaceId: string; members: Array<{ value: string; label: string }>; labels: TaskLabel[] }

export function TaskCreateForm({ action, workspaceId, members, labels }: Props) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [assigneeId, setAssigneeId] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [priority, setPriority] = useState("medium")
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [status, setStatus] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { processImages } = useImageUpload()

  const toggleLabel = (id: string) => setLabelIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return setStatus("Add a title before creating the task.")
    setSubmitting(true)
    setStatus("")
    try {
      const formData = new FormData()
      formData.set("title", title.trim())
      formData.set("description", await processImages(description, workspaceId))
      formData.set("assigneeId", assigneeId)
      formData.set("dueDate", dueDate)
      formData.set("priority", priority)
      for (const id of labelIds) formData.append("labelIds", id)
      await action(formData)
    } catch (error) {
      // redirect() from the server action surfaces as a thrown navigation; let it through.
      if (error && typeof error === "object" && "digest" in error) throw error
      setStatus("Could not create the task: " + (error instanceof Error ? error.message : "unknown error"))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="issue-form mt-6">
      <div className="issue-form-field">
        <label htmlFor="task-title" className="issue-form-label">Title <span className="font-normal text-[var(--muted)]">(required)</span></label>
        <input id="task-title" required maxLength={160} autoFocus value={title} onChange={(event) => setTitle(event.target.value)} className="field-control" />
      </div>
      <div className="issue-form-field">
        <p id="task-description-label" className="issue-form-label">Description</p>
        <NoteDescriptionEditor value={description} onChange={setDescription} minHeight={180} labelledBy="task-description-label" placeholder="Describe the outcome, context, or acceptance criteria…" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="issue-form-field">
          <label htmlFor="task-assignee" className="issue-form-label">Assignee</label>
          <Select id="task-assignee" value={assigneeId} onChange={setAssigneeId} placeholder="Unassigned" className="field-control" options={[{ value: "", label: "Unassigned" }, ...members]} />
        </div>
        <div className="issue-form-field">
          <label htmlFor="task-due-date" className="issue-form-label">Due date</label>
          <input id="task-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="field-control" />
        </div>
        <div className="issue-form-field">
          <label htmlFor="task-priority" className="issue-form-label">Priority</label>
          <Select id="task-priority" value={priority} onChange={setPriority} className="field-control" options={priorityOptions} />
        </div>
        <div className="issue-form-field">
          <p id="task-labels-label" className="issue-form-label">Labels</p>
          {labels.length ? (
            <div role="group" aria-labelledby="task-labels-label" className="flex flex-wrap gap-1.5">
              {labels.map((label) => {
                const selected = labelIds.includes(label.id)
                return <button key={label.id} type="button" aria-pressed={selected} onClick={() => toggleLabel(label.id)} className={"inline-flex items-center gap-1 rounded-full" + (selected ? "" : " opacity-50 hover:opacity-80")}>{selected && <Check size={12} aria-hidden />}<LabelChip name={label.name} color={label.color} /></button>
              })}
            </div>
          ) : <p className="text-sm text-[var(--muted)]">No labels yet. You can create labels from a task&apos;s sidebar.</p>}
        </div>
      </div>
      <div className="issue-form-actions">
        <button disabled={submitting} className="button-primary disabled:opacity-60">{submitting ? "Creating…" : "Create task"}</button>
        <Link href="/tasks" className="button-secondary">Cancel</Link>
        <span role="status" className="text-xs text-[var(--muted)]">{status}</span>
      </div>
    </form>
  )
}
