"use client"

import { useFormStatus } from "react-dom"

export function SubmitButton({ label, pendingLabel, className = "button-primary disabled:opacity-60", disabled = false }: { label: string; pendingLabel: string; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus()
  return <button disabled={pending || disabled} className={className}>{pending ? pendingLabel : label}</button>
}
