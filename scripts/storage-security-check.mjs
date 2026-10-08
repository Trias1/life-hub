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
  }, Buffer, console, process, Response, ReadableStream })
  return exports
}

let mediaReads = 0
let mutations = 0
let rootId = "root-folder"
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
rootId = null
await assert.rejects(() => storage.download("valid"))
assert.equal(mediaReads, 1, "Denied files must never fetch media")
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
assert.equal((avatarUpload.match(/\.delete\(/g) ?? []).length, 1)
assert.match(avatarUpload, /storage\.delete\(uploaded\.id\)/, "Only newly uploaded avatar rollback is allowed")

const { storageResponseHeaders } = load("src/lib/storage/storage.ts", { "./google-drive": { googleDriveStorage: () => storage } })
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

let avatarWorkspace = "foreign-workspace"
let avatarDownloads = 0
const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { avatar_google_file_id: "valid", avatar_workspace_id: avatarWorkspace } }) }
const avatar = load("src/app/api/profile/avatar/route.ts", {
  "node:stream": { Readable },
  "next/server": { NextResponse: Response },
  "@/lib/workspace/server": { getWorkspaceContext: async () => ({ user: { id: "user" }, memberships: [{ workspace_id: "workspace" }], supabase: { from: () => query } }) },
  "@/lib/storage/storage": { storageResponseHeaders, getStorageForWorkspace: (workspaceId) => {
    assert.equal(workspaceId, "workspace")
    return { download: async () => { avatarDownloads++; return { body: Readable.from([Buffer.from("image")]), name: "image", mimeType: "image/png" } } }
  } },
})
assert.equal((await avatar.GET()).status, 404)
assert.equal(avatarDownloads, 0)
avatarWorkspace = "workspace"
assert.equal((await avatar.GET()).status, 200)
assert.equal(avatarDownloads, 1)

for (const route of ["files/[id]/download", "file-versions/[id]/download", "shared/files/[token]", "images/[fileId]"]) {
  const source = readFileSync(new URL("../src/app/api/" + route + "/route.ts", import.meta.url), "utf8")
  assert.match(source, /storageResponseHeaders\(/)
  assert.match(source, /\.download\(/)
}
assert.doesNotMatch(readFileSync(new URL("../src/app/api/notes/upload-image/route.ts", import.meta.url), "utf8"), /makePublic/)
console.log("Storage security checks passed")
