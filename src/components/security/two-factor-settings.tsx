"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { Check, Copy, ShieldCheck, Smartphone, Trash2 } from "lucide-react"
import { formatDateTime } from "@/lib/format-date"
import { createClient } from "@/lib/supabase/client"

type FactorRow = { id: string; name: string; createdAt: string }
type Enrollment = { factorId: string; qrCode: string; secret: string }

const codeError = (message: string) => /rate limit|too many/i.test(message)
  ? "Too many attempts. Wait a few minutes and try again."
  : "That code didn't match. Use the newest code, and check that your phone's clock is set automatically."

/** Authenticator-app 2FA (TOTP) through Supabase MFA: list, add with a QR code, and remove after entering a code. */
export function TwoFactorSettings() {
  const [factors, setFactors] = useState<FactorRow[] | null>(null)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [removing, setRemoving] = useState<FactorRow | null>(null)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await createClient().auth.mfa.listFactors()
    if (error || !data) {
      setFactors([])
      setMessage({ tone: "error", text: "Couldn't load your authenticators. Refresh the page." })
      return []
    }
    setFactors(data.totp.map((factor, index) => ({ id: factor.id, name: factor.friendly_name || "Authenticator " + (index + 1), createdAt: factor.created_at })))
    return data.all
  }, [])

  useEffect(() => { void load() }, [load])

  async function startEnrollment() {
    setBusy(true)
    setMessage(null)
    const supabase = createClient()
    // Drop half-finished setups from earlier attempts; only unverified factors are removed here.
    const all = await load()
    for (const factor of all.filter((item) => item.status === "unverified")) await supabase.auth.mfa.unenroll({ factorId: factor.id })
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator " + new Date().toISOString().slice(0, 16).replace("T", " ") })
    setBusy(false)
    if (error || !data) return setMessage({ tone: "error", text: "Couldn't start the setup. Try again." })
    setCode("")
    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
  }

  async function cancelEnrollment() {
    if (enrollment) await createClient().auth.mfa.unenroll({ factorId: enrollment.factorId })
    setEnrollment(null)
    setCode("")
  }

  async function confirm(event: FormEvent<HTMLFormElement>, factorId: string, after: () => Promise<void>) {
    event.preventDefault()
    const digits = code.replace(/\s/g, "")
    if (!/^\d{6}$/.test(digits)) return setMessage({ tone: "error", text: "Enter the 6-digit code from your authenticator app." })
    setBusy(true)
    setMessage(null)
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: digits })
    if (error) {
      setBusy(false)
      setCode("")
      return setMessage({ tone: "error", text: codeError(error.message) })
    }
    await after()
    setBusy(false)
    setCode("")
  }

  const finishEnrollment = (event: FormEvent<HTMLFormElement>) => enrollment && confirm(event, enrollment.factorId, async () => {
    setEnrollment(null)
    await load()
    setMessage({ tone: "success", text: "Two-factor authentication is on. You'll be asked for a code when you sign in." })
  })

  // Removing needs a fresh code from that authenticator, so a stolen session alone can't switch 2FA off.
  const finishRemoval = (event: FormEvent<HTMLFormElement>) => removing && confirm(event, removing.id, async () => {
    const { error } = await createClient().auth.mfa.unenroll({ factorId: removing.id })
    setRemoving(null)
    await load()
    setMessage(error ? { tone: "error", text: "Couldn't remove that authenticator. Try again." } : { tone: "success", text: "Authenticator removed." })
  })

  async function copySecret(secret: string) {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const codeInput = (id: string) => (
    <label className="field-label" htmlFor={id}>6-digit code
      <input id={id} inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus required value={code} onChange={(event) => setCode(event.target.value.replace(/[^\d ]/g, ""))} placeholder="123 456" className="field-control font-mono text-lg tracking-[0.3em]" />
    </label>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[var(--accent)]" aria-hidden />
        <div>
          <p className="text-lg font-semibold">Two-factor authentication</p>
          <p className="mt-1 text-sm text-zinc-500">After your password, sign-in asks for a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password…). A leaked password alone is then not enough.</p>
        </div>
      </div>

      {message && <p role={message.tone === "error" ? "alert" : "status"} className={"rounded-xl border p-3 text-sm " + (message.tone === "error" ? "border-[var(--danger)] text-danger" : "border-[var(--line)] text-success")}>{message.text}</p>}

      {factors === null ? <p className="text-sm text-zinc-500" aria-busy="true">Loading…</p> : (
        <>
          <p className="text-sm"><strong>Status:</strong> {factors.length ? <span className="text-success">On, {factors.length} authenticator{factors.length > 1 ? "s" : ""}</span> : <span className="text-zinc-500">Off</span>}</p>
          {factors.length > 0 && (
            <ul className="space-y-2">
              {factors.map((factor) => (
                <li key={factor.id} className="profile-session">
                  <Smartphone className="text-[var(--accent)]" aria-hidden />
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold">{factor.name}</p><p className="mt-1 text-sm text-zinc-500">Added {formatDateTime(factor.createdAt)}</p></div>
                  <button type="button" onClick={() => { setRemoving(factor); setEnrollment(null); setCode(""); setMessage(null) }} className="button-quiet min-h-11 text-danger" aria-label={"Remove " + factor.name}><Trash2 size={16} aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}

          {removing && (
            <form onSubmit={finishRemoval} className="space-y-3 rounded-xl border border-[var(--line)] p-4">
              <p className="font-semibold">Remove {removing.name}?</p>
              <p className="text-sm text-zinc-500">Enter a code from this authenticator to confirm.{factors.length === 1 ? " This turns two-factor authentication off." : ""}</p>
              {codeInput("remove-code")}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => { setRemoving(null); setCode("") }} className="button-secondary">Cancel</button>
                <button disabled={busy} className="button-primary bg-red-600 disabled:opacity-60">{busy ? "Checking…" : "Remove"}</button>
              </div>
            </form>
          )}

          {enrollment ? (
            <form onSubmit={finishEnrollment} className="space-y-4 rounded-xl border border-[var(--line)] p-4">
              <p className="font-semibold">Scan this QR code with your authenticator app</p>
              <div className="flex flex-wrap items-start gap-4">
                {/* The QR is an SVG data URL from Supabase, shown as an image (no script can run). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={enrollment.qrCode} alt="QR code for your authenticator app" width={176} height={176} className="rounded-lg bg-white p-2" />
                <div className="min-w-0 flex-1 space-y-2 text-sm text-zinc-500">
                  <p>Can&apos;t scan? Enter this key in the app instead:</p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 break-all rounded-md bg-[var(--surface-muted)] px-2 py-1 font-mono text-[var(--foreground)]">{enrollment.secret}</code>
                    <button type="button" onClick={() => void copySecret(enrollment.secret)} className="button-quiet min-h-11 min-w-11" aria-label={copied ? "Copied" : "Copy key"}>{copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}</button>
                  </div>
                  <p>Keep this key private; anyone with it can generate your codes.</p>
                </div>
              </div>
              {codeInput("enroll-code")}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => void cancelEnrollment()} className="button-secondary">Cancel</button>
                <button disabled={busy} className="button-primary disabled:opacity-60">{busy ? "Checking…" : "Turn on"}</button>
              </div>
            </form>
          ) : !removing && (
            <button type="button" disabled={busy} onClick={() => void startEnrollment()} className="button-primary disabled:opacity-60">{factors.length ? "Add another authenticator" : "Set up authenticator app"}</button>
          )}

          <div className="rounded-xl bg-[var(--surface-muted)] p-3 text-sm text-zinc-500">
            <p className="font-semibold text-[var(--foreground)]">Backup</p>
            <p className="mt-1">Add a second authenticator (another phone or a password manager) so losing one device doesn&apos;t lock you out. If you lose all of them, the workspace owner can remove your factors in the Supabase dashboard (Authentication → Users → your account).</p>
          </div>
        </>
      )}
    </div>
  )
}
