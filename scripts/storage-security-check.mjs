import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { Readable } from "node:stream"
import vm from "node:vm"
import ts from "typescript"

function load(path, dependencies) {
  const source = readFileSync(new URL("../" + path, import.meta.url), "utf8")
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const exports = {}
  vm.runInNewContext(outputText, { exports, require: (name) => {
    assert.ok(name in dependencies, "Unexpected dependency: " + name)
    return dependencies[name]
  }, Buffer, console, process, Response, ReadableStream, Headers, URL, Uint8Array })
  return exports
}

let mediaReads = 0
let mutations = 0
let rootId = "root-folder"
const savedRoots = []
const folderQueries = []
const entries = {
  valid: { parents: ["nested"], mimeType: "image/png" },
  nested: { parents: ["workspace-folder"], mimeType: "application/vnd.google-apps.folder" },
  "workspace-folder": { parents: ["workspaces-folder"], mimeType: "application/vnd.google-apps.folder" },
  foreign: { parents: ["other-workspace"] },
  "other-workspace": { parents: ["workspaces-folder"] },
  "workspaces-folder": { parents: ["root-folder"] },
  "root-folder": { parents: [] },
  legacy: { parents: ["avatars"] },
  avatars: { parents: ["root-folder"] },
  cycle: { parents: ["cycle"] },
  shortcut: { parents: ["workspace-folder"], mimeType: "application/vnd.google-apps.shortcut" },
  trashed: { parents: ["workspace-folder"], trashed: true },
}
const drive = { files: {
  delete: async () => { mutations++ },
  update: async ({ fileId }) => { mutations++; return { data: { id: fileId } } },
  copy: async () => { mutations++; return { data: { id: "copied" } } },
  list: async ({ q }) => {
    folderQueries.push(q)
    if (q.includes("name = 'LifeHub'")) return { data: { files: [{ id: "root-folder" }] } }
    return { data: { files: q.includes("name = 'workspaces'") ? [{ id: "workspaces-folder" }] : [{ id: "workspace-folder" }] } }
  },
  get: async ({ fileId, alt }) => {
    if (alt === "media") { mediaReads++; return { data: Readable.from([Buffer.from("image")]) } }
    assert.ok(entries[fileId], "Unexpected file: " + fileId)
    return { data: { id: fileId, name: "image", ...entries[fileId] } }
  },
} }
const { googleDriveStorage } = load("src/lib/storage/google-drive.ts", {
  googleapis: { google: { drive: () => drive } },
  "node:stream": { Readable },
  "@/lib/google-drive-auth": {
    getWorkspaceDriveConnection: async () => ({ refresh_token: "test", root_folder_id: rootId }),
    saveWorkspaceDriveRoot: async (_workspaceId, folderId) => { savedRoots.push(folderId) },
    createGoogleOAuthClient: () => ({ setCredentials() {} }),
  },
})
const storage = googleDriveStorage("workspace")
await storage.ensureFolder(["avatars"])
assert.match(folderQueries[0], /name = 'workspaces'.*'root-folder' in parents/)
assert.match(folderQueries[1], /name = 'workspace'.*'workspaces-folder' in parents/)
assert.match(folderQueries[2], /name = 'avatars'.*'workspace-folder' in parents/)
await assert.rejects(() => storage.ensureFolder(["workspaces", "foreign"]))
await storage.download("valid")
assert.equal(mediaReads, 1)
for (const fileId of ["foreign", "legacy", "cycle", "shortcut", "trashed", "invalid/id"]) {
  await assert.rejects(() => storage.download(fileId))
}
// A reconnect leaves root_folder_id empty: reads find the LifeHub folder again (and save it) instead of
// failing, and the workspace-folder check still applies.
rootId = null
await storage.download("valid")
assert.equal(mediaReads, 2)
assert.deepEqual(savedRoots.slice(-1), ["root-folder"])
for (const fileId of ["foreign", "legacy", "cycle"]) await assert.rejects(() => storage.download(fileId))
assert.equal(mediaReads, 2, "Denied files must never fetch media")
assert.equal("makePublic" in storage, false)
rootId = "root-folder"
for (const fileId of ["foreign", "legacy", "cycle", "shortcut", "trashed", "invalid/id", "workspace-folder"]) {
  await assert.rejects(() => storage.delete(fileId))
  await assert.rejects(() => storage.rename(fileId, "renamed"))
  await assert.rejects(() => storage.move(fileId, "nested"))
  await assert.rejects(() => storage.copy(fileId, "nested"))
}
for (const parentId of ["foreign", "root-folder", "shortcut", "trashed", "invalid/id", "valid"]) {
  await assert.rejects(() => storage.move("valid", parentId))
  await assert.rejects(() => storage.copy("valid", parentId))
}
assert.equal(mutations, 0, "Forged source/destination references must never mutate Drive")
await storage.delete("valid")
await storage.rename("valid", "renamed")
await storage.move("valid", "nested")
await storage.copy("valid", "workspace-folder")
assert.equal(mutations, 4)

