"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    setMessage(error?.message ?? "If an account exists, a reset link has been sent.")
  }
  return <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6"><section className="w-full space-y-8"><div><h1 className="text-3xl font-semibold">Reset password</h1><p className="mt-2 text-zinc-600">Enter your email and we will send instructions.</p></div><form onSubmit={submit} className="space-y-5"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-lg border border-zinc-300 px-3 py-2" /><button className="w-full rounded-lg bg-zinc-950 px-4 py-2.5 font-medium text-white">Send reset link</button>{message && <p role="status" className="text-sm text-zinc-600">{message}</p>}</form><Link href="/login" className="text-sm underline">Back to sign in</Link></section></main>
}
