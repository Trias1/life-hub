import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8")
const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8")
const layout = readFileSync(new URL("../layout.tsx", import.meta.url), "utf8")

test("notification views are isolated to the active workspace", () => {
  assert.match(page, /eq\("workspace_id", context\.workspaceId\)/)
  assert.match(layout, /from\("notifications"\)\s*\.select\([^)]*\)\s*\.eq\("workspace_id", context\.workspaceId\)/)
})

test("notification mutations require recipient and workspace", () => {
  assert.ok((actions.match(/eq\("workspace_id", context\.workspaceId\)/g) ?? []).length >= 6)
  assert.ok((actions.match(/eq\("recipient_id", context\.user\.id\)/g) ?? []).length >= 6)
})
