import { describe, expect, it, vi } from "vitest";

import type { Deployment } from "./config";
import { discoverWallets, switchToDeploymentChain, type DiscoveredWallet, type Eip1193Provider } from "./wallet";

const provider = (impl: (method: string, params?: unknown) => unknown = () => null): Eip1193Provider & { calls: string[] } => {
  const calls: string[] = [];
  return { calls, request: async ({ method, params }) => (calls.push(method), impl(method, params)) };
};
const announce = (win: EventTarget, info: Partial<DiscoveredWallet["info"]>, p = provider()) =>
  win.dispatchEvent(Object.assign(new Event("eip6963:announceProvider"), { detail: { info: { icon: "", ...info }, provider: p } }));

describe("discoverWallets", () => {
  it("collects EIP-6963 announcements, MetaMask first, one per wallet", () => {
    const win = new EventTarget();
    const seen: string[][] = [];
    win.addEventListener("eip6963:requestProvider", () => announce(win, { uuid: "a", name: "Zerion", rdns: "io.zerion" }));
    const stop = discoverWallets((w) => seen.push(w.map((x) => x.info.name)), win as never);
    announce(win, { uuid: "b", name: "MetaMask", rdns: "io.metamask" });
    announce(win, { uuid: "c", name: "MetaMask", rdns: "io.metamask" }); // re-announce after reload
    win.dispatchEvent(Object.assign(new Event("eip6963:announceProvider"), { detail: { info: { uuid: "x" } } })); // malformed
    expect(seen.at(-1)).toEqual(["MetaMask", "Zerion"]);
    stop();
  });

  it("falls back to window.ethereum when nothing announces", () => {
    vi.useFakeTimers();
    const win = Object.assign(new EventTarget(), { ethereum: { ...provider(), isMetaMask: true } });
    const seen: string[][] = [];
    const stop = discoverWallets((w) => seen.push(w.map((x) => x.info.name)), win as never);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(500);
    expect(seen).toEqual([["MetaMask"]]);
    stop();
    vi.useRealTimers();
  });
});

describe("switchToDeploymentChain", () => {
  const deployment: Deployment = { chainId: 31337, address: "0x5FbDB2315678afecb367f032d93F642f64180aa3", deployBlock: 1n, rpcUrl: "http://127.0.0.1:8545", explorerUrl: null };

  it("only switches when the wallet knows the chain", async () => {
    const p = provider();
    await switchToDeploymentChain(p, deployment);
    expect(p.calls).toEqual(["wallet_switchEthereumChain"]);
  });

  it("adds the chain on 4902 and on MetaMask mobile's -32603", async () => {
    for (const err of [{ code: 4902 }, { code: -32603, message: "Unrecognized chain ID 0x7a69" }]) {
      let added: any;
      const p = provider((m, params) => {
        if (m === "wallet_switchEthereumChain") throw Object.assign(new Error(err.message ?? "unknown"), err);
        added = (params as unknown[])[0];
        return null;
      });
      await switchToDeploymentChain(p, deployment);
      expect(p.calls).toEqual(["wallet_switchEthereumChain", "wallet_addEthereumChain"]);
      expect(added).toMatchObject({ chainId: "0x7a69", rpcUrls: ["http://127.0.0.1:8545"], nativeCurrency: { symbol: "ETH" } });
    }
  });

  it("passes a rejection through", async () => {
    const p = provider(() => {
      throw Object.assign(new Error("rejected"), { code: 4001 });
    });
    await expect(switchToDeploymentChain(p, deployment)).rejects.toMatchObject({ code: 4001 });
  });
});

export function queueMessage(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function debounceInput(data: unknown): unknown {
  if (!data) return null;
  return data;
}