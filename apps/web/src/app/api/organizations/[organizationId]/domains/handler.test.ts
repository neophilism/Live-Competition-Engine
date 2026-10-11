import { describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "@live-competition-engine/auth";
import {
  createDomainClaimPostHandler,
  createDomainVerifyPostHandler
} from "./handler";

const organizationId = "11111111-1111-4111-8111-111111111111";
const domainId = "22222222-2222-4222-8222-222222222222";
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

const request = (body?: unknown) => new Request("https://engine.example/api", {
  method: "POST",
  headers: { authorization: "Bearer test", "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body)
});

describe("tenant custom-domain handlers", () => {
  it("authorizes a domain claim and returns its DNS proof", async () => {
    const claim = vi.fn(async () => ({
      id: domainId,
      domain: "events.customer.com",
      status: "pending" as const,
      dnsChallenge: {
        name: "_lce-domain.events.customer.com",
        value: "lce-domain-verification=proof"
      }
    }));
    const response = await createDomainClaimPostHandler(authorized, claim)(
      request({ domain: "Events.Customer.com" }),
      organizationId
    );

    expect(response.status).toBe(201);
    expect(claim).toHaveBeenCalledWith(organizationId, "account-a", "Events.Customer.com");
    expect((await response.json()).dnsChallenge.name).toBe("_lce-domain.events.customer.com");
  });

  it("does not inspect or claim a domain for an unauthorized tenant", async () => {
    const authorizer = {
      authorizeAction: vi.fn(async () => { throw new AuthenticationError("forbidden"); })
    };
    const claim = vi.fn();
    const response = await createDomainClaimPostHandler(authorizer, claim)(
      request({ domain: "events.customer.com" }),
      organizationId
    );
    expect(response.status).toBe(403);
    expect(claim).not.toHaveBeenCalled();
  });

  it("resolves only the stored challenge name and activates matching proof", async () => {
    const read = vi.fn(async () => ({
      domain: "events.customer.com",
      tokenHash: "a".repeat(64),
      createdAt: new Date()
    }));
    const resolve = vi.fn(async () => [["lce-domain-verification=proof"]]);
    const verify = vi.fn(async () => ({
      id: domainId,
      domain: "events.customer.com",
      status: "verified" as const
    }));
    const response = await createDomainVerifyPostHandler(authorized, read, resolve, verify)(
      request(),
      organizationId,
      domainId
    );

    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalledWith("_lce-domain.events.customer.com");
    expect(verify).toHaveBeenCalledWith(
      organizationId,
      domainId,
      "account-a",
      [["lce-domain-verification=proof"]]
    );
  });

  it("fails closed when DNS cannot be checked", async () => {
    const read = vi.fn(async () => ({
      domain: "events.customer.com",
      tokenHash: "a".repeat(64),
      createdAt: new Date()
    }));
    const resolve = vi.fn(async () => { throw new Error("timeout"); });
    const verify = vi.fn();
    const response = await createDomainVerifyPostHandler(authorized, read, resolve, verify)(
      request(),
      organizationId,
      domainId
    );
    expect(response.status).toBe(503);
    expect(verify).not.toHaveBeenCalled();
  });
});
