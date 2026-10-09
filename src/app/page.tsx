import Link from "next/link";
import {
  Bookmark,
  CalendarDays,
  CircleDot,
  ClipboardList,
  Folder,
  LayoutDashboard,
  MessageSquare,
  Notebook,
  Paperclip,
  Settings,
  Users,
} from "lucide-react";
import { LabelChip, PriorityChip } from "@/components/tasks/task-chip";

const repo = "https://github.com/Trias1/life-hub";

const sidebar = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Notebook, label: "Notes" },
  { icon: ClipboardList, label: "Tasks", active: true },
  { icon: CalendarDays, label: "Calendar" },
  { icon: Folder, label: "Files" },
  { icon: Bookmark, label: "Bookmarks" },
  { icon: Users, label: "Team" },
  { icon: Settings, label: "Settings" },
];

// Sample rows for the preview, written the way the real Tasks list renders them.
const tasks = [
  { title: "Renew the domain before it lapses", priority: "high", label: { name: "admin", color: "rose" }, meta: "In progress · created 3 days ago by You · Due 14 Oct · 1/3 checklist", comments: 2, updated: "updated 2 hours ago" },
  { title: "Draft the self-hosting guide", priority: "medium", label: { name: "docs", color: "blue" }, meta: "In review · created 5 days ago by Rani · 2/4 checklist", attachments: 1, updated: "updated 3 hours ago" },
  { title: "Move old notes out of the General folder", priority: "low", meta: "To do · created last week by You", updated: "updated yesterday" },
  { title: "Compare Drive storage plans", priority: "medium", meta: "To do · created 2 weeks ago by You · Due 20 Oct", updated: "updated 4 days ago" },
];

const modules = [
  { name: "Notes", text: "Rich text with images, folders, tags and pins. Every edit keeps a version you can restore." },
  { name: "Tasks", text: "A list and a board, with labels, due dates, checklists, comments and file attachments." },
  { name: "Calendar", text: "Agenda, month, week and day views, repeating events and reminders, with your Google Calendar shown alongside." },
  { name: "Files", text: "Kept in a folder in your own Google Drive, with versions and share links that expire." },
  { name: "Bookmarks", text: "Titles are filled in from the page. Group them into collections and import or export CSV." },
  { name: "Team", text: "Separate workspaces with member, admin and owner roles. People accept or decline invitations by email." },
];

const security = [
  "Postgres row-level security checks every read and write, not only the app code.",
  "Free text such as note bodies, task descriptions and comments can be encrypted with AES-256-GCM, using a key that stays on your server.",
  "Search, uploads, exports and sign-in related endpoints are rate limited.",
  "File downloads are checked against your workspace, and share links are hashed and expire.",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold">
          <span className="brand-mark">SC</span>
          <span>Sanctum Cove</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <a href={repo} className="px-2 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]">GitHub</a>
          <Link href="/login" className="button-secondary min-h-0 px-3 py-1.5">Sign in</Link>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Sanctum Cove</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
          A self-hosted workspace for notes, tasks, a calendar, files and bookmarks. It runs on your own Supabase project, and your files stay in your own Google Drive.
        </p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <Link href="/login" className="button-primary">Sign in</Link>
          <a href={repo} className="button-secondary">View source on GitHub</a>
        </div>
      </section>

      <section aria-label="Preview of the Tasks page" className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
          <div className="grid md:grid-cols-[13rem_1fr]">
            <aside className="hidden border-r border-[var(--line)] p-3 md:block" aria-hidden>
              <p className="px-2 pb-3 text-sm font-semibold">Personal</p>
              <ul className="space-y-0.5 text-sm">
                {sidebar.map(({ icon: Icon, label, active }) => (
                  <li key={label} className={"flex items-center gap-2.5 rounded-lg px-2 py-1.5 " + (active ? "bg-[var(--surface-muted)] font-semibold text-[var(--foreground)]" : "text-[var(--muted)]")}>
                    <Icon size={16} aria-hidden />{label}
                  </li>
                ))}
              </ul>
            </aside>
            <div className="min-w-0 p-4 sm:p-6">
              <p className="text-xl font-bold">Tasks</p>
              <div className="issue-list-head mt-3">
                <div className="issue-tabs">
                  <span className="issue-tab is-active">Open <span className="issue-tab-count">4</span></span>
                  <span className="issue-tab">Closed <span className="issue-tab-count">12</span></span>
                  <span className="issue-tab">All <span className="issue-tab-count">16</span></span>
                </div>
              </div>
              <ul className="issue-list">
                {tasks.map((task) => (
                  <li key={task.title} className="issue-row">
                    <CircleDot size={16} className="issue-row-icon" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="issue-row-title">{task.title}</span>
                        <PriorityChip priority={task.priority} />
                        {task.label && <LabelChip name={task.label.name} color={task.label.color} />}
                      </div>
                      <p className="issue-row-meta">{task.meta}</p>
                    </div>
                    <div className="issue-row-side max-sm:hidden">
                      <div className="flex items-center gap-2.5">
                        {task.comments && <span className="inline-flex items-center gap-1"><MessageSquare size={13} aria-hidden />{task.comments}</span>}
                        {task.attachments && <span className="inline-flex items-center gap-1"><Paperclip size={13} aria-hidden />{task.attachments}</span>}
                      </div>
                      <span>{task.updated}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl gap-16 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1fr] lg:gap-x-20">
        <section aria-labelledby="inside">
          <h2 id="inside" className="text-xl font-bold">What&apos;s inside</h2>
          <dl className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {modules.map((module) => (
              <div key={module.name} className="grid gap-1 py-4 sm:grid-cols-[7rem_1fr] sm:gap-4">
                <dt className="font-semibold">{module.name}</dt>
                <dd className="leading-7 text-[var(--muted)]">{module.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="security">
          <h2 id="security" className="text-xl font-bold">Security</h2>
          <ul className="mt-6 space-y-4 leading-7 text-[var(--muted)]">
            {security.map((item) => <li key={item} className="border-l-2 border-[var(--line)] pl-4">{item}</li>)}
          </ul>
        </section>
      </div>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-[var(--muted)] sm:px-6">
          <p>Released under the MIT License.</p>
          <a href={repo} className="hover:text-[var(--foreground)]">Source on GitHub</a>
        </div>
      </footer>
    </main>
  );
}
