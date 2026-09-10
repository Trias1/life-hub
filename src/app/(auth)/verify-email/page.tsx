import Link from "next/link"

export default function VerifyEmailPage() {
  return <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6"><section className="w-full space-y-5"><p className="text-sm font-medium text-zinc-500">Sanctum Cove</p><h1 className="text-3xl font-semibold">Check your email</h1><p className="text-zinc-600">Use the verification link we sent to finish setting up your account.</p><Link href="/login" className="inline-block rounded-lg bg-zinc-950 px-4 py-2.5 font-medium text-white">Back to sign in</Link></section></main>
}
