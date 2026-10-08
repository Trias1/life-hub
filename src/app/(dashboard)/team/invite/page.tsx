import Link from "next/link"
import { Select } from "@/components/ui/select"
import { SubmitButton } from "@/components/team/team-controls"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { inviteMember } from "../actions"

export default async function InviteMembersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const context = await getWorkspaceContext()
  if (!context) return null
  const isSuperAdmin = context.role === "super_admin"
  const isAdmin = context.role === "admin" || isSuperAdmin

  return (
    <div className="page-container">
      <nav aria-label="Breadcrumb" className="issue-breadcrumb">
        <Link href="/team">Members</Link>
        <span aria-hidden>/</span>
        <span>Invite</span>
      </nav>
      <h1 className="issue-title mt-4">Invite members</h1>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {isAdmin ? (
        <form action={inviteMember} className="issue-form mt-6">
          <div className="issue-form-field max-w-xl">
            <label htmlFor="member-email" className="issue-form-label">Email <span className="font-normal text-[var(--muted)]">(required)</span></label>
            <input id="member-email" required autoFocus name="email" type="email" autoComplete="off" placeholder="member@example.com" className="field-control" />
            <p className="text-xs text-[var(--muted)]">We send an invitation email when an email provider is configured. You also get a link to share yourself.</p>
          </div>
          <div className="issue-form-field issue-form-narrow">
            <label htmlFor="member-role" className="issue-form-label">Role</label>
            <Select id="member-role" name="role" defaultValue="user" className="field-control" options={[{ value: "user", label: "User" }, ...(isSuperAdmin ? [{ value: "admin", label: "Admin" }] : [])]} />
          </div>
          <div className="max-w-xl space-y-1.5 text-xs text-[var(--muted)]">
            <dl className="space-y-1.5">
              <div><dt className="inline font-semibold text-[var(--foreground)]">User</dt> <dd className="inline">· works with shared workspace content.</dd></div>
              <div><dt className="inline font-semibold text-[var(--foreground)]">Admin</dt> <dd className="inline">· also invites users and removes them, and sees pending invitations. {!isSuperAdmin && "Only a super admin can invite admins."}</dd></div>
            </dl>
            <p>Give the smallest role needed for the work. Invitations expire if they are not accepted in time.</p>
          </div>
          <div className="issue-form-actions">
            <SubmitButton className="button-primary" pendingText="Inviting…">Invite</SubmitButton>
            <Link href="/team" className="button-secondary">Cancel</Link>
          </div>
        </form>
      ) : (
        <div className="issue-empty">
          <h2>Only admins can invite members</h2>
          <p>Ask a workspace admin to send the invitation for you.</p>
          <Link href="/team" className="button-secondary mt-4">Back to members</Link>
        </div>
      )}
    </div>
  )
}
