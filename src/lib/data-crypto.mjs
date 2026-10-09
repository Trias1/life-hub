// Server-only: imports node:crypto and reads secret env vars, so it cannot be bundled for the browser.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const PREFIX = "enc:1:"

export const FIELD = Object.freeze({
  NOTE_CONTENT: "note.content",
  TASK_DESCRIPTION: "task.description",
  TASK_COMMENT_BODY: "task_comment.body",
  EVENT_DESCRIPTION: "event.description",
  PROFILE_BIO: "profile.bio",
  SPACE_DESCRIPTION: "space.description",
  BOOKMARK_URL: "bookmark.url",
  CHECKLIST_TITLE: "task_checklist.title",
})
const families = new Set(Object.values(FIELD))

export class DataCryptoError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message)
    this.name = "DataCryptoError"
  }
}

/** @param {string | undefined} value */
function loadKey(value) {
  if (!value) return null
  const key = Buffer.from(value, "base64")
  if (key.length !== 32) throw new DataCryptoError("Data encryption key must be 32 bytes")
  return { key, kid: createHash("sha256").update(key).digest("hex").slice(0, 8) }
}

/** A bad previous key only loses access to old values; it must not take down reads of current ones. */
function previousKey() {
  try {
    return loadKey(process.env.DATA_ENCRYPTION_KEY_PREVIOUS)
  } catch {
    console.error("Ignoring invalid DATA_ENCRYPTION_KEY_PREVIOUS")
    return null
  }
}

function keys() {
  return [loadKey(process.env.DATA_ENCRYPTION_KEY), previousKey()].filter((entry) => entry !== null)
}

/** @param {string} family */
function assertFamily(family) {
  if (!families.has(family)) throw new DataCryptoError("Unknown encrypted field family")
}

/** @param {unknown} stored */
export function isEncrypted(stored) {
  return typeof stored === "string" && stored.startsWith(PREFIX)
}

/**
 * Encrypts a field for storage; returns the plaintext unchanged while DATA_ENCRYPTION_WRITE is not "on".
 * Text that already looks like a stored value is always encrypted, or it would be misread as ciphertext later.
 * @param {string} family @param {string} plaintext
 */
export function encryptField(family, plaintext) {
  assertFamily(family)
  if (process.env.DATA_ENCRYPTION_WRITE !== "on" && !isEncrypted(plaintext)) return plaintext
  const current = loadKey(process.env.DATA_ENCRYPTION_KEY)
  if (!current) throw new DataCryptoError("Data encryption key is not configured")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", current.key, iv)
  cipher.setAAD(Buffer.from(family, "utf8"))
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return PREFIX + [current.kid, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(":")
}

/** Decrypts a stored field; legacy plaintext (no prefix) is returned as-is. @param {string} family @param {string | null | undefined} stored */
export function decryptField(family, stored) {
  assertFamily(family)
  if (stored === null || stored === undefined) return ""
  if (!isEncrypted(stored)) return stored
  const [kid, iv, tag, ciphertext] = stored.slice(PREFIX.length).split(":")
  if (!kid || !iv || !tag || ciphertext === undefined) throw new DataCryptoError("Malformed encrypted field")
  const match = keys().find((entry) => entry.kid === kid)
  if (!match) throw new DataCryptoError("No key available for encrypted field")
  try {
    const decipher = createDecipheriv("aes-256-gcm", match.key, Buffer.from(iv, "base64url"))
    decipher.setAAD(Buffer.from(family, "utf8"))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8")
  } catch {
    throw new DataCryptoError("Encrypted field failed authentication")
  }
}

/** Like decryptField, but one unreadable value must not cost the owner the whole export. @param {string} family @param {string | null | undefined} stored */
export function decryptForExport(family, stored) {
  try {
    return decryptField(family, stored)
  } catch (error) {
    if (error instanceof DataCryptoError) return "[undecryptable]"
    throw error
  }
}
