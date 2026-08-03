import { AuthForm } from "@/components/auth/auth-form"

export default function LoginPage() {
  return <main className="flex min-h-screen items-center justify-center px-4 py-10"><section className="surface w-full max-w-md p-6 sm:p-8"><div className="flex items-center gap-3"><span className="brand-mark">LH</span><div><p className="font-semibold tracking-tight">LifeHub</p><p className="text-xs text-zinc-500">Personal workspace</p></div></div><div className="mt-10"><p className="eyebrow">Welcome back</p><h1 className="page-title">Sign in</h1><p className="page-description">Sign in to your workspace and pick up where you left off.</p></div><div className="mt-8"><AuthForm mode="login" /></div></section></main>
}
