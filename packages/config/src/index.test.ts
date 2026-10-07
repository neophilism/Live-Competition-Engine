import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./index";

describe("parseServerEnv", () => {
  it("accepts a complete server environment", () => {
    const env = parseServerEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgres://user:pass@localhost:5432/test",
      APP_URL: "http://localhost:3000"
    });

    expect(env.NODE_ENV).toBe("test");
  });

  it("rejects a missing database URL", () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: "test",
        APP_URL: "http://localhost:3000"
      })
    ).toThrow();
  });
});
