import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8")

test("landing page points to the source, sign in and self-hosting", () => {
  assert.match(page, /const repo = "https:\/\/github\.com\/Trias1\/life-hub"/)
  assert.match(page, /href=\{repo\}/)
  assert.match(page, /href="\/login"/)
  assert.match(page, /git clone \$\{repo\}/)
  assert.match(page, /supabase db push/)
  assert.match(page, /MIT/)
})

test("landing page uses the app's own theme instead of decorative effects", () => {
  for (const pattern of [/gradient/, /blur-3xl/, /backdrop-blur/, /Sparkles/, /#070707/, /rounded-full px-/]) {
    assert.doesNotMatch(page, pattern)
  }
  assert.match(page, /issue-row/)
})
