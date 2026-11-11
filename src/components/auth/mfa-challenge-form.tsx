"use client"

import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useState } from "react"
import { Select } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"

type FactorOption = { id: string; name: string }

/** Second sign-in step for accounts with an authenticator app: verifies a 6-digit code and upgrades the session to aal2. */
export function MfaChallengeForm() {
  const router = useRouter()
  const [factors, setFactors] = useState<FactorOption[] | null>(null)
  const [factorId, setFactorId] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    createClient().auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (listError || !data) {
        setError("Couldn't load your authenticators. Sign in again.")
        setFactors([])
        return
      }
      const verified = data.totp.map((factor, index) => ({ id: factor.id, name: factor.friendly_name || "Authenticator " + (index + 1) }))
      // No authenticator on this account: nothing to verify.
      if (!verified.length) return router.replace("/dashboard")
      setFactors(verified)
      setFactorId(verified[0].id)
    })
  }, [router])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const digits = code.replace(/\s/g, "")
    if (!/^\d{6}$/.test(digits)) return setError("Enter the 6-digit code from your authenticator app.")
    setVerifying(true)
    setError("")
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: digits })
    if (verifyError) {
      setVerifying(false)
      setCode("")
      return setError(/rate limit|too many/i.test(verifyError.message) ? "Too many attempts. Wait a few minutes and try again." : "That code didn't match. Use the newest code, and check that your phone's clock is set automatically.")
    }
    router.replace("/dashboard")
    router.refresh()
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.replace("/login")
  }

  if (!factors) return <p className="text-sm text-[var(--muted)]" aria-busy="true">Loading…</p>
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {factors.length > 1 && (
        <div className="space-y-1.5">
          <label htmlFor="mfa-factor" className="auth-label">Authenticator</label>
          <Select id="mfa-factor" value={factorId} onChange={setFactorId} options={factors.map((factor) => ({ value: factor.id, label: factor.name }))} className="field-control w-full" />
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="mfa-code" className="auth-label">6-digit code</label>
        <input id="mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={7} autoFocus required value={code} onChange={(event) => setCode(event.target.value.replace(/[^\d ]/g, ""))} placeholder="123 456" aria-invalid={error ? true : undefined} aria-describedby={error ? "mfa-error" : undefined} className="field-control w-full font-mono text-lg tracking-[0.3em]" />
      </div>
      {error && <p id="mfa-error" role="alert" className="auth-alert" data-tone="error">{error}</p>}
      <button disabled={verifying || !factors.length} className="button-primary w-full disabled:opacity-60">{verifying ? "Verifying…" : "Verify"}</button>
      <button type="button" onClick={() => void signOut()} className="w-full text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]">Use a different account</button>
    </form>
  )
}
