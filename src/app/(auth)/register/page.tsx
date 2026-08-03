import { AuthForm } from "@/components/auth/auth-form"

export default function RegisterPage() {
  return <main className="flex min-h-screen items-center justify-center px-4 py-10"><section className="surface w-full max-w-md p-6 sm:p-8"><div className="flex items-center gap-3"><span className="brand-mark">LH</span><div><p className="font-semibold tracking-tight">LifeHub</p><p className="text-xs text-zinc-500">Personal workspace</p></div></div><div className="mt-10"><p className="eyebrow">Get started</p><h1 className="page-title">Create your account</h1><p className="page-description">Start with a focused workspace for work and life.</p></div><div className="mt-8"><AuthForm mode="register" /></div></section></main>
}
