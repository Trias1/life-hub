import Link from "next/link"
import { Mail, Search } from "lucide-react"
import { Select } from "@/components/ui/select"
import { InvitationLinkNotice, InvitationMenu, MemberControls } from "@/components/team/team-controls"
import { relativeTime } from "@/lib/relative-time"
import { getWorkspaceContext } from "@/lib/workspace/server"
import { changeMemberRole, removeMember, revokeInvitation } from "./actions"

type Member = { user_id: string; role: string; created_at: string }
type Invitation = { id: string; email: string; role: string; expires_at: string; accepted_at: string | null; declined_at?: string | null; created_at: string }
type Tab = "members" | "invitations"
type InvitationState = "pending" | "accepted" | "declined" | "expired"
type Sort = "joined" | "recent" | "role"

const roleLabels: Record<string, string> = { user: "User", admin: "Admin", super_admin: "Super admin" }
const roleRank: Record<string, number> = { super_admin: 0, admin: 1, user: 2 }
const stateBadge: Record<InvitationState, string> = { pending: "active", accepted: "archived", declined: "closed", expired: "trash" }
// Server component: a fixed locale and zone keep the label stable regardless of the host.
const joinedFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" })

function invitationState(invitation: Invitation, now: number): InvitationState {
  if (invitation.accepted_at) return "accepted"
  if (invitation.declined_at) return "declined"
  if (new Date(invitation.expires_at).getTime() <= now) return "expired"
  return "pending"
}

function memberId(value: string) {
  return value.slice(0, 8)
}

