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

export function getStorageForWorkspace(workspaceId: string): StorageService {
  return googleDriveStorage(workspaceId)
}

export const storage: StorageService = googleDriveStorage()
