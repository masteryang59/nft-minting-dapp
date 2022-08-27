import { defineChain, getAddress, isAddress, type Address, type Chain } from "viem";
import { hardhat, mainnet, sepolia } from "viem/chains";

/** Written by `npx hardhat moths:deploy` and fetched at runtime, so one build works on any chain. */
export type Deployment = {
  chainId: number;
  address: Address;
  deployBlock: bigint;
  rpcUrl: string;
  explorerUrl: string | null;
};

export class DeploymentError extends Error {}

export function parseDeployment(raw: unknown): Deployment {
  const d = raw as Record<string, unknown> | null;
  if (!d || typeof d !== "object") throw new DeploymentError("deployment.json is not an object");
  if (typeof d.chainId !== "number" || !Number.isInteger(d.chainId) || d.chainId <= 0) throw new DeploymentError("deployment.json: bad chainId");
  if (typeof d.address !== "string" || !isAddress(d.address)) throw new DeploymentError("deployment.json: bad address");
  if (typeof d.rpcUrl !== "string" || !/^https?:\/\//.test(d.rpcUrl)) throw new DeploymentError("deployment.json: bad rpcUrl");
  return {
    chainId: d.chainId,
    address: getAddress(d.address),
    deployBlock: BigInt(typeof d.deployBlock === "string" || typeof d.deployBlock === "number" ? d.deployBlock : 0),
    rpcUrl: d.rpcUrl,
    explorerUrl: typeof d.explorerUrl === "string" ? d.explorerUrl.replace(/\/+$/, "") : null,
  };
}

export async function loadDeployment(fetchImpl: typeof fetch = fetch): Promise<Deployment> {
  const res = await fetchImpl(`${import.meta.env.BASE_URL}deployment.json`, { cache: "no-store" });
  if (!res.ok) throw new DeploymentError("No contract deployed yet: deployment.json is missing. Run `npm run dev` (or the deploy task) first.");
  return parseDeployment(await res.json());
}

const KNOWN: Record<number, Chain> = { [hardhat.id]: hardhat, [sepolia.id]: sepolia, [mainnet.id]: mainnet };

/** The viem chain for a deployment, with its RPC pointed at the deployment's URL. */
export function chainFor(d: Deployment): Chain {
  const base = KNOWN[d.chainId];
  const rpcUrls = { default: { http: [d.rpcUrl] } };
  if (base) return { ...base, rpcUrls };
  return defineChain({
    id: d.chainId,
    name: `Chain ${d.chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls,
  });
}

export const chainLabel = (chainId: number) =>
  chainId === hardhat.id ? "Hardhat local" : (KNOWN[chainId]?.name ?? `Chain ${chainId}`);

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function backupTable(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function checkHealth(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function backupTable(data: unknown): unknown {
  if (!data) return null;
  return data;
}