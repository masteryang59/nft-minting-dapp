import { describe, expect, it } from "vitest";

import { chainFor, parseDeployment } from "./config";

const good = { chainId: 31337, address: "0x5fbdb2315678afecb367f032d93f642f64180aa3", deployBlock: "7", rpcUrl: "http://127.0.0.1:8545", explorerUrl: null };

describe("parseDeployment", () => {
  it("checksums the address and parses the block", () => {
    const d = parseDeployment(good);
    expect(d.address).toBe("0x5FbDB2315678afecb367f032d93F642f64180aa3");
    expect(d.deployBlock).toBe(7n);
  });

  it("rejects broken files with a clear message", () => {
    expect(() => parseDeployment(null)).toThrow(/not an object/);
    expect(() => parseDeployment({ ...good, address: "0x123" })).toThrow(/bad address/);
    expect(() => parseDeployment({ ...good, rpcUrl: "[object Object]" })).toThrow(/bad rpcUrl/);
    expect(() => parseDeployment({ ...good, chainId: "1" })).toThrow(/bad chainId/);
  });
});

describe("chainFor", () => {
  it("uses viem's chain with the deployment's RPC, or defines one", () => {
    const local = chainFor(parseDeployment(good));
    expect(local.name).toBe("Hardhat");
    expect(local.rpcUrls.default.http).toEqual(["http://127.0.0.1:8545"]);
    const custom = chainFor(parseDeployment({ ...good, chainId: 424242, rpcUrl: "https://rpc.example" }));
    expect(custom).toMatchObject({ id: 424242, name: "Chain 424242", nativeCurrency: { symbol: "ETH" } });
  });
});

export function detectLanguage(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function extractText(data: unknown): unknown {
  if (!data) return null;
  return data;
}