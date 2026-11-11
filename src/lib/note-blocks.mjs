// Turns "label : value" lists in a note into account cards. Works on the TipTap JSON document
// (already filtered through the note schema), so nothing here ever renders raw HTML.

const LIST_TYPES = new Set(["bulletList", "orderedList"])

/** "Life-hub : a@b.com" → { label, value }; null when the line isn't a short label and a value. "://" never counts as the separator. */
export function parseKeyValue(text) {
  const line = String(text ?? "").replace(/\s+/g, " ").trim()
  for (let index = line.indexOf(":"); index !== -1; index = line.indexOf(":", index + 1)) {
    if (line.startsWith("//", index + 1)) continue
    const label = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim()
    if (!label || !value || label.length > 60) return null
    return { label, value }
  }
  return null
}

/** One entry per distinct value (case- and space-insensitive), keeping first-seen order and spelling. */
export function groupByValue(pairs) {
  const groups = new Map()
  for (const { label, value } of pairs) {
    const key = value.trim().toLowerCase()
    const group = groups.get(key) ?? { value: value.trim(), labels: [] }
    if (!group.labels.includes(label)) group.labels.push(label)
    groups.set(key, group)
  }
  return [...groups.values()]
}

/** Two letters for the card's circle, from the part before "@" when it's an email. */
export function accountInitials(value) {
  const name = String(value).split("@")[0].replace(/[^a-z0-9]/gi, "")
  return (name.slice(0, 2) || String(value).slice(0, 2)).toUpperCase()
}

function textOf(node) {
  if (!node) return ""
  if (node.type === "text") return node.text ?? ""
  if (node.type === "hardBreak") return " "
  return (node.content ?? []).map(textOf).join("")
}

/** Pairs for a list whose every item is a single "label : value" paragraph, else null. */
function listPairs(node) {
  if (!LIST_TYPES.has(node?.type) || !node.content?.length) return null
  const pairs = []
  for (const item of node.content) {
    if (item.type !== "listItem" || item.content?.length !== 1 || item.content[0].type !== "paragraph") return null
    const pair = parseKeyValue(textOf(item.content[0]))
    if (!pair) return null
    pairs.push(pair)
  }
  return pairs
}

/** Splits a document into runs of normal content and account-card groups, in order. */
export function splitNoteDoc(doc) {
  const segments = []
  for (const node of doc?.content ?? []) {
    const pairs = listPairs(node)
    if (pairs) {
      segments.push({ kind: "accounts", groups: groupByValue(pairs) })
      continue
    }
    const last = segments[segments.length - 1]
    if (last?.kind === "doc") last.content.push(node)
    else segments.push({ kind: "doc", content: [node] })
  }
  return segments
}
