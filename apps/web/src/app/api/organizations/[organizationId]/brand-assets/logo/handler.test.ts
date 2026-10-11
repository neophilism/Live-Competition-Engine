import { describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "@live-competition-engine/auth";
import {
  createBrandLogoPostHandler,
  type PersistLogoAsset
} from "./handler";

const organizationId = "11111111-1111-4111-8111-111111111111";
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

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

const request = (body: Uint8Array, contentType = "image/png", extraHeaders = {}) =>
  new Request("http://localhost/upload", {
    method: "POST",
    headers: {
      authorization: "Bearer test",
      "content-type": contentType,
      ...extraHeaders
    },
    body: new Blob([body.slice().buffer as ArrayBuffer])
  });

describe("tenant brand logo upload", () => {
  it("authorizes, verifies and persists a bounded logo", async () => {
    const persist = vi.fn<PersistLogoAsset>(async (_org, _account, asset) => ({
      id: "asset-a",
      path: "/api/tenant-assets/asset-a",
      sha256: asset.sha256
    }));
    const response = await createBrandLogoPostHandler(authorized, persist)(
      request(png),
      organizationId
    );

    expect(response.status).toBe(201);
    expect((await response.json()).path).toBe("/api/tenant-assets/asset-a");
    expect(persist).toHaveBeenCalledWith(
      organizationId,
      "account-a",
      expect.objectContaining({ contentType: "image/png", content: png })
    );
  });

  it("rejects a spoofed image signature", async () => {
    const persist = vi.fn<PersistLogoAsset>();
    const response = await createBrandLogoPostHandler(authorized, persist)(
      request(new TextEncoder().encode("<svg></svg>")),
      organizationId
    );

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: "asset_signature_mismatch" });
    expect(persist).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies before persistence", async () => {
    const persist = vi.fn<PersistLogoAsset>();
    const response = await createBrandLogoPostHandler(authorized, persist)(
      request(png, "image/png", { "content-length": String(512 * 1024 + 1) }),
      organizationId
    );

    expect(response.status).toBe(413);
    expect(persist).not.toHaveBeenCalled();
  });

  it("fails closed before reading for unauthorized tenants", async () => {
    const authorizer = {
      authorizeAction: vi.fn(async () => {
        throw new AuthenticationError("forbidden");
      })
    };
    const persist = vi.fn<PersistLogoAsset>();
    const response = await createBrandLogoPostHandler(authorizer, persist)(
      request(png),
      organizationId
    );

    expect(response.status).toBe(403);
    expect(persist).not.toHaveBeenCalled();
  });
});
