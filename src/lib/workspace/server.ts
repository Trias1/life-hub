import { createClient } from "@/lib/supabase/server"

type WorkspaceMembership = { workspace_id: string; role: string }

type ActivityInput = { action: string; entityType: string; entityId?: string | null; resourceName?: string | null; link?: string | null; notify?: boolean }
type NotificationInput = { recipientId: string; type: string; message: string; priority?: "low" | "normal" | "high" | "urgent"; resourceType?: string; resourceId?: string | null; resourceName?: string; link?: string }

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

  const { error } = await context.supabase.from("profiles").upsert({ id: context.user.id, active_workspace_id: workspaceId, updated_at: new Date().toISOString() })
  return error ? { error: "Could not switch workspace." } : {}
}

export async function recordActivity(context: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>, input: ActivityInput) {
  const { error } = await context.supabase.from("activity_logs").insert({ workspace_id: context.workspaceId, actor_id: context.user.id, action: input.action, entity_type: input.entityType, entity_id: input.entityId ?? null })
  if (error) {
    console.error("Could not record activity", error)
    return { error }
  }
  if (input.notify === false) return {}

  const { data: members, error: membersError } = await context.supabase.from("workspace_members").select("user_id").eq("workspace_id", context.workspaceId).neq("user_id", context.user.id)
  if (membersError) {
    console.error("Could not load activity recipients", membersError)
    return { error: membersError }
  }
  const recipients = (members ?? []).map((member) => ({ workspace_id: context.workspaceId, recipient_id: member.user_id, actor_id: context.user.id, type: "activity", message: (context.user.email?.split("@")[0] ?? "A workspace member") + " " + input.action.toLowerCase() + " " + input.entityType + ".", priority: "normal" as const, resource_type: input.entityType, resource_id: input.entityId ?? null, resource_name: input.resourceName ?? null, link: input.link ?? null }))
  if (!recipients.length) return {}
  const { error: notificationError } = await context.supabase.from("notifications").insert(recipients)
  if (notificationError) console.error("Could not create activity notifications", notificationError)
  return notificationError ? { error: notificationError } : {}
}

export async function createNotification(context: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>, input: NotificationInput) {
  if (input.recipientId === context.user.id) return
  const { error } = await context.supabase.from("notifications").insert({ workspace_id: context.workspaceId, recipient_id: input.recipientId, actor_id: context.user.id, type: input.type, message: input.message, priority: input.priority ?? "normal", resource_type: input.resourceType ?? null, resource_id: input.resourceId ?? null, resource_name: input.resourceName ?? null, link: input.link ?? null })
  if (error) console.error("Could not create notification", error)
}
