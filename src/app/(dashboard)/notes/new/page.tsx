import Link from "next/link"
import { z } from "zod"
import { NoteCreateForm } from "@/components/notes/note-create-form"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { createNote } from "../actions"

export default async function NewNotePage({ searchParams }: { searchParams: Promise<{ error?: string; parent?: string }> }) {
  const { error, parent: parentParam } = await searchParams
  const context = await getWorkspaceContext()
  if (!context) return null
  const parentId = z.string().uuid().safeParse(parentParam).data
  const [{ data: folderRows }, { data: parent }] = await Promise.all([
    context.supabase.from("notes").select("folder").eq("workspace_id", context.workspaceId).is("deleted_at", null),
    // "New sub-page" from the notes list: only under your own active notes (createNote checks again).
    parentId
      ? context.supabase.from("notes").select("id,title,folder").eq("id", parentId).eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).is("deleted_at", null).is("archived_at", null).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb">
        <Link href="/notes">Notes</Link>
        <span aria-hidden>/</span>
        {parent && <><Link href={"/notes/" + parent.id} className="truncate">{parent.title}</Link><span aria-hidden>/</span></>}
        <span>New</span>
      </nav>
      <h1 className="issue-title mt-4">{parent ? "New sub-page" : "New note"}</h1>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <NoteCreateForm action={createNote} workspaceId={context.workspaceId} folders={Array.from(new Set((folderRows ?? []).map((row) => row.folder)))} parent={parent} />
    </div>
  )
}
