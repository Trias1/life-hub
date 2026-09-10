import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notificationEnabled } from "@/lib/notification-preferences.mjs"

type WorkspaceMembership = { workspace_id: string; role: string }

type ActivityInput = { action: string; entityType: string; entityId?: string | null; resourceName?: string | null; link?: string | null; notify?: boolean }
type NotificationInput = { recipientId: string; type: string; message: string; priority?: "low" | "normal" | "high" | "urgent"; resourceType?: string; resourceId?: string | null; resourceName?: string; link?: string }
type NotificationDeliveryInput = Omit<NotificationInput, "recipientId"> & { recipientId?: string | null; preferenceType: string }

async function deliverNotifications(context: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>, input: NotificationDeliveryInput) {
  const admin = createAdminClient()
  const membersResult = input.recipientId
    ? await admin.from("workspace_members").select("user_id").eq("workspace_id", context.workspaceId).eq("user_id", input.recipientId)
    : await admin.from("workspace_members").select("user_id").eq("workspace_id", context.workspaceId).neq("user_id", context.user.id)
  if (membersResult.error) return { error: membersResult.error }
  const memberIds = (membersResult.data ?? []).map((member) => member.user_id)
  if (!memberIds.length) return {}
  const preferencesResult = await admin.from("notification_preferences").select("user_id,mentions_enabled,tasks_enabled,calendar_enabled,notes_enabled,files_enabled,bookmarks_enabled").in("user_id", memberIds)
  if (preferencesResult.error) return { error: preferencesResult.error }
  const preferencesByUser = new Map((preferencesResult.data ?? []).map((preferences) => [preferences.user_id, preferences]))
  const recipients = memberIds.filter((userId) => userId !== context.user.id && notificationEnabled(preferencesByUser.get(userId) ?? null, input.preferenceType))
  if (!recipients.length) return {}
  const { error } = await admin.from("notifications").insert(recipients.map((recipientId) => ({ workspace_id: context.workspaceId, recipient_id: recipientId, actor_id: context.user.id, type: input.type, message: input.message, priority: input.priority ?? "normal", resource_type: input.resourceType ?? null, resource_id: input.resourceId ?? null, resource_name: input.resourceName ?? null, link: input.link ?? null })))
  return error ? { error } : {}
}

export async function getWorkspaceContext() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return null

  const [{ data: memberships, error: membershipError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("workspace_members").select("workspace_id,role").eq("user_id", user.id).order("created_at"),
    supabase.from("profiles").select("active_workspace_id").eq("id", user.id).maybeSingle(),
  ])
  if (membershipError || profileError || !memberships?.length) return null

  const activeMembership = memberships.find((membership: WorkspaceMembership) => membership.workspace_id === profile?.active_workspace_id) ?? memberships[0]
  return { supabase, user, workspaceId: activeMembership.workspace_id, role: activeMembership.role, memberships }
}

export async function setActiveWorkspace(workspaceId: string) {
  const context = await getWorkspaceContext()
  if (!context || !context.memberships.some((membership: WorkspaceMembership) => membership.workspace_id === workspaceId)) return { error: "Workspace not found." }

  const updatedAt = new Date().toISOString()
  const { data: profile, error: profileError } = await context.supabase
    .from("profiles")
    .select("id")
    .eq("id", context.user.id)
    .maybeSingle()

  if (profileError) {
    console.error("Could not read profile while switching workspace")
    return { error: "Could not switch workspace." }
  }

  const result = profile
    ? await context.supabase
        .from("profiles")
        .update({ active_workspace_id: workspaceId, updated_at: updatedAt })
        .eq("id", context.user.id)
    : await context.supabase
        .from("profiles")
        .insert({ id: context.user.id, active_workspace_id: workspaceId, updated_at: updatedAt })

  if (result.error) {
    console.error("Could not switch active workspace")
    return { error: "Could not switch workspace." }
  }
  return {}
}

export async function recordActivity(context: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>, input: ActivityInput) {
  const { error } = await context.supabase.from("activity_logs").insert({ workspace_id: context.workspaceId, actor_id: context.user.id, action: input.action, entity_type: input.entityType, entity_id: input.entityId ?? null })
  if (error) {
    console.error("Could not record activity")
    return { error }
  }
  if (input.notify === false) return {}

  const { error: notificationError } = await deliverNotifications(context, { recipientId: null, type: "activity", preferenceType: input.entityType, message: (context.user.email?.split("@")[0] ?? "A workspace member") + " " + input.action.toLowerCase() + " " + input.entityType + ".", priority: "normal", resourceType: input.entityType, resourceId: input.entityId ?? null, resourceName: input.resourceName ?? undefined, link: input.link ?? undefined })
  if (notificationError) console.error("Could not create activity notifications")
  return notificationError ? { error: notificationError } : {}
}

export async function createNotification(context: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>, input: NotificationInput) {
  if (input.recipientId === context.user.id) return
  const { error } = await deliverNotifications(context, { ...input, preferenceType: input.type })
  if (error) console.error("Could not create notification")
}
