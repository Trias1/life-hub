export type PasswordStrength = { label: string; tone: "weak" | "fair" | "good" }

/** Rough strength hint for new passwords: length plus character variety. */
export function passwordStrength(value: string): PasswordStrength {
  let score = 0
  if (value.length >= 8) score++
  if (value.length >= 12) score++
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++
  const levels: PasswordStrength[] = [{ label: "Too short", tone: "weak" }, { label: "Weak", tone: "weak" }, { label: "Fair", tone: "fair" }, { label: "Good", tone: "good" }, { label: "Strong", tone: "good" }]
  return levels[value.length < 8 ? 0 : score]
}
