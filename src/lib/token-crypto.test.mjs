import assert from "node:assert/strict"
import test from "node:test"
import { decryptToken, decryptTokenWithKeys, encryptToken } from "./token-crypto.mjs"

test("tokens round-trip and fail under the wrong key", () => {
  const stored = encryptToken("refresh-token", "key-a")
  assert.equal(decryptToken(stored, "key-a"), "refresh-token")
  assert.throws(() => decryptToken(stored, "key-b"))
})

test("changing the key keeps old tokens readable and flags them for re-encryption", () => {
  const old = encryptToken("refresh-token", "supabase-secret")
  assert.deepEqual(decryptTokenWithKeys(old, ["dedicated-key", "supabase-secret"]), { token: "refresh-token", keyIndex: 1 })
  const current = encryptToken("refresh-token", "dedicated-key")
  assert.deepEqual(decryptTokenWithKeys(current, ["dedicated-key", "supabase-secret"]), { token: "refresh-token", keyIndex: 0 })
  assert.deepEqual(decryptTokenWithKeys("legacy-plain", ["dedicated-key"]), { token: "legacy-plain", keyIndex: -1 })
  assert.throws(() => decryptTokenWithKeys(old, ["unrelated-key"]))
})
