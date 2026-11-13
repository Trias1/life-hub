import Link from "next/link"
import { NoteImportForm } from "@/components/notes/note-import-form"
import { flattenTree } from "@/lib/note-tree.mjs"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { importDocuments, importNotes } from "../actions"

export default async function ImportNotesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const context = await getWorkspaceContext()
  if (!context) return null
  // Your active notes: titles for "add to existing" in the list format, and the "Put under" choices.
  const [{ data: mine }, { data: folderRows }] = await Promise.all([
    context.supabase.from("notes").select("id,title,parent_id,sort_order,created_at").eq("workspace_id", context.workspaceId).eq("author_id", context.user.id).is("deleted_at", null).is("archived_at", null).order("title"),
    context.supabase.from("notes").select("folder").eq("workspace_id", context.workspaceId).is("deleted_at", null),
  ])

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb">
        <Link href="/notes">Notes</Link>
        <span aria-hidden>/</span>
        <span>Import</span>
      </nav>
      <h1 className="issue-title mt-4">Import notes from files</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">Markdown (.md), Word (.docx) and text files. The files are read for this import only and aren&apos;t stored; the notes are encrypted like any other note.</p>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <NoteImportForm
        importList={importNotes}
        importDocuments={importDocuments}
        existingTitles={Array.from(new Set((mine ?? []).map((note) => note.title.trim().toLowerCase())))}
        folders={Array.from(new Set((folderRows ?? []).map((row) => row.folder).filter(Boolean)))}
        parents={flattenTree(mine ?? []).map((note) => ({ value: note.id, label: "  ".repeat(note.depth) + note.title }))}
      />
    </div>
  )
}
