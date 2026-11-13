// Sub-page helpers. Work on plain rows ({ id, parent_id, ... }) so the same code serves the
// notes list, the Pages panel and the server actions. A row whose parent isn't in the set
// (archived, trashed, or filtered out) is treated as a top-level note.

/**
 * Map of parent id → child rows, in the order given. Unknown parents map to null (top level).
 * @template {{ id: string, parent_id?: string | null }} T
 * @param {T[]} rows
 * @returns {Map<string | null, T[]>}
 */
export function childrenByParent(rows) {
  const ids = new Set(rows.map((row) => row.id))
  /** @type {Map<string | null, T[]>} */
  const map = new Map()
  for (const row of rows) {
    const key = row.parent_id && ids.has(row.parent_id) ? row.parent_id : null
    if (!map.has(key)) map.set(key, [])
    map.get(key)?.push(row)
  }
  return map
}

/**
 * Ids of every note below `id` (not including it). Stops on cycles, which the database also forbids.
 * @param {{ id: string, parent_id?: string | null }[]} rows
 * @param {string} id
 * @returns {string[]}
 */
export function descendantIds(rows, id) {
  const children = childrenByParent(rows)
  /** @type {string[]} */
  const out = []
  const seen = new Set([id])
  const queue = [id]
  while (queue.length) {
    for (const child of children.get(queue.shift() ?? null) ?? []) {
      if (seen.has(child.id)) continue
      seen.add(child.id)
      out.push(child.id)
      queue.push(child.id)
    }
  }
  return out
}

/**
 * Rows from the top-level note down to the direct parent of `id`.
 * @template {{ id: string, parent_id?: string | null }} T
 * @param {T[]} rows
 * @param {string} id
 * @returns {T[]}
 */
export function ancestorRows(rows, id) {
  const byId = new Map(rows.map((row) => [row.id, row]))
  /** @type {T[]} */
  const out = []
  const seen = new Set([id])
  let parentId = byId.get(id)?.parent_id
  while (parentId && !seen.has(parentId)) {
    const parent = byId.get(parentId)
    if (!parent) break
    seen.add(parentId)
    out.unshift(parent)
    parentId = parent.parent_id
  }
  return out
}

/**
 * Depth-first list for display: each row gets depth and childCount. Roots keep the given order;
 * sub-pages follow their parent. `collapsed` (a Set of ids) hides the rows below those notes.
 * @template {{ id: string, parent_id?: string | null }} T
 * @param {T[]} rows
 * @param {Set<string>} [collapsed]
 * @returns {(T & { depth: number, childCount: number })[]}
 */
export function flattenTree(rows, collapsed = new Set()) {
  const children = childrenByParent(rows)
  /** @type {(T & { depth: number, childCount: number })[]} */
  const out = []
  const seen = new Set()
  /** @param {T} row @param {number} depth */
  const walk = (row, depth) => {
    if (seen.has(row.id)) return
    seen.add(row.id)
    const kids = children.get(row.id) ?? []
    out.push({ ...row, depth, childCount: kids.length })
    if (!collapsed.has(row.id)) for (const kid of kids) walk(kid, depth + 1)
  }
  for (const row of children.get(null) ?? []) walk(row, 0)
  return out
}

/**
 * Short label for a heading, used by the "On this page" list.
 * @param {string | null | undefined} text
 */
export function headingLabel(text) {
  const label = String(text ?? "").replace(/\s+/g, " ").trim()
  return label.length > 80 ? label.slice(0, 79) + "…" : label
}
