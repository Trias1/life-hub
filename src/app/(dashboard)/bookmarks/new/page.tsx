import Link from "next/link"
import { BookmarkComposer } from "@/components/bookmark-composer"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { createBookmark } from "../actions"

export default async function NewBookmarkPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const context = await getWorkspaceContext()
  if (!context) return null
  const { data: collectionRows } = await context.supabase.from("bookmarks").select("collection").eq("workspace_id", context.workspaceId)

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb">
        <Link href="/bookmarks">Bookmarks</Link>
        <span aria-hidden>/</span>
        <span>New</span>
      </nav>
      <h1 className="issue-title mt-4">New bookmark</h1>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <BookmarkComposer action={createBookmark} collections={Array.from(new Set((collectionRows ?? []).map((row) => row.collection))).sort()} />
    </div>
  )
}
