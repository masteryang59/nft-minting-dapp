import { describe, expect, it, vi } from "vitest";

import { loadMetadata, parseMetadata, resolveUri } from "./metadata";

describe("resolveUri", () => {
  it("maps ipfs:// and ar:// to gateways and leaves http alone", () => {
    expect(resolveUri("ipfs://bafy/1.json", "https://gw/ipfs/")).toBe("https://gw/ipfs/bafy/1.json");
    expect(resolveUri("ipfs://ipfs/bafy/1.json", "https://gw/ipfs/")).toBe("https://gw/ipfs/bafy/1.json");
    expect(resolveUri("ar://tx123")).toBe("https://arweave.net/tx123");
    expect(resolveUri("https://x/1.json")).toBe("https://x/1.json");
  });
});

describe("parseMetadata", () => {
  it("keeps valid attributes and resolves the image", () => {
    const m = parseMetadata({ name: "A", image: "ipfs://cid/1.svg", attributes: [{ trait_type: "Wings", value: "Hooked" }, null, { value: 3 }] });
    expect(m.name).toBe("A");
    expect(m.image).toMatch(/\/cid\/1\.svg$/);
    expect(m.attributes).toEqual([{ trait_type: "Wings", value: "Hooked" }]);
    expect(parseMetadata(null)).toMatchObject({ name: "Untitled", image: "", attributes: [] });
  });
});

describe("loadMetadata", () => {
  it("decodes data: URIs without fetching", async () => {
    const json = btoa(JSON.stringify({ name: "On-chain", image: "data:image/svg+xml,<svg/>" }));
    const f = vi.fn();
    expect((await loadMetadata(`data:application/json;base64,${json}`, f)).name).toBe("On-chain");
    expect(f).not.toHaveBeenCalled();
  });

  it("caches by URI and retries after a failure", async () => {
    const ok = { ok: true, json: async () => ({ name: "Cocoon", image: "https://x/u.svg" }) };
    const f = vi.fn().mockResolvedValueOnce({ ok: false, status: 502 }).mockResolvedValue(ok);
    await expect(loadMetadata("https://x/u.json", f)).rejects.toThrow(/502/);
    expect((await loadMetadata("https://x/u.json", f)).name).toBe("Cocoon");
    await loadMetadata("https://x/u.json", f);
    expect(f).toHaveBeenCalledTimes(2);
  });
});

export function throttleRequests(data: unknown): unknown {
  if (!data) return null;
  return data;
}