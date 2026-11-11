"use client"

import { format, isValid, parse } from "date-fns"
import { DayPicker } from "react-day-picker"
import { useEffect, useRef, useState } from "react"

type DateTimePickerProps = {
  name: string
  defaultValue?: string
  /** Controlled value ("yyyy-MM-ddTHH:mm", or "yyyy-MM-dd" with dateOnly); pair with onChange. */
  value?: string
  onChange?: (value: string) => void
  required?: boolean
  dateOnly?: boolean
  invalid?: boolean
}

function parseValue(value: string | undefined, dateOnly: boolean) {
  if (!value) return new Date()
  const parsed = dateOnly ? parse(value.slice(0, 10), "yyyy-MM-dd", new Date()) : parse(value.slice(0, 16), "yyyy-MM-dd'T'HH:mm", new Date())
  return isValid(parsed) ? parsed : new Date()
}

export function DateTimePicker({ name, defaultValue = "", value: controlled, onChange, required = false, dateOnly = false, invalid = false }: DateTimePickerProps) {
  const [internal, setInternal] = useState(() => {
    const initial = parseValue(defaultValue, dateOnly)
    return dateOnly ? format(initial, "yyyy-MM-dd") : format(initial, "yyyy-MM-dd'T'HH:mm")
  })
  const value = controlled ?? internal
  const date = parseValue(value, dateOnly)
  const time = dateOnly ? "" : format(date, "HH:mm")
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  const update = (next: string) => {
    if (controlled === undefined) setInternal(next)
    onChange?.(next)
  }
  const pickDate = (selected: Date) => update(dateOnly ? format(selected, "yyyy-MM-dd") : `${format(selected, "yyyy-MM-dd")}T${time}`)

  // Close on a click outside or Escape, like other popovers.
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false) }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey) }
  }, [open])

  return (
    <div ref={root} className={dateOnly ? "date-time-picker date-only" : "date-time-picker"}>
      <input type="hidden" name={name} value={value} required={required} />
      <button type="button" className="date-time-picker-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="dialog">
        {format(date, "EEE, d MMM yyyy")}
      </button>
      {!dateOnly && <input aria-label={`${name} time`} type="time" value={time} onChange={(event) => { if (event.target.value) update(`${format(date, "yyyy-MM-dd")}T${event.target.value}`) }} className="field-control date-time-picker-time" required={required} aria-invalid={invalid || undefined} />}
      {open && (
        <div className="date-time-picker-popover" role="dialog" aria-label="Choose a date">
          <DayPicker mode="single" selected={date} defaultMonth={date} onSelect={(selected) => { if (selected) { pickDate(selected); setOpen(false) } }} />
        </div>
      )}
    </div>
  )
}
