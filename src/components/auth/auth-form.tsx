"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { Eye, EyeOff, MailCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type AuthMode = "login" | "register"

/** Rough strength hint for new passwords: length plus character variety. */
function passwordStrength(value: string) {
  let score = 0
  if (value.length >= 8) score++
  if (value.length >= 12) score++
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++
  return [{ label: "Too short", tone: "weak" }, { label: "Weak", tone: "weak" }, { label: "Fair", tone: "fair" }, { label: "Good", tone: "good" }, { label: "Strong", tone: "good" }][value.length < 8 ? 0 : score]
}

function friendlyError(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Check them and try again."
  if (/email not confirmed/i.test(message)) return "Confirm your email first. Open the link we sent to your inbox."
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Wait a few minutes and try again."
  if (/already registered/i.test(message)) return "An account with this email already exists. Sign in instead."
  return message
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [sentTo, setSentTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const strength = mode === "register" && password ? passwordStrength(password) : null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Native required/minLength checks are skipped for autofilled or script-set values, so validate here too.
    const trimmedEmail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return setError("Enter a valid email address.")
    if (!password) return setError("Enter your password.")
    if (mode === "register" && password.length < 8) return setError("Use at least 8 characters for your password.")
    setLoading(true)
    setError("")
    const supabase = createClient()
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
      : await supabase.auth.signUp({ email: trimmedEmail, password, options: { emailRedirectTo: `${window.location.origin}/verify-email` } })
    if (result.error) {
      setLoading(false)
      return setError(friendlyError(result.error.message))
    }
    if (mode === "login") {
      router.replace("/dashboard")
      router.refresh()
      return
    }
    setLoading(false)
    setSentTo(trimmedEmail)
  }

  if (sentTo) return (
    <div className="auth-sent" role="status">
      <MailCheck size={22} aria-hidden />
      <div>
        <p className="font-semibold text-[var(--foreground)]">Check your inbox</p>
        <p className="mt-1 text-sm text-[var(--muted)]">If <strong className="text-[var(--foreground)]">{sentTo}</strong> can be registered, we sent a confirmation link to it. Open it to finish creating your account.</p>
        <button type="button" onClick={() => { setSentTo(""); setPassword("") }} className="mt-3 text-sm font-semibold underline underline-offset-2">Use a different email</button>
      </div>
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="auth-email" className="auth-label">Email</label>
        <input id="auth-email" type="email" name="email" autoComplete={mode === "login" ? "username" : "email"} inputMode="email" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="field-control w-full" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="auth-password" className="auth-label">Password</label>
          {mode === "login" && <Link href="/forgot-password" className="text-xs font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline">Forgot password?</Link>}
        </div>
        <div className="relative">
          <input id="auth-password" type={showPassword ? "text" : "password"} name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "At least 8 characters" : ""} aria-describedby={strength ? "auth-strength" : undefined} className="field-control w-full pr-10" />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--muted)] hover:text-[var(--foreground)]" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        {strength && <p id="auth-strength" className="auth-strength" data-tone={strength.tone}><span aria-hidden /> {strength.label}</p>}
      </div>
      {error && <p role="alert" className="auth-alert" data-tone="error">{error}</p>}
      <button disabled={loading} className="button-primary w-full disabled:opacity-60">{loading ? (mode === "login" ? "Signing in…" : "Creating account…") : mode === "login" ? "Sign in" : "Create account"}</button>
    </form>
  )
}
