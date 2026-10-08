import { Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { listMyInvitations } from "@/lib/invitations"
import { relativeTime } from "@/lib/relative-time"
import { respondToInvitation } from "./actions"

const roleLabels: Record<string, string> = { user: "Member", admin: "Admin" }

export default async function InvitesPage() {
  const supabase = await createClient()
  const invitations = await listMyInvitations(supabase)
  const now = new Date()

  return (
    <div className="page-container">
      <div className="issue-page-head">
        <h1 className="issue-title">Invitations</h1>
      </div>
      <p className="text-sm text-[var(--muted)]">Workspaces that invited your email address. Accepting adds you as a member and opens the workspace.</p>
      {invitations.length ? (
        <ul className="issue-list">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="issue-row items-center">
              <Mail size={16} className="issue-row-icon" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="issue-row-title">{invitation.workspace_name}</p>
                <p className="issue-row-meta">{roleLabels[invitation.role] ?? invitation.role} · invited {relativeTime(invitation.created_at, now)} · expires {relativeTime(invitation.expires_at, now)}</p>
              </div>
              <form action={respondToInvitation} className="flex shrink-0 gap-2">
                <input type="hidden" name="id" value={invitation.id} />
                <button name="decision" value="decline" className="button-secondary min-h-0 px-3 py-1.5 text-xs">Decline</button>
                <button name="decision" value="accept" className="button-primary min-h-0 px-3 py-1.5 text-xs">Accept</button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <div className="issue-empty">
          <h2>No invitations waiting</h2>
          <p>When someone invites your email address to a workspace, it shows up here and at the top of every page.</p>
        </div>
      )}
    </div>
  )
}
