// Two-factor recovery codes: 16 characters from a 31-character alphabet (about 79 bits), shown once,
// stored only as SHA-256(user id + code). Letters that look alike (0/O, 1/I/L) are left out.
import { createHash, randomInt } from "node:crypto"

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
export const RECOVERY_CODE_COUNT = 10

/** @returns {string} e.g. "K7QM-2XPA-9RTB-WN4D" */
export function newRecoveryCode() {
  let raw = ""
  for (let index = 0; index < 16; index++) raw += ALPHABET[randomInt(ALPHABET.length)]
  return raw.match(/.{4}/g)?.join("-") ?? raw
}

/** Uppercase, no spaces or dashes; null when it can't be a recovery code. @param {unknown} input */
export function normalizeRecoveryCode(input) {
  const code = String(input ?? "").toUpperCase().replace(/[\s-]/g, "")
  return /^[A-Z0-9]{16}$/.test(code) ? code : null
}

/** @param {string} userId @param {string} normalizedCode */
export function hashRecoveryCode(userId, normalizedCode) {
  return createHash("sha256").update(userId + ":" + normalizedCode).digest("hex")
}
