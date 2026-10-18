import test from "node:test";
import assert from "node:assert/strict";
import { projectProfile, ProfileService, type ProfileRecord } from "./index.ts";
const id = (n: number) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const org = id(1), owner = id(2), event = id(3);
const base: ProfileRecord = { id: id(4), organizationId: org, ownerAccountId: owner, revision: 1,
  displayName: "Participant", bio: "A public biography", roles: ["performer", "judge"],
  visibility: "public", history: [{ eventId: event, title: "Published event", public: true },
    { eventId: id(5), title: "Private event", public: false }] };

test("visibility matrix distinguishes anonymous, member and owner viewers", () => {
  for (const visibility of ["public", "members", "private"] as const) {
    for (const viewer of [null, { organizationId: org, accountId: id(6) }, { organizationId: org, accountId: owner }]) {
      const expected = visibility === "public" || visibility === "members" && viewer !== null || viewer?.accountId === owner;
      assert.equal(projectProfile({ ...base, visibility }, org, viewer) !== null, expected);
    }
  }
});
test("cross-tenant record and viewer cannot disclose profile", () => {
  assert.equal(projectProfile(base, id(9), null), null);
  assert.equal(projectProfile(base, org, { organizationId: id(9), accountId: owner }), null);
});
test("projection allowlists fields, removes private history and freezes copies", () => {
  const view = projectProfile({ ...base, secret: "never returned" } as ProfileRecord, org, null)!;
  assert.deepEqual(Object.keys(view).sort(), ["bio", "displayName", "history", "id", "revision", "roles"]);
  assert.deepEqual(view.history, [{ eventId: event, title: "Published event" }]);
  assert.equal(Object.isFrozen(view.history[0]), true);
  base.history[0]!.title = "Changed after projection";
  assert.equal(view.history[0]!.title, "Published event");
});
test("malformed or oversized profile data fails validation", () => {
  for (const change of [{ displayName: "" }, { bio: "x".repeat(2001) }, { visibility: "other" },
    { revision: 0 }, { roles: ["admin"] }, { roles: ["judge", "judge"] }, { history: [{ eventId: "bad", title: "", public: true }] }]) {
    assert.throws(() => projectProfile({ ...base, ...change } as ProfileRecord, org, null), /Invalid profile/);
  }
});

test("owner-only edits reject mass assignment and stale revisions", async () => {
  let saved: ProfileRecord | null = null;
  const service = new ProfileService({
    find: async () => saved,
    compareAndSet: async (profile, expected) => {
      if ((saved?.revision ?? null) !== expected) return false;
      saved = structuredClone(profile);
      return true;
    }
  });
  const viewer = { organizationId: org, accountId: owner };
  const patch = { displayName: "Public name", bio: "", roles: ["performer"] as const, visibility: "public" as const };
  assert.equal((await service.edit(org, base.id, viewer, patch, null)).revision, 1);
  await assert.rejects(() => service.edit(org, base.id, { ...viewer, accountId: id(8) }, patch, 1), /edit denied/);
  await assert.rejects(() => service.edit(org, base.id, viewer, { ...patch, ownerAccountId: id(8) } as typeof patch, 1), /Invalid profile patch/);
  await assert.rejects(() => service.edit(org, base.id, viewer, patch, null), /revision conflict/);
  assert.equal((await service.edit(org, base.id, viewer, { ...patch, visibility: "private" }, 1)).revision, 2);
  assert.equal(await service.read(org, base.id, null), null);
  assert.notEqual(await service.read(org, base.id, viewer), null);
  await assert.rejects(() => service.edit(org, base.id, viewer, patch, 1), /revision conflict/);
});
test("concurrent edit compare-and-set failure is propagated", async () => {
  const service = new ProfileService({ find: async () => ({ ...base }), compareAndSet: async () => false });
  await assert.rejects(() => service.edit(org, base.id, { organizationId: org, accountId: owner }, {
    displayName: "Changed", bio: "", roles: [], visibility: "public"
  }, 1), /revision conflict/);
});
