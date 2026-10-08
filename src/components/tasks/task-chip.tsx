import { labelTone, priorityTone } from "./task-meta"

export function LabelChip({ name, color }: { name: string; color: string }) {
  return <span className="tag-chip" data-tone={labelTone(color)}>{name}</span>
}

export function PriorityChip({ priority }: { priority: string }) {
  return <span className="tag-chip" data-tone={priorityTone[priority] ?? "sky"}>Priority: {priority}</span>
}

/** Small round initial standing in for an avatar. */
export function AssigneeBadge({ name }: { name: string }) {
  // A div without child spans, so list-row rules that hide the last span on phones leave it alone.
  return <div role="img" aria-label={"Assigned to " + name} title={"Assigned to " + name} className="inline-grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] text-[10px] font-semibold text-[var(--foreground)]">{name === "You" ? "Y" : name.slice(7, 8).toUpperCase()}</div>
}
