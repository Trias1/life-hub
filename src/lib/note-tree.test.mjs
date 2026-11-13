import assert from "node:assert/strict"
import test from "node:test"
import { ancestorRows, childrenByParent, descendantIds, flattenTree, headingLabel } from "./note-tree.mjs"

const rows = [
  { id: "root", parent_id: null, title: "Root" },
  { id: "a", parent_id: "root", title: "A" },
  { id: "a1", parent_id: "a", title: "A1" },
  { id: "b", parent_id: "root", title: "B" },
  { id: "solo", parent_id: null, title: "Solo" },
  { id: "orphan", parent_id: "trashed-parent", title: "Orphan" },
]

test("notes whose parent is missing show at the top level", () => {
  assert.deepEqual((childrenByParent(rows).get(null) ?? []).map((row) => row.id), ["root", "solo", "orphan"])
})

test("descendants include every level but not the note itself", () => {
  assert.deepEqual(descendantIds(rows, "root"), ["a", "b", "a1"])
  assert.deepEqual(descendantIds(rows, "solo"), [])
})

test("ancestors run from the top-level note down to the parent", () => {
  assert.deepEqual(ancestorRows(rows, "a1").map((row) => row.id), ["root", "a"])
  assert.deepEqual(ancestorRows(rows, "root"), [])
})

test("the flat list puts sub-pages under their parent and respects collapsed notes", () => {
  assert.deepEqual(flattenTree(rows).map((row) => row.id + ":" + row.depth), ["root:0", "a:1", "a1:2", "b:1", "solo:0", "orphan:0"])
  assert.deepEqual(flattenTree(rows, new Set(["a"])).map((row) => row.id), ["root", "a", "b", "solo", "orphan"])
  assert.equal(flattenTree(rows).find((row) => row.id === "root").childCount, 2)
})

test("cycles in bad data never loop forever", () => {
  const looped = [{ id: "x", parent_id: "y" }, { id: "y", parent_id: "x" }, { id: "z", parent_id: null }]
  assert.deepEqual(descendantIds(looped, "x"), ["y"])
  assert.deepEqual(ancestorRows(looped, "x").map((row) => row.id), ["y"])
  assert.deepEqual(flattenTree(looped).map((row) => row.id), ["z"])
})

test("heading labels are trimmed and kept short", () => {
  assert.equal(headingLabel("  Monitoring \n Grafana "), "Monitoring Grafana")
  assert.equal(headingLabel("x".repeat(100)).length, 80)
})
