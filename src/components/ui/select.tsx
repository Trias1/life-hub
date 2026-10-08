"use client"

import * as SelectPrimitive from "@radix-ui/react-select"
import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"

type SelectOption = { value: string; label: string }

// Radix reserves "" for "no selection", so options with an empty value (e.g. "All tags")
// are mapped to a sentinel internally and back to "" for the form and callbacks.
const EMPTY = "__lifehub_empty__"
const toRadix = (value: string | undefined) => (value === "" ? EMPTY : value)
const fromRadix = (value: string) => (value === EMPTY ? "" : value)
type SelectProps = { name?: string; defaultValue?: string; value?: string; onChange?: (value: string) => void; options: SelectOption[]; placeholder?: string; id?: string; className?: string; required?: boolean }

export function Select({ name, defaultValue, value, onChange, options, placeholder = "Select an option", id, className, required = false }: SelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "")
  const selectedValue = value ?? internalValue
  const handleValueChange = (radixValue: string) => {
    const nextValue = fromRadix(radixValue)
    if (value === undefined) setInternalValue(nextValue)
    onChange?.(nextValue)
  }
  return (
    <SelectPrimitive.Root value={toRadix(value)} defaultValue={value === undefined ? toRadix(defaultValue) : undefined} onValueChange={handleValueChange}>
      {name && <input type="hidden" id={id} name={name} value={selectedValue} required={required} />}
      <SelectPrimitive.Trigger id={id} className={"custom-select-trigger" + (className ? " " + className : "")} aria-label={name}>
        {/* Render the label ourselves: Radix only knows it after the items mount on the client, so SSR showed an empty trigger. */}
        <SelectPrimitive.Value placeholder={placeholder}>{options.find((option) => option.value === selectedValue)?.label}</SelectPrimitive.Value>
        <SelectPrimitive.Icon><ChevronDown size={16} /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="custom-select-content" position="popper" sideOffset={5}>
          <SelectPrimitive.Viewport>
            {options.map((option) => <SelectPrimitive.Item key={option.value} value={toRadix(option.value) ?? EMPTY} className="custom-select-item"><SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText><SelectPrimitive.ItemIndicator className="custom-select-item-indicator"><Check size={14} /></SelectPrimitive.ItemIndicator></SelectPrimitive.Item>)}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
