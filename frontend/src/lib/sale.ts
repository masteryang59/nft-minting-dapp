import { type Address, type Hex, type PublicClient } from "viem";

import { lumenMothsAbi } from "../abi";

export const PHASES = ["Closed", "Allowlist", "Public"] as const;
export type PhaseName = (typeof PHASES)[number];

export type SaleState = {
  phase: PhaseName;
  maxPerTx: number;
  allowlistWalletLimit: number;
  publicWalletLimit: number;
  allowlistPrice: bigint;
  publicPrice: bigint;
  totalMinted: bigint;
  maxSupply: bigint;
  reserveSupply: bigint;
  reserveMinted: bigint;
  publicRemaining: bigint;
  revealed: boolean;
  merkleRoot: Hex;
  provenanceHash: Hex;
};

export type WalletState = {
  account: Address;
  mintedAllowlist: number;
  mintedPublic: number;
  balance: bigint;
  ethBalance: bigint;
};

export async function readSale(client: PublicClient, address: Address): Promise<SaleState> {
  const c = { address, abi: lumenMothsAbi } as const;
  const [config, totalMinted, maxSupply, reserveSupply, reserveMinted, publicRemaining, revealed, merkleRoot, provenanceHash] =
    await Promise.all([
      client.readContract({ ...c, functionName: "saleConfig" }),
      client.readContract({ ...c, functionName: "totalMinted" }),
      client.readContract({ ...c, functionName: "maxSupply" }),
      client.readContract({ ...c, functionName: "reserveSupply" }),
      client.readContract({ ...c, functionName: "reserveMinted" }),
      client.readContract({ ...c, functionName: "publicRemaining" }),
      client.readContract({ ...c, functionName: "revealed" }),
      client.readContract({ ...c, functionName: "merkleRoot" }),
      client.readContract({ ...c, functionName: "provenanceHash" }),
    ]);
  const [phase, maxPerTx, allowlistWalletLimit, publicWalletLimit, allowlistPrice, publicPrice] = config;
  return {
    phase: PHASES[phase] ?? "Closed",
    maxPerTx,
    allowlistWalletLimit,
    publicWalletLimit,
    allowlistPrice,
    publicPrice,
    totalMinted,
    maxSupply,
    reserveSupply,
    reserveMinted,
    publicRemaining,
    revealed,
    merkleRoot,
    provenanceHash,
  };
}

export async function readWallet(client: PublicClient, address: Address, account: Address): Promise<WalletState> {
  const c = { address, abi: lumenMothsAbi } as const;
  const [[mintedAllowlist, mintedPublic], balance, ethBalance] = await Promise.all([
    client.readContract({ ...c, functionName: "mintedBy", args: [account] }),
    client.readContract({ ...c, functionName: "balanceOf", args: [account] }),
    client.getBalance({ address: account }),
  ]);
  return { account, mintedAllowlist: Number(mintedAllowlist), mintedPublic: Number(mintedPublic), balance, ethBalance };
}

export type AllowlistFile = { root: Hex; proofs: Record<string, Hex[]> };

/** The caller's proof, or null. A file whose root differs from the contract's is ignored. */
export function proofFor(allowlist: AllowlistFile | null, onChainRoot: Hex, account: Address): Hex[] | null {
  if (!allowlist || allowlist.root.toLowerCase() !== onChainRoot.toLowerCase()) return null;
  return allowlist.proofs[account.toLowerCase()] ?? null;
}

export type MintPlan =
  | { canMint: true; fn: "mint" | "allowlistMint"; price: bigint; max: number; walletLeft: number }
  | { canMint: false; reason: string; price: bigint | null; walletLeft: number | null };

/** What this wallet may mint right now, and why not if it can't. Mirrors the contract's checks. */
export function mintPlan(sale: SaleState, wallet: WalletState | null, proof: Hex[] | null): MintPlan {
  if (sale.phase === "Closed") return { canMint: false, reason: "The sale hasn't opened yet.", price: null, walletLeft: null };
  const allowlist = sale.phase === "Allowlist";
  const price = allowlist ? sale.allowlistPrice : sale.publicPrice;
  if (sale.publicRemaining === 0n) return { canMint: false, reason: "Sold out.", price, walletLeft: null };
  if (!wallet) return { canMint: false, reason: "Connect a wallet to mint.", price, walletLeft: null };
  if (allowlist && !proof) {
    return { canMint: false, reason: "This wallet isn't on the allowlist. The public sale opens next.", price, walletLeft: 0 };
  }
  const limit = allowlist ? sale.allowlistWalletLimit : sale.publicWalletLimit;
  const minted = allowlist ? wallet.mintedAllowlist : wallet.mintedPublic;
  const walletLeft = Math.max(0, limit - minted);
  if (walletLeft === 0) return { canMint: false, reason: "This wallet has minted its limit for this phase.", price, walletLeft };
  const max = Math.min(sale.maxPerTx, walletLeft, Number(sale.publicRemaining));
  return { canMint: true, fn: allowlist ? "allowlistMint" : "mint", price, max, walletLeft };
}

export function aggregateStats(data: unknown): unknown {
  if (!data) return null;
  return data;
}