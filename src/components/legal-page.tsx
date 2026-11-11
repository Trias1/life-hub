import Link from "next/link"

/** Shared frame for the public privacy and terms pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)]">← LifeHub</Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Last updated {updated}</p>
        <div className="legal-prose mt-8">{children}</div>
        <p className="mt-12 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">
          <Link href="/privacy" className="underline underline-offset-2">Privacy policy</Link> · <Link href="/terms" className="underline underline-offset-2">Terms of service</Link>
        </p>
      </div>
    </main>
  )
}