const settingsSource = readFileSync(new URL("../src/app/(dashboard)/settings/actions.ts", import.meta.url), "utf8")
const avatarUpload = settingsSource.slice(settingsSource.indexOf("export async function uploadProfileAvatar"), settingsSource.indexOf("export async function deleteWorkspace"))
assert.doesNotMatch(avatarUpload, /existingProfile|\.select\(/, "Avatar replacement must not trust old profile references")
assert.doesNotMatch(avatarUpload, /\.delete\(/, "Replacing a photo must not delete files named by profile columns")
assert.match(avatarUpload, /sniffAvatarType\(bytes\)/, "The photo's bytes decide its type")
assert.match(avatarUpload, /saveAvatar\(context\.user\.id, bytes, type\)/, "Photos are stored under the caller's own id")

const { storageResponseHeaders } = load("src/lib/storage/storage.ts", { "./google-drive": { googleDriveStorage: () => storage }, "next/cache": { unstable_cache: (fn) => fn } })
for (const mimeType of ["text/html", "image/svg+xml", "application/pdf", "text/plain", "image/png; charset=utf-8"]) {
  const headers = storageResponseHeaders({ name: "untrusted'\r\n.svg", mimeType }, true)
  assert.match(headers["Content-Disposition"], /^attachment;/)
  assert.equal(headers["Content-Type"], "application/octet-stream")
  assert.equal(headers["X-Content-Type-Options"], "nosniff")
  assert.equal(headers["Content-Security-Policy"], "sandbox; default-src 'none'")
  assert.equal(/[\r\n]/.test(headers["Content-Disposition"]), false)
}
for (const mimeType of ["image/png", "image/jpeg", "image/gif", "image/webp"]) {
  assert.match(storageResponseHeaders({ name: "image", mimeType }, true)["Content-Disposition"], /^inline;/)
  assert.match(storageResponseHeaders({ name: "image", mimeType })["Content-Disposition"], /^attachment;/)
}

// Profile photo route: Storage first, legacy Drive photos moved on read, teammates only.
const { z } = await import("zod")
let profileRow = null
let isMember = true
let targetMemberships = []
const storedAvatars = new Map()
const avatarCalls = { reads: 0, saves: [], updates: 0, downloads: 0 }
function table(name) {
  const filters = {}
  const builder = {
    select: () => builder,
    eq: (column, value) => { filters[column] = value; return builder },
    update: () => { avatarCalls.updates++; return builder },
    maybeSingle: async () => ({ data: name === "workspace_members" ? (isMember ? { user_id: filters.user_id } : null) : profileRow }),
    then: (resolve) => resolve({ data: name === "workspace_members" ? targetMemberships : null, error: null }),
  }
  return builder
}
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])
const me = "11111111-1111-4111-8111-111111111111"
const mate = "22222222-2222-4222-8222-222222222222"
const avatar = load("src/app/api/profile/avatar/route.ts", {
  "node:stream": { Readable },
  "next/server": { NextResponse: Response },
  zod: { z },
  "@/lib/supabase/admin": { createAdminClient: () => ({ from: table }) },
  "@/lib/workspace/server": { getWorkspaceContext: async () => ({ user: { id: me }, workspaceId: "workspace", memberships: [{ workspace_id: "workspace" }] }) },
  "@/lib/avatar-storage": {
    AVATAR_MARKER: "storage:avatar",
    readAvatar: async (userId) => { avatarCalls.reads++; return storedAvatars.has(userId) ? { bytes: storedAvatars.get(userId), type: "image/png" } : null },
    saveAvatar: async (userId, bytes) => { avatarCalls.saves.push(userId); storedAvatars.set(userId, bytes) },
    sniffAvatarType: (bytes) => (bytes[0] === 0x89 ? "image/png" : null),
  },
  "@/lib/storage/storage": { storageResponseHeaders, getStorageForWorkspace: (workspaceId) => ({ download: async () => {
    avatarCalls.downloads++
    if (!targetMemberships.some((membership) => membership.workspace_id === workspaceId)) throw new Error("not this workspace")
    return { body: Readable.from([png]), name: "avatar", mimeType: "image/png" }
  } }) },
})
const getAvatar = (query) => avatar.GET({ nextUrl: new URL("https://lifehub.test/api/profile/avatar" + query) })

profileRow = { avatar_url: "storage:avatar", avatar_google_file_id: null, avatar_workspace_id: null }
storedAvatars.set(me, png)
const ownPhoto = await getAvatar("?v=1")
assert.equal(ownPhoto.status, 200)
assert.match(ownPhoto.headers.get("Cache-Control"), /^private, max-age=86400/, "Versioned photos are cached privately")
assert.equal((await getAvatar("")).headers.get("Cache-Control"), "private, no-store", "Unversioned photos are not cached")

isMember = false
const readsBefore = avatarCalls.reads
assert.equal((await getAvatar("?user=" + mate)).status, 404, "Non-members get nothing")
assert.equal(avatarCalls.reads, readsBefore, "Non-members must not trigger a read")
assert.equal((await getAvatar("?user=not-a-uuid")).status, 404)

isMember = true
profileRow = { avatar_url: "google-drive:x", avatar_google_file_id: "drive-file", avatar_workspace_id: "workspace" }
targetMemberships = [{ workspace_id: "workspace" }]
assert.equal((await getAvatar("?user=" + mate + "&v=2")).status, 200)
assert.deepEqual(avatarCalls.saves, [mate], "A legacy Drive photo is moved to Storage under its owner's id")
assert.equal(avatarCalls.updates, 1)

profileRow = { avatar_url: "google-drive:x", avatar_google_file_id: "drive-file", avatar_workspace_id: "elsewhere" }
const downloadsBefore = avatarCalls.downloads
assert.equal((await getAvatar("?user=" + mate)).status, 404, "Only the workspace the photo belongs to is searched")
assert.equal(avatarCalls.downloads, downloadsBefore)

for (const route of ["files/[id]/download", "file-versions/[id]/download", "shared/files/[token]", "images/[fileId]"]) {
  const source = readFileSync(new URL("../src/app/api/" + route + "/route.ts", import.meta.url), "utf8")
  assert.match(source, /storageResponseHeaders\(/)
  assert.match(source, /\.download\(/)
}
assert.doesNotMatch(readFileSync(new URL("../src/app/api/notes/upload-image/route.ts", import.meta.url), "utf8"), /makePublic/)
console.log("Storage security checks passed")