function RoleBadge({ role }: { role: string }) {
  return <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--foreground)]">{roleLabels[role] ?? role}</span>
}

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; invite?: string; email?: string; tab?: string; q?: string; role?: string; status?: string; state?: string; sort?: string }> }) {
  const params = await searchParams
  const context = await getWorkspaceContext()
  if (!context) return null

  const isSuperAdmin = context.role === "super_admin"
  const isAdmin = context.role === "admin" || isSuperAdmin
  const [{ data: memberData }, { data: workspace }] = await Promise.all([
    context.supabase.from("workspace_members").select("user_id,role,created_at").eq("workspace_id", context.workspaceId).order("created_at"),
    context.supabase.from("workspaces").select("owner_id").eq("id", context.workspaceId).maybeSingle(),
  ])
  const { data: invitationData } = isAdmin
    ? await context.supabase.from("workspace_invitations").select("*").eq("workspace_id", context.workspaceId).order("created_at", { ascending: false })
    : { data: [] }

  const members = (memberData ?? []) as Member[]
  const invitations = (invitationData ?? []) as Invitation[]
  // Old links used ?status=pending for the invitation list.
  const requestedTab = params.tab ?? (params.status === "pending" ? "invitations" : "members")
  const tab: Tab = isAdmin && requestedTab === "invitations" ? "invitations" : "members"
  const q = (params.q ?? "").trim().slice(0, 100)
  const query = q.toLowerCase()
  const role = params.role === "user" || params.role === "admin" || params.role === "super_admin" ? params.role : "all"
  const sort: Sort = params.sort === "recent" || params.sort === "role" ? params.sort : "joined"
  const stateFilter: InvitationState | "all" = params.state === "accepted" || params.state === "declined" || params.state === "expired" || params.state === "all" ? params.state : "pending"
  const nowDate = new Date()
  const now = nowDate.getTime()
  const matchesRole = (value: string) => role === "all" || value === role

  const visibleMembers = members
    .filter((member) => matchesRole(member.role) && (!query || member.user_id.toLowerCase().includes(query)))
    .sort((a, b) => sort === "recent" ? b.created_at.localeCompare(a.created_at) : sort === "role" ? (roleRank[a.role] ?? 9) - (roleRank[b.role] ?? 9) || a.created_at.localeCompare(b.created_at) : a.created_at.localeCompare(b.created_at))
  const visibleInvitations = invitations.filter((invitation) => (stateFilter === "all" || invitationState(invitation, now) === stateFilter) && matchesRole(invitation.role) && (!query || invitation.email.toLowerCase().includes(query)))
  const pendingCount = invitations.filter((invitation) => invitationState(invitation, now) === "pending").length
  const filtered = Boolean(q) || role !== "all" || (tab === "invitations" && stateFilter !== "pending")
  const emailHeading = params.email === "sent" ? "Invitation email sent" : params.email === "failed" ? "Email failed; use the link below" : "Email provider not configured; use the link below"

  const href = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams()
    const merged = { tab: tab === "members" ? undefined : tab, q: q || undefined, role: role === "all" ? undefined : role, ...changes }
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value)
    const search = next.toString()
    return "/team" + (search ? "?" + search : "")
  }

  return (
    <div className="page-container">
      {params.error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
      {params.success && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{params.success}</p>}
      {isAdmin && params.invite && <InvitationLinkNotice path={"/invitations/" + encodeURIComponent(params.invite)} heading={emailHeading} />}

      <div className="issue-page-head">
        <h1 className="issue-title">Members</h1>
        {isAdmin && <Link href="/team/invite" className="button-primary min-h-0 px-3.5 py-2">Invite members</Link>}
      </div>
      <div className="issue-list-head">
        <nav aria-label="Team views" className="issue-tabs">
          <Link href={href({ tab: undefined })} aria-current={tab === "members" ? "page" : undefined} className={"issue-tab" + (tab === "members" ? " is-active" : "")}>
            Members<span className="issue-tab-count">{members.length}</span>
          </Link>
          {isAdmin && (
            <Link href={href({ tab: "invitations" })} aria-current={tab === "invitations" ? "page" : undefined} className={"issue-tab" + (tab === "invitations" ? " is-active" : "")}>
              Pending invitations<span className="issue-tab-count">{pendingCount}</span>
            </Link>
          )}
        </nav>
      </div>

      <form method="get" action="/team" className="issue-filter">
        {tab === "invitations" && <input type="hidden" name="tab" value="invitations" />}
        <label className="issue-search">
          <Search size={15} aria-hidden />
          <span className="sr-only">{tab === "members" ? "Search members by ID" : "Search invitations by email"}</span>
          <input name="q" defaultValue={q} placeholder={tab === "members" ? "Search by member ID…" : "Search by email…"} />
        </label>
        <Select id="team-role-filter" name="role" defaultValue={role} className="field-control issue-filter-select" options={[{ value: "all", label: "All roles" }, { value: "user", label: "Users" }, { value: "admin", label: "Admins" }, { value: "super_admin", label: "Super admins" }]} />
        {tab === "members"
          ? <Select id="team-sort" name="sort" defaultValue={sort} className="field-control issue-filter-select" options={[{ value: "joined", label: "Joined (oldest)" }, { value: "recent", label: "Joined (newest)" }, { value: "role", label: "Role" }]} />
          : <Select id="team-state-filter" name="state" defaultValue={stateFilter} className="field-control issue-filter-select" options={[{ value: "pending", label: "Pending" }, { value: "expired", label: "Expired" }, { value: "accepted", label: "Accepted" }, { value: "declined", label: "Declined" }, { value: "all", label: "All states" }]} />}
        <button className="issue-filter-apply button-secondary min-h-0 px-3.5 py-2">Apply</button>
      </form>

      {filtered && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          Showing {tab === "members" ? visibleMembers.length : visibleInvitations.length} {tab === "members" ? (visibleMembers.length === 1 ? "member" : "members") : (visibleInvitations.length === 1 ? "invitation" : "invitations")}
          <Link href={href({ q: undefined, role: undefined })} className="underline">Clear filters</Link>
        </p>
      )}

      {tab === "members" && (visibleMembers.length ? (
        <ul className="issue-list">
          {visibleMembers.map((member) => {
            const shortId = memberId(member.user_id)
            const isCurrentUser = member.user_id === context.user.id
            const isOwner = member.user_id === workspace?.owner_id
            const isProtected = isCurrentUser || isOwner || member.role === "super_admin"
            const canManageMember = Boolean(workspace?.owner_id) && isAdmin && !isProtected && (isSuperAdmin || member.role === "user")
            return (
              <li key={member.user_id} className="issue-row flex-wrap items-center sm:flex-nowrap">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center self-start rounded-full bg-[var(--surface-muted)] text-sm font-bold uppercase text-[var(--foreground)] sm:self-center">{member.user_id.slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold text-[var(--foreground)]">Member {shortId}</span>
                    {isCurrentUser && <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">You</span>}
                    {isOwner && <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">Owner</span>}
                  </p>
                  <p className="issue-row-meta">Active · Joined <time dateTime={member.created_at} title={member.created_at}>{joinedFormat.format(new Date(member.created_at))}</time></p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 pl-11 sm:w-auto sm:shrink-0 sm:justify-end sm:pl-0">
                  {!(canManageMember && isSuperAdmin) && <RoleBadge role={member.role} />}
                  {canManageMember && <MemberControls userId={member.user_id} shortId={shortId} role={member.role} canChangeRole={isSuperAdmin} changeMemberRole={changeMemberRole} removeMember={removeMember} />}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="issue-empty">
          <h2>{filtered ? "No members match these filters" : "No members yet"}</h2>
          <p>{filtered ? "Try a different member ID or role." : "Invite people to start working together in this workspace."}</p>
        </div>
      ))}

      {tab === "invitations" && (visibleInvitations.length ? (
        <ul className="issue-list">
          {visibleInvitations.map((invitation) => {
            const state = invitationState(invitation, now)
            const canRevoke = state === "pending" && (isSuperAdmin || invitation.role === "user")
            return (
              <li key={invitation.id} className="issue-row flex-wrap items-center sm:flex-nowrap">
                <Mail size={16} className="issue-row-icon self-start sm:self-center" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--foreground)] [overflow-wrap:anywhere]">{invitation.email}</p>
                  <p className="issue-row-meta">
                    {roleLabels[invitation.role] ?? invitation.role} · invited <time dateTime={invitation.created_at} title={invitation.created_at}>{relativeTime(invitation.created_at, nowDate)}</time>
                    {" · "}{state === "accepted" ? "accepted" : state === "declined" ? "declined" : state === "expired" ? "expired" : "expires"} <time dateTime={invitation.accepted_at ?? invitation.declined_at ?? invitation.expires_at} title={invitation.accepted_at ?? invitation.declined_at ?? invitation.expires_at}>{relativeTime(invitation.accepted_at ?? invitation.declined_at ?? invitation.expires_at, nowDate)}</time>
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 pl-7 sm:w-auto sm:shrink-0 sm:justify-end sm:pl-0">
                  <span className="issue-state capitalize" data-state={stateBadge[state]}>{state}</span>
                  <RoleBadge role={invitation.role} />
                  {canRevoke && <InvitationMenu id={invitation.id} email={invitation.email} revokeInvitation={revokeInvitation} />}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="issue-empty">
          <h2>{filtered ? "No invitations match these filters" : "No pending invitations"}</h2>
          <p>{filtered ? "Try a different email, role, or state." : "Invitations you send show up here until they are accepted or expire."}</p>
          {!filtered && <Link href="/team/invite" className="button-primary mt-4">Invite members</Link>}
        </div>
      ))}
    </div>
  )
}
