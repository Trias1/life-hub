import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import test from "node:test"
import { DataCryptoError, FIELD, decryptField, decryptForExport, encryptField, isEncrypted } from "./data-crypto.mjs"

const keyA = randomBytes(32).toString("base64")
const keyB = randomBytes(32).toString("base64")
function env(values) {
  for (const name of ["DATA_ENCRYPTION_KEY", "DATA_ENCRYPTION_KEY_PREVIOUS", "DATA_ENCRYPTION_WRITE"]) delete process.env[name]
  Object.assign(process.env, values)
}

test("round-trips text, including empty, multi-byte and HTML", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  for (const text of ["", "Halo dunia", "Kopi ☕ 🚀 — ünïcödé", "<p>a &amp; b</p>"]) {
    const stored = encryptField(FIELD.NOTE_CONTENT, text)
    assert.ok(stored.startsWith("enc:1:"))
    assert.notEqual(stored, text)
    assert.equal(decryptField(FIELD.NOTE_CONTENT, stored), text)
  }
})

test("each encryption uses a fresh IV", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  assert.notEqual(encryptField(FIELD.PROFILE_BIO, "same"), encryptField(FIELD.PROFILE_BIO, "same"))
})

test("legacy plaintext and empty values pass through", () => {
  env({ DATA_ENCRYPTION_KEY: keyA })
  assert.equal(decryptField(FIELD.NOTE_CONTENT, "plain old note"), "plain old note")
  assert.equal(decryptField(FIELD.NOTE_CONTENT, null), "")
  assert.equal(decryptField(FIELD.NOTE_CONTENT, undefined), "")
})

test("writes stay plaintext when the switch is off, but encrypted values still read", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  const stored = encryptField(FIELD.TASK_DESCRIPTION, "secret")
  env({ DATA_ENCRYPTION_KEY: keyA })
  assert.equal(encryptField(FIELD.TASK_DESCRIPTION, "new text"), "new text")
  assert.equal(decryptField(FIELD.TASK_DESCRIPTION, stored), "secret")
})

test("rejects tampering in iv, tag or ciphertext", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  const parts = encryptField(FIELD.NOTE_CONTENT, "do not touch").split(":")
  for (const index of [3, 4, 5]) {
    const copy = [...parts]
    const bytes = Buffer.from(copy[index], "base64url")
    bytes[0] ^= 1
    copy[index] = bytes.toString("base64url")
    assert.throws(() => decryptField(FIELD.NOTE_CONTENT, copy.join(":")), DataCryptoError)
  }
})

test("a value cannot be decrypted as another field family", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  const stored = encryptField(FIELD.PROFILE_BIO, "bio")
  assert.throws(() => decryptField(FIELD.NOTE_CONTENT, stored), DataCryptoError)
})

test("rotation: previous key still decrypts, unknown key id is rejected", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  const oldValue = encryptField(FIELD.NOTE_CONTENT, "old")
  env({ DATA_ENCRYPTION_KEY: keyB, DATA_ENCRYPTION_KEY_PREVIOUS: keyA })
  assert.equal(decryptField(FIELD.NOTE_CONTENT, oldValue), "old")
  env({ DATA_ENCRYPTION_KEY: keyB })
  assert.throws(() => decryptField(FIELD.NOTE_CONTENT, oldValue), DataCryptoError)
})

test("missing or malformed key fails without leaking the value", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  const stored = encryptField(FIELD.NOTE_CONTENT, "top secret")
  env({})
  assert.throws(() => decryptField(FIELD.NOTE_CONTENT, stored), (error) => error instanceof DataCryptoError && !error.message.includes("top secret"))
  env({ DATA_ENCRYPTION_KEY: "c2hvcnQ=", DATA_ENCRYPTION_WRITE: "on" })
  assert.throws(() => encryptField(FIELD.NOTE_CONTENT, "x"), DataCryptoError)
})

test("unknown field family is rejected", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  assert.throws(() => encryptField("nope.field", "x"), DataCryptoError)
})

test("isEncrypted recognises only the stored prefix", () => {
  assert.equal(isEncrypted("enc:1:abcd"), true)
  assert.equal(isEncrypted("encrypted text"), false)
  assert.equal(isEncrypted(null), false)
})

test("plaintext that looks like a stored value is encrypted even with the switch off", () => {
  env({ DATA_ENCRYPTION_KEY: keyA })
  const stored = encryptField(FIELD.NOTE_CONTENT, "enc:1:copied-from-the-table")
  assert.ok(stored.startsWith("enc:1:"))
  assert.equal(decryptField(FIELD.NOTE_CONTENT, stored), "enc:1:copied-from-the-table")
  assert.equal(encryptField(FIELD.NOTE_CONTENT, "encrypt me later"), "encrypt me later")
})

test("an invalid previous key does not break values written with the current key", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  const stored = encryptField(FIELD.NOTE_CONTENT, "still readable")
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_KEY_PREVIOUS: "c2hvcnQ=" })
  assert.equal(decryptField(FIELD.NOTE_CONTENT, stored), "still readable")
})

test("export decryption marks an unreadable value instead of failing", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  const stored = encryptField(FIELD.NOTE_CONTENT, "fine")
  env({ DATA_ENCRYPTION_KEY: keyB })
  assert.equal(decryptForExport(FIELD.NOTE_CONTENT, stored), "[undecryptable]")
  assert.equal(decryptForExport(FIELD.NOTE_CONTENT, "legacy"), "legacy")
})

test("bookmark URLs and checklist titles have their own field families", () => {
  env({ DATA_ENCRYPTION_KEY: keyA, DATA_ENCRYPTION_WRITE: "on" })
  const url = encryptField(FIELD.BOOKMARK_URL, "https://example.com/a?b=c")
  assert.equal(decryptField(FIELD.BOOKMARK_URL, url), "https://example.com/a?b=c")
  assert.throws(() => decryptField(FIELD.CHECKLIST_TITLE, url), DataCryptoError)
  assert.equal(decryptField(FIELD.CHECKLIST_TITLE, encryptField(FIELD.CHECKLIST_TITLE, "Beli kopi")), "Beli kopi")
})
