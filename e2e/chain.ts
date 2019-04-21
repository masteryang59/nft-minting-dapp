// Shared by the e2e global setup and the tests: the throwaway chain and how to act as the owner.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { hardhat } from "viem/chains";

import { lumenMothsAbi } from "../frontend/src/abi.ts";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const E2E_RPC_PORT = 8546;
export const E2E_RPC = `http://127.0.0.1:${E2E_RPC_PORT}`;
export const E2E_WEB_PORT = 5174;
export const DEPLOYMENT_DIR = path.join(ROOT, "e2e", ".deployment");

// Hardhat's default dev accounts (public test keys).
export const ACCOUNTS = {
  owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  alice: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // allowlisted
  bob: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // allowlisted
  dave: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", // not allowlisted
} as const satisfies Record<string, Address>;

export function frontendDeployment(): string {
  return readFileSync(path.join(DEPLOYMENT_DIR, "deployment.json"), "utf8");
}

export function contractAddress(): Address {
  return JSON.parse(frontendDeployment()).address as Address;
}

const chain = { ...hardhat, rpcUrls: { default: { http: [E2E_RPC] } } };
export const publicClient = createPublicClient({ chain, transport: http(E2E_RPC) });
// The node holds the owner's key, so a JSON-RPC account is enough to send owner transactions.
const ownerClient = createWalletClient({ chain, account: ACCOUNTS.owner, transport: http(E2E_RPC) });

export async function asOwner(
  call:
    | { functionName: "setPhase"; args: readonly [number] }
    | { functionName: "reveal"; args: readonly [string] },
) {
  const hash = await ownerClient.writeContract({ address: contractAddress(), abi: lumenMothsAbi, ...call } as never);
  await publicClient.waitForTransactionReceipt({ hash });
}

export async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(E2E_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as { result: T; error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

export function calculateHash(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function parseInput(data: unknown): unknown {
  if (!data) return null;
  return data;
}