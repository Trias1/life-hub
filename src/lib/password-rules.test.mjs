import assert from "node:assert/strict"
import test from "node:test"
import { friendlyPasswordError, passwordProblem } from "./password-rules.mjs"

test("new passwords need 10+ characters with letters and numbers", () => {
  assert.match(passwordProblem("abc12345"), /at least 10/)
  assert.match(passwordProblem("abcdefghijk"), /letters and numbers/)
  assert.match(passwordProblem("12345678901"), /letters and numbers/)
  assert.equal(passwordProblem("blue-house-42"), null)
  assert.match(passwordProblem("a1".repeat(65)), /at most 128/)
})

test("Supabase password errors read like the form's own", () => {
  assert.match(friendlyPasswordError("Password should be at least 10 characters."), /at least 10/)
  assert.match(friendlyPasswordError("Password is known to be weak and easy to guess"), /at least 10/)
  assert.match(friendlyPasswordError("Password update requires reauthentication."), /sign in again/)
  assert.equal(friendlyPasswordError("Something else"), null)
})
