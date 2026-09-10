"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { actionFailure } from "@/lib/actions/server"
import { getWorkspaceContext, recordActivity } from "@/lib/workspace/server"

const taskSchema = z.object({ title: z.string().trim().min(1).max(160), priority: z.enum(["low", "medium", "high"]), dueDate: z.iso.date().optional(), assigneeId: z.string().uuid().optional() })
const taskEditSchema = z.object({ taskId: z.string().uuid(), title: z.string().trim().min(1).max(160), description: z.string().trim().max(10000), priority: z.enum(["low", "medium", "high"]), dueDate: z.union([z.literal(""), z.iso.date()]) })
const labelSchema = z.object({ name: z.string().trim().min(1).max(40), color: z.enum(["indigo", "blue", "emerald", "rose", "amber"]) })
const taskIdSchema = z.object({ taskId: z.string().uuid() })
const statusSchema = z.object({ id: z.string().uuid(), status: z.enum(["todo", "in_progress", "review", "done", "cancelled"]) })

export async function createTask(formData: FormData): Promise<void> {
  const input = taskSchema.safeParse({ title: formData.get("title"), priority: formData.get("priority"), dueDate: formData.get("dueDate") || undefined, assigneeId: formData.get("assigneeId") || undefined })
  if (!input.success) actionFailure("/tasks", "create task")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/tasks", "access the active workspace")

  if (input.data.assigneeId) {
    const { data: member, error: memberError } = await context.supabase.from("workspace_members").select("user_id").eq("workspace_id", context.workspaceId).eq("user_id", input.data.assigneeId).maybeSingle()
    if (memberError || !member) actionFailure("/tasks", "assign task", memberError ?? new Error("Member not found"))
  }
  const { data: task, error } = await context.supabase.from("tasks").insert({ title: input.data.title, priority: input.data.priority, due_date: input.data.dueDate || null, assignee_id: input.data.assigneeId || null, created_by: context.user.id, workspace_id: context.workspaceId }).select("id").single()
  if (error) actionFailure("/tasks", "create task", error)
  await recordActivity(context, { action: "Created", entityType: "task", entityId: task.id })
  revalidatePath("/tasks")
  revalidatePath("/activity")
}

export async function updateTaskStatus(formData: FormData): Promise<void> {
  const input = statusSchema.safeParse({ id: formData.get("id"), status: formData.get("status") })
  if (!input.success) actionFailure("/tasks", "update task")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/tasks", "access the active workspace")

  const { data: task, error } = await context.supabase.from("tasks").update({ status: input.data.status }).eq("id", input.data.id).eq("workspace_id", context.workspaceId).is("deleted_at", null).select("id").maybeSingle()
  if (error || !task) actionFailure("/tasks", "update task", error ?? new Error("Task not found"))
  await recordActivity(context, { action: "Moved to " + input.data.status, entityType: "task", entityId: input.data.id })
  revalidatePath("/tasks")
  revalidatePath("/activity")
}

export async function updateTask(formData: FormData): Promise<void> {
  const input = taskEditSchema.safeParse({ taskId: formData.get("taskId"), title: formData.get("title"), description: formData.get("description"), priority: formData.get("priority"), dueDate: formData.get("dueDate") })
  if (!input.success) actionFailure("/tasks", "update task")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/tasks", "access the active workspace")

  const { data: task, error } = await context.supabase.from("tasks").update({ title: input.data.title, description: input.data.description, priority: input.data.priority, due_date: input.data.dueDate || null, updated_at: new Date().toISOString() }).eq("id", input.data.taskId).eq("workspace_id", context.workspaceId).is("deleted_at", null).select("id,title").maybeSingle()
  if (error || !task) actionFailure("/tasks", "update task", error ?? new Error("Task not found"))
  await recordActivity(context, { action: "Updated", entityType: "task", entityId: task.id, resourceName: task.title, link: "/tasks" })
  revalidatePath("/tasks")
  revalidatePath("/activity")
}

export async function trashTask(formData: FormData): Promise<void> {
  const input = taskIdSchema.safeParse({ taskId: formData.get("taskId") })
  if (!input.success) actionFailure("/tasks", "move task to trash")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/tasks", "access the active workspace")

  const now = new Date().toISOString()
  const { data: task, error } = await context.supabase.from("tasks").update({ deleted_at: now, updated_at: now }).eq("id", input.data.taskId).eq("workspace_id", context.workspaceId).is("deleted_at", null).select("id,title").maybeSingle()
  if (error || !task) actionFailure("/tasks", "move task to trash", error ?? new Error("Task not found"))
  await recordActivity(context, { action: "Trashed", entityType: "task", entityId: task.id, resourceName: task.title, link: "/tasks?view=trash" })
  revalidatePath("/tasks")
  revalidatePath("/activity")
}

