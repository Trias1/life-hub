import Link from "next/link"
import Image from "next/image"
import { redirect } from "next/navigation"
import { Download, LayoutGrid, List, Search, Star } from "lucide-react"
import { Select } from "@/components/ui/select"
import { FileKindIcon } from "@/components/files/file-kind-icon"
import { fileLabel, fileType, fileTypeOptions, fileUrls, formatBytes } from "@/components/files/file-kind"
import { relativeTime } from "@/lib/relative-time"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { DriveNotConnectedError, getStorageForWorkspace } from "@/lib/storage/storage"

type FilesView = "all" | "favorites" | "trash"
type Layout = "list" | "grid"
type Sort = "uploaded" | "modified" | "name" | "size"
const PER_PAGE = 20

type SearchParams = { error?: string; success?: string; view?: string; layout?: string; folder?: string; q?: string; type?: string; sort?: string; page?: string; share?: string; trash?: string; favorite?: string }

export default async function FilesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  // Old links used ?trash=true, ?favorite=true and ?view=grid|list|compact.
  if (params.trash !== undefined || params.favorite !== undefined || params.view === "grid" || params.view === "list" || params.view === "compact") {
    const next = new URLSearchParams()
    const legacyView = params.trash === "true" ? "trash" : params.favorite === "true" ? "favorites" : undefined
    const legacyLayout = params.view === "grid" ? "grid" : undefined
    for (const [key, value] of Object.entries({ ...params, trash: undefined, favorite: undefined, view: legacyView, layout: params.layout ?? legacyLayout })) {
      if (value && !(key === "folder" && value === "all") && !(key === "type" && value === "all")) next.set(key, value)
    }
    const query = next.toString()
    redirect("/files" + (query ? "?" + query : ""))
  }

  const view: FilesView = params.view === "favorites" || params.view === "trash" ? params.view : "all"
  const layout: Layout = params.layout === "grid" ? "grid" : "list"
  const sort: Sort = params.sort === "modified" || params.sort === "name" || params.sort === "size" ? params.sort : "uploaded"
  const query = (params.q ?? "").trim().toLowerCase().slice(0, 100)
  const folder = (params.folder ?? "").trim().slice(0, 80)
  const type = fileTypeOptions.some((option) => option.value === params.type && option.value !== "all") ? params.type ?? "" : ""
  const context = await getWorkspaceContext()
  if (!context) return null

  const [{ data: allFiles }, { data: workspaceSettings }] = await Promise.all([
    context.supabase.from("files").select("id,name,mime_type,size_bytes,storage_path,google_file_id,folder,is_favorite,trashed_at,created_at,updated_at").eq("workspace_id", context.workspaceId).order("created_at", { ascending: false }),
    context.supabase.from("workspace_settings").select("storage_limit_bytes").eq("workspace_id", context.workspaceId).maybeSingle(),
  ])
  const rows = allFiles ?? []
  const inView = (file: (typeof rows)[number], state: FilesView) => state === "trash" ? Boolean(file.trashed_at) : !file.trashed_at && (state === "all" || file.is_favorite)
  const counts = { all: rows.filter((file) => inView(file, "all")).length, favorites: rows.filter((file) => inView(file, "favorites")).length, trash: rows.filter((file) => inView(file, "trash")).length }
  const files = rows.filter((file) => inView(file, view) && (!folder || file.folder === folder) && (!query || [file.name, file.mime_type, file.folder].some((value) => value.toLowerCase().includes(query))) && (!type || fileType(file.mime_type) === type))
  files.sort((first, second) => sort === "name" ? first.name.localeCompare(second.name) : sort === "size" ? Number(second.size_bytes) - Number(first.size_bytes) : sort === "modified" ? new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime() : new Date(second.created_at).getTime() - new Date(first.created_at).getTime())
  const folders = Array.from(new Set(rows.map((file) => file.folder))).sort()

  const localStorageBytes = rows.filter((file) => !file.trashed_at).reduce((total, file) => total + Number(file.size_bytes ?? 0), 0)
  let storageUsage = { usedBytes: localStorageBytes, limitBytes: Number(workspaceSettings?.storage_limit_bytes ?? 107374182400) }
  let driveConnected = true
  try {
    const driveUsage = await getStorageForWorkspace(context.workspaceId).getUsage()
    storageUsage = { usedBytes: driveUsage.usedBytes, limitBytes: driveUsage.limitBytes ?? storageUsage.limitBytes }
  } catch (error) {
    if (error instanceof DriveNotConnectedError) driveConnected = false
    else console.error("Could not load Google Drive storage quota")
  }
  const storagePercent = storageUsage.limitBytes ? Math.min(100, (storageUsage.usedBytes / storageUsage.limitBytes) * 100) : 0

  const totalPages = Math.max(1, Math.ceil(files.length / PER_PAGE))
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1))
  const pageFiles = files.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const { data: versionRows } = pageFiles.length ? await context.supabase.from("file_versions").select("file_id").in("file_id", pageFiles.map((file) => file.id)) : { data: [] as Array<{ file_id: string }> }
  const versionCounts = new Map<string, number>()
  for (const version of versionRows ?? []) versionCounts.set(version.file_id, (versionCounts.get(version.file_id) ?? 0) + 1)
  const now = new Date()
  const items = pageFiles.map((file) => {
    const versions = versionCounts.get(file.id) ?? 0
    return {
      ...file,
      ...fileUrls(file),
      label: fileLabel(file.mime_type, file.name),
      meta: [fileLabel(file.mime_type, file.name), formatBytes(Number(file.size_bytes)), "uploaded " + relativeTime(file.created_at, now), ...(versions ? [versions + (versions === 1 ? " version" : " versions")] : [])].join(" · "),
      sideLabel: file.trashed_at ? "trashed " + relativeTime(file.trashed_at, now) : "updated " + relativeTime(file.updated_at, now),
    }
  })
  const filtered = Boolean(query || folder || type)

  const href = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams()
    const merged = { view: view === "all" ? undefined : view, q: query || undefined, folder: folder || undefined, type: type || undefined, sort: sort === "uploaded" ? undefined : sort, layout: layout === "list" ? undefined : layout, ...changes }
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value)
    const search = next.toString()
    return "/files" + (search ? "?" + search : "")
  }

  return (
    <div className="page-container">
      {params.error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
      {params.success && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{params.success}</p>}
      {params.share && /^[0-9a-f-]{36}$/i.test(params.share) && (
        <div role="status" className="issue-banner min-w-0">
          <span className="min-w-0">Share link ready. Anyone with this link can view the file until it expires:{" "}
            <a href={"/api/shared/files/" + params.share + "?inline=1"} target="_blank" rel="noopener noreferrer" className="break-all font-semibold underline">{"/api/shared/files/" + params.share + "?inline=1"}</a>
          </span>
        </div>
      )}

      <div className="issue-page-head">
        <h1 className="issue-title">Files</h1>
        {driveConnected
          ? <Link href="/files/upload" className="button-primary min-h-0 px-3.5 py-2">Upload file</Link>
          : <a href="/api/auth/google/login" className="button-secondary min-h-0 px-3.5 py-2">Connect Google Drive</a>}
      </div>
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--muted)]">
        <span><strong className="font-semibold text-[var(--foreground)]">{formatBytes(storageUsage.usedBytes)}</strong> used{storageUsage.limitBytes ? " of " + formatBytes(storageUsage.limitBytes) : " · workspace limit not set"}</span>
        {storageUsage.limitBytes > 0 && <span aria-hidden className="h-1.5 w-28 overflow-hidden rounded-full bg-[var(--surface-muted)]"><span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: storagePercent + "%" }} /></span>}
        {!driveConnected && <span>Google Drive is not connected, so uploads and downloads are paused.</span>}
      </div>

      <div className="issue-list-head">
        <nav aria-label="File views" className="issue-tabs">
          {([["all", "All"], ["favorites", "Favourites"], ["trash", "Trash"]] as const).map(([key, text]) => (
            <Link key={key} href={href({ view: key === "all" ? undefined : key, page: undefined })} aria-current={view === key ? "page" : undefined} className={"issue-tab" + (view === key ? " is-active" : "")}>
              {text}<span className="issue-tab-count">{counts[key]}</span>
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1 pb-1.5" role="group" aria-label="Layout">
          <Link href={href({ layout: undefined, page: undefined })} aria-label="List view" aria-current={layout === "list" ? "true" : undefined} className={(layout === "list" ? "button-secondary" : "button-quiet") + " min-h-0 px-2 py-1.5"}><List size={15} aria-hidden /></Link>
          <Link href={href({ layout: "grid", page: undefined })} aria-label="Grid view" aria-current={layout === "grid" ? "true" : undefined} className={(layout === "grid" ? "button-secondary" : "button-quiet") + " min-h-0 px-2 py-1.5"}><LayoutGrid size={15} aria-hidden /></Link>
        </div>
      </div>

      {/* Five controls instead of the notes' four, so the column template is overridden here. */}
      <form method="get" className="issue-filter grid-cols-2! lg:grid-cols-[minmax(0,1fr)_10rem_9rem_11rem_auto]!">
        {view !== "all" && <input type="hidden" name="view" value={view} />}
        {layout !== "list" && <input type="hidden" name="layout" value={layout} />}
        <label className="issue-search max-lg:col-span-2!">
          <Search size={15} aria-hidden />
          <span className="sr-only">Search files by name, folder or type</span>
          <input name="q" defaultValue={query} placeholder="Search files…" />
        </label>
        <Select name="folder" defaultValue={folder} placeholder="All folders" className="field-control issue-filter-select" options={[{ value: "", label: "All folders" }, ...folders.map((item) => ({ value: item, label: item }))]} />
        <Select name="type" defaultValue={type} placeholder="All types" className="field-control issue-filter-select" options={fileTypeOptions.map((option) => option.value === "all" ? { value: "", label: option.label } : option)} />
        <Select name="sort" defaultValue={sort} className="field-control issue-filter-select" options={[{ value: "uploaded", label: "Recently uploaded" }, { value: "modified", label: "Recently modified" }, { value: "name", label: "Name" }, { value: "size", label: "Size" }]} />
        <button className="issue-filter-apply button-secondary min-h-0 px-3.5 py-2">Apply</button>
      </form>

      {filtered && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          Showing {files.length} {files.length === 1 ? "file" : "files"}
          <Link href={href({ q: undefined, folder: undefined, type: undefined, page: undefined })} className="underline">Clear filters</Link>
        </p>
      )}

      {items.length === 0 ? (
        <div className="issue-empty">
          <h2>{filtered ? "No files match these filters" : view === "all" ? "No files yet" : view === "favorites" ? "No favourites yet" : "Trash is empty"}</h2>
          <p>{filtered ? "Try a different search, folder, or type." : view === "all" ? (driveConnected ? "Upload your first file to start building workspace storage." : "Connect Google Drive to start uploading workspace files.") : view === "favorites" ? "Star a file from its page to keep it here." : "Files you move to the trash will show up in this list."}</p>
          {!filtered && view === "all" && (driveConnected ? <Link href="/files/upload" className="button-primary mt-4">Upload file</Link> : <a href="/api/auth/google/login" className="button-primary mt-4">Connect Google Drive</a>)}
        </div>
      ) : layout === "grid" ? (
        <ul className="files-grid mt-4">
          {items.map((file) => (
            <li key={file.id} className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)]">
              <Link href={"/files/" + file.id} className="relative grid aspect-[16/10] w-full place-items-center bg-[var(--surface-muted)] text-[var(--muted)]" tabIndex={-1} aria-hidden>
                {file.imagePreviewUrl ? <Image src={file.imagePreviewUrl} alt="" fill sizes="(min-width: 768px) 45vw, 90vw" unoptimized className="object-cover" /> : <FileKindIcon mimeType={file.mime_type} name={file.name} size={36} />}
              </Link>
              <div className="flex min-w-0 items-start gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <Link href={"/files/" + file.id} className="issue-row-title block truncate" title={file.name}>{file.name}</Link>
                  <p className="issue-row-meta truncate">{file.meta}</p>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]"><Link href={href({ folder: file.folder, page: undefined })} className="hover:underline">{file.folder}</Link> · {file.sideLabel}</p>
                </div>
                {file.is_favorite && <Star size={14} fill="currentColor" className="mt-1 shrink-0 text-[var(--foreground)]" aria-label="Favourite" />}
                {file.downloadUrl && !file.trashed_at && <a href={file.downloadUrl} target="_blank" rel="noreferrer" aria-label={"Download " + file.name} className="button-quiet min-h-0 shrink-0 px-2 py-1.5"><Download size={14} aria-hidden /></a>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="issue-list">
          {items.map((file) => (
            <li key={file.id} className="issue-row">
              <FileKindIcon mimeType={file.mime_type} name={file.name} size={16} className="issue-row-icon" aria-hidden />
              <div className="min-w-0 flex-1">
                <Link href={"/files/" + file.id} className="issue-row-title">{file.name}</Link>
                <p className="issue-row-meta">{file.meta}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Link href={href({ folder: file.folder, page: undefined })} className="tag-chip max-w-full truncate" data-tone="sky">{file.folder}</Link>
                </div>
              </div>
              <div className="issue-row-side">
                {/* div + bare svg: the phone rule hides `.issue-row-side span:last-child` (the timestamp). */}
                <div className="flex items-center gap-1.5">
                  {file.is_favorite && <Star size={13} fill="currentColor" role="img" aria-label="Favourite" className="issue-pin" />}
                  {file.downloadUrl && !file.trashed_at && <a href={file.downloadUrl} target="_blank" rel="noreferrer" aria-label={"Download " + file.name} title="Download" className="button-quiet min-h-0 px-1.5 py-1"><Download size={14} aria-hidden /></a>}
                </div>
                <span>{file.sideLabel}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
          {page > 1 ? <Link href={href({ page: String(page - 1) })} className="button-secondary min-h-0 px-3 py-1.5">Previous</Link> : <span />}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages ? <Link href={href({ page: String(page + 1) })} className="button-secondary min-h-0 px-3 py-1.5">Next</Link> : <span />}
        </nav>
      )}
    </div>
  )
}
