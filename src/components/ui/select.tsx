"use client"

import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"

type SelectOption = { value: string; label: string }
type SelectProps = { name?: string; defaultValue?: string; value?: string; onChange?: (value: string) => void; options: SelectOption[]; placeholder?: string; id?: string; className?: string; required?: boolean }

export function Select({ name, defaultValue, value, onChange, options, placeholder = "Select an option", id, className, required = false }: SelectProps) {
  const selectedValue = value ?? defaultValue ?? ""
  return (
    <SelectPrimitive.Root value={value} defaultValue={value === undefined ? defaultValue : undefined} onValueChange={onChange}>
      {name && <input type="hidden" id={id} name={name} value={selectedValue} required={required} />}
      <SelectPrimitive.Trigger id={id} className={"custom-select-trigger" + (className ? " " + className : "")} aria-label={name}>
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon><ChevronDown size={16} /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="custom-select-content" position="popper" sideOffset={5}>
          <SelectPrimitive.Viewport>
            {options.map((option) => <SelectPrimitive.Item key={option.value} value={option.value} className="custom-select-item"><SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText><SelectPrimitive.ItemIndicator className="custom-select-item-indicator"><Check size={14} /></SelectPrimitive.ItemIndicator></SelectPrimitive.Item>)}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
