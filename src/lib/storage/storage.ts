import { unstable_cache } from "next/cache"
import type { Readable } from "node:stream"

export type StorageUploadInput = {
  name: string
  mimeType: string
  body: Buffer
  sizeBytes: number
  parentId: string
}

export type StoredObject = {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  webViewLink?: string | null
}

export type StorageDownload = {
  body: Readable
  name: string
  mimeType: string
  sizeBytes?: number
}

export type StorageUsage = {
  usedBytes: number
  limitBytes: number | null
}

export interface StorageService {
  ensureFolder(path: string[]): Promise<string>
  getUsage(): Promise<StorageUsage>
  upload(input: StorageUploadInput): Promise<StoredObject>
  download(fileId: string): Promise<StorageDownload>
  delete(fileId: string): Promise<void>
  rename(fileId: string, name: string): Promise<StoredObject>
  move(fileId: string, parentId: string): Promise<StoredObject>
  copy(fileId: string, parentId: string, name?: string): Promise<StoredObject>
  createFolder(name: string, parentId?: string): Promise<StoredObject>
  list(parentId?: string): Promise<StoredObject[]>
  get(fileId: string): Promise<StoredObject>
}

import { googleDriveStorage } from "./google-drive"

export { DriveNotConnectedError } from "./google-drive"

// Quota calls Google on every page view otherwise. Errors are not cached, so a disconnect still shows up.
export const getCachedDriveUsage = unstable_cache(
  async (workspaceId: string) => googleDriveStorage(workspaceId).getUsage(),
  ["drive-usage"],
  { revalidate: 300 },
)

export function getStorageForWorkspace(workspaceId: string): StorageService {
  return googleDriveStorage(workspaceId)
}

export const storage: StorageService = googleDriveStorage()

export function storageResponseHeaders(download: Pick<StorageDownload, "name" | "mimeType">, inline = false) {
  const raster = /^image\/(jpeg|png|gif|webp)$/.test(download.mimeType)
  return {
    "Content-Type": raster ? download.mimeType : "application/octet-stream",
    "Content-Disposition": (inline && raster ? "inline" : "attachment") + "; filename*=UTF-8''" + encodeURIComponent(download.name).replace(/['()*]/g, (character) => "%" + character.charCodeAt(0).toString(16)),
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  }
}
