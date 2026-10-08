"use client"

import { useFormStatus } from "react-dom"

/** Accept / Decline for an invitation form; both lock while the request runs so a double click can't submit twice. */
export function InvitationResponseButtons() {
  const { pending, data } = useFormStatus()
  const decision = data?.get("decision")
  return (
    <>
      <button name="decision" value="decline" disabled={pending} className="button-secondary min-h-0 px-3 py-1.5 text-xs disabled:opacity-60">{pending && decision === "decline" ? "Declining…" : "Decline"}</button>
      <button name="decision" value="accept" disabled={pending} className="button-primary min-h-0 px-3 py-1.5 text-xs disabled:opacity-60">{pending && decision === "accept" ? "Joining…" : "Accept"}</button>
    </>
  )
}
