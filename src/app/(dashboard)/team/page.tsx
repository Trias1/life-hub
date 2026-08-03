import { getWorkspaceContext } from "@/lib/workspace/server"
import { changeMemberRole, inviteMember } from "./actions"

type Member = { user_id: string; role: string; created_at: string }
type Invitation = { id: string; email: string; role: string; expires_at: string; accepted_at: string | null; created_at: string }
type TeamStatus = "all" | "members" | "pending"

function invitationState(invitation: Invitation, now: number) {
  if (invitation.accepted_at) return "accepted"
  if (new Date(invitation.expires_at).getTime() <= now) return "expired"
  return "pending"
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function memberId(value: string) {
  return value.slice(0, 8)
}

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ invite?: string; q?: string; role?: string; status?: string }> }) {
  const params = await searchParams
  const context = await getWorkspaceContext()
  if (!context) return null

  const isAdmin = context.role === "admin" || context.role === "super_admin"
  const { data: memberData } = await context.supabase
    .from("workspace_members")
    .select("user_id,role,created_at")
    .eq("workspace_id", context.workspaceId)
    .order("created_at")
  const { data: invitationData } = isAdmin
    ? await context.supabase.from("workspace_invitations").select("id,email,role,expires_at,accepted_at,created_at").eq("workspace_id", context.workspaceId).order("created_at", { ascending: false })
    : { data: [] }

  const members = (memberData ?? []) as Member[]
  const invitations = (invitationData ?? []) as Invitation[]
  const query = params.q?.trim().toLowerCase() ?? ""
  const role = params.role === "user" || params.role === "admin" || params.role === "super_admin" ? params.role : "all"
  const status: TeamStatus = params.status === "members" || params.status === "pending" ? params.status : "all"
  const now = Date.now()
  const matchesRole = (value: string) => role === "all" || value === role
  const visibleMembers = status === "pending" ? [] : members.filter((member) => matchesRole(member.role) && (!query || member.user_id.toLowerCase().includes(query)))
  const visibleInvitations = status === "members" ? [] : invitations.filter((invitation) => (status !== "pending" || invitationState(invitation, now) === "pending") && matchesRole(invitation.role) && (!query || invitation.email.toLowerCase().includes(query)))
  const pendingInvitations = invitations.filter((invitation) => invitationState(invitation, now) === "pending")

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <p className="eyebrow">People and access</p>
          <h1 className="page-title">Team</h1>
          <p className="page-description">Invite people and keep workspace permissions understandable.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700">{members.length} members</span>
          {isAdmin && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">{pendingInvitations.length} pending</span>}
        </div>
      </header>

      {isAdmin && <section className="surface mt-8 p-5">
        <p className="eyebrow">Invite member</p>
        <h2 className="mt-1 text-lg font-semibold">Grow the workspace</h2>
        <p className="mt-1 text-sm text-zinc-500">Send access with the smallest role needed for the work.</p>
        <form action={inviteMember} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="sr-only" htmlFor="member-email">Member email</label>
          <input id="member-email" required name="email" type="email" placeholder="member@example.com" className="field-control" />
          <label className="sr-only" htmlFor="member-role">Member role</label>
          <select id="member-role" name="role" defaultValue="user" className="field-control">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button className="button-primary">Invite</button>
        </form>
        {params.invite && <div className="mt-4 rounded-xl border border-zinc-300 bg-zinc-100 p-3 text-sm text-zinc-800"><p className="font-semibold">Invitation link created</p><p className="mt-1 break-all font-mono text-xs">/invitations/{params.invite}</p></div>}
      </section>}

      <section className="surface mt-8 p-4">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Workspace directory</p>
            <p className="mt-1 text-sm text-zinc-500">Search members and pending invitations by identity or role.</p>
          </div>
          <span className="text-sm text-zinc-500">{visibleMembers.length + visibleInvitations.length} shown</span>
        </div>
        <form method="get" action="/team" className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="sr-only" htmlFor="team-search">Search team</label>
          <input id="team-search" name="q" defaultValue={params.q ?? ""} placeholder="Search by member ID or email" className="field-control" />
          <label className="sr-only" htmlFor="team-role-filter">Filter by role</label>
          <select id="team-role-filter" name="role" defaultValue={role} className="field-control">
            <option value="all">All roles</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
            <option value="super_admin">Super admins</option>
          </select>
          <label className="sr-only" htmlFor="team-status-filter">Filter by status</label>
          <select id="team-status-filter" name="status" defaultValue={status} className="field-control">
            <option value="all">All people</option>
            <option value="members">Members</option>
            {isAdmin && <option value="pending">Pending invites</option>}
          </select>
          <button className="button-secondary">Apply filters</button>
        </form>
      </section>

      <section className="mt-8 space-y-3">
        {visibleMembers.map((member) => {
          const isCurrentUser = member.user_id === context.user.id
          return <article key={member.user_id} className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-200 text-sm font-bold text-zinc-700">{member.user_id.slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><p className="font-medium">Workspace member</p>{isCurrentUser && <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">You</span>}</div>
                <p className="mt-1 font-mono text-xs text-zinc-500">ID {memberId(member.user_id)}…</p>
                <p className="mt-1 text-sm text-zinc-400">Active · Joined {formatDate(member.created_at)}</p>
              </div>
            </div>
            {isAdmin && !isCurrentUser ? <form action={changeMemberRole} className="flex gap-2">
              <input type="hidden" name="userId" value={member.user_id} />
              <label className="sr-only" htmlFor={`role-${member.user_id}`}>Role for member {memberId(member.user_id)}</label>
              <select id={`role-${member.user_id}`} name="role" defaultValue={member.role} className="field-control min-h-0 py-2 text-xs">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button className="button-quiet min-h-0 px-2 py-1 text-xs">Save</button>
            </form> : <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold capitalize text-zinc-600">{member.role.replace("_", " ")}</span>}
          </article>
        })}

        {isAdmin && visibleInvitations.map((invitation) => {
          const state = invitationState(invitation, now)
          const stateStyle = state === "pending" ? "bg-amber-50 text-amber-700" : state === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
          return <article key={invitation.id} className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-sm font-bold text-amber-700">@</div>
              <div className="min-w-0">
                <p className="font-medium">{invitation.email}</p>
                <p className="mt-1 text-sm text-zinc-400">Invitation - {state} - Sent {formatDate(invitation.created_at)} - Expires {formatDate(invitation.expires_at)}</p>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${stateStyle}`}>{state} - {invitation.role}</span>
          </article>
        })}
        {!visibleMembers.length && !visibleInvitations.length && <div className="empty-state surface"><h2 className="font-semibold">No matching people</h2><p>Try a different search or filter.</p></div>}
      </section>
    </div>
  )
}
