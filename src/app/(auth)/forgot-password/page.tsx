"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setMessage("")
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setSending(false)
    setMessage(error?.message ?? "If an account exists, a reset link has been sent to your email.")
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="surface w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="brand-mark">LH</span>
          <p className="font-semibold">LifeHub</p>
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
          <button disabled={sending} className="button-primary w-full">
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
