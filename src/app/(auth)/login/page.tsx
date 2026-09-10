import { AuthForm } from "@/components/auth/auth-form"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error, success } = await searchParams
  return <main className="flex min-h-screen items-center justify-center px-4 py-10"><section className="surface w-full max-w-md p-6 sm:p-8"><div className="flex items-center gap-3"><span className="brand-mark">SC</span><div><p className="font-semibold tracking-tight">Sanctum Cove</p><p className="text-xs text-zinc-500">Personal workspace</p></div></div><div className="mt-10"><p className="eyebrow">Welcome back</p><h1 className="page-title">Sign in</h1><p className="page-description">Sign in to your workspace and pick up where you left off.</p></div>{error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}<div className="mt-8"><AuthForm mode="login" /></div></section></main>
}
