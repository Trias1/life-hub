import Link from "next/link"
import { Select } from "@/components/ui/select"
import Image from "next/image"
import { MoreHorizontal, Star } from "lucide-react"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { getStorageForWorkspace } from "@/lib/storage/storage"
import { createFileShare, permanentlyDeleteFile, restoreFile, toggleFileFavorite, trashFile, uploadFile, uploadFileVersion } from "./actions"

type View = "grid" | "list" | "compact"
type Sort = "uploaded" | "modified" | "name" | "size"

function formatBytes(value: number) {
  if (value < 1024) return value + " B"
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB"
  if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + " MB"
  return (value / (1024 * 1024 * 1024)).toFixed(1) + " GB"
}

function fileType(mime: string) {
  if (mime.startsWith("image/")) return "image"
  if (mime === "application/pdf") return "pdf"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  if (mime.includes("zip") || mime.includes("compressed")) return "zip"
  return "document"
}
function fileLabel(mime: string, name: string) {
  const extension = name.split(".").pop()?.trim().toUpperCase()
  if (extension && extension.length <= 5 && extension !== name.toUpperCase()) return extension
  if (mime === "application/pdf") return "PDF"
  if (mime.includes("word")) return "DOC"
  if (mime.includes("excel")) return "XLS"
  if (mime.includes("powerpoint")) return "PPT"
  if (mime.includes("zip") || mime.includes("compressed")) return "ZIP"
  if (mime.startsWith("image/")) return "IMG"
  if (mime.startsWith("video/")) return "VID"
  if (mime.startsWith("audio/")) return "AUD"
  return "FILE"
}


