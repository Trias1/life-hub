import Link from "next/link"
import { NoteCreateForm } from "@/components/notes/note-create-form"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { createNote } from "../actions"

export default async function NewNotePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const context = await getWorkspaceContext()
  if (!context) return null
  const { data: folderRows } = await context.supabase.from("notes").select("folder").eq("workspace_id", context.workspaceId).is("deleted_at", null)

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb">
        <Link href="/notes">Notes</Link>
        <span aria-hidden>/</span>
        <span>New</span>
      </nav>
      <h1 className="issue-title mt-4">New note</h1>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <NoteCreateForm action={createNote} workspaceId={context.workspaceId} folders={Array.from(new Set((folderRows ?? []).map((row) => row.folder)))} />
    </div>
  )
}
