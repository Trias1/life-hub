"use client"

import { useFormStatus } from "react-dom"

export function SubmitButton({ label, pendingLabel, className = "button-primary disabled:opacity-60" }: { label: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus()
  return <button disabled={pending} className={className}>{pending ? pendingLabel : label}</button>
}
