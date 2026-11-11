"use client"

import Link from "next/link"
import { FormEvent, useRef, useState } from "react"
import { Turnstile, type TurnstileHandle } from "@/components/auth/turnstile"
import { createClient } from "@/lib/supabase/client"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const captcha = useRef<TurnstileHandle>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!captchaToken) return setMessage("Wait a moment for the security check to finish, then try again.")
    setSending(true)
    setMessage("")
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      captchaToken,
    })
    captcha.current?.reset()
    setSending(false)
    // Same answer whether or not the address has an account, so the form can't be used to find accounts.
    if (error && /rate limit|too many/i.test(error.message)) return setMessage("Too many requests. Wait a few minutes and try again.")
    if (error && /captcha/i.test(error.message)) return setMessage("The security check didn't pass. Wait a moment and try again.")
    setMessage("If an account exists, a reset link has been sent to your email.")
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="surface w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="brand-mark">SC</span>
          <p className="font-semibold">Sanctum Cove</p>
        </div>
        <div className="mt-10">
          <p className="eyebrow">Account recovery</p>
          <h1 className="page-title">Reset password</h1>
          <p className="page-description">Enter your email and we will send password reset instructions.</p>
        </div>
        <form onSubmit={submit} className="form-grid mt-8">
          <label className="field-label">
            Email address
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="field-control"
              autoComplete="email"
            />
          </label>
          <Turnstile ref={captcha} onToken={setCaptchaToken} />
          <button disabled={sending || !captchaToken} className="button-primary w-full disabled:opacity-60">
            {sending ? "Sending..." : "Send reset link"}
          </button>
          {message && (
            <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {message}
            </p>
          )}
        </form>
        <Link href="/login" className="mt-6 inline-flex text-sm underline underline-offset-4">
          Back to sign in
        </Link>
      </section>
    </main>
  )
}
