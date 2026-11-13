// New-password rule, the same as Supabase Auth's password policy (Authentication → Providers → Email):
// at least 10 characters, with at least one letter and one digit. Supabase enforces it on the server;
// the forms check first so people get a clear message instead of a raw API error.

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_HINT = "At least 10 characters, with letters and numbers"

/** @param {string} password @returns {string | null} what's missing, or null when the password is acceptable */
export function passwordProblem(password) {
  const value = String(password ?? "")
  if (value.length < PASSWORD_MIN_LENGTH) return "Use at least " + PASSWORD_MIN_LENGTH + " characters for your password."
  if (value.length > 128) return "Use at most 128 characters for your password."
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "Use both letters and numbers in your password."
  return null
}

/** Supabase's wording for a refused password, turned into the same message the forms use. @param {string} message */
export function friendlyPasswordError(message) {
  if (/weak|password should|password.*(at least|characters|contain)/i.test(message)) return "Use at least " + PASSWORD_MIN_LENGTH + " characters, with letters and numbers."
  if (/reauthenticat|nonce/i.test(message)) return "For your security, sign in again before changing your password."
  if (/same.*password|different from the old/i.test(message)) return "Choose a password you haven't used for this account."
  return null
}
