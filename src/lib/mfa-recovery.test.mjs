import assert from "node:assert/strict"
import test from "node:test"
import { hashRecoveryCode, newRecoveryCode, normalizeRecoveryCode } from "./mfa-recovery.mjs"

test("codes are 16 unambiguous characters in groups of four, and unique", () => {
  const codes = Array.from({ length: 200 }, newRecoveryCode)
  for (const code of codes) assert.match(code, /^[A-HJKMNP-Z2-9]{4}(-[A-HJKMNP-Z2-9]{4}){3}$/)
  assert.equal(new Set(codes).size, codes.length)
})

test("typing a code with spaces, dashes or lower case still matches", () => {
  assert.equal(normalizeRecoveryCode(" k7qm 2xpa-9rtb-wn4d "), "K7QM2XPA9RTBWN4D")
  assert.equal(normalizeRecoveryCode("123456"), null)
  assert.equal(normalizeRecoveryCode(null), null)
})

test("hashes are per user, so the same code under another account doesn't match", () => {
  const code = "K7QM2XPA9RTBWN4D"
  assert.match(hashRecoveryCode("user-a", code), /^[0-9a-f]{64}$/)
  assert.notEqual(hashRecoveryCode("user-a", code), hashRecoveryCode("user-b", code))
})
