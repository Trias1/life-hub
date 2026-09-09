import { google } from "googleapis"
import { Readable } from "node:stream"
import { createGoogleOAuthClient, getWorkspaceDriveConnection, saveWorkspaceDriveRoot, GOOGLE_DRIVE_SCOPE } from "@/lib/google-drive-auth"
import type { StorageDownload, StorageService, StorageUploadInput, StorageUsage, StoredObject } from "./storage"

const FOLDER_MIME = "application/vnd.google-apps.folder"

type DriveFile = { id?: string | null; name?: string | null; mimeType?: string | null; size?: string | null; webViewLink?: string | null }
type Drive = ReturnType<typeof google.drive>

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error("Missing required storage configuration: " + name)
  return value
}

function escapeQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
}

function logDriveError(operation: string, error: unknown) {
  const value = error as { message?: string; stack?: string; errors?: unknown; response?: { status?: number; data?: unknown } }
  console.error("[google-drive] " + operation, { message: value.message, stack: value.stack, status: value.response?.status, responseData: value.response?.data, errors: value.errors })
}

function serviceAccountClient() {
  const auth = new google.auth.JWT({ email: required("GOOGLE_DRIVE_CLIENT_EMAIL"), key: required("GOOGLE_DRIVE_PRIVATE_KEY").replace(/\\\\n/g, "\\n"), scopes: [GOOGLE_DRIVE_SCOPE] })
  return google.drive({ version: "v3", auth })
}

async function workspaceClient(workspaceId: string) {
  const connection = await getWorkspaceDriveConnection(workspaceId)
  if (!connection?.refresh_token) throw new Error("Google Drive is not connected for this workspace. Open Settings > Integrations first.")
  const auth = createGoogleOAuthClient()
  auth.setCredentials({ refresh_token: connection.refresh_token })
  return { drive: google.drive({ version: "v3", auth }), connection }
}

function objectFromFile(file: DriveFile): StoredObject {
  if (!file.id) throw new Error("Google Drive did not return a file id")
  return { id: file.id, name: file.name ?? "Untitled", mimeType: file.mimeType ?? "application/octet-stream", sizeBytes: Number(file.size ?? 0), webViewLink: file.webViewLink }
}

async function findFolder(drive: Drive, name: string, parentId?: string) {
  const parents = parentId ? " and '" + escapeQuery(parentId) + "' in parents" : " and 'root' in parents"
  const response = await drive.files.list({ q: "name = '" + escapeQuery(name) + "' and mimeType = '" + FOLDER_MIME + "' and trashed = false" + parents, fields: "files(id,name,mimeType,size,webViewLink)", pageSize: 1, spaces: "drive", includeItemsFromAllDrives: true, supportsAllDrives: true })
  return response.data.files?.[0]
}

async function createFolderWithDrive(drive: Drive, name: string, parentId?: string) {
  console.log("[google-drive] create folder", { name, parentId: parentId ?? null })
  try {
    const response = await drive.files.create({ requestBody: { name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }, fields: "id,name,mimeType,size,webViewLink,parents,driveId", supportsAllDrives: true })
    console.log("[google-drive] create folder response", response.data)
    return objectFromFile(response.data)
  } catch (error) {
    logDriveError("create folder failed", error)
    throw error
  }
}

