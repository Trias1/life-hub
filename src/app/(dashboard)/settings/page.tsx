import { getWorkspaceContext } from "@/lib/workspace/server"
import { hasWorkspaceDriveConnection } from "@/lib/google-drive-auth"
import { SettingsStudio } from "@/components/settings-studio"
import { deleteWorkspace, disconnectGoogleDrive, saveGeneralSettings, saveNotificationPreferences } from "./actions"

export default async function SettingsPage() {
  const context = await getWorkspaceContext()
  if (!context) return null
  const [{ data: workspace }, { data: settings }, { data: notificationPreferences }, driveConnected] = await Promise.all([
    context.supabase.from("workspaces").select("name,slug").eq("id", context.workspaceId).maybeSingle(),
    context.supabase.from("workspace_settings").select("language,timezone,date_format,time_format").eq("workspace_id", context.workspaceId).maybeSingle(),
    context.supabase.from("notification_preferences").select("mentions_enabled,tasks_enabled,calendar_enabled,notes_enabled,files_enabled,bookmarks_enabled").eq("user_id", context.user.id).maybeSingle(),
    hasWorkspaceDriveConnection(context.workspaceId).catch((error) => {
      console.error("load Google Drive connection", error)
      return false
    }),
  ])
  const canManageSettings = ["admin", "super_admin"].includes(context.role)
  return <SettingsStudio workspace={{ name: workspace?.name ?? "Workspace", slug: workspace?.slug ?? "workspace" }} initialGeneral={{ language: "English", timezone: settings?.timezone ?? "Asia/Jakarta", dateFormat: settings?.date_format ?? "DD/MM/YYYY", timeFormat: settings?.time_format ?? "24-hour" }} initialNotifications={{ mentionsEnabled: notificationPreferences?.mentions_enabled ?? true, tasksEnabled: notificationPreferences?.tasks_enabled ?? true, calendarEnabled: notificationPreferences?.calendar_enabled ?? true, notesEnabled: notificationPreferences?.notes_enabled ?? true, filesEnabled: notificationPreferences?.files_enabled ?? true, bookmarksEnabled: notificationPreferences?.bookmarks_enabled ?? false }} driveConnected={driveConnected} canManageDrive={canManageSettings} canManageSettings={canManageSettings} disconnectDrive={disconnectGoogleDrive} saveGeneralSettings={saveGeneralSettings} saveNotificationPreferences={saveNotificationPreferences} deleteWorkspace={deleteWorkspace} />
}
