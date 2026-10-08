import Link from "next/link"
import { FileUploadForm } from "@/components/files/file-upload-form"
import { hasWorkspaceDriveConnection } from "@/lib/google-drive-auth"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { uploadFile } from "../actions"

export default async function UploadFilePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const context = await getWorkspaceContext()
  if (!context) return null
  const [{ data: folderRows }, driveConnected] = await Promise.all([
    context.supabase.from("files").select("folder").eq("workspace_id", context.workspaceId).is("trashed_at", null),
    // A lookup failure should not hide the form; the upload action reports Drive errors itself.
    hasWorkspaceDriveConnection(context.workspaceId).catch(() => true),
  ])
  const folders = Array.from(new Set(["General", ...(folderRows ?? []).map((row) => row.folder)])).sort()

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb">
        <Link href="/files">Files</Link>
        <span aria-hidden>/</span>
        <span>Upload</span>
      </nav>
      <h1 className="issue-title mt-4">Upload file</h1>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {driveConnected ? (
        <FileUploadForm action={uploadFile} folders={folders} />
      ) : (
        <div role="status" className="issue-banner mt-6">
          <span>Uploads are paused because Google Drive is not connected for this workspace. Files are stored in the workspace Drive, so a workspace admin needs to connect it first.</span>
          <span className="flex gap-2">
            {/* Plain <a>: the OAuth login route redirects off-site. */}
            <a href="/api/auth/google/login" className="button-primary min-h-0 px-3 py-1.5 text-xs">Connect Google Drive</a>
            <Link href="/files" className="button-secondary min-h-0 px-3 py-1.5 text-xs">Back to files</Link>
          </span>
        </div>
      )}
    </div>
  )
}
