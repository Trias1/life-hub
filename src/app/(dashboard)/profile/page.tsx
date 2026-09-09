import { getWorkspaceContext } from "@/lib/workspace/server"
import { ProfileStudio } from "@/components/profile-studio"
import { updateProfile, uploadProfileAvatar } from "../settings/actions"

export default async function ProfilePage() {
  const context = await getWorkspaceContext()
  if (!context) return null
  const supabase = context.supabase
  const user = context.user
  const { data: profile } = await supabase.from("profiles").select("display_name,username,bio,avatar_url,avatar_google_file_id,updated_at").eq("id", user.id).maybeSingle()
  const avatarUrl = profile?.avatar_google_file_id ? "/api/profile/avatar?v=" + encodeURIComponent(profile.updated_at ?? "") : null
  const membership = { workspace_id: context.workspaceId }
  const [notes, tasks, files, logs] = membership ? await Promise.all([
    supabase.from("notes").select("title,updated_at").eq("workspace_id", membership.workspace_id).eq("author_id", user.id).order("updated_at", { ascending: false }).limit(2),
    supabase.from("tasks").select("title,status,updated_at").eq("workspace_id", membership.workspace_id).or(`created_by.eq.${user.id},assignee_id.eq.${user.id}`).order("updated_at", { ascending: false }).limit(2),
    supabase.from("files").select("name,updated_at").eq("workspace_id", membership.workspace_id).eq("uploader_id", user.id).order("updated_at", { ascending: false }).limit(2),
    supabase.from("activity_logs").select("action,entity_type,created_at").eq("workspace_id", membership.workspace_id).eq("actor_id", user.id).order("created_at", { ascending: false }).limit(2),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]
  const activity = [...(notes.data ?? []).map((item) => ({ label: item.title, detail: "Updated note", time: new Date(item.updated_at).toLocaleDateString() })), ...(tasks.data ?? []).map((item) => ({ label: item.title, detail: item.status + " task", time: new Date(item.updated_at).toLocaleDateString() })), ...(files.data ?? []).map((item) => ({ label: item.name, detail: "Workspace file", time: new Date(item.updated_at).toLocaleDateString() })), ...(logs.data ?? []).map((item) => ({ label: item.action, detail: item.entity_type, time: new Date(item.created_at).toLocaleDateString() }))].slice(0, 8)
  return <ProfileStudio email={user.email ?? ""} profile={profile} avatarUrl={avatarUrl} activity={activity} updateProfile={updateProfile} uploadProfileAvatar={uploadProfileAvatar} />
}
