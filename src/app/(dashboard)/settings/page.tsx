import { getWorkspaceContext } from "@/lib/workspace/server"
import { hasWorkspaceDriveConnection } from "@/lib/google-drive-auth"
import { SettingsStudio } from "@/components/settings-studio"

export default async function SettingsPage() {
  const context = await getWorkspaceContext()
  if (!context) return null
  const { data: workspace } = await context.supabase.from("workspaces").select("name,slug").eq("id", context.workspaceId).maybeSingle()
  const driveConnected = await hasWorkspaceDriveConnection(context.workspaceId).catch((error) => {
    console.error("load Google Drive connection", error)
    return false
  })
  return <SettingsStudio workspace={{ name: workspace?.name ?? "Workspace", slug: workspace?.slug ?? "workspace" }} driveConnected={driveConnected} canManageDrive={["admin", "super_admin"].includes(context.role)} />
}
