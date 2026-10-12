"use client"

import { formatDateTime } from "@/lib/format-date"
import { passwordStrength } from "@/lib/password-strength"

import { useState } from "react"
import { CheckCircle2, Eye, EyeOff, Laptop, ShieldCheck, TriangleAlert } from "lucide-react"

type PasswordAction = (formData: FormData) => Promise<void>
type SignOutAction = () => Promise<void>
type Section = "password" | "two-factor" | "sessions" | "devices" | "history" | "tokens" | "recovery" | "danger"
const sections: Array<[Section, string]> = [["password", "Password"], ["two-factor", "Two-factor authentication"], ["sessions", "Active sessions"], ["devices", "Connected devices"], ["history", "Login history"], ["tokens", "API tokens"], ["recovery", "Recovery codes"], ["danger", "Danger zone"]]

/** Asks before running a destructive form action, so a stray tap can't end sessions. */
function confirmSubmit(message: string) {
  return (event: React.FormEvent<HTMLFormElement>) => { if (!window.confirm(message)) event.preventDefault() }
}

export function SecurityCenter({ email, lastSignIn, updatePassword, signOut, signOutOthers }: { email: string; lastSignIn: string | null; updatePassword: PasswordAction; signOut: SignOutAction; signOutOthers: SignOutAction }) {
  const [section, setSection] = useState<Section>("password")
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const strength = password ? passwordStrength(password) : null
  const mismatch = confirm.length > 0 && confirm !== password
  const inputType = showPassword ? "text" : "password"
  const signOutThisDevice = <form action={signOut} onSubmit={confirmSubmit("Sign out of this browser?")}><button className="button-secondary text-danger">Sign out this device</button></form>
  const currentSession = <article className="profile-session"><Laptop className="text-[var(--accent)]" /><div className="min-w-0 flex-1"><p className="font-semibold">Current browser</p><p className="mt-1 truncate text-sm text-zinc-500">Signed in as {email}{lastSignIn ? " · since " + formatDateTime(lastSignIn) : ""}</p></div><span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600">Current</span></article>
  const content = section === "password" ? (
    <form action={updatePassword} className="space-y-5">
      <div><p className="text-lg font-semibold">Change password</p><p className="mt-1 text-sm text-zinc-500">Use at least 8 characters and keep it unique to Sanctum Cove. Other sessions are signed out after the change.</p></div>
      {/* Lets password managers attach the new password to the right account. */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <label className="field-label">Current password<input required name="currentPassword" autoComplete="current-password" type={inputType} className="field-control" /></label>
      <label className="field-label">New password
        <span className="relative block">
          <input required minLength={8} maxLength={128} name="newPassword" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} type={inputType} aria-describedby={strength ? "security-strength" : undefined} className="field-control w-full pr-12" />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-0.5 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded text-[var(--muted)] hover:text-[var(--foreground)]" aria-label={showPassword ? "Hide passwords" : "Show passwords"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </span>
      </label>
      {strength && <p id="security-strength" className="auth-strength" data-tone={strength.tone} aria-live="polite"><span aria-hidden /> {strength.label}</p>}
      <label className="field-label">Confirm new password<input required minLength={8} maxLength={128} name="confirmPassword" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} type={inputType} aria-invalid={mismatch || undefined} aria-describedby={mismatch ? "security-mismatch" : undefined} className="field-control" /></label>
      {mismatch && <p id="security-mismatch" role="alert" className="text-sm text-danger">Passwords don&apos;t match yet.</p>}
      <div className="flex justify-end"><button disabled={password.length < 8 || confirm !== password} className="button-primary disabled:cursor-not-allowed disabled:opacity-60">Save password</button></div>
    </form>
  ) : section === "sessions" ? (
    <div className="space-y-5">
      <div><p className="text-lg font-semibold">Active sessions</p><p className="mt-1 text-sm text-zinc-500">Lost a device or signed in on a shared computer? Sign out everywhere else and keep this browser signed in.</p></div>
      {currentSession}
      <div className="flex flex-wrap gap-2">
        <form action={signOutOthers} onSubmit={confirmSubmit("Sign out of every other browser and device? This browser stays signed in.")}><button className="button-secondary">Sign out all other sessions</button></form>
        {signOutThisDevice}
      </div>
    </div>
  ) : section === "devices" ? <div className="space-y-4"><p className="text-lg font-semibold">Connected devices</p>{currentSession}<p className="text-sm text-zinc-500">Additional device inventory requires an identity provider session API.</p></div>
    : section === "history" ? <div className="space-y-4"><p className="text-lg font-semibold">Login history</p><article className="profile-activity-row"><CheckCircle2 className="text-emerald-500" /><div><p className="font-medium">Successful sign-in</p><p className="text-sm text-zinc-500">{lastSignIn ? formatDateTime(lastSignIn) : "No sign-in timestamp available"}</p></div></article></div>
    : section === "danger" ? <div className="space-y-4"><TriangleAlert className="h-8 w-8 text-red-500" /><p className="text-lg font-semibold">Danger zone</p><p className="text-sm text-zinc-500">Signing out removes this browser session. Account and workspace deletion require verified support workflows.</p>{signOutThisDevice}</div>
    : <div className="space-y-4"><ShieldCheck className="h-8 w-8 text-[var(--accent)]" /><p className="text-lg font-semibold">{sections.find((item) => item[0] === section)?.[1]}</p><p className="text-sm leading-6 text-zinc-500">This control is ready for a configured identity or token provider. It remains unavailable rather than showing fake security data.</p>{section === "two-factor" && <div className="rounded-xl border p-4 text-sm"><strong>Disabled</strong><p className="mt-1 text-zinc-500">Enable it after connecting an authentication provider with MFA support.</p></div>}</div>
  return <div className="page-container"><header className="page-header"><div><p className="eyebrow">Account protection</p><h1 className="page-title">Security</h1><p className="page-description">Manage password, current access, and security controls in one focused place.</p></div><ShieldCheck className="h-8 w-8 text-[var(--accent)]" /></header><div className="mt-8 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]"><nav className="settings-nav h-fit">{sections.map(([id, label]) => <button key={id} type="button" onClick={() => setSection(id)} aria-current={section === id ? "page" : undefined} className={"settings-nav-item " + (section === id ? "settings-nav-item-active" : "")}>{label}</button>)}</nav><section className="settings-panel">{content}</section></div></div>
}
