import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const settingsActions = readFileSync(new URL("../settings/actions.ts", import.meta.url), "utf8")
const profilePage = readFileSync(new URL("./page.tsx", import.meta.url), "utf8")
const spaces = readFileSync(new URL("../_actions/spaces.ts", import.meta.url), "utf8")

test("profile bio and space descriptions are encrypted at rest", () => {
  assert.match(settingsActions, /bio: encryptField\(FIELD\.PROFILE_BIO, input\.data\.bio\)/)
  assert.match(profilePage, /decryptField\(FIELD\.PROFILE_BIO, profile\.bio\)/)
  assert.equal((spaces.match(/description: encryptField\(FIELD\.SPACE_DESCRIPTION, input\.data\.description\)/g) ?? []).length, 2)
  assert.doesNotMatch(spaces, /\.\.\.input\.data/)
})

test("profile photos live in Storage per account, not in a workspace's Drive", () => {
  const settingsActions = readFileSync(new URL("../settings/actions.ts", import.meta.url), "utf8")
  const avatarRoute = readFileSync(new URL("../../api/profile/avatar/route.ts", import.meta.url), "utf8")
  const avatarStorage = readFileSync(new URL("../../../lib/avatar-storage.ts", import.meta.url), "utf8")
  const upload = settingsActions.slice(settingsActions.indexOf("export async function uploadProfileAvatar"))
  // Upload checks the file's bytes and clears the Drive reference.
  assert.match(upload, /const type = sniffAvatarType\(bytes\)/)
  assert.match(upload, /saveAvatar\(context\.user\.id, bytes, type\)/)
  assert.match(upload, /avatar_url: AVATAR_MARKER, avatar_google_file_id: null, avatar_workspace_id: null/)
  // The storage path comes from the user id only, never from a profile column the owner can edit.
  assert.match(avatarStorage, /const pathFor = \(userId: string\) => userId \+ "\/avatar"/)
  assert.doesNotMatch(avatarStorage, /avatar_url\)\s*\.|download\(profile/)
  // Someone else's photo is only served to members of the viewer's active workspace.
  assert.match(avatarRoute, /if \(userId !== context\.user\.id\) \{[\s\S]*?eq\("workspace_id", context\.workspaceId\)\.eq\("user_id", userId\)[\s\S]*?status: 404/)
})
