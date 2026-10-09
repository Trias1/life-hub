import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { BookmarkDetail } from "@/components/bookmarks/bookmark-detail"
import { relativeTime } from "@/lib/relative-time"
import { formatDateTime } from "@/lib/format-date"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { FIELD, decryptField } from "@/lib/data-crypto.mjs"
import { archiveBookmark, restoreBookmark, toggleBookmarkFavorite, updateBookmark } from "../actions"

const activityText: Record<string, string> = { Created: "added this bookmark", Updated: "edited this bookmark", Archived: "archived this bookmark", Restored: "restored this bookmark" }

export default async function BookmarkPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const { id } = await params
  const { error, success } = await searchParams
  if (!z.string().uuid().safeParse(id).success) notFound()
  const context = await getWorkspaceContext()
  if (!context) return null

  const { data: bookmark } = await context.supabase
    .from("bookmarks")
    .select("id,title,url,collection,tags,is_favorite,archived_at,creator_id,created_at,updated_at")
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle()
  if (!bookmark) notFound()

  const [{ data: logs }, { data: collectionRows }, { data: profile }] = await Promise.all([
    context.supabase.from("activity_logs").select("id,action,actor_id,created_at").eq("workspace_id", context.workspaceId).eq("entity_type", "bookmark").eq("entity_id", bookmark.id).order("created_at", { ascending: false }).limit(20),
    context.supabase.from("bookmarks").select("collection").eq("workspace_id", context.workspaceId),
    context.supabase.from("profiles").select("display_name").eq("id", context.user.id).maybeSingle(),
  ])
  const isCreator = bookmark.creator_id === context.user.id
  // Profiles are only readable by their owner, so other members stay anonymous.
  const ownName = profile?.display_name ?? context.user.email?.split("@")[0] ?? "You"
  const nameFor = (actorId: string | null) => (actorId === context.user.id ? ownName : "A workspace member")
  const now = new Date()
  const activity = (logs ?? []).filter((log) => activityText[log.action]).map((log) => ({ id: log.id, actor: nameFor(log.actor_id), text: activityText[log.action], at: formatDateTime(log.created_at), label: relativeTime(log.created_at, now) }))
  // Bookmarks imported from CSV or saved before activity was recorded have no "Created" entry.
  if (!(logs ?? []).some((log) => log.action === "Created")) activity.push({ id: "created", actor: nameFor(bookmark.creator_id), text: "added this bookmark", at: formatDateTime(bookmark.created_at), label: relativeTime(bookmark.created_at, now) })
  const backHref = bookmark.archived_at ? "/bookmarks?view=archived" : "/bookmarks"

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb">
        <Link href={backHref}>Bookmarks</Link>
        <span aria-hidden>/</span>
        <span className="truncate">{bookmark.title}</span>
      </nav>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
      <div className="mt-5">
        <BookmarkDetail
          bookmark={{ id: bookmark.id, title: bookmark.title, url: decryptField(FIELD.BOOKMARK_URL, bookmark.url), collection: bookmark.collection, tags: bookmark.tags ?? [], is_favorite: bookmark.is_favorite, archived_at: bookmark.archived_at }}
          collections={Array.from(new Set((collectionRows ?? []).map((row) => row.collection))).sort()}
          canEdit={isCreator}
          creatorName={nameFor(bookmark.creator_id)}
          createdAt={formatDateTime(bookmark.created_at)}
          createdLabel={relativeTime(bookmark.created_at, now)}
          updatedAt={formatDateTime(bookmark.updated_at)}
          updatedLabel={relativeTime(bookmark.updated_at, now)}
          activity={activity}
          actions={{ updateBookmark, toggleFavorite: toggleBookmarkFavorite, archiveBookmark, restoreBookmark }}
        />
      </div>
    </div>
  )
}
