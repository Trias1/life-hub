"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { actionFailure } from "@/lib/actions/server"
import { getWorkspaceContext, recordActivity } from "@/lib/workspace/server"
import { FIELD, encryptField } from "@/lib/data-crypto.mjs"

const taskSchema = z.object({ title: z.string().trim().min(1).max(160), description: z.string().trim().max(10000), priority: z.enum(["low", "medium", "high"]), dueDate: z.iso.date().optional(), assigneeId: z.string().uuid().optional(), labelIds: z.array(z.string().uuid()).max(20) })
const taskEditSchema = z.object({ taskId: z.string().uuid(), title: z.string().trim().min(1).max(160), description: z.string().trim().max(10000), priority: z.enum(["low", "medium", "high"]), dueDate: z.union([z.literal(""), z.iso.date()]) })
const labelSchema = z.object({ name: z.string().trim().min(1).max(40), color: z.enum(["indigo", "blue", "emerald", "rose", "amber"]) })
const taskIdSchema = z.object({ taskId: z.string().uuid() })
const statusSchema = z.object({ id: z.string().uuid(), status: z.enum(["todo", "in_progress", "review", "done", "cancelled"]) })

/** Where a failed action sends the user back to: the task's own page when the id is valid. */
function taskPath(taskId: FormDataEntryValue | null) {
  return typeof taskId === "string" && z.string().uuid().safeParse(taskId).success ? "/tasks/" + taskId : "/tasks"
}

function refresh(taskId?: string) {
  revalidatePath("/tasks")
  if (taskId) revalidatePath("/tasks/" + taskId)
  revalidatePath("/activity")
}

export async function createTask(formData: FormData): Promise<void> {
  const input = taskSchema.safeParse({ title: formData.get("title"), description: formData.get("description") ?? "", priority: formData.get("priority"), dueDate: formData.get("dueDate") || undefined, assigneeId: formData.get("assigneeId") || undefined, labelIds: Array.from(new Set(formData.getAll("labelIds"))) })
  if (!input.success) actionFailure("/tasks/new", "create task")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/tasks/new", "access the active workspace")

  if (input.data.assigneeId) {
    const { data: member, error: memberError } = await context.supabase.from("workspace_members").select("user_id").eq("workspace_id", context.workspaceId).eq("user_id", input.data.assigneeId).maybeSingle()
    if (memberError || !member) actionFailure("/tasks/new", "assign task", memberError ?? new Error("Member not found"))
  }
  if (input.data.labelIds.length) {
    const { data: labels, error: labelError } = await context.supabase.from("task_labels").select("id").eq("workspace_id", context.workspaceId).in("id", input.data.labelIds)
    if (labelError || (labels ?? []).length !== input.data.labelIds.length) actionFailure("/tasks/new", "add task labels", labelError ?? new Error("Label not found"))
  }
  const { data: task, error } = await context.supabase.from("tasks").insert({ title: input.data.title, description: encryptField(FIELD.TASK_DESCRIPTION, input.data.description), priority: input.data.priority, due_date: input.data.dueDate || null, assignee_id: input.data.assigneeId || null, created_by: context.user.id, workspace_id: context.workspaceId }).select("id").single()
  if (error) actionFailure("/tasks/new", "create task", error)
  if (input.data.labelIds.length) {
    const { error: assignmentError } = await context.supabase.from("task_label_assignments").insert(input.data.labelIds.map((labelId) => ({ task_id: task.id, label_id: labelId })))
    if (assignmentError) actionFailure("/tasks/" + task.id, "add task labels", assignmentError)
  }
  await recordActivity(context, { action: "Created", entityType: "task", entityId: task.id, resourceName: input.data.title, link: "/tasks/" + task.id })
  refresh(task.id)
  redirect("/tasks/" + task.id + "?success=Task%20created")
}

export async function updateTaskStatus(formData: FormData): Promise<void> {
  // The board sends from=board so a failure lands back on the board instead of the task page.
  const back = formData.get("from") === "board" ? "/tasks?layout=board" : taskPath(formData.get("id"))
  const input = statusSchema.safeParse({ id: formData.get("id"), status: formData.get("status") })
  if (!input.success) actionFailure(back, "update task")
  const context = await getWorkspaceContext()
  if (!context) actionFailure(back, "access the active workspace")

  const { data: task, error } = await context.supabase.from("tasks").update({ status: input.data.status, completed_at: input.data.status === "done" ? new Date().toISOString() : null }).eq("id", input.data.id).eq("workspace_id", context.workspaceId).is("deleted_at", null).select("id").maybeSingle()
  if (error || !task) actionFailure(back, "update task", error ?? new Error("Task not found"))
  await recordActivity(context, { action: "Moved to " + input.data.status, entityType: "task", entityId: input.data.id })
  refresh(input.data.id)
}

