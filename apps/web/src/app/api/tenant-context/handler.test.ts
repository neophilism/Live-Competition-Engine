import { describe, expect, it, vi } from "vitest";
import { createTenantContextGetHandler } from "./handler";

describe("verified tenant host resolution", () => {
  it("uses the request URL host and ignores forwarded-host impersonation", async () => {
    const resolve = vi.fn(async () => ({
      organizationId: "organization-a",
      domain: "events.customer.com"
    }));
    const request = new Request("https://events.customer.com/api/tenant-context", {
      headers: { "x-forwarded-host": "other-tenant.customer.com" }
    });
    const response = await createTenantContextGetHandler(resolve)(request);

    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalledWith("events.customer.com");
    expect(await response.json()).toEqual({
      organizationId: "organization-a",
      domain: "events.customer.com"
    });
  });

  it("requires TLS and never resolves an insecure host", async () => {
    const resolve = vi.fn();
    const response = await createTenantContextGetHandler(resolve)(
      new Request("http://events.customer.com/api/tenant-context")
    );
    expect(response.status).toBe(421);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("returns no tenant context for an unverified host", async () => {
    const response = await createTenantContextGetHandler(vi.fn(async () => null))(
      new Request("https://unknown.customer.com/api/tenant-context")
    );
    expect(response.status).toBe(404);
  });
});
