import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const actions = read("./actions.ts");
const listPage = read("./page.tsx");
const uploadPage = read("./upload/page.tsx");
const detailPage = read("./[id]/page.tsx");
const detail = read("../../../components/files/file-detail.tsx");
const uploadForm = read("../../../components/files/file-upload-form.tsx");

function actionSource(name, nextName) {
  const start = actions.indexOf(`export async function ${name}(`);
  const end = nextName
    ? actions.indexOf(`export async function ${nextName}(`, start)
    : actions.length;
  assert.notEqual(start, -1, `${name} action is missing`);
  return actions.slice(start, end === -1 ? actions.length : end);
}

const ownerScoped = (source) => {
  assert.match(source, /eq\(["']workspace_id["'], context\.workspaceId\)/);
  assert.match(source, /eq\(["']uploader_id["'], context\.user\.id\)/);
};

test("uploads keep the size and type limits and open the new file", () => {
  assert.match(actions, /const MAX_SIZE = 10 \* 1024 \* 1024/);
  const source = actionSource("uploadFile", "toggleFileFavorite");
  assert.match(source, /value\.size > MAX_SIZE/);
  assert.match(source, /!ALLOWED_TYPES\.has\(value\.type\)/);
  assert.match(source, /folderSchema\.safeParse/);
  assert.match(source, /actionFailure\("\/files\/upload"/);
  assert.match(source, /redirect\("\/files\/" \+ file\.id/);
  assert.match(source, /storage\.delete\(uploaded\.id\)/, "orphaned Drive uploads are rolled back");
});

test("favourite, trash and restore stay scoped to the uploader in the active workspace", () => {
  for (const [name, next] of [["toggleFileFavorite", "trashFile"], ["trashFile", "restoreFile"], ["restoreFile", "permanentlyDeleteFile"]]) {
    const source = actionSource(name, next);
    ownerScoped(source);
    assert.match(source, /z\.string\(\)\.uuid\(\)/);
    assert.match(source, /revalidatePath\("\/files"\)/);
    assert.match(source, /revalidatePath\(back\)/);
  }
});

test("permanent delete only removes trashed files owned by the uploader, Drive first", () => {
  const source = actionSource("permanentlyDeleteFile", "uploadFileVersion");
  ownerScoped(source);
  assert.match(source, /not\(["']trashed_at["'], ["']is["'], null\)/);
  assert.ok(source.indexOf("getStorageForWorkspace(context.workspaceId).delete") < source.indexOf('from("files").delete()'));
  assert.match(source, /redirect\("\/files\?view=trash/);
});

test("versions keep limits and owner scoping, shares stay workspace scoped", () => {
  const version = actionSource("uploadFileVersion", "createFileShare");
  ownerScoped(version);
  assert.match(version, /value\.size > MAX_SIZE/);
  assert.match(version, /!ALLOWED_TYPES\.has\(value\.type\)/);
  const share = actionSource("createFileShare");
  assert.match(share, /eq\(["']workspace_id["'], context\.workspaceId\)/);
  assert.match(share, /z\.enum\(\["never", "1d", "7d", "30d"\]\)/);
  assert.match(share, /createHash\("sha256"\)/, "only the token hash is stored");
  assert.match(share, /redirect\(back \+ "\?share="/);
});

test("list page uses issue-style tabs and redirects legacy query params", () => {
  assert.match(listPage, /className="issue-tabs"/);
  assert.match(listPage, /\["all", "All"\], \["favorites", "Favourites"\], \["trash", "Trash"\]/);
  assert.match(listPage, /params\.trash !== undefined \|\| params\.favorite !== undefined/);
  assert.match(listPage, /href="\/files\/upload"/);
  assert.match(listPage, /\.eq\("workspace_id", context\.workspaceId\)/);
});

test("upload page pauses uploads when Google Drive is disconnected", () => {
  assert.match(uploadPage, /hasWorkspaceDriveConnection\(context\.workspaceId\)/);
  assert.match(uploadPage, /<a href="\/api\/auth\/google\/login"/);
  assert.match(uploadPage, /className="issue-banner/);
  assert.match(uploadForm, /name="file"/);
  assert.match(uploadForm, /name="folder"/);
});

test("detail page is workspace scoped and exposes every file action", () => {
  assert.match(detailPage, /z\.string\(\)\.uuid\(\)\.safeParse\(id\)/);
  assert.match(detailPage, /\.eq\("workspace_id", context\.workspaceId\)/);
  assert.match(detailPage, /notFound\(\)/);
  for (const action of ["toggleFavorite", "trashFile", "restoreFile", "permanentlyDeleteFile", "uploadFileVersion", "createFileShare"]) {
    assert.match(detail, new RegExp("actions\\." + action + "\\b"), action + " is wired");
  }
  assert.match(detail, /"\/api\/file-versions\/" \+ version\.id \+ "\/download"/);
  assert.match(detail, /window\.confirm\(/, "permanent delete asks first");
});
