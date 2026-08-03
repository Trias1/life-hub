import { createClient } from "@/lib/supabase/server"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { redirect } from "next/navigation"
import { SidebarLayout } from "@/components/sidebar-layout"
import { signOut } from "./_actions/auth"
import { archiveSpace, createSpace, deleteSpace, updateSpace } from "./_actions/spaces"
import { selectWorkspace } from "./_actions/workspaces"
import { markAllNotificationsRead } from "@/app/(dashboard)/notifications/actions"

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getWorkspaceContext()
  if (!context) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    redirect(user ? "/onboarding" : "/login")
  }

  const workspaceIds = context.memberships.map((membership) => membership.workspace_id)
  const [{ data: workspace }, { data: workspaces }, { data: profile }, { data: spaces }, { data: recentNotifications }, tasks, notifications, activity, files] = await Promise.all([
    context.supabase.from("workspaces").select("id,name,owner_id").eq("id", context.workspaceId).maybeSingle(),
    context.supabase.from("workspaces").select("id,name,owner_id").in("id", workspaceIds).order("name"),
    context.supabase.from("profiles").select("display_name,avatar_google_file_id,updated_at").eq("id", context.user.id).maybeSingle(),
    context.supabase.from("spaces").select("id,name,color").eq("workspace_id", context.workspaceId).is("archived_at", null).order("created_at"),
    context.supabase.from("notifications").select("id,message,type,is_read,created_at").eq("recipient_id", context.user.id).order("created_at", { ascending: false }).limit(8),
    context.supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspaceId).eq("status", "todo").is("deleted_at", null),
    context.supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", context.user.id).eq("is_read", false),
    context.supabase.from("activity_logs").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspaceId),
    context.supabase.from("files").select("size_bytes").eq("workspace_id", context.workspaceId).is("trashed_at", null),
  ])
  const storageBytes = (files.data ?? []).reduce((total, file) => total + Number(file.size_bytes ?? 0), 0)
  const avatarUrl = profile?.avatar_google_file_id ? "/api/profile/avatar?v=" + encodeURIComponent(profile.updated_at ?? "") : null

  return <SidebarLayout user={{ id: context.user.id, email: context.user.email ?? "", displayName: profile?.display_name ?? context.user.email?.split("@")[0] ?? "User", avatarUrl }} workspace={{ id: context.workspaceId, name: workspace?.name ?? "Workspace", plan: "Free plan", isOwner: workspace?.owner_id === context.user.id }} workspaces={workspaces ?? []} counts={{ tasks: tasks.count ?? 0, notifications: notifications.count ?? 0, activity: activity.count ?? 0, storageBytes }} spaces={spaces ?? []} notifications={recentNotifications ?? []} createSpace={createSpace} updateSpace={updateSpace} archiveSpace={archiveSpace} deleteSpace={deleteSpace} selectWorkspace={selectWorkspace} signOut={signOut} markAllRead={markAllNotificationsRead}>{children}</SidebarLayout>
}