export function googleDriveStorage(workspaceId?: string): StorageService {
  async function driveForRequest() {
    return workspaceId ? workspaceClient(workspaceId) : { drive: serviceAccountClient(), connection: null }
  }

  async function rootFolder(drive: Drive, connection: Awaited<ReturnType<typeof workspaceClient>>["connection"] | null) {
    if (!workspaceId && process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID) return process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    if (connection?.root_folder_id) return connection.root_folder_id
    const existing = await findFolder(drive, "LifeHub")
    const rootId = existing?.id ?? (await createFolderWithDrive(drive, "LifeHub")).id
    if (!rootId) throw new Error("Could not create the LifeHub Google Drive folder")
    if (workspaceId) await saveWorkspaceDriveRoot(workspaceId, rootId)
    return rootId
  }

  async function ensureFolder(pathParts: string[]) {
    const { drive, connection } = await driveForRequest()
    let parentId = await rootFolder(drive, connection)
    for (const part of pathParts) {
      const existing = await findFolder(drive, part, parentId)
      parentId = existing?.id ?? (await createFolderWithDrive(drive, part, parentId)).id
    }
    return parentId
  }

  async function get(fileId: string) {
    const { drive } = await driveForRequest()
    const response = await drive.files.get({ fileId, fields: "id,name,mimeType,size,webViewLink", supportsAllDrives: true })
    return objectFromFile(response.data)
  }

  async function getUsage(): Promise<StorageUsage> {
    const { drive } = await driveForRequest()
    const response = await drive.about.get({ fields: "storageQuota" })
    const quota = response.data.storageQuota
    return {
      usedBytes: Number(quota?.usage ?? quota?.usageInDrive ?? 0),
      limitBytes: quota?.limit ? Number(quota.limit) : null,
    }
  }

  async function upload(input: StorageUploadInput) {
    const body = Buffer.isBuffer(input.body) ? input.body : Buffer.from(input.body)
    if (body.byteLength === 0) throw new Error("Cannot upload an empty file")
    const stream = Readable.from([body])
    console.log("[google-drive] upload input", { name: input.name, mimeType: input.mimeType, sizeBytes: input.sizeBytes, bufferBytes: body.byteLength, parentId: input.parentId, streamReadable: stream instanceof Readable })
    try {
      const { drive } = await driveForRequest()
      const response = await drive.files.create({ requestBody: { name: input.name, mimeType: input.mimeType, parents: [input.parentId] }, media: { mimeType: input.mimeType, body: stream }, fields: "id,name,mimeType,size,webViewLink,parents,driveId", supportsAllDrives: true })
      console.log("[google-drive] upload response", response.data)
      return objectFromFile({ ...response.data, size: response.data.size ?? String(input.sizeBytes) })
    } catch (error) {
      logDriveError("upload failed", error)
      throw error
    }
  }

  async function download(fileId: string): Promise<StorageDownload> {
    const { drive } = await driveForRequest()
    const metadata = await drive.files.get({ fileId, fields: "id,name,mimeType,size", supportsAllDrives: true })
    const response = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "stream" })
    return { body: response.data as Readable, name: metadata.data.name ?? "download", mimeType: metadata.data.mimeType ?? "application/octet-stream", sizeBytes: Number(metadata.data.size ?? 0) }
  }

  async function remove(fileId: string) {
    const { drive } = await driveForRequest()
    try {
      await drive.files.delete({ fileId, supportsAllDrives: true })
    } catch (error) {
      const status = (error as { response?: { status?: number }; code?: number }).response?.status ?? (error as { code?: number }).code
      if (status === 404) return
      throw error
    }
  }

  async function rename(fileId: string, name: string) {
    const { drive } = await driveForRequest()
    const response = await drive.files.update({ fileId, requestBody: { name }, fields: "id,name,mimeType,size,webViewLink", supportsAllDrives: true })
    return objectFromFile(response.data)
  }

  async function move(fileId: string, parentId: string) {
    const { drive } = await driveForRequest()
    const current = await drive.files.get({ fileId, fields: "parents", supportsAllDrives: true })
    const response = await drive.files.update({ fileId, addParents: parentId, removeParents: (current.data.parents ?? []).join(","), fields: "id,name,mimeType,size,webViewLink", supportsAllDrives: true })
    return objectFromFile(response.data)
  }

  async function copy(fileId: string, parentId: string, name?: string) {
    const { drive } = await driveForRequest()
    const response = await drive.files.copy({ fileId, requestBody: { ...(name ? { name } : {}), parents: [parentId] }, fields: "id,name,mimeType,size,webViewLink", supportsAllDrives: true })
    return objectFromFile(response.data)
  }

  async function createFolder(name: string, parentId?: string) {
    const { drive, connection } = await driveForRequest()
    return createFolderWithDrive(drive, name, parentId ?? await rootFolder(drive, connection))
  }

  async function list(parentId?: string) {
    const { drive } = await driveForRequest()
    const response = await drive.files.list({ q: (parentId ? "'" + escapeQuery(parentId) + "' in parents" : "'root' in parents") + " and trashed = false", fields: "files(id,name,mimeType,size,webViewLink)", orderBy: "name", spaces: "drive", includeItemsFromAllDrives: true, supportsAllDrives: true })
    return (response.data.files ?? []).map(objectFromFile)
  }

  return { ensureFolder, getUsage, upload, download, delete: remove, rename, move, copy, createFolder, list, get }
}

export const legacyGoogleDriveStorage = googleDriveStorage()
