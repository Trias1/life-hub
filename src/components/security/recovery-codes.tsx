"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Download, KeyRound } from "lucide-react"
import { createRecoveryCodes, getRecoveryCodeCount } from "@/app/(auth)/mfa/actions"

/** Shows how many recovery codes are left and makes a new set (shown once, then only hashes remain). */
export function RecoveryCodes() {
  const [remaining, setRemaining] = useState<number | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void getRecoveryCodeCount().then((result) => {
      if ("error" in result) setError(result.error)
      else setRemaining(result.remaining)
    })
  }, [])

  async function create() {
    if (remaining && !window.confirm("Make new recovery codes? The " + remaining + " codes you have now stop working.")) return
    setBusy(true)
    setError("")
    const result = await createRecoveryCodes()
    setBusy(false)
    if ("error" in result) return setError(result.error)
    setCodes(result.codes)
    setRemaining(result.codes.length)
  }

  const text = () => "Sanctum Cove recovery codes\nEach code works once and turns two-factor off so you can sign in and set up a new authenticator.\n\n" + (codes ?? []).join("\n") + "\n"

  async function copy() {
    try {
      await navigator.clipboard.writeText(text())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError("Couldn't copy. Select the codes and copy them by hand.")
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text()], { type: "text/plain" }))
    const link = Object.assign(document.createElement("a"), { href: url, download: "sanctum-cove-recovery-codes.txt" })
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="space-y-3 rounded-xl border border-[var(--line)] p-4" aria-labelledby="recovery-heading">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p id="recovery-heading" className="font-semibold">Recovery codes</p>
          <p className="mt-1 text-sm text-zinc-500">If you lose your phone, one of these codes lets you in: it turns two-factor off, then you sign in with your password and set up a new authenticator. Keep them somewhere safe, away from your phone.</p>
          {remaining !== null && !codes && <p className="mt-2 text-sm">{remaining ? remaining + " unused code" + (remaining === 1 ? "" : "s") + " left." : "You haven't made any yet."}</p>}
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {codes ? (
        <div className="space-y-3">
          <p role="status" className="text-sm font-semibold">Save these now. They won&apos;t be shown again.</p>
          <ol className="grid grid-cols-1 gap-1.5 rounded-lg bg-[var(--surface-muted)] p-3 font-mono text-sm sm:grid-cols-2">
            {codes.map((code) => <li key={code}>{code}</li>)}
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copy()} className="button-secondary">{copied ? <Check size={15} className="mr-1.5" aria-hidden /> : <Copy size={15} className="mr-1.5" aria-hidden />}{copied ? "Copied" : "Copy"}</button>
            <button type="button" onClick={download} className="button-secondary"><Download size={15} className="mr-1.5" aria-hidden />Download .txt</button>
            <button type="button" onClick={() => setCodes(null)} className="button-primary">I saved them</button>
          </div>
        </div>
      ) : (
        <button type="button" disabled={busy || remaining === null} onClick={() => void create()} className="button-secondary disabled:opacity-60">{busy ? "Making codes…" : remaining ? "Make new codes" : "Make recovery codes"}</button>
      )}
    </section>
  )
}
