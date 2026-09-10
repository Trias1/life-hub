import { acceptInvitation } from "./actions"

export default async function InvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params
  const { error } = await searchParams
  return <main className="flex min-h-screen items-center justify-center px-4 py-10"><section className="surface w-full max-w-md p-6 sm:p-8"><span className="brand-mark">SC</span><p className="eyebrow mt-8">Workspace invitation</p><h1 className="page-title mt-2">Join Sanctum Cove workspace</h1><p className="page-description mt-3">Sign in with the invited email, then accept to add this workspace to your account.</p>{error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<form action={acceptInvitation} className="mt-7"><input type="hidden" name="token" value={token} /><button className="button-primary w-full">Accept invitation</button></form></section></main>
}
