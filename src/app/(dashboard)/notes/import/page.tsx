import Link from "next/link"
import { NoteImportForm } from "@/components/notes/note-import-form"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { importNotes } from "../actions"

export default async function ImportNotesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const context = await getWorkspaceContext()
  if (!context) return null
  // Titles of your active notes, so the preview can show which entries will be appended instead of created.
  const [{ data: mine }, { data: folderRows }] = await Promise.all([
    context.supabase.from("notes").select("title").eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).is("deleted_at", null).is("archived_at", null),
    context.supabase.from("notes").select("folder").eq("workspace_id", context.workspaceId).is("deleted_at", null),
  ])

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb">
        <Link href="/notes">Notes</Link>
        <span aria-hidden>/</span>
        <span>Import</span>
      </nav>
      <h1 className="issue-title mt-4">Import notes from a file</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">The file is read for this import only and isn&apos;t stored. A title that matches one of your notes adds the text to that note, and its earlier version stays in the history.</p>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <NoteImportForm
        action={importNotes}
        existingTitles={Array.from(new Set((mine ?? []).map((note) => note.title.trim().toLowerCase())))}
        folders={Array.from(new Set((folderRows ?? []).map((row) => row.folder).filter(Boolean)))}
      />
    </div>
  )
}
