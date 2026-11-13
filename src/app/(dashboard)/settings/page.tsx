import { getWorkspaceContext } from "@/lib/workspace/server"
import { hasWorkspaceDriveConnection } from "@/lib/google-drive-auth"
import { SettingsStudio } from "@/components/settings-studio"
import { BackupPanel, type BackupFile, type BackupSchedule } from "@/components/settings/backup-panel"
import { deleteWorkspace, disconnectGoogleDrive, runBackupNow, saveBackupSchedule, saveGeneralSettings, saveNotificationPreferences } from "./actions"

export default async function SettingsPage() {
  const context = await getWorkspaceContext()
  if (!context) return null
  const [{ data: workspace }, { data: settings }, { data: notificationPreferences }, driveConnected, { data: backupSchedule }, { data: backups }] = await Promise.all([
    context.supabase.from("workspaces").select("name,slug").eq("id", context.workspaceId).maybeSingle(),
    context.supabase.from("workspace_settings").select("language,timezone,date_format,time_format").eq("workspace_id", context.workspaceId).maybeSingle(),
    context.supabase.from("notification_preferences").select("mentions_enabled,tasks_enabled,calendar_enabled,notes_enabled,files_enabled,bookmarks_enabled").eq("user_id", context.user.id).maybeSingle(),
    hasWorkspaceDriveConnection(context.workspaceId).catch(() => {
      console.error("load Google Drive connection")
      return false
    }),
    context.supabase.from("workspace_backup_settings").select("frequency,hour,weekday,month_day,keep_count,last_run_at,last_status,last_error").eq("workspace_id", context.workspaceId).maybeSingle(),
    // Owner only (RLS): other members get an empty list.
    context.supabase.from("workspace_backups").select("id,file_name,size_bytes,trigger,created_at").eq("workspace_id", context.workspaceId).order("created_at", { ascending: false }).limit(30),
  ])
  const schedule: BackupSchedule = (backupSchedule as BackupSchedule | null) ?? { frequency: "off", hour: 2, weekday: 0, month_day: 1, keep_count: 14, last_run_at: null, last_status: null, last_error: null }
  const backupPanel = <BackupPanel schedule={schedule} backups={(backups ?? []) as BackupFile[]} isOwner={context.role === "super_admin"} driveConnected={driveConnected} saveSchedule={saveBackupSchedule} runNow={runBackupNow} />
  const canManageSettings = ["admin", "super_admin"].includes(context.role)
  return <SettingsStudio workspace={{ name: workspace?.name ?? "Workspace", slug: workspace?.slug ?? "workspace" }} initialGeneral={{ language: "English", timezone: settings?.timezone ?? "Asia/Jakarta", dateFormat: settings?.date_format ?? "DD/MM/YYYY", timeFormat: settings?.time_format ?? "24-hour" }} initialNotifications={{ mentionsEnabled: notificationPreferences?.mentions_enabled ?? true, tasksEnabled: notificationPreferences?.tasks_enabled ?? true, calendarEnabled: notificationPreferences?.calendar_enabled ?? true, notesEnabled: notificationPreferences?.notes_enabled ?? true, filesEnabled: notificationPreferences?.files_enabled ?? true, bookmarksEnabled: notificationPreferences?.bookmarks_enabled ?? false }} driveConnected={driveConnected} canManageDrive={context.role === "super_admin"} canManageSettings={canManageSettings} disconnectDrive={disconnectGoogleDrive} saveGeneralSettings={saveGeneralSettings} saveNotificationPreferences={saveNotificationPreferences} deleteWorkspace={deleteWorkspace} backupPanel={backupPanel} />
}
