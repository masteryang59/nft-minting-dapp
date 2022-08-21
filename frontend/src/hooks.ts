import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPublicClient, createWalletClient, custom, getAddress, http, parseAbiItem, zeroAddress, type Address, type PublicClient, type WalletClient } from "viem";

import { chainFor, loadDeployment, type Deployment } from "./lib/config";
import { describeError } from "./lib/errors";
import { readSale, readWallet, type AllowlistFile, type SaleState, type WalletState } from "./lib/sale";
import {
  discoverWallets,
  readChainId,
  rememberedWallet,
  requestAccounts,
  switchToDeploymentChain,
  type DiscoveredWallet,
} from "./lib/wallet";

const POLL_MS = 3000;

export type AppContext = { deployment: Deployment; client: PublicClient };

export function useDeployment() {
  const [state, setState] = useState<{ ctx: AppContext | null; error: string | null }>({ ctx: null, error: null });
  useEffect(() => {
    loadDeployment()
      .then((deployment) => {
        const client = createPublicClient({
          chain: chainFor(deployment),
          transport: http(deployment.rpcUrl, { batch: true }),
          pollingInterval: 1000,
        }) as PublicClient;
        setState({ ctx: { deployment, client }, error: null });
      })
      .catch((e) => setState({ ctx: null, error: describeError(e).message }));
  }, []);
  return state;
}

export type WalletConnection = {
  wallets: DiscoveredWallet[];
  wallet: DiscoveredWallet | null;
  account: Address | null;
  chainId: number | null;
  wrongChain: boolean;
  connecting: boolean;
  error: string | null;
  walletClient: WalletClient | null;
  connect(w: DiscoveredWallet): Promise<void>;
  disconnect(): void;
  switchChain(): Promise<void>;
  clearError(): void;
};

export function useWallet(deployment: Deployment | null): WalletConnection {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [wallet, setWallet] = useState<DiscoveredWallet | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triedSilent = useRef(false);

  useEffect(() => discoverWallets(setWallets), []);

  const attach = useCallback(async (w: DiscoveredWallet, silent: boolean) => {
    const accounts = await requestAccounts(w.provider, silent);
    if (accounts.length === 0) return false;
    setWallet(w);
    setAccount(accounts[0]);
    setChainId(await readChainId(w.provider));
    rememberedWallet.set(w.info.rdns);
    return true;
  }, []);

  // Reconnect without a prompt if the user connected this wallet before (eth_accounts is silent).
  useEffect(() => {
    if (triedSilent.current || wallet) return;
    const remembered = rememberedWallet.get();
    const w = remembered && wallets.find((x) => x.info.rdns === remembered);
    if (!w) return;
    triedSilent.current = true;
    attach(w, true).catch(() => undefined);
  }, [wallets, wallet, attach]);

  useEffect(() => {
    const p = wallet?.provider;
    if (!p?.on) return;
    const onAccounts = (accs: string[]) => {
      if (!accs?.length) {
        setWallet(null);
        setAccount(null);
        setChainId(null);
        rememberedWallet.set(null);
      } else setAccount(getAddress(accs[0]));
    };
    const onChain = (id: string) => setChainId(Number(id));
    p.on("accountsChanged", onAccounts);
    p.on("chainChanged", onChain);
    return () => {
      p.removeListener?.("accountsChanged", onAccounts);
      p.removeListener?.("chainChanged", onChain);
    };
  }, [wallet]);

  const connect = useCallback(
    async (w: DiscoveredWallet) => {
      setConnecting(true);
      setError(null);
      try {
        await attach(w, false);
        // Offer the chain switch straight away; declining it still leaves the wallet connected.
        if (deployment && (await readChainId(w.provider)) !== deployment.chainId) {
          await switchToDeploymentChain(w.provider, deployment).catch((e) => setError(describeError(e).message));
          setChainId(await readChainId(w.provider));
        }
      } catch (e) {
        setError(describeError(e).message);
      } finally {
        setConnecting(false);
      }
    },
    [attach, deployment],
  );

  const disconnect = useCallback(() => {
    // EIP-1193 has no disconnect; forget the wallet locally (wallet_revokePermissions where supported).
    wallet?.provider
      .request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] })
      .catch(() => undefined);
    setWallet(null);
    setAccount(null);
    setChainId(null);
    rememberedWallet.set(null);
  }, [wallet]);

  const switchChain = useCallback(async () => {
    if (!wallet || !deployment) return;
    setError(null);
    try {
      await switchToDeploymentChain(wallet.provider, deployment);
      setChainId(await readChainId(wallet.provider));
    } catch (e) {
      setError(describeError(e).message);
    }
  }, [wallet, deployment]);

  const walletClient = useMemo(() => {
    if (!wallet || !account || !deployment) return null;
    return createWalletClient({ account, chain: chainFor(deployment), transport: custom(wallet.provider) });
  }, [wallet, account, deployment]);

  return {
    wallets,
    wallet,
    account,
    chainId,
    wrongChain: !!deployment && chainId !== null && chainId !== deployment.chainId,
    connecting,
    error,
    walletClient,
    connect,
    disconnect,
    switchChain,
    clearError: () => setError(null),
  };
}

export type RecentMint = { id: bigint; to: Address; block: bigint };

/** Sale + wallet state, refreshed on an interval and on demand (after a mint). */
export function useSale(ctx: AppContext | null, account: Address | null) {
  const [sale, setSale] = useState<SaleState | null>(null);
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [recent, setRecent] = useState<RecentMint[]>([]);
  const [allowlist, setAllowlist] = useState<AllowlistFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}collection/allowlist.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setAllowlist)
      .catch(() => setAllowlist(null));
  }, []);

  const refresh = useCallback(async () => {
    if (!ctx) return;
    const { client, deployment } = ctx;
    try {
      const [s, w] = await Promise.all([
        readSale(client, deployment.address),
        account ? readWallet(client, deployment.address, account) : Promise.resolve(null),
      ]);
      setSale(s);
      setWalletState(w);
      setError(null);
      // cacheTime 0: viem otherwise reuses the block number for a polling interval and misses a fresh mint.
      const latest = await client.getBlockNumber({ cacheTime: 0 });
      const from = latest > deployment.deployBlock + 5000n ? latest - 5000n : deployment.deployBlock;
      const logs = await client.getLogs({
        address: deployment.address,
        event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
        args: { from: zeroAddress },
        fromBlock: from,
        toBlock: latest,
      });
      setRecent(
        logs
          .slice(-8)
          .reverse()
          .map((l) => ({ id: l.args.tokenId!, to: l.args.to!, block: l.blockNumber })),
      );
    } catch (e) {
      setError(`Can't reach the chain at ${deployment.rpcUrl}: ${describeError(e).message}`);
    }
  }, [ctx, account]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  return { sale, walletState, recent, allowlist, error, refresh };
}

export function syncRecords(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function compressPayload(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function syncRecords(data: unknown): unknown {
  if (!data) return null;
  return data;
}