export async function updateTask(formData: FormData): Promise<void> {
  const back = taskPath(formData.get("taskId"))
  const input = taskEditSchema.safeParse({ taskId: formData.get("taskId"), title: formData.get("title"), description: formData.get("description"), priority: formData.get("priority"), dueDate: formData.get("dueDate") })
  if (!input.success) actionFailure(back, "update task")
  const context = await getWorkspaceContext()
  if (!context) actionFailure(back, "access the active workspace")

  const { data: task, error } = await context.supabase.from("tasks").update({ title: input.data.title, description: encryptField(FIELD.TASK_DESCRIPTION, input.data.description), priority: input.data.priority, due_date: input.data.dueDate || null, updated_at: new Date().toISOString() }).eq("id", input.data.taskId).eq("workspace_id", context.workspaceId).is("deleted_at", null).select("id,title").maybeSingle()
  if (error || !task) actionFailure(back, "update task", error ?? new Error("Task not found"))
  await recordActivity(context, { action: "Updated", entityType: "task", entityId: task.id, resourceName: task.title, link: "/tasks/" + task.id })
  refresh(task.id)
}

export async function trashTask(formData: FormData): Promise<void> {
  const back = taskPath(formData.get("taskId"))
  const input = taskIdSchema.safeParse({ taskId: formData.get("taskId") })
  if (!input.success) actionFailure(back, "move task to trash")
  const context = await getWorkspaceContext()
  if (!context) actionFailure(back, "access the active workspace")

  const now = new Date().toISOString()
  const { data: task, error } = await context.supabase.from("tasks").update({ deleted_at: now, updated_at: now }).eq("id", input.data.taskId).eq("workspace_id", context.workspaceId).is("deleted_at", null).select("id,title").maybeSingle()
  if (error || !task) actionFailure(back, "move task to trash", error ?? new Error("Task not found"))
  await recordActivity(context, { action: "Trashed", entityType: "task", entityId: task.id, resourceName: task.title, link: "/tasks/" + task.id })
  refresh(task.id)
}

export async function restoreTask(formData: FormData): Promise<void> {
  const input = taskIdSchema.safeParse({ taskId: formData.get("taskId") })
  if (!input.success) actionFailure("/tasks?view=trash", "restore task")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/tasks?view=trash", "access the active workspace")

  const { data: task, error } = await context.supabase.from("tasks").update({ deleted_at: null, updated_at: new Date().toISOString() }).eq("id", input.data.taskId).eq("workspace_id", context.workspaceId).not("deleted_at", "is", null).select("id,title").maybeSingle()
  if (error || !task) actionFailure("/tasks?view=trash", "restore task", error ?? new Error("Task not found"))
  await recordActivity(context, { action: "Restored", entityType: "task", entityId: task.id, resourceName: task.title, link: "/tasks/" + task.id })
  refresh(task.id)
}

export async function deleteTaskPermanently(formData: FormData): Promise<void> {
  const input = taskIdSchema.safeParse({ taskId: formData.get("taskId") })
  if (!input.success) actionFailure("/tasks?view=trash", "delete task permanently")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/tasks?view=trash", "access the active workspace")

  const { data: task, error: readError } = await context.supabase.from("tasks").select("id,title,created_by").eq("id", input.data.taskId).eq("workspace_id", context.workspaceId).not("deleted_at", "is", null).maybeSingle()
  if (readError || !task || task.created_by !== context.user.id) actionFailure("/tasks?view=trash", "delete task permanently", readError ?? new Error("Only the task creator can delete it permanently"))
  const { data: deleted, error } = await context.supabase.from("tasks").delete().eq("id", task.id).eq("workspace_id", context.workspaceId).eq("created_by", context.user.id).not("deleted_at", "is", null).select("id,title").maybeSingle()
  if (error || !deleted) actionFailure("/tasks?view=trash", "delete task permanently", error ?? new Error("Task not found"))
  await recordActivity(context, { action: "Deleted permanently", entityType: "task", entityId: deleted.id, resourceName: deleted.title, link: "/tasks?view=trash" })
  refresh(deleted.id)
  // The task page no longer exists, so always land on the trash list.
  redirect("/tasks?view=trash&success=Task%20deleted%20permanently")
}

async function getTaskContext(formData: FormData, operation: string) {
  const back = taskPath(formData.get("taskId"))
  const input = taskIdSchema.safeParse({ taskId: formData.get("taskId") })
  if (!input.success) actionFailure(back, operation)
  const context = await getWorkspaceContext()
  if (!context) actionFailure(back, "access the active workspace")
  const { data: task, error } = await context.supabase.from("tasks").select("id").eq("id", input.data.taskId).eq("workspace_id", context.workspaceId).is("deleted_at", null).maybeSingle()
  if (error || !task) actionFailure(back, operation, error ?? new Error("Task not found"))
  return { context, taskId: input.data.taskId, back }
}

