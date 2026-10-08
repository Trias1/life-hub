import { File, FileArchive, FileAudio, FileCode, FileImage, FileSpreadsheet, FileText, FileVideo, Presentation, type LucideIcon } from "lucide-react"

export type FileTypeFilter = "image" | "pdf" | "video" | "audio" | "zip" | "document"

export const fileTypeOptions: Array<{ value: "all" | FileTypeFilter; label: string }> = [
  { value: "all", label: "All types" },
  { value: "image", label: "Images" },
  { value: "pdf", label: "PDF" },
  { value: "document", label: "Documents" },
  { value: "zip", label: "ZIP" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
]

/** Accepted by the upload input; the server action keeps the authoritative MIME allow-list. */
export const UPLOAD_ACCEPT = "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,video/*,audio/*"
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024

export function formatBytes(value: number) {
  if (value < 1024) return value + " B"
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB"
  if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + " MB"
  return (value / (1024 * 1024 * 1024)).toFixed(1) + " GB"
}

export function fileType(mime: string): FileTypeFilter {
  if (mime.startsWith("image/")) return "image"
  if (mime === "application/pdf") return "pdf"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  if (mime.includes("zip") || mime.includes("compressed")) return "zip"
  return "document"
}

/** Short badge such as "PDF", "DOCX" or "IMG". */
export function fileLabel(mime: string, name: string) {
  const extension = name.includes(".") ? name.split(".").pop()?.trim().toUpperCase() : undefined
  if (extension && extension.length <= 5) return extension
  if (mime === "application/pdf") return "PDF"
  if (mime.includes("word")) return "DOC"
  if (mime.includes("excel") || mime.includes("spreadsheet")) return "XLS"
  if (mime.includes("powerpoint") || mime.includes("presentation")) return "PPT"
  if (mime.includes("zip") || mime.includes("compressed")) return "ZIP"
  if (mime.startsWith("image/")) return "IMG"
  if (mime.startsWith("video/")) return "VID"
  if (mime.startsWith("audio/")) return "AUD"
  if (mime.startsWith("text/")) return "TXT"
  return "FILE"
}

const codeExtensions = [".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cpp", ".go", ".rs", ".php", ".json", ".html", ".css", ".sql"]

export function fileIcon(mime: string, name: string): LucideIcon {
  const lower = name.toLowerCase()
  if (mime.startsWith("image/")) return FileImage
  if (mime.startsWith("video/")) return FileVideo
  if (mime.startsWith("audio/")) return FileAudio
  if (mime.includes("zip") || mime.includes("compressed") || mime.includes("archive") || [".zip", ".rar", ".tar", ".gz", ".7z"].some((extension) => lower.endsWith(extension))) return FileArchive
  if (mime.includes("excel") || mime.includes("spreadsheet") || lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".csv")) return FileSpreadsheet
  if (mime.includes("powerpoint") || mime.includes("presentation") || lower.endsWith(".ppt") || lower.endsWith(".pptx")) return Presentation
  if (codeExtensions.some((extension) => lower.endsWith(extension))) return FileCode
  if (mime === "application/pdf" || mime.includes("word") || mime.startsWith("text/")) return FileText
  return File
}

/** Download and inline-preview routes. Only raster images are served inline by the download route. */
export function fileUrls(file: { id: string; mime_type: string; google_file_id: string | null }) {
  const downloadUrl = file.google_file_id ? "/api/files/" + file.id + "/download" : null
  const imagePreviewUrl = file.google_file_id && /^image\/(jpeg|png|gif|webp)$/.test(file.mime_type) ? "/api/files/" + file.id + "/download?inline=1" : null
  return { downloadUrl, imagePreviewUrl }
}
