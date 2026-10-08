import { tagTone } from "./note-content"

export function TagChip({ tag }: { tag: string }) {
  return <span className="tag-chip" data-tone={tagTone(tag)}>{tag}</span>
}