export async function createTaskLabel(formData: FormData): Promise<void> {
  const back = taskPath(formData.get("taskId"))
  const input = labelSchema.safeParse({ name: formData.get("name"), color: formData.get("color") || "indigo" })
  if (!input.success) actionFailure(back, "create label")
  const context = await getWorkspaceContext()
  if (!context) actionFailure(back, "access the active workspace")
  const { error } = await context.supabase.from("task_labels").insert({ workspace_id: context.workspaceId, name: input.data.name, color: input.data.color, created_by: context.user.id })
  if (error) actionFailure(back, "create label", error)
  await recordActivity(context, { action: "Created", entityType: "task label" })
  revalidatePath("/activity")
  revalidatePath("/tasks")
  if (back !== "/tasks") revalidatePath(back)
}

export async function assignTask(formData: FormData): Promise<void> {
  const input = z.object({ taskId: z.string().uuid(), assigneeId: z.string().uuid().nullable() }).safeParse({ taskId: formData.get("taskId"), assigneeId: formData.get("assigneeId") || null })
  if (!input.success) actionFailure(taskPath(formData.get("taskId")), "assign task")
  const { context, back } = await getTaskContext(formData, "assign task")
  if (input.data.assigneeId) {
    const { data: member, error: memberError } = await context.supabase.from("workspace_members").select("user_id").eq("workspace_id", context.workspaceId).eq("user_id", input.data.assigneeId).maybeSingle()
    if (memberError || !member) actionFailure(back, "assign task", memberError ?? new Error("Member not found"))
  }
  const { error } = await context.supabase.from("tasks").update({ assignee_id: input.data.assigneeId }).eq("id", input.data.taskId).eq("workspace_id", context.workspaceId)
  if (error) actionFailure(back, "assign task", error)
  await recordActivity(context, { action: input.data.assigneeId ? "Assigned" : "Unassigned", entityType: "task", entityId: input.data.taskId })
  refresh(input.data.taskId)
}

export async function toggleTaskLabel(formData: FormData): Promise<void> {
  const input = z.object({ taskId: z.string().uuid(), labelId: z.string().uuid() }).safeParse({ taskId: formData.get("taskId"), labelId: formData.get("labelId") })
  if (!input.success) actionFailure(taskPath(formData.get("taskId")), "update task labels")
  const { context, back } = await getTaskContext(formData, "update task labels")
  const { data: label, error: labelError } = await context.supabase.from("task_labels").select("id").eq("id", input.data.labelId).eq("workspace_id", context.workspaceId).maybeSingle()
  if (labelError || !label) actionFailure(back, "update task labels", labelError ?? new Error("Label not found"))
  const { data: assignment, error: assignmentError } = await context.supabase.from("task_label_assignments").select("task_id").eq("task_id", input.data.taskId).eq("label_id", input.data.labelId).maybeSingle()
  if (assignmentError) actionFailure(back, "update task labels", assignmentError)
  const result = assignment ? await context.supabase.from("task_label_assignments").delete().eq("task_id", input.data.taskId).eq("label_id", input.data.labelId) : await context.supabase.from("task_label_assignments").insert({ task_id: input.data.taskId, label_id: input.data.labelId })
  if (result.error) actionFailure(back, "update task labels", result.error)
  await recordActivity(context, { action: assignment ? "Removed label from" : "Added label to", entityType: "task", entityId: input.data.taskId })
  refresh(input.data.taskId)
}

export async function createChecklistItem(formData: FormData): Promise<void> {
  const input = z.object({ taskId: z.string().uuid(), title: z.string().trim().min(1).max(240) }).safeParse({ taskId: formData.get("taskId"), title: formData.get("title") })
  if (!input.success) actionFailure(taskPath(formData.get("taskId")), "create checklist item")
  const { context, back } = await getTaskContext(formData, "create checklist item")
  // task_checklist_items.title allows 2000 characters for encrypted values (0031).
  const title = encryptField(FIELD.CHECKLIST_TITLE, input.data.title)
  if (title.length > 2000) actionFailure(back, "create checklist item")
  const { error } = await context.supabase.from("task_checklist_items").insert({ task_id: input.data.taskId, title, created_by: context.user.id })
  if (error) actionFailure(back, "create checklist item", error)
  await recordActivity(context, { action: "Added checklist item to", entityType: "task", entityId: input.data.taskId })
  refresh(input.data.taskId)
}

