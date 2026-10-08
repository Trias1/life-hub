"use client"

import { useEffect, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { Check, Copy, ExternalLink, MoreVertical, Trash2, UserMinus } from "lucide-react"
import { Select } from "@/components/ui/select"

type FormAction = (formData: FormData) => Promise<void>

function useMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", escape)
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape) }
  }, [open])
  return { open, setOpen, ref }
}

function RowMenu({ label, item }: { label: string; item: (close: () => void) => React.ReactNode }) {
  const { open, setOpen, ref } = useMenu()
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="button-quiet min-h-0 px-2 py-1.5"><MoreVertical size={16} /></button>
      {open && <div role="menu" className="issue-menu">{item(() => setOpen(false))}</div>}
    </div>
  )
}

/** Role picker (super admins only) and a ⋮ menu with "Remove member" for a manageable member row. */
export function MemberControls({ userId, shortId, role, canChangeRole, changeMemberRole, removeMember }: { userId: string; shortId: string; role: string; canChangeRole: boolean; changeMemberRole: FormAction; removeMember: FormAction }) {
  const [nextRole, setNextRole] = useState(role)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canChangeRole && (
        <form action={changeMemberRole} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={userId} />
          <label className="sr-only" htmlFor={"role-" + userId}>Role for member {shortId}</label>
          <Select id={"role-" + userId} name="role" value={nextRole} onChange={setNextRole} className="field-control min-h-0 w-28 py-1.5 text-xs" options={[{ value: "user", label: "User" }, { value: "admin", label: "Admin" }]} />
          {nextRole !== role && <SubmitButton className="button-secondary min-h-0 px-2.5 py-1.5 text-xs" pendingText="Saving…">Save</SubmitButton>}
        </form>
      )}
      <RowMenu label={"Actions for member " + shortId} item={(close) => (
        <form action={removeMember} onSubmit={(event) => { if (!window.confirm("Remove member " + shortId + " from this workspace? They lose access immediately.")) event.preventDefault(); else close() }}>
          <input type="hidden" name="id" value={userId} />
          <button role="menuitem" className="text-red-600" aria-label={"Remove member " + shortId}><UserMinus size={14} />Remove member</button>
        </form>
      )} />
    </div>
  )
}

/** ⋮ menu with "Revoke invitation" for a pending invitation row. */
export function InvitationMenu({ id, email, revokeInvitation }: { id: string; email: string; revokeInvitation: FormAction }) {
  return (
    <RowMenu label={"Actions for invitation to " + email} item={(close) => (
      <form action={revokeInvitation} onSubmit={(event) => { if (!window.confirm("Revoke the invitation for " + email + "? The link stops working.")) event.preventDefault(); else close() }}>
        <input type="hidden" name="id" value={id} />
        <button role="menuitem" className="text-red-600" aria-label={"Revoke invitation for " + email}><Trash2 size={14} />Revoke invitation</button>
      </form>
    )} />
  )
}

/** Shown once after an invite: the token is not stored in clear, so this is the only time the link is available. */
export function InvitationLinkNotice({ path, heading }: { path: string; heading: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin + path)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div role="status" className="issue-banner flex-col items-stretch">
      <div>
        <p className="font-semibold">{heading}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">This link is shown only once. Copy it now if you need to share it yourself.</p>
      </div>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <label htmlFor="invitation-link" className="sr-only">Invitation link</label>
        <input id="invitation-link" readOnly value={path} onFocus={(event) => event.currentTarget.select()} className="field-control min-h-0 min-w-0 flex-1 py-1.5 font-mono text-xs" />
        <div className="flex gap-2">
          <button type="button" onClick={() => void copy()} className="button-secondary min-h-0 flex-1 px-3 py-1.5 text-xs">{copied ? <Check size={14} className="mr-1.5" /> : <Copy size={14} className="mr-1.5" />}{copied ? "Copied" : "Copy link"}</button>
          <a href={path} className="button-secondary min-h-0 flex-1 px-3 py-1.5 text-xs"><ExternalLink size={14} className="mr-1.5" />Open link</a>
        </div>
      </div>
    </div>
  )
}

export function SubmitButton({ children, pendingText, className }: { children: React.ReactNode; pendingText: string; className: string }) {
  const { pending } = useFormStatus()
  return <button disabled={pending} className={className + " disabled:opacity-60"}>{pending ? pendingText : children}</button>
}
