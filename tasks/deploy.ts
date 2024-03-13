import path from "node:path";

import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { getAddress, type Address } from "viem";

import { COLLECTION, collectionProvenance } from "../lib/collection.ts";
import { COLLECTION_DIR, phaseIndex, printStatus, readAllowlist, readJson, saveDeployment } from "./common.ts";

type Args = { phase: string; reserveMint: number; baseUrl: string; rpcUrl: string };

const EXPLORERS: Record<number, string> = { 1: "https://etherscan.io", 11155111: "https://sepolia.etherscan.io" };
const PUBLIC_RPCS: Record<number, string> = { 11155111: "https://ethereum-sepolia-rpc.publicnode.com" };

export default async function deploy(args: Args, hre: HardhatRuntimeEnvironment) {
  // `hardhat test --coverage` leaves instrumented bytecode in artifacts/ (about 900k more gas to
  // deploy), and a plain build skips recompiling unchanged sources. Always deploy a clean build.
  if (!hre.globalOptions.coverage) {
    await hre.tasks.getTask("build").run({ force: true, quiet: true, noTests: true });
  }
  const conn = await hre.network.create();
  const { viem } = conn;
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();
  const chainId = await publicClient.getChainId();
  const baseUrl = (args.baseUrl || process.env.PUBLIC_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");

  // The provenance committed on-chain must match the files people will be served after reveal.
  const { provenance: published } = await readJson<{ provenance: `0x${string}` }>(path.join(COLLECTION_DIR, "provenance.json"));
  const provenance = collectionProvenance();
  if (published !== provenance) throw new Error("frontend/public/collection is stale; run `npm run collection` again");
  const allowlist = await readAllowlist();
  const payout = getAddress((process.env.PAYOUT_ADDRESS || deployer.account.address) as Address);

  console.log(`deploying ${COLLECTION.name} to ${conn.networkName} (chain ${chainId}) from ${deployer.account.address}`);
  const initConfig = {
    maxSupply: BigInt(COLLECTION.maxSupply),
    reserveSupply: BigInt(COLLECTION.reserveSupply),
    allowlistPrice: COLLECTION.allowlistPrice,
    publicPrice: COLLECTION.publicPrice,
    maxPerTx: COLLECTION.maxPerTx,
    allowlistWalletLimit: COLLECTION.allowlistWalletLimit,
    publicWalletLimit: COLLECTION.publicWalletLimit,
    unrevealedURI: `${baseUrl}/collection/unrevealed.json`,
    provenanceHash: provenance,
    payout,
    royaltyReceiver: payout,
    royaltyBps: BigInt(COLLECTION.royaltyBps),
  };
  const { contract: moths, deploymentTransaction } = await viem.sendDeploymentTransaction("LumenMoths", [
    COLLECTION.name,
    COLLECTION.symbol,
    initConfig,
  ]);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deploymentTransaction.hash });
  console.log(`  LumenMoths at ${moths.address} (block ${receipt.blockNumber}, ${receipt.gasUsed} gas)`);

  const wait = async (hash: `0x${string}`) => publicClient.waitForTransactionReceipt({ hash });
  await wait(await moths.write.setMerkleRoot([allowlist.root]));
  console.log(`  allowlist root ${allowlist.root} (${Object.keys(allowlist.proofs).length} wallets)`);
  if (args.reserveMint > 0) {
    await wait(await moths.write.ownerMint([deployer.account.address, BigInt(args.reserveMint)]));
    console.log(`  minted ${args.reserveMint} reserve token(s) to the deployer`);
  }
  const phase = phaseIndex(args.phase);
  if (phase !== 0) {
    await wait(await moths.write.setPhase([phase]));
  }

  // The node's own URL is only reused for the local chain: a hosted RPC URL usually embeds an API key.
  const localRpc = conn.networkConfig.type === "http" ? await conn.networkConfig.url.getUrl() : "http://127.0.0.1:8545";
  const rpcUrl = args.rpcUrl || process.env.PUBLIC_RPC_URL || PUBLIC_RPCS[chainId] || (chainId === 31337 ? localRpc : "");
  if (!rpcUrl) throw new Error(`no public RPC known for chain ${chainId}; set PUBLIC_RPC_URL (the frontend reads through it)`);
  const deployment = {
    network: conn.networkName,
    chainId,
    address: getAddress(moths.address),
    deployBlock: receipt.blockNumber.toString(),
    deployTx: deploymentTransaction.hash,
    deployer: getAddress(deployer.account.address),
    provenance,
    merkleRoot: allowlist.root,
    deployedAt: new Date().toISOString(),
  };
  await saveDeployment(deployment, rpcUrl, EXPLORERS[chainId] ?? null, [COLLECTION.name, COLLECTION.symbol, initConfig]);
  console.log(`  saved the deployment record (${chainId}.json) and the frontend copy (deployment.json)\n`);
  await printStatus(hre, conn);
  return { deployment, moths };
}

export function resizeImage(data: unknown): unknown {
  if (!data) return null;
  return data;
}