import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const actions = read("./actions.ts");
const listPage = read("./page.tsx");
const newPage = read("./new/page.tsx");
const detailPage = read("./[id]/page.tsx");
const detail = read("../../../components/bookmarks/bookmark-detail.tsx");
const composer = read("../../../components/bookmark-composer.tsx");
const listMenu = read("../../../components/bookmarks/bookmark-list-menu.tsx");

function actionSource(name) {
  const start = actions.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `${name} action is missing`);
  const end = actions.indexOf("export async function ", start + 1);
  return actions.slice(start, end === -1 ? actions.length : end);
}

test("bookmarks only accept https links with bounded fields", () => {
  assert.match(actions, /url: z\.string\(\)\.url\(\)\.startsWith\("https:\/\/"\)/);
  assert.match(actions, /title: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(160\)/);
  assert.match(actions, /collection: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(80\)/);
  assert.match(actions, /\.slice\(0, 12\)/);
});

test("creating a bookmark opens it and reports field errors on the form", () => {
  const source = actionSource("createBookmark");
  assert.match(source, /validationFailure\("\/bookmarks\/new", input\.error\.issues\)/);
  assert.match(source, /creator_id: context\.user\.id/);
  assert.match(source, /workspace_id: context\.workspaceId/);
  assert.match(source, /redirect\("\/bookmarks\/" \+ bookmark\.id/);
});

for (const name of ["updateBookmark", "toggleBookmarkFavorite", "archiveBookmark", "restoreBookmark"]) {
  test(`${name} stays scoped to the creator in the active workspace`, () => {
    const source = actionSource(name);
    assert.match(source, /eq\("id", (input\.data\.id|id\.data)\)/);
    assert.match(source, /eq\("workspace_id", context\.workspaceId\)/);
    assert.match(source, /eq\("creator_id", context\.user\.id\)/);
    assert.match(source, /revalidateBookmark\(/);
  });
}

test("CSV import keeps the size limit and per-row validation", () => {
  const source = actionSource("importBookmarks");
  assert.match(source, /value\.size > 1_000_000/);
  assert.match(source, /schema\.safeParse\(/);
  assert.match(source, /creator_id: context\.user\.id/);
  assert.match(listMenu, /href="\/api\/bookmarks\/export"/);
  assert.match(listMenu, /accept="\.csv,text\/csv"/);
});

test("external links open in a new tab without leaking the opener", () => {
  for (const source of [listPage, detail]) {
    for (const match of source.matchAll(/target="_blank"[^>]*/g)) assert.match(match[0], /rel="noopener noreferrer"/);
  }
  assert.match(listPage, /target="_blank"/);
  assert.match(detail, /target="_blank"/);
});

test("list keeps tabs, filters, layouts and legacy links", () => {
  for (const key of ["favorites", "archived", "collection", "tag", "sort", "layout", "q"]) assert.match(listPage, new RegExp(key));
  assert.match(listPage, /params\.archived !== undefined/);
  assert.match(listPage, /redirect\("\/bookmarks\/" \+ params\.bookmark\)/);
  assert.match(listPage, /href="\/bookmarks\/new"/);
});

test("detail page is workspace-scoped and exposes every bookmark action", () => {
  assert.match(detailPage, /z\.string\(\)\.uuid\(\)\.safeParse\(id\)/);
  assert.match(detailPage, /eq\("workspace_id", context\.workspaceId\)/);
  assert.match(detailPage, /notFound\(\)/);
  for (const name of ["updateBookmark", "toggleBookmarkFavorite", "archiveBookmark", "restoreBookmark"]) assert.match(detailPage, new RegExp(`\\b${name}\\b`));
  assert.match(detail, /actions\.updateBookmark/);
  assert.match(detail, /actions\.toggleFavorite/);
  assert.match(detail, /actions\.archiveBookmark/);
  assert.match(detail, /actions\.restoreBookmark/);
});

test("new bookmark form puts the URL first and auto-fills the title", () => {
  assert.match(newPage, /createBookmark/);
  assert.ok(composer.indexOf('name="url"') < composer.indexOf('name="title"'), "URL field comes before title");
  assert.match(composer, /\/api\/bookmarks\/fetch-meta\?url=/);
});
