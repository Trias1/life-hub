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
