import Link from "next/link"
import { TaskCreateForm } from "@/components/tasks/task-create-form"
import { memberName } from "@/components/tasks/task-meta"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { createTask } from "../actions"

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const context = await getWorkspaceContext()
  if (!context) return null
  const [{ data: members }, { data: labels }] = await Promise.all([
    context.supabase.from("workspace_members").select("user_id").eq("workspace_id", context.workspaceId).order("created_at"),
    context.supabase.from("task_labels").select("id,name,color").eq("workspace_id", context.workspaceId).order("name"),
  ])
  // The current user first, as "You", like the assignee picker on an issue tracker.
  const memberOptions = [...(members ?? [])].sort((a, b) => Number(b.user_id === context.user.id) - Number(a.user_id === context.user.id)).map((member) => ({ value: member.user_id, label: memberName(member.user_id, context.user.id) }))

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb">
        <Link href="/tasks">Tasks</Link>
        <span aria-hidden>/</span>
        <span>New</span>
      </nav>
      <h1 className="issue-title mt-4">New task</h1>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <TaskCreateForm action={createTask} workspaceId={context.workspaceId} members={memberOptions} labels={labels ?? []} />
    </div>
  )
}
