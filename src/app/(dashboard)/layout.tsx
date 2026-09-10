import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/server";
import { redirect } from "next/navigation";
import { SidebarLayout } from "@/components/sidebar-layout";
import { createWorkspace } from "@/app/onboarding/actions";
import { signOut } from "./_actions/auth";
import {
  archiveSpace,
  createSpace,
  deleteSpace,
  updateSpace,
} from "./_actions/spaces";
import { selectWorkspace } from "./_actions/workspaces";
import { markAllNotificationsRead } from "@/app/(dashboard)/notifications/actions";
import { getStorageForWorkspace } from "@/lib/storage/storage"
import { clearWorkspaceDriveConnection, isGoogleInvalidGrant } from "@/lib/google-drive-auth";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await getWorkspaceContext();
  if (!context) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    redirect(user ? "/onboarding" : "/login");
  }

  const [
    { data: workspace },
    { data: workspaces },
    { data: profile },
    { data: spaces },
    { data: recentNotifications },
    tasks,
    notifications,
    activity,
    files,
    { data: workspaceSettings },
  ] = await Promise.all([
    context.supabase
      .from("workspaces")
      .select("id,name,owner_id")
      .eq("id", context.workspaceId)
      .maybeSingle(),
    context.supabase
      .from("workspace_members")
      .select("workspace_id,workspaces(id,name,owner_id)")
      .eq("user_id", context.user.id)
      .order("created_at"),
    context.supabase
      .from("profiles")
      .select("display_name,avatar_google_file_id,updated_at")
      .eq("id", context.user.id)
      .maybeSingle(),
    context.supabase
      .from("spaces")
      .select("id,name,color")
      .eq("workspace_id", context.workspaceId)
      .is("archived_at", null)
      .order("created_at"),
    context.supabase
      .from("notifications")
      .select("id,message,type,is_read,created_at")
      .eq("workspace_id", context.workspaceId)
      .eq("recipient_id", context.user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
    context.supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", context.workspaceId)
      .eq("status", "todo")
      .is("deleted_at", null),
    context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", context.workspaceId)
      .eq("recipient_id", context.user.id)
      .eq("is_read", false)
      .is("archived_at", null),
    context.supabase
      .from("activity_logs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", context.workspaceId),
    context.supabase
      .from("files")
      .select("size_bytes")
      .eq("workspace_id", context.workspaceId)
      .is("trashed_at", null),
    context.supabase
      .from("workspace_settings")
      .select("storage_limit_bytes")
      .eq("workspace_id", context.workspaceId)
      .maybeSingle(),
  ]);
  const workspaceRows = (workspaces ?? []) as Array<{
    workspace_id: string;
    workspaces:
      | { id: string; name: string; owner_id: string }
      | { id: string; name: string; owner_id: string }[]
      | null;
  }>;
  const availableWorkspaces = workspaceRows
    .flatMap((row) => {
      if (!row.workspaces) return [];
      return Array.isArray(row.workspaces) ? row.workspaces : [row.workspaces];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const localStorageBytes = (files.data ?? []).reduce(
    (total, file) => total + Number(file.size_bytes ?? 0),
    0,
  );
  let storageBytes = localStorageBytes;
  let storageLimitBytes = Number(
    workspaceSettings?.storage_limit_bytes ?? 107374182400,
  );
  try {
    const driveUsage = await getStorageForWorkspace(context.workspaceId).getUsage();
    storageBytes = driveUsage.usedBytes;
    storageLimitBytes = driveUsage.limitBytes ?? storageLimitBytes;
  } catch (error) {
    if (isGoogleInvalidGrant(error)) {
      try {
        await clearWorkspaceDriveConnection(context.workspaceId)
      } catch (clearError) {
        console.error("Could not clear invalid Google Drive connection")
      }
    } else {
      console.error("Could not load Google Drive storage quota")
    }
  }
  const avatarUrl = profile?.avatar_google_file_id
    ? "/api/profile/avatar?v=" + encodeURIComponent(profile.updated_at ?? "")
    : null;

  return (
    <SidebarLayout
      user={{
        id: context.user.id,
        email: context.user.email ?? "",
        displayName:
          profile?.display_name ?? context.user.email?.split("@")[0] ?? "User",
        avatarUrl,
      }}
      workspace={{
        id: context.workspaceId,
        name: workspace?.name ?? "Workspace",
        plan: "",
        isOwner: workspace?.owner_id === context.user.id,
      }}
      workspaces={availableWorkspaces}
      counts={{
        tasks: tasks.count ?? 0,
        notifications: notifications.count ?? 0,
        activity: activity.count ?? 0,
        storageBytes,
        storageLimitBytes,
      }}
      spaces={spaces ?? []}
      notifications={recentNotifications ?? []}
      createSpace={createSpace}
      createWorkspace={createWorkspace}
      updateSpace={updateSpace}
      archiveSpace={archiveSpace}
      deleteSpace={deleteSpace}
      selectWorkspace={selectWorkspace}
      signOut={signOut}
      markAllRead={markAllNotificationsRead}
    >
      {children}
    </SidebarLayout>
  );
}
