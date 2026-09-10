import Link from "next/link";
import { ArrowRight, Check, Layers3, Sparkles, Users, Zap } from "lucide-react";

const features = [
  { icon: Layers3, title: "One calm home", text: "Keep notes, tasks, events, files, and bookmarks connected in one workspace." },
  { icon: Zap, title: "Move with clarity", text: "See what matters next without noisy dashboards or scattered tools." },
  { icon: Users, title: "Work together", text: "Invite your team, share files, and keep every workspace conversation in context." },
];

export default function Home() {
  return (
    <main className="landing-page min-h-screen overflow-hidden bg-[#070707] text-white">
      <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(circle_at_15%_5%,rgba(120,119,198,0.18),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(45,212,191,0.12),transparent_28%)]" />
      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
          <span className="landing-logo grid h-9 w-9 place-items-center rounded-xl text-xs font-black">SC</span>
          <span>Sanctum Cove</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/login" className="rounded-full px-4 py-2 text-zinc-300 transition hover:bg-white/10 hover:text-white">Sign in</Link>
          <Link href="/register" className="landing-cta-primary rounded-full px-4 py-2 font-semibold transition">Get started</Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid w-full max-w-7xl gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-zinc-300 backdrop-blur">
            <Sparkles size={14} className="text-teal-300" /> A quieter way to get things done
          </div>
          <h1 className="mt-7 max-w-3xl text-5xl font-semibold tracking-[-0.065em] text-white sm:text-6xl lg:text-7xl">
            Your work and life, finally in one <span className="bg-gradient-to-r from-teal-200 via-white to-violet-300 bg-clip-text text-transparent">clear space.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">
            Sanctum Cove brings your notes, tasks, calendar, files, and people together so you can focus on the next meaningful thing.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/register" className="landing-cta-primary group inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5">
              Create your workspace <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/login" className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-white/30 hover:bg-white/[0.06]">Explore sign in</Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
            {['Notes and tasks', 'Calendar and files', 'Team-ready workspace'].map((item) => <span key={item} className="inline-flex items-center gap-1.5"><Check size={14} className="text-teal-300" />{item}</span>)}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-violet-500/20 via-transparent to-teal-400/15 blur-3xl" />
          <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.07] p-3 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="rounded-[1.45rem] border border-white/10 bg-[#101010] p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" /></div><span className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Today</span></div>
              <div className="grid gap-4 pt-5 sm:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-3"><div className="h-20 rounded-2xl bg-gradient-to-br from-violet-500/30 to-violet-500/5 p-4"><p className="text-[10px] uppercase tracking-widest text-violet-200/70">Focus</p><p className="mt-2 text-sm font-semibold">Plan the week</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-[10px] uppercase tracking-widest text-zinc-500">Progress</p><div className="mt-3 h-1.5 rounded-full bg-white/10"><div className="h-full w-2/3 rounded-full bg-teal-300" /></div><p className="mt-2 text-xs text-zinc-500">6 of 9 tasks complete</p></div></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Your workspace</p><span className="rounded-full bg-teal-300/10 px-2 py-1 text-[10px] text-teal-200">Live</span></div><div className="mt-5 space-y-3">{['Finalize project brief', 'Review team notes', 'Design sync �· 14:00'].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-3"><span className={`grid h-6 w-6 place-items-center rounded-lg ${index === 2 ? 'bg-violet-300/15 text-violet-200' : 'bg-teal-300/15 text-teal-200'}`}>{index === 2 ? '•' : <Check size={13} />}</span><span className="text-xs text-zinc-300">{item}</span></div>)}</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-20 lg:px-8">
        <div className="grid gap-4 border-y border-white/10 py-5 text-sm text-zinc-500 sm:grid-cols-3 sm:gap-8">
          <span>Built for deep work</span><span className="sm:text-center">Designed for real teams</span><span className="sm:text-right">Keeps context close</span>
        </div>
        <div className="grid gap-4 pt-16 md:grid-cols-3">{features.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:bg-white/[0.07]"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-teal-200"><Icon size={19} /></div><h2 className="mt-6 text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p></article>)}</div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-16 lg:px-8"><div className="flex flex-col items-start justify-between gap-6 rounded-[2rem] border border-white/10 bg-gradient-to-r from-white/[0.09] to-white/[0.03] p-7 sm:p-10 md:flex-row md:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Start with clarity</p><h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight">Make space for the work that matters.</h2></div><Link href="/register" className="landing-cta-primary inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition">Get started <ArrowRight size={16} /></Link></div><p className="mt-8 text-center text-xs text-zinc-600">© 2026 Sanctum Cove · A focused workspace for work and life.</p></section>
    </main>
  );
}