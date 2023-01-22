// Wallet discovery (EIP-6963, with a window.ethereum fallback) and the few EIP-1193 calls the
// app makes directly. Everything else goes through a viem WalletClient on top of the provider.
import { getAddress, numberToHex, type Address } from "viem";

import type { Deployment } from "./config";
import { chainFor } from "./config";

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
  on?(event: string, listener: (...args: any[]) => void): void;
  removeListener?(event: string, listener: (...args: any[]) => void): void;
  isMetaMask?: boolean;
};

export type WalletInfo = { uuid: string; name: string; icon: string; rdns: string };
export type DiscoveredWallet = { info: WalletInfo; provider: Eip1193Provider };

export const METAMASK_RDNS = "io.metamask";
const LEGACY_FALLBACK_MS = 400;

type WalletWindow = Pick<Window, "addEventListener" | "removeEventListener" | "dispatchEvent"> & {
  ethereum?: Eip1193Provider;
};

/** MetaMask first, then alphabetical: the order the picker shows. */
export function sortWallets(wallets: DiscoveredWallet[]): DiscoveredWallet[] {
  return [...wallets].sort((a, b) => {
    const am = a.info.rdns === METAMASK_RDNS ? 0 : 1;
    const bm = b.info.rdns === METAMASK_RDNS ? 0 : 1;
    return am - bm || a.info.name.localeCompare(b.info.name);
  });
}

/**
 * Listens for EIP-6963 announcements and asks wallets to announce themselves. Wallets that
 * predate EIP-6963 only set window.ethereum; that is offered if nothing announces in time.
 * Returns an unsubscribe function.
 */
export function discoverWallets(onChange: (wallets: DiscoveredWallet[]) => void, win: WalletWindow = window): () => void {
  const found = new Map<string, DiscoveredWallet>();
  const emit = () => onChange(sortWallets([...found.values()]));

  const onAnnounce = (event: Event) => {
    const detail = (event as CustomEvent<DiscoveredWallet>).detail;
    if (!detail?.info?.uuid || typeof detail.provider?.request !== "function") return;
    // One entry per wallet: some wallets re-announce with the same rdns after a reload.
    for (const [uuid, w] of found) if (w.info.rdns === detail.info.rdns && uuid !== detail.info.uuid) found.delete(uuid);
    found.set(detail.info.uuid, { info: detail.info, provider: detail.provider });
    found.delete("legacy");
    emit();
  };

  win.addEventListener("eip6963:announceProvider", onAnnounce);
  win.dispatchEvent(new Event("eip6963:requestProvider"));

  const timer = setTimeout(() => {
    if (found.size === 0 && win.ethereum) {
      found.set("legacy", {
        info: { uuid: "legacy", name: win.ethereum.isMetaMask ? "MetaMask" : "Browser wallet", icon: "", rdns: "legacy" },
        provider: win.ethereum,
      });
      emit();
    }
  }, LEGACY_FALLBACK_MS);

  return () => {
    clearTimeout(timer);
    win.removeEventListener("eip6963:announceProvider", onAnnounce);
  };
}

export const errorCode = (e: unknown): number | undefined => {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "number" ? c : undefined;
};

export async function requestAccounts(provider: Eip1193Provider, silent = false): Promise<Address[]> {
  const accounts = (await provider.request({ method: silent ? "eth_accounts" : "eth_requestAccounts" })) as string[];
  return (accounts ?? []).map((a) => getAddress(a));
}

export async function readChainId(provider: Eip1193Provider): Promise<number> {
  return Number(await provider.request({ method: "eth_chainId" }));
}

/**
 * Switches the wallet to the deployment's chain, adding it first if the wallet doesn't know it
 * (error 4902; some wallets report it as -32603 with "Unrecognized chain").
 */
export async function switchToDeploymentChain(provider: Eip1193Provider, deployment: Deployment): Promise<void> {
  const chainId = numberToHex(deployment.chainId);
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (e) {
    const code = errorCode(e);
    const unknownChain = code === 4902 || (code === -32603 && /unrecognized chain/i.test(String((e as Error).message)));
    if (!unknownChain) throw e;
    const chain = chainFor(deployment);
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: [deployment.rpcUrl],
          blockExplorerUrls: deployment.explorerUrl ? [deployment.explorerUrl] : undefined,
        },
      ],
    });
  }
}

const STORAGE_KEY = "lumen-moths.wallet";

/** The wallet to reconnect silently on the next visit. Storage can be unavailable; that's fine. */
export const rememberedWallet = {
  get(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set(rdns: string | null) {
    try {
      if (rdns) localStorage.setItem(STORAGE_KEY, rdns);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode or blocked storage */
    }
  },
};

export function computeMetrics(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function computeMetrics(data: unknown): unknown {
  if (!data) return null;
  return data;
}