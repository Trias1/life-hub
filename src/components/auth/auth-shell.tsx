import Link from "next/link"
import { CalendarDays, CircleDot, SquarePen } from "lucide-react"
import type { ReactNode } from "react"

type Props = { title: string; description: string; error?: string; success?: string; children: ReactNode; footer?: ReactNode }

/** Two-column auth layout: a quiet product preview on the left, the form on the right (form only on phones). */
export function AuthShell({ title, description, error, success, children, footer }: Props) {
  return (
    <main className="auth-shell">
      <aside className="auth-aside" aria-hidden>
        <Link href="/" className="auth-brand"><span className="brand-mark">SC</span><span>Sanctum Cove</span></Link>
        <div>
          <p className="auth-aside-title">Notes, tasks and your calendar, in one calm workspace.</p>
          <ul className="auth-preview">
            <li><SquarePen size={15} /><span>Project brief</span><em>updated 2h ago</em></li>
            <li><CircleDot size={15} /><span>Review team notes</span><em>due Fri</em></li>
            <li><CalendarDays size={15} /><span>Design sync</span><em>14:00</em></li>
          </ul>
        </div>
        <p className="auth-aside-foot">Private by default. Shared only with the people you invite.</p>
      </aside>
      <section className="auth-panel">
        <div className="auth-card">
          <Link href="/" className="auth-brand auth-brand-mobile"><span className="brand-mark">SC</span><span>Sanctum Cove</span></Link>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
          {error && <p role="alert" className="auth-alert" data-tone="error">{error}</p>}
          {success && <p role="status" className="auth-alert" data-tone="success">{success}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </section>
    </main>
  )
}
