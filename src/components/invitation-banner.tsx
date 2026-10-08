import Link from "next/link"
import { Mail } from "lucide-react"
import { respondToInvitation } from "@/app/(dashboard)/invites/actions"
import type { MyInvitation } from "@/lib/invitations"
import { InvitationResponseButtons } from "@/components/invitation-response-buttons"

const roleLabels: Record<string, string> = { user: "a member", admin: "an admin" }

/** Slack-style strip shown above every page while the user has invitations waiting. */
export function InvitationBanner({ invitations }: { invitations: MyInvitation[] }) {
  const [first] = invitations
  if (!first) return null
  const others = invitations.length - 1
  return (
    <div role="region" aria-label="Workspace invitations" className="invite-banner">
      <Mail size={16} aria-hidden className="shrink-0" />
      <p className="min-w-0 flex-1">
        You&apos;re invited to join <strong>{first.workspace_name}</strong> as {roleLabels[first.role] ?? first.role}.
        {others > 0 && <> <Link href="/invites" className="underline underline-offset-2">{others === 1 ? "1 more invitation" : others + " more invitations"}</Link></>}
      </p>
      <form action={respondToInvitation} className="flex shrink-0 gap-2">
        <input type="hidden" name="id" value={first.id} />
        <input type="hidden" name="returnTo" value="/dashboard" />
        <InvitationResponseButtons />
      </form>
    </div>
  )
}