export async function restoreTask(formData: FormData): Promise<void> {
  const input = taskIdSchema.safeParse({ taskId: formData.get("taskId") })
  if (!input.success) actionFailure("/tasks?view=trash", "restore task")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/tasks?view=trash", "access the active workspace")

  const { data: task, error } = await context.supabase.from("tasks").update({ deleted_at: null, updated_at: new Date().toISOString() }).eq("id", input.data.taskId).eq("workspace_id", context.workspaceId).not("deleted_at", "is", null).select("id,title").maybeSingle()
  if (error || !task) actionFailure("/tasks?view=trash", "restore task", error ?? new Error("Task not found"))
  await recordActivity(context, { action: "Restored", entityType: "task", entityId: task.id, resourceName: task.title, link: "/tasks" })
  revalidatePath("/tasks")
  revalidatePath("/activity")
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
  revalidatePath("/tasks")
  revalidatePath("/activity")
}

async function getTaskContext(formData: FormData, operation: string) {
  const input = taskIdSchema.safeParse({ taskId: formData.get("taskId") })
  if (!input.success) actionFailure("/tasks", operation)
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/tasks", "access the active workspace")
  const { data: task, error } = await context.supabase.from("tasks").select("id").eq("id", input.data.taskId).eq("workspace_id", context.workspaceId).is("deleted_at", null).maybeSingle()
  if (error || !task) actionFailure("/tasks", operation, error ?? new Error("Task not found"))
  return { context, taskId: input.data.taskId }
}

export async function createTaskLabel(formData: FormData): Promise<void> {
  const input = labelSchema.safeParse({ name: formData.get("name"), color: formData.get("color") || "indigo" })
  if (!input.success) actionFailure("/tasks", "create label")
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/tasks", "access the active workspace")
  const { error } = await context.supabase.from("task_labels").insert({ workspace_id: context.workspaceId, name: input.data.name, color: input.data.color, created_by: context.user.id })
  if (error) actionFailure("/tasks", "create label", error)
  await recordActivity(context, { action: "Created", entityType: "task label" })
  revalidatePath("/activity")
  revalidatePath("/tasks")
}

export async function assignTask(formData: FormData): Promise<void> {
  const input = z.object({ taskId: z.string().uuid(), assigneeId: z.string().uuid().nullable() }).safeParse({ taskId: formData.get("taskId"), assigneeId: formData.get("assigneeId") || null })
  if (!input.success) actionFailure("/tasks", "assign task")
  const { context } = await getTaskContext(formData, "assign task")
  if (input.data.assigneeId) {
    const { data: member, error: memberError } = await context.supabase.from("workspace_members").select("user_id").eq("workspace_id", context.workspaceId).eq("user_id", input.data.assigneeId).maybeSingle()
    if (memberError || !member) actionFailure("/tasks", "assign task", memberError ?? new Error("Member not found"))
  }
  const { error } = await context.supabase.from("tasks").update({ assignee_id: input.data.assigneeId }).eq("id", input.data.taskId).eq("workspace_id", context.workspaceId)
  if (error) actionFailure("/tasks", "assign task", error)
  await recordActivity(context, { action: input.data.assigneeId ? "Assigned" : "Unassigned", entityType: "task", entityId: input.data.taskId })
  revalidatePath("/tasks")
  revalidatePath("/activity")
}

export async function toggleTaskLabel(formData: FormData): Promise<void> {
  const input = z.object({ taskId: z.string().uuid(), labelId: z.string().uuid() }).safeParse({ taskId: formData.get("taskId"), labelId: formData.get("labelId") })
  if (!input.success) actionFailure("/tasks", "update task labels")
  const { context } = await getTaskContext(formData, "update task labels")
  const { data: label, error: labelError } = await context.supabase.from("task_labels").select("id").eq("id", input.data.labelId).eq("workspace_id", context.workspaceId).maybeSingle()
  if (labelError || !label) actionFailure("/tasks", "update task labels", labelError ?? new Error("Label not found"))
  const { data: assignment, error: assignmentError } = await context.supabase.from("task_label_assignments").select("task_id").eq("task_id", input.data.taskId).eq("label_id", input.data.labelId).maybeSingle()
  if (assignmentError) actionFailure("/tasks", "update task labels", assignmentError)
  const result = assignment ? await context.supabase.from("task_label_assignments").delete().eq("task_id", input.data.taskId).eq("label_id", input.data.labelId) : await context.supabase.from("task_label_assignments").insert({ task_id: input.data.taskId, label_id: input.data.labelId })
  if (result.error) actionFailure("/tasks", "update task labels", result.error)
  await recordActivity(context, { action: assignment ? "Removed label from" : "Added label to", entityType: "task", entityId: input.data.taskId })
  revalidatePath("/activity")
  revalidatePath("/tasks")
}