function getFileIcon(mimeType: string, fileName: string) {
  const lowerName = fileName.toLowerCase()
  if (mimeType === "application/pdf") return { icon: "📄", color: "bg-red-50 text-red-600", label: "PDF" }
  if (mimeType.includes("word") || lowerName.endsWith(".doc") || lowerName.endsWith(".docx")) return { icon: "📝", color: "bg-blue-50 text-blue-600", label: "DOC" }
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) return { icon: "📊", color: "bg-green-50 text-green-600", label: "XLS" }
  if (mimeType.includes("presentation") || lowerName.endsWith(".pptx") || lowerName.endsWith(".ppt")) return { icon: "📽️", color: "bg-orange-50 text-orange-600", label: "PPT" }
  if (mimeType.startsWith("image/")) return { icon: "🖼️", color: "bg-purple-50 text-purple-600", label: "IMG" }
  if (mimeType.startsWith("video/")) return { icon: "🎬", color: "bg-pink-50 text-pink-600", label: "VID" }
  if (mimeType.startsWith("audio/")) return { icon: "🎵", color: "bg-yellow-50 text-yellow-600", label: "AUD" }
  if (["text/javascript", "application/json", "text/html", "text/css", "text/typescript", "application/x-python", "text/x-python"].includes(mimeType) || [".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cpp", ".go", ".rs", ".php", ".json", ".html", ".css", ".sql"].some((extension) => lowerName.endsWith(extension))) return { icon: "💻", color: "bg-gray-50 text-gray-600", label: "CODE" }
  if (mimeType.includes("zip") || mimeType.includes("compressed") || mimeType.includes("archive") || [".zip", ".rar", ".tar", ".gz", ".7z"].some((extension) => lowerName.endsWith(extension))) return { icon: "📦", color: "bg-amber-50 text-amber-600", label: "ZIP" }
  if (mimeType.startsWith("text/")) return { icon: "📃", color: "bg-slate-50 text-slate-600", label: "TXT" }
  return { icon: "📁", color: "bg-zinc-50 text-zinc-600", label: "FILE" }
}

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ folder?: string; trash?: string; favorite?: string; q?: string; type?: string; sort?: Sort; view?: View; share?: string }> }) {
  const params = await searchParams
  const folder = params.folder ?? "all"
  const trash = params.trash ?? "false"
  const favorite = params.favorite ?? "false"
  const query = (params.q ?? "").trim().toLowerCase()
  const type = params.type ?? "all"
  const sort = ["uploaded", "modified", "name", "size"].includes(params.sort ?? "") ? params.sort as Sort : "uploaded"
  const view = ["grid", "list", "compact"].includes(params.view ?? "") ? params.view as View : "grid"
  const context = await getWorkspaceContext()
  if (!context) return null
  const [{ data: allFiles }, { data: workspaceSettings }] = await Promise.all([
    context.supabase.from("files").select("id,name,mime_type,size_bytes,storage_path,google_file_id,folder,is_favorite,trashed_at,created_at,updated_at").eq("workspace_id", context.workspaceId).order("created_at", { ascending: false }),
    context.supabase.from("workspace_settings").select("storage_limit_bytes").eq("workspace_id", context.workspaceId).maybeSingle(),
  ])
  const files = (allFiles ?? []).filter((file) => (trash === "true" ? Boolean(file.trashed_at) : !file.trashed_at) && (folder === "all" || file.folder === folder) && (favorite !== "true" || file.is_favorite) && (!query || [file.name, file.mime_type, file.folder].some((value) => value.toLowerCase().includes(query))) && (type === "all" || fileType(file.mime_type) === type))
  files.sort((first, second) => sort === "name" ? first.name.localeCompare(second.name) : sort === "size" ? Number(second.size_bytes) - Number(first.size_bytes) : sort === "modified" ? new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime() : new Date(second.created_at).getTime() - new Date(first.created_at).getTime())
  const folders = Array.from(new Set((allFiles ?? []).map((file) => file.folder))).sort()
  const { data: versionRows } = files.length ? await context.supabase.from("file_versions").select("id,file_id,name,mime_type,size_bytes,created_at").in("file_id", files.map((file) => file.id)).order("created_at", { ascending: false }) : { data: [] as Array<{ id: string; file_id: string; name: string; mime_type: string; size_bytes: number; created_at: string }> }
  const versionsByFile = new Map<string, typeof versionRows>()
  for (const version of versionRows ?? []) versionsByFile.set(version.file_id, [...(versionsByFile.get(version.file_id) ?? []), version])
  const localStorageBytes = (allFiles ?? []).filter((file) => !file.trashed_at).reduce((total, file) => total + Number(file.size_bytes ?? 0), 0)
  let storageUsage = { usedBytes: localStorageBytes, limitBytes: Number(workspaceSettings?.storage_limit_bytes ?? 107374182400) }
  try {
    const driveUsage = await getStorageForWorkspace(context.workspaceId).getUsage()
    storageUsage = { usedBytes: driveUsage.usedBytes, limitBytes: driveUsage.limitBytes ?? storageUsage.limitBytes }
  } catch (error) {
    console.error("Could not load Google Drive storage quota")
  }
  const storagePercent = storageUsage.limitBytes ? Math.min(100, (storageUsage.usedBytes / storageUsage.limitBytes) * 100) : 0
  const filesWithUrls = files.map((file) => ({ ...file, downloadUrl: file.google_file_id ? "/api/files/" + file.id + "/download" : null, previewUrl: file.google_file_id && (file.mime_type.startsWith("image/") || file.mime_type === "application/pdf") ? "/api/files/" + file.id + "/download?inline=1" : null, imagePreviewUrl: file.google_file_id && file.mime_type.startsWith("image/") ? "/api/files/" + file.id + "/download?inline=1" : null }))
  const link = (next: Record<string, string>) => { const value = new URLSearchParams({ folder, trash, favorite, q: query, type, sort, view, ...next }); return "/files?" + value.toString() }
  const cardClass = view === "grid" ? "surface flex flex-col gap-3 p-4" : view === "compact" ? "surface flex items-center gap-3 p-3" : "surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center"

  return <div className="page-container"><header className="page-header"><div><p className="eyebrow">Workspace storage</p><h1 className="page-title">Files</h1><p className="page-description">Find, upload, and organize private workspace files without the clutter.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">{files.length} shown</span></header>{params.share && <section className="surface mt-6 border border-emerald-200 bg-emerald-50 p-5"><p className="eyebrow text-emerald-700">Share link ready</p><p className="mt-1 text-sm text-emerald-900">Anyone with this link can view the file until it expires.</p><a href={"/api/shared/files/" + params.share + "?inline=1"} target="_blank" rel="noreferrer" className="mt-3 block truncate text-sm font-semibold text-emerald-800 underline">{"/api/shared/files/" + params.share + "?inline=1"}</a></section>}<section className="surface mt-8 p-5"><div className="toolbar"><div><p className="eyebrow">Upload</p><h2 className="mt-1 text-lg font-semibold">Add files to the workspace</h2></div><p className="text-xs text-zinc-400">Images, PDF, documents, ZIP, audio, or video ? max 10 MB</p></div><form action={uploadFile} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><input required name="file" type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,video/*,audio/*" className="field-control min-w-0 text-sm" /><input required name="folder" defaultValue="General" placeholder="Folder" className="field-control" /><button className="button-primary">Upload file</button></form></section><section className="surface-muted mt-6 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Storage summary</p><p className="mt-1 text-lg font-semibold">{formatBytes(storageUsage.usedBytes)} used</p></div><span className="text-sm text-zinc-500">{storageUsage.limitBytes ? formatBytes(storageUsage.limitBytes) + " workspace limit" : "Workspace limit not set"}</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/60"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: storageUsage.limitBytes ? storagePercent + "%" : "0%" }} /></div></section><form method="get" className="mt-6 grid gap-3 lg:grid-cols-[1fr_repeat(4,auto)]"><input name="q" defaultValue={query} placeholder="Search files, folders, or types..." className="field-control" /><Select name="folder" defaultValue={folder} className="field-control" options={[{ value: "all", label: "All folders" }, ...folders.map((item) => ({ value: item, label: item }))]} /><Select name="type" defaultValue={type} className="field-control" options={[{ value: "all", label: "All types" }, { value: "image", label: "Images" }, { value: "pdf", label: "PDF" }, { value: "document", label: "Documents" }, { value: "zip", label: "ZIP" }, { value: "video", label: "Video" }, { value: "audio", label: "Audio" }]} /><Select name="sort" defaultValue={sort} className="field-control" options={[{ value: "uploaded", label: "Recently uploaded" }, { value: "modified", label: "Recently modified" }, { value: "name", label: "Name" }, { value: "size", label: "Size" }]} /><Select name="trash" defaultValue={trash} className="field-control" options={[{ value: "false", label: "Active" }, { value: "true", label: "Trash" }]} /><input type="hidden" name="favorite" value={favorite} /><input type="hidden" name="view" value={view} /><button className="button-secondary">Filter</button></form><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><Link href={link({ favorite: favorite === "true" ? "false" : "true" })} className="button-quiet min-h-0 px-2 py-1 text-xs">{favorite === "true" ? "All files" : "Favorites"}</Link></div><div className="flex gap-1 rounded-lg bg-[var(--surface-muted)] p-1">{(["grid", "list", "compact"] as View[]).map((item) => <Link key={item} href={link({ view: item })} className={view === item ? "button-secondary min-h-0 px-3 py-1.5 text-xs capitalize" : "button-quiet min-h-0 px-3 py-1.5 text-xs capitalize"}>{item}</Link>)}</div></div><section className="mt-6">{filesWithUrls.length ? <div className={view === "grid" ? "files-grid" : "space-y-2"}>{filesWithUrls.map((file) => <article key={file.id} className={cardClass}>{file.imagePreviewUrl && view === "grid" ? <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-emerald-50"><Image src={file.imagePreviewUrl} alt={file.name} fill sizes="(min-width: 1024px) 28vw, 90vw" unoptimized className="object-cover" /></div> : <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${getFileIcon(file.mime_type, file.name).color}`}>{file.mime_type.startsWith("image/") && file.previewUrl ? <Image src={file.previewUrl} alt={file.name} width={44} height={44} unoptimized className="h-full w-full object-cover" /> : <span aria-label={getFileIcon(file.mime_type, file.name).label}>{getFileIcon(file.mime_type, file.name).icon}</span>}</div>}<div className="min-w-0 flex-1"><p className="truncate font-semibold">{file.name}</p><p className="mt-1 truncate text-xs text-zinc-500">{file.mime_type} ? {formatBytes(Number(file.size_bytes))} ? {file.folder}</p><p className="mt-1 text-[11px] text-zinc-400">Modified {new Date(file.updated_at).toLocaleDateString()}</p></div><div className="flex flex-wrap items-center gap-2"><form action={toggleFileFavorite}><input type="hidden" name="id" value={file.id} /><input type="hidden" name="favorite" value={file.is_favorite ? "false" : "true"} /><button className="button-quiet min-w-0 min-h-0 px-3 py-1.5 text-xs" aria-label={file.is_favorite ? "Remove favorite" : "Add favorite"}>{file.is_favorite ? <Star size={14} fill="currentColor" aria-hidden="true" /> : <Star size={14} aria-hidden="true" />}</button></form>{file.previewUrl && file.mime_type === "application/pdf" && <a href={file.previewUrl} target="_blank" rel="noreferrer" className="button-secondary min-w-0 max-w-full truncate min-h-0 px-3 py-1.5 text-xs">Open PDF</a>}{file.downloadUrl && <a href={file.downloadUrl} target="_blank" rel="noreferrer" className="button-secondary min-w-0 max-w-full truncate min-h-0 px-3 py-1.5 text-xs">Download</a>}<details className="relative"><summary className="button-quiet flex min-h-0 cursor-pointer list-none items-center justify-center px-2 py-1.5 text-xs"><MoreHorizontal size={16} aria-label="More file actions" /></summary><div className="absolute right-0 top-9 z-50 w-48 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xl"><div className="flex flex-col gap-2"><form action={createFileShare}><input type="hidden" name="id" value={file.id} /><Select name="expires" defaultValue="7d" className="field-control min-h-0 px-2 py-1 text-xs" options={[{ value: "1d", label: "1 day" }, { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }, { value: "never", label: "Never" }]} /><button className="button-secondary min-w-0 max-w-full truncate min-h-0 px-2 py-1 text-xs">Share</button></form><form action={uploadFileVersion} className="flex flex-wrap items-center gap-2"><input type="hidden" name="fileId" value={file.id} /><input id={"version-" + file.id} required name="version" type="file" className="hidden" /><label htmlFor={"version-" + file.id} className="button-quiet min-w-0 max-w-full cursor-pointer truncate min-h-0 px-2 py-1 text-xs">Choose file</label><button className="button-secondary min-w-0 max-w-full truncate min-h-0 px-2 py-1 text-xs">Upload version</button></form></div></div></details><div className="mt-3 flex flex-wrap gap-2">{(versionsByFile.get(file.id) ?? []).slice(0, 3).map((version) => <a key={version.id} href={"/api/file-versions/" + version.id + "/download"} target="_blank" rel="noreferrer" className="button-quiet min-w-0 max-w-full truncate min-h-0 px-2 py-1 text-xs">Version · {version.name}</a>)}</div>{trash !== "true" ? <form action={trashFile}><input type="hidden" name="id" value={file.id} /><button className="button-quiet min-w-0 max-w-full truncate min-h-0 px-3 py-1.5 text-xs text-red-600">Trash</button></form> : <><form action={restoreFile}><input type="hidden" name="id" value={file.id} /><button className="button-secondary min-w-0 max-w-full truncate min-h-0 px-2 py-1 text-xs">Restore</button></form><form action={permanentlyDeleteFile}><input type="hidden" name="id" value={file.id} /><button className="button-quiet min-w-0 max-w-full truncate min-h-0 px-2 py-1 text-xs text-red-600">Delete permanently</button></form></>}</div></article>)}</div> : <div className="empty-state surface"><h2 className="font-semibold">No files yet</h2><p>{query || folder !== "all" ? "Try a different search or folder." : "Upload your first file to start building workspace storage."}</p></div>}</section></div>
}
