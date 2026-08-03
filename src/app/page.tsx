import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-20">
      <section className="max-w-2xl">
        <p className="text-sm font-medium text-zinc-500">LifeHub</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight">
          Your focused workspace for work and life.
        </h1>
        <p className="mt-6 text-lg text-zinc-600">
          Keep notes, tasks, events, files, and team activity together in one
          calm workspace.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-zinc-950 px-4 py-2.5 font-medium text-white"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-300 px-4 py-2.5 font-medium"
          >
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
