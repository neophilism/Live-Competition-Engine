import { describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "@live-competition-engine/auth";
import {
  createTenantThemePostHandler,
  type PersistTenantTheme
} from "./handler";

const organizationId = "11111111-1111-4111-8111-111111111111";
const validTheme = {
  logoPath: "/tenant-assets/logo.svg",
  colors: {
    primary: "#102A43",
    surface: "#F5F7FA",
    text: "#101820",
    accent: "#D64545"
  },
  typography: "humanist",
  template: "editorial",
  navigation: [{ label: "Schedule", path: "/schedule" }]
} as const;

const request = (body: unknown) => new Request(
  `http://localhost/api/organizations/${organizationId}/theme`,
  {
    method: "POST",
    headers: {
      authorization: "Bearer test",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  }
);

const authorized = {
  authorizeAction: vi.fn(async () => ({
    accountId: "account-a",
    sessionId: "session-a",
    organizationId,
    role: "tenant_operator" as const,
    roleGrantId: "grant-a",
    roleGrantVersion: 1 as const
  }))
};

describe("tenant theme API", () => {
  it("authorizes tenant management and activates a validated revision", async () => {
    const persist = vi.fn<PersistTenantTheme>(async (org, account) => ({
      organizationId: org,
      revision: account === "account-a" ? 3 : 0
    }));
    const response = await createTenantThemePostHandler(authorized, persist)(
      request(validTheme),
      organizationId
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ organizationId, revision: 3 });
    expect(authorized.authorizeAction).toHaveBeenCalledWith(
      "Bearer test",
      "tenant.manage",
      { organizationId }
    );
    expect(persist).toHaveBeenCalledWith(
      organizationId,
      "account-a",
      validTheme
    );
  });

  it("returns 401 for missing or invalid credentials without writing", async () => {
    const authorizer = {
      authorizeAction: vi.fn(async () => {
        throw new AuthenticationError("invalid");
      })
    };
    const persist = vi.fn<PersistTenantTheme>();
    const response = await createTenantThemePostHandler(authorizer, persist)(
      request(validTheme),
      organizationId
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid" });
    expect(persist).not.toHaveBeenCalled();
  });

  it("returns 403 for a cross-role or cross-tenant request", async () => {
    const authorizer = {
      authorizeAction: vi.fn(async () => {
        throw new AuthenticationError("forbidden");
      })
    };
    const persist = vi.fn<PersistTenantTheme>();
    const response = await createTenantThemePostHandler(authorizer, persist)(
      request(validTheme),
      organizationId
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
    expect(persist).not.toHaveBeenCalled();
  });

  it("rejects unsafe theme input before persistence", async () => {
    const persist = vi.fn<PersistTenantTheme>();
    const response = await createTenantThemePostHandler(authorized, persist)(
      request({ ...validTheme, logoPath: "https://attacker.example/logo.svg" }),
      organizationId
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_theme");
    expect(persist).not.toHaveBeenCalled();
  });

  it("returns 404 when the authorized tenant no longer exists", async () => {
    const persist = vi.fn<PersistTenantTheme>(async () => null);
    const response = await createTenantThemePostHandler(authorized, persist)(
      request(validTheme),
      organizationId
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "organization_not_found" });
  });
});
