// Small owner actions, each exported for its own task in hardhat.config.ts.
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";

import { connect, phaseIndex, printStatus, readAllowlist } from "./common.ts";

async function send(hre: HardhatRuntimeEnvironment, label: string, run: (m: Awaited<ReturnType<typeof connect>>["moths"]) => Promise<`0x${string}`>) {
  const { moths, publicClient } = await connect(hre);
  const hash = await run(moths);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} reverted (${hash})`);
  console.log(`${label}: ${hash}\n`);
  await printStatus(hre);
}

export async function phase(args: { phase: string }, hre: HardhatRuntimeEnvironment) {
  const p = phaseIndex(args.phase);
  await send(hre, `phase -> ${args.phase}`, (m) => m.write.setPhase([p]));
}

export async function allowlist(_args: unknown, hre: HardhatRuntimeEnvironment) {
  const { root } = await readAllowlist();
  await send(hre, `merkle root -> ${root}`, (m) => m.write.setMerkleRoot([root]));
}

export async function reveal(args: { baseUri: string }, hre: HardhatRuntimeEnvironment) {
  const base = args.baseUri || `${(process.env.PUBLIC_BASE_URL || "http://localhost:5173").replace(/\/+$/, "")}/collection/metadata/`;
  await send(hre, `reveal -> ${base}`, (m) => m.write.reveal([base]));
}

export async function withdraw(_args: unknown, hre: HardhatRuntimeEnvironment) {
  await send(hre, "withdraw", (m) => m.write.withdraw());
}

export async function status(_args: unknown, hre: HardhatRuntimeEnvironment) {
  await printStatus(hre);
}

export function compactStorage(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function invalidateCache(data: unknown): unknown {
  if (!data) return null;
  return data;
}