"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { actionFailure } from "@/lib/actions/server"
import { getWorkspaceContext } from "@/lib/workspace/server"

const idSchema = z.string().uuid()
const idsSchema = z.array(idSchema).min(1).max(100)
const viewSchema = z.enum(["active", "archive"])

async function notificationContext() {
  const context = await getWorkspaceContext()
  if (!context) actionFailure("/notifications", "access the active workspace")
  return context
}

function parseIds(formData: FormData) {
  const raw = formData.get("ids")
  try { return idsSchema.safeParse(JSON.parse(typeof raw === "string" ? raw : "[]")) } catch { return idsSchema.safeParse([]) }
}

function notificationPath(formData: FormData) {
  const view = viewSchema.safeParse(formData.get("view"))
  return view.success && view.data === "archive" ? "/notifications?view=archive" : "/notifications"
}

export async function markNotificationRead(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("id"))
  if (!id.success) actionFailure("/notifications", "mark notification as read")
  const context = await notificationContext()
  const { error } = await context.supabase.from("notifications").update({ is_read: true }).eq("id", id.data).eq("workspace_id", context.workspaceId).eq("recipient_id", context.user.id)
  if (error) actionFailure("/notifications", "mark notification as read", error)
  revalidatePath("/notifications")
  revalidatePath("/dashboard")
}

export async function markAllNotificationsRead(): Promise<void> {
  const context = await notificationContext()
  const { error } = await context.supabase.from("notifications").update({ is_read: true }).eq("workspace_id", context.workspaceId).eq("recipient_id", context.user.id).is("archived_at", null).eq("is_read", false)
  if (error) actionFailure("/notifications", "mark notifications as read", error)
  revalidatePath("/notifications")
  revalidatePath("/dashboard")
}

export async function markNotificationsRead(formData: FormData): Promise<void> {
  const ids = parseIds(formData)
  if (!ids.success) actionFailure("/notifications", "mark notifications as read")
  const context = await notificationContext()
  const { error } = await context.supabase.from("notifications").update({ is_read: true }).in("id", ids.data).eq("workspace_id", context.workspaceId).eq("recipient_id", context.user.id)
  if (error) actionFailure("/notifications", "mark notifications as read", error)
  revalidatePath("/notifications")
  revalidatePath("/dashboard")
}

export async function archiveNotifications(formData: FormData): Promise<void> {
  const ids = parseIds(formData)
  if (!ids.success) actionFailure("/notifications", "archive notifications")
  const context = await notificationContext()
  const { error } = await context.supabase.from("notifications").update({ archived_at: new Date().toISOString() }).in("id", ids.data).eq("workspace_id", context.workspaceId).eq("recipient_id", context.user.id)
  if (error) actionFailure("/notifications", "archive notifications", error)
  revalidatePath("/notifications")
  revalidatePath("/dashboard")
}

export async function restoreNotification(formData: FormData): Promise<void> {
  const path = notificationPath(formData)
  const id = idSchema.safeParse(formData.get("id"))
  if (!id.success) actionFailure(path, "restore notification")
  const context = await notificationContext()
  const { error } = await context.supabase.from("notifications").update({ archived_at: null }).eq("id", id.data).eq("workspace_id", context.workspaceId).eq("recipient_id", context.user.id).not("archived_at", "is", null)
  if (error) actionFailure(path, "restore notification", error)
  revalidatePath("/notifications")
  revalidatePath("/dashboard")
}

export async function deleteNotifications(formData: FormData): Promise<void> {
  const path = notificationPath(formData)
  const ids = parseIds(formData)
  if (!ids.success) actionFailure(path, "delete notifications")
  const context = await notificationContext()
  const { error } = await context.supabase.from("notifications").delete().in("id", ids.data).eq("workspace_id", context.workspaceId).eq("recipient_id", context.user.id)
  if (error) actionFailure(path, "delete notifications", error)
  revalidatePath("/notifications")
  revalidatePath("/dashboard")
}