export async function toggleChecklistItem(formData: FormData): Promise<void> {
  const input = z.object({ id: z.string().uuid(), completed: z.enum(["true", "false"]) }).safeParse({ id: formData.get("id"), completed: formData.get("completed") })
  if (!input.success) actionFailure("/tasks", "update checklist item")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/tasks", "access the active workspace")
  const { data: item, error: itemError } = await context.supabase.from("task_checklist_items").select("id,task_id").eq("id", input.data.id).maybeSingle()
  if (itemError || !item) actionFailure("/tasks", "find checklist item", itemError ?? new Error("Checklist item not found"))
  const { data: task, error: taskError } = await context.supabase.from("tasks").select("id").eq("id", item.task_id).eq("workspace_id", context.workspaceId).is("deleted_at", null).maybeSingle()
  if (taskError || !task) actionFailure("/tasks", "update checklist item", taskError ?? new Error("Task not found"))
  const completed = input.data.completed !== "true"
  const { error } = await context.supabase.from("task_checklist_items").update({ is_completed: completed, updated_at: new Date().toISOString() }).eq("id", input.data.id)
  if (error) actionFailure("/tasks/" + task.id, "update checklist item", error)
  await recordActivity(context, { action: completed ? "Completed checklist item on" : "Reopened checklist item on", entityType: "task", entityId: item.task_id })
  refresh(task.id)
}

export async function createTaskComment(formData: FormData): Promise<void> {
  const input = z.object({ taskId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).safeParse({ taskId: formData.get("taskId"), body: formData.get("body") })
  if (!input.success) actionFailure(taskPath(formData.get("taskId")), "add task comment")
  const { context, back } = await getTaskContext(formData, "add task comment")
  // task_comments.body allows 12000 characters for encrypted values (0031); refuse before the database does.
  const body = encryptField(FIELD.TASK_COMMENT_BODY, input.data.body)
  if (body.length > 12000) actionFailure(back, "add task comment")
  const { error } = await context.supabase.from("task_comments").insert({ task_id: input.data.taskId, author_id: context.user.id, body })
  if (error) actionFailure(back, "add task comment", error)
  await recordActivity(context, { action: "Commented on", entityType: "task", entityId: input.data.taskId, link: "/tasks/" + input.data.taskId })
  refresh(input.data.taskId)
}

const taskAttachmentSchema = z.object({ taskId: z.string().uuid(), fileId: z.string().uuid() })

export async function attachTaskFile(formData: FormData): Promise<void> {
  const input = taskAttachmentSchema.safeParse({ taskId: formData.get("taskId"), fileId: formData.get("fileId") })
  if (!input.success) actionFailure(taskPath(formData.get("taskId")), "attach file")
  const { context, back } = await getTaskContext(formData, "attach file")
  const { data: file, error: fileError } = await context.supabase.from("files").select("id,name").eq("id", input.data.fileId).eq("workspace_id", context.workspaceId).is("trashed_at", null).maybeSingle()
  if (fileError || !file) actionFailure(back, "find file", fileError ?? new Error("File not found"))
  const { error } = await context.supabase.from("task_attachments").upsert({ task_id: input.data.taskId, file_id: input.data.fileId, created_by: context.user.id }, { onConflict: "task_id,file_id" })
  if (error) actionFailure(back, "attach file", error)
  await recordActivity(context, { action: "Attached file to", entityType: "task", entityId: input.data.taskId, resourceName: file.name, link: "/tasks/" + input.data.taskId })
  refresh(input.data.taskId)
}

export async function detachTaskFile(formData: FormData): Promise<void> {
  const input = taskAttachmentSchema.safeParse({ taskId: formData.get("taskId"), fileId: formData.get("fileId") })
  if (!input.success) actionFailure(taskPath(formData.get("taskId")), "remove file attachment")
  const { context, back } = await getTaskContext(formData, "remove file attachment")
  const { data: attachment, error: attachmentError } = await context.supabase.from("task_attachments").select("file_id").eq("task_id", input.data.taskId).eq("file_id", input.data.fileId).maybeSingle()
  if (attachmentError || !attachment) actionFailure(back, "find file attachment", attachmentError ?? new Error("Attachment not found"))
  const { data: file } = await context.supabase.from("files").select("name").eq("id", attachment.file_id).eq("workspace_id", context.workspaceId).maybeSingle()
  const { error } = await context.supabase.from("task_attachments").delete().eq("task_id", input.data.taskId).eq("file_id", input.data.fileId)
  if (error) actionFailure(back, "remove file attachment", error)
  await recordActivity(context, { action: "Removed file from", entityType: "task", entityId: input.data.taskId, resourceName: file?.name ?? null, link: "/tasks/" + input.data.taskId })
  refresh(input.data.taskId)
}
