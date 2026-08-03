"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type AuthMode = "login" | "register"

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")
    const supabase = createClient()
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/verify-email` } })
    setLoading(false)
    if (!result.error && mode === "login") {
      router.push("/dashboard")
      router.refresh()
      return
    }
    setMessage(result.error?.message ?? "Check your email to verify your account.")
  }

  return <form onSubmit={submit} className="space-y-5">
    <label className="block space-y-2 text-sm font-medium">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900" /></label>
    <label className="block space-y-2 text-sm font-medium">Password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900" /></label>
    <button disabled={loading} className="w-full rounded-lg bg-zinc-950 px-4 py-2.5 font-medium text-white disabled:opacity-50">{loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
    {message && <p role="status" className="text-sm text-zinc-600">{message}</p>}
    <div className="flex justify-between text-sm text-zinc-600"><Link href={mode === "login" ? "/register" : "/login"} className="underline">{mode === "login" ? "Create account" : "Sign in"}</Link>{mode === "login" && <Link href="/forgot-password" className="underline">Forgot password?</Link>}</div>
  </form>
}
