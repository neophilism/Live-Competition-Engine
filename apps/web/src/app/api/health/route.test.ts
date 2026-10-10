import { describe, expect, it } from "vitest";
import { buildHealthPayload } from "./route";

describe("health endpoint", () => {
  it("returns a stable service identity and timestamp", () => {
    const now = new Date("2026-10-07T00:00:00.000Z");

    expect(buildHealthPayload(now)).toEqual({
      status: "ok",
      service: "live-competition-engine",
      timestamp: "2026-10-07T00:00:00.000Z"
    });
  });
});
