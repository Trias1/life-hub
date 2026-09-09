"use client"

import { format, isValid, parse } from "date-fns"
import { DayPicker } from "react-day-picker"
import { useState } from "react"

type DateTimePickerProps = {
  name: string
  defaultValue?: string
  required?: boolean
  dateOnly?: boolean
}

function parseDateTime(value?: string) {
  if (!value) return new Date()
  const parsed = parse(value.slice(0, 16), "yyyy-MM-dd'T'HH:mm", new Date())
  return isValid(parsed) ? parsed : new Date()
}

export function DateTimePicker({ name, defaultValue = "", required = false, dateOnly = false }: DateTimePickerProps) {
  const initial = dateOnly && defaultValue ? parse(defaultValue.slice(0, 10), "yyyy-MM-dd", new Date()) : parseDateTime(defaultValue)
  const [date, setDate] = useState(initial)
  const [time, setTime] = useState(format(initial, "HH:mm"))
  const [open, setOpen] = useState(false)
  const value = date ? (dateOnly ? format(date, "yyyy-MM-dd") : `${format(date, "yyyy-MM-dd")}T${time}`) : ""

  return (
    <div className={dateOnly ? "date-time-picker date-only" : "date-time-picker"}>
      <input type="hidden" name={name} value={value} required={required} />
      <button type="button" className="date-time-picker-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        {value ? format(date, "MMM d, yyyy") : "Choose date"}
      </button>
      {!dateOnly && <input aria-label={`${name} time`} type="time" value={time} onChange={(event) => setTime(event.target.value)} className="field-control date-time-picker-time" required={required} />}
      {open && (
        <div className="date-time-picker-popover">
          <DayPicker mode="single" selected={date} onSelect={(selected) => { if (selected) { setDate(selected); setOpen(false) } }} />
        </div>
      )}
    </div>
  )
}
