import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const invitePage = readFileSync(new URL("./invite/page.tsx", import.meta.url), "utf8");
const controls = readFileSync(
  new URL("../../../components/team/team-controls.tsx", import.meta.url),
  "utf8",
);

function actionSource(name, nextName) {
  const start = actions.indexOf(`export async function ${name}(`);
  const end = nextName
    ? actions.indexOf(`export async function ${nextName}(`, start)
    : actions.length;
  assert.notEqual(start, -1, `${name} action is missing`);
  return actions.slice(start, end === -1 ? actions.length : end);
}

test("inviting validates the email and keeps admin invitations for super admins", () => {
  const source = actionSource("inviteMember", "changeMemberRole");
  assert.match(actions, /email: z\.string\(\)\.email\(\)/);
  assert.match(source, /adminContext\(\)/);
  assert.match(source, /role === "admin" && context\.role !== "super_admin"/);
  assert.match(source, /actionFailure\("\/team\/invite"/);
  assert.match(source, /redirect\("\/team\?tab=invitations&success="/);
});

test("role changes and removals stay scoped to the workspace and the RPC check", () => {
  for (const [name, next] of [["changeMemberRole", "revokeInvitation"], ["removeMember"]]) {
    const source = actionSource(name, next);
    assert.match(source, /=== context\.user\.id\) actionFailure/);
    assert.match(source, /requireMemberManagement\(context/);
    assert.match(source, /\.eq\("workspace_id", context\.workspaceId\)/);
  }
});

test("revoking checks the invitation role and workspace", () => {
  const source = actionSource("revokeInvitation", "removeMember");
  assert.match(source, /invitation\.role === "admin" && context\.role !== "super_admin"/);
  assert.equal((source.match(/\.eq\("workspace_id", context\.workspaceId\)/g) ?? []).length, 2);
});

test("members page keeps the owner, self and super admin protections", () => {
  assert.match(page, /isCurrentUser \|\| isOwner \|\| member\.role === "super_admin"/);
  assert.match(page, /isAdmin && !isProtected && \(isSuperAdmin \|\| member\.role === "user"\)/);
  assert.match(page, /canChangeRole=\{isSuperAdmin\}/);
  assert.match(page, /state === "pending" && \(isSuperAdmin \|\| invitation\.role === "user"\)/);
  assert.match(page, /isAdmin && requestedTab === "invitations"/);
});

test("invite form offers admin only to super admins and is admin-only", () => {
  assert.match(invitePage, /isSuperAdmin \? \[\{ value: "admin"/);
  assert.match(invitePage, /\{isAdmin \? \(/);
  assert.match(controls, /window\.confirm\("Remove member/);
});
