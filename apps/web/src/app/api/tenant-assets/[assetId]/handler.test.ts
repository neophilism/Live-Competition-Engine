import { describe, expect, it, vi } from "vitest";
import { createBrandAssetGetHandler } from "./handler";

const assetId = "11111111-1111-4111-8111-111111111111";

describe("public tenant brand assets", () => {
  it("serves validated immutable bytes with defensive headers", async () => {
    const content = Uint8Array.from([1, 2, 3]);
    const fetchAsset = vi.fn(async () => ({
      contentType: "image/png" as const,
      sha256: "a".repeat(64),
      content
    }));
    const response = await createBrandAssetGetHandler(fetchAsset)(assetId);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(content);
  });

  it("does not query storage for malformed identifiers", async () => {
    const fetchAsset = vi.fn();
    const response = await createBrandAssetGetHandler(fetchAsset)("not-a-uuid");
    expect(response.status).toBe(404);
    expect(fetchAsset).not.toHaveBeenCalled();
  });
});
