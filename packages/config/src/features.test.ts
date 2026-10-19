import { describe, expect, it } from "vitest";
import { evaluateFeature, requireFeature } from "./features";

const org = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const eventId = "00000000-0000-4000-8000-000000000003";
const accountId = "00000000-0000-4000-8000-000000000004";
const context = { organizationId: org, eventId, accountId };
const audit = { record: async () => {} };
const settings = (value: boolean | undefined) => value === undefined ? {} : { ticketing: value };
function policy(values: Array<boolean | undefined>) {
  return {
    platform: { revision: 1, flags: settings(values[0]) },
    tenant: { organizationId: org, revision: 2, flags: settings(values[1]) },
    event: { organizationId: org, eventId, revision: 3, flags: settings(values[2]) },
    account: { organizationId: org, accountId, revision: 4, flags: settings(values[3]) }
  };
}

describe("hierarchical feature decisions", () => {
  it("checks all 81 explicit/inherited combinations without a child overriding an ancestor veto", async () => {
    const values = [undefined, false, true];
    for (const p of values) for (const t of values) for (const e of values) for (const a of values) {
      const decision = await evaluateFeature("ticketing", context, policy([p, t, e, a]), audit);
      expect(decision.enabled).toBe(p === true && ![t, e, a].includes(false));
    }
  });
  it("defaults to disabled and permits inheritance only after platform enablement", async () => {
    expect((await evaluateFeature("ticketing", context, policy([]), audit)).enabled).toBe(false);
    expect((await evaluateFeature("ticketing", context, policy([true]), audit)).enabled).toBe(true);
    expect((await evaluateFeature("voting", context, policy([true]), audit)).enabled).toBe(false);
  });
  it("records the exact revisions, context, veto and inherited values before returning", async () => {
    const records: unknown[] = [];
    const decision = await evaluateFeature("ticketing", context, policy([true, undefined, false, true]), {
      record: async d => { records.push(d); }
    });
    expect(records).toEqual([decision]);
    expect(decision.reason).toBe("disabled_at_scope");
    expect(decision.controllingScope).toBe("event");
    expect(decision.evaluatedScopes.map(d => [d.revision, d.value])).toEqual([[1, true], [2, null], [3, false], [4, true]]);
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.context)).toBe(true);
    expect(Object.isFrozen(decision.evaluatedScopes[0])).toBe(true);
  });
  it("rejects cross-tenant, cross-event and cross-account policies even when platform is disabled", async () => {
    const base = policy([false]);
    for (const layer of ["tenant", "event", "account"] as const) {
      await expect(evaluateFeature("ticketing", context, {
        ...base, [layer]: { ...base[layer], organizationId: other }
      }, audit)).rejects.toThrow(/scope denied/);
    }
    await expect(evaluateFeature("ticketing", { ...context, eventId: other }, base, audit)).rejects.toThrow(/scope denied/);
    await expect(evaluateFeature("ticketing", { ...context, accountId: other }, base, audit)).rejects.toThrow(/scope denied/);
    await expect(evaluateFeature("ticketing", { organizationId: org }, base, audit)).rejects.toThrow(/scope denied/);
  });
  it("rejects invalid data and unknown feature names rather than silently enabling them", async () => {
    await expect(evaluateFeature("__proto__", context, policy([true]), audit)).rejects.toThrow();
    await expect(evaluateFeature("ticketing", context, { platform: { revision: -1, flags: {} } }, audit)).rejects.toThrow();
    await expect(evaluateFeature("ticketing", context, { platform: { revision: 1, flags: { ticketing: "true" } } }, audit)).rejects.toThrow();
    await expect(evaluateFeature("ticketing", { organizationId: "" }, policy([]), audit)).rejects.toThrow();
  });
  it("propagates audit failure and refuses disabled actions", async () => {
    await expect(evaluateFeature("ticketing", context, policy([true]), {
      record: async () => { throw new Error("audit unavailable"); }
    })).rejects.toThrow("audit unavailable");
    await expect(requireFeature("ticketing", context, policy([]), audit)).rejects.toThrow("Feature disabled");
    expect((await requireFeature("ticketing", context, policy([true]), audit)).enabled).toBe(true);
  });
});
