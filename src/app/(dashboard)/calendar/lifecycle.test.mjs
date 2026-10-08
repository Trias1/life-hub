import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const actions = read("./actions.ts");
const listPage = read("./page.tsx");
const newPage = read("./new/page.tsx");
const detailPage = read("./[id]/page.tsx");
const detail = read("../../../components/calendar/event-detail.tsx");
const fields = read("../../../components/calendar/event-fields.tsx");
const board = read("../../../components/calendar-board.tsx");

function actionSource(name, nextName) {
  const start = actions.indexOf(`export async function ${name}(`);
  const end = nextName ? actions.indexOf(`export async function ${nextName}(`, start) : actions.length;
  assert.notEqual(start, -1, `${name} action is missing`);
  return actions.slice(start, end === -1 ? actions.length : end);
}

test("creating an event opens the new event instead of the list", () => {
  const source = actionSource("createEvent", "updateEvent");
  assert.match(source, /redirect\("\/calendar\/" \+ event\.id/);
  assert.match(source, /actionFailure\("\/calendar\/new", "create event"\)/);
  assert.match(source, /workspace_id: context\.workspaceId, creator_id: context\.user\.id/);
});

test("events must end after they start", () => {
  assert.match(actions, /\.refine\(\(value\) => value\.endsAt > value\.startsAt\)/);
});

test("event edits and deletes stay scoped to the creator in the active workspace", () => {
  for (const [name, next] of [["updateEvent", "deleteEvent"], ["deleteEvent", undefined]]) {
    const source = actionSource(name, next ?? "addEventAttendee");
    assert.match(source, /eq\("workspace_id", context\.workspaceId\)/);
    assert.match(source, /eq\("creator_id", context\.user\.id\)/);
  }
  assert.match(actionSource("updateEvent", "deleteEvent"), /redirect\(eventPath \+ "\?success=Event%20updated"\)/);
  assert.match(actionSource("deleteEvent", "addEventAttendee"), /redirect\("\/calendar\?success=Event%20deleted"\)/);
});

test("only the creator manages attendees and only the attendee responds", () => {
  assert.match(actionSource("addEventAttendee", "removeEventAttendee"), /event\.creator_id !== context\.user\.id/);
  assert.match(actionSource("removeEventAttendee", "respondEventAttendee"), /event\.creator_id !== context\.user\.id/);
  assert.match(actionSource("respondEventAttendee"), /attendee\.user_id !== context\.user\.id && attendee\.email !== context\.user\.email\?\.toLowerCase\(\)/);
  assert.match(actions, /revalidatePath\(eventPath\)/);
});

test("calendar routes: list, new form and issue-style detail", () => {
  assert.match(listPage, /href="\/calendar\/new"/);
  assert.match(listPage, /issue-list/);
  assert.doesNotMatch(listPage, /createEvent/);
  assert.match(newPage, /action=\{createEvent\}/);
  assert.match(newPage, /isDayKey\(date\)/);
  assert.match(fields, /name="startsAt"/);
  assert.match(fields, /name="endsAt"/);
  assert.match(detailPage, /\.eq\("workspace_id", context\.workspaceId\)/);
  assert.match(detail, /actions\.deleteEvent/);
  assert.match(detail, /actions\.respondEventAttendee/);
  for (const view of ["agenda", "month", "week", "day"]) assert.match(board, new RegExp(`"${view}"`));
  assert.match(board, /\/calendar\/new\?date=/);
});
