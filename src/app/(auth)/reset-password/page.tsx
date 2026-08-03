"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setMessage(""); const { error } = await createClient().auth.updateUser({ password }); setSaving(false); if (error) { setMessage(error.message); return } router.push("/login?success=Password%20updated") }
  return <main className="flex min-h-screen items-center justify-center px-4 py-10"><section className="surface w-full max-w-md p-6 sm:p-8"><div className="flex items-center gap-3"><span className="brand-mark">LH</span><p className="font-semibold">LifeHub</p></div><div className="mt-10"><p className="eyebrow">Account recovery</p><h1 className="page-title">Choose a new password</h1><p className="page-description">Use at least eight characters, then sign in again.</p></div><form onSubmit={submit} className="form-grid mt-8"><label className="field-label">New password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="field-control" autoComplete="new-password" /></label><button disabled={saving} className="button-primary w-full">{saving ? "Saving…" : "Update password"}</button>{message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>}</form><Link href="/login" className="mt-6 inline-flex text-sm underline underline-offset-4">Back to sign in</Link></section></main>
}
