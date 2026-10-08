import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { FileDetail } from "@/components/files/file-detail"
import { fileLabel, fileUrls, formatBytes } from "@/components/files/file-kind"
import { formatDateTime } from "@/lib/format-date"
import { relativeTime } from "@/lib/relative-time"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { createFileShare, permanentlyDeleteFile, restoreFile, toggleFileFavorite, trashFile, uploadFileVersion } from "../actions"

export default async function FilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string; share?: string }> }) {
  const { id } = await params
  const { error, success, share } = await searchParams
  if (!z.string().uuid().safeParse(id).success) notFound()
  const context = await getWorkspaceContext()
  if (!context) return null

  const { data: file } = await context.supabase
    .from("files")
    .select("id,name,mime_type,size_bytes,google_file_id,folder,is_favorite,uploader_id,trashed_at,created_at,updated_at")
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle()
  if (!file) notFound()

  const [{ data: versions }, { data: shares }, { data: profile }] = await Promise.all([
    context.supabase.from("file_versions").select("id,name,mime_type,size_bytes,uploader_id,created_at").eq("file_id", file.id).eq("workspace_id", context.workspaceId).order("created_at", { ascending: false }),
    context.supabase.from("file_shares").select("id,expires_at,created_at").eq("file_id", file.id).eq("workspace_id", context.workspaceId).not("token_hash", "is", null).order("created_at", { ascending: false }),
    context.supabase.from("profiles").select("display_name").eq("id", context.user.id).maybeSingle(),
  ])
  const now = new Date()
  // Profiles are only readable by their owner, so other uploaders stay anonymous.
  const myName = profile?.display_name ?? context.user.email?.split("@")[0] ?? "You"
  const nameFor = (userId: string) => userId === context.user.id ? myName : "A workspace member"
  const activeShares = (shares ?? []).filter((item) => !item.expires_at || new Date(item.expires_at) > now)
  const latestShare = activeShares[0]
  const shareStatus = !activeShares.length
    ? (shares ?? []).length ? "All links have expired" : "Not shared"
    : activeShares.length + (activeShares.length === 1 ? " active link" : " active links") + " · latest " + (latestShare.expires_at ? "expires " + relativeTime(latestShare.expires_at, now) : "never expires")
  const { downloadUrl, imagePreviewUrl } = fileUrls(file)

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb min-w-0">
        <Link href={file.trashed_at ? "/files?view=trash" : "/files"}>Files</Link>
        <span aria-hidden>/</span>
        <Link href={"/files?folder=" + encodeURIComponent(file.folder)} className="truncate">{file.folder}</Link>
        <span aria-hidden>/</span>
        <span className="min-w-0 truncate">{file.name}</span>
      </nav>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
      <div className="mt-5">
        <FileDetail
          file={{ id: file.id, name: file.name, mimeType: file.mime_type, folder: file.folder, isFavorite: file.is_favorite, trashed: Boolean(file.trashed_at) }}
          typeLabel={fileLabel(file.mime_type, file.name)}
          size={formatBytes(Number(file.size_bytes))}
          downloadUrl={downloadUrl}
          imagePreviewUrl={imagePreviewUrl}
          canEdit={file.uploader_id === context.user.id}
          uploaderName={nameFor(file.uploader_id)}
          createdAt={formatDateTime(file.created_at)}
          createdLabel={relativeTime(file.created_at, now)}
          updatedLabel={relativeTime(file.updated_at, now) + " · " + formatDateTime(file.updated_at)}
          trashedLabel={file.trashed_at ? relativeTime(file.trashed_at, now) : null}
          shareStatus={shareStatus}
          shareToken={share && /^[0-9a-f-]{36}$/i.test(share) ? share : null}
          versions={(versions ?? []).map((version) => ({ id: version.id, name: version.name, size: formatBytes(Number(version.size_bytes)), typeLabel: fileLabel(version.mime_type, version.name), uploaderName: nameFor(version.uploader_id), createdAt: formatDateTime(version.created_at), createdLabel: relativeTime(version.created_at, now) }))}
          actions={{ toggleFavorite: toggleFileFavorite, trashFile, restoreFile, permanentlyDeleteFile, uploadFileVersion, createFileShare }}
        />
      </div>
    </div>
  )
}
