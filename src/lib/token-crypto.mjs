import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const PREFIX = "v1"

/** @param {string} secret */
function key(secret) {
  return createHash("sha256").update(secret).digest()
}

/** @param {string} token @param {string} secret */
export function encryptToken(token, secret) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv)
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()])
  return [PREFIX, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(":")
}

/** @param {string} token @param {string} secret */
export function decryptToken(token, secret) {
  if (!token.startsWith(PREFIX + ":")) return token
  const [, iv, tag, encrypted] = token.split(":")
  if (!iv || !tag || !encrypted) throw new Error("Invalid encrypted Google refresh token")
  const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8")
}