export async function createChecklistItem(formData: FormData): Promise<void> {
  const input = z.object({ taskId: z.string().uuid(), title: z.string().trim().min(1).max(240) }).safeParse({ taskId: formData.get("taskId"), title: formData.get("title") })
  if (!input.success) actionFailure("/tasks", "create checklist item")
  const { context } = await getTaskContext(formData, "create checklist item")
  const { error } = await context.supabase.from("task_checklist_items").insert({ task_id: input.data.taskId, title: input.data.title, created_by: context.user.id })
  if (error) actionFailure("/tasks", "create checklist item", error)
  await recordActivity(context, { action: "Added checklist item to", entityType: "task", entityId: input.data.taskId })
  revalidatePath("/activity")
  revalidatePath("/tasks")
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
  if (error) actionFailure("/tasks", "update checklist item", error)
  await recordActivity(context, { action: completed ? "Completed checklist item on" : "Reopened checklist item on", entityType: "task", entityId: item.task_id })
  revalidatePath("/tasks")
  revalidatePath("/activity")
}

export async function createTaskComment(formData: FormData): Promise<void> {
  const input = z.object({ taskId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).safeParse({ taskId: formData.get("taskId"), body: formData.get("body") })
  if (!input.success) actionFailure("/tasks", "add task comment")
  const { context } = await getTaskContext(formData, "add task comment")
  const { error } = await context.supabase.from("task_comments").insert({ task_id: input.data.taskId, author_id: context.user.id, body: input.data.body })
  if (error) actionFailure("/tasks", "add task comment", error)
  await recordActivity(context, { action: "Commented on", entityType: "task", entityId: input.data.taskId })
  revalidatePath("/tasks")
  revalidatePath("/activity")
}

const taskAttachmentSchema = z.object({ taskId: z.string().uuid(), fileId: z.string().uuid() })

export async function attachTaskFile(formData: FormData): Promise<void> {
  const input = taskAttachmentSchema.safeParse({ taskId: formData.get("taskId"), fileId: formData.get("fileId") })
  if (!input.success) actionFailure("/tasks", "attach file")
  const { context } = await getTaskContext(formData, "attach file")
  const { data: file, error: fileError } = await context.supabase.from("files").select("id,name").eq("id", input.data.fileId).eq("workspace_id", context.workspaceId).is("trashed_at", null).maybeSingle()
  if (fileError || !file) actionFailure("/tasks", "find file", fileError ?? new Error("File not found"))
  const { error } = await context.supabase.from("task_attachments").upsert({ task_id: input.data.taskId, file_id: input.data.fileId, created_by: context.user.id }, { onConflict: "task_id,file_id" })
  if (error) actionFailure("/tasks", "attach file", error)
  await recordActivity(context, { action: "Attached file to", entityType: "task", entityId: input.data.taskId, resourceName: file.name, link: "/tasks" })
  revalidatePath("/tasks")
  revalidatePath("/activity")
}

export async function detachTaskFile(formData: FormData): Promise<void> {
  const input = taskAttachmentSchema.safeParse({ taskId: formData.get("taskId"), fileId: formData.get("fileId") })
  if (!input.success) actionFailure("/tasks", "remove file attachment")
  const { context } = await getTaskContext(formData, "remove file attachment")
  const { data: attachment, error: attachmentError } = await context.supabase.from("task_attachments").select("file_id").eq("task_id", input.data.taskId).eq("file_id", input.data.fileId).maybeSingle()
  if (attachmentError || !attachment) actionFailure("/tasks", "find file attachment", attachmentError ?? new Error("Attachment not found"))
  const { data: file } = await context.supabase.from("files").select("name").eq("id", attachment.file_id).eq("workspace_id", context.workspaceId).maybeSingle()
  const { error } = await context.supabase.from("task_attachments").delete().eq("task_id", input.data.taskId).eq("file_id", input.data.fileId)
  if (error) actionFailure("/tasks", "remove file attachment", error)
  await recordActivity(context, { action: "Removed file from", entityType: "task", entityId: input.data.taskId, resourceName: file?.name ?? null, link: "/tasks" })
  revalidatePath("/tasks")
  revalidatePath("/activity")
}
