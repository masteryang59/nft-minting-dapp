import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import hre from "hardhat";
import { getAddress } from "viem";

import { renderMoth, traitsFor } from "../art/moth.ts";
import { buildAllowlist, COLLECTION, collectionProvenance } from "../lib/collection.ts";
import { ABI_FILE, renderAbiModule } from "../tasks/abi.ts";

// Pinned on purpose: if this changes, already-deployed contracts no longer match the art.
const PROVENANCE = "0x8b16daacf5f17700fb27027bf2f9aa331161c061fdc51a343dfe756c5e352d63";

describe("generative art", function () {
  it("is deterministic and matches the pinned provenance", function () {
    assert.equal(renderMoth(42), renderMoth(42));
    assert.notEqual(renderMoth(42), renderMoth(43));
    assert.equal(collectionProvenance(), PROVENANCE);
  });

  it("produces well-formed SVG with no unset values", function () {
    for (let id = 1; id <= COLLECTION.maxSupply; id++) {
      const svg = renderMoth(id);
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      assert.ok(svg.endsWith("</svg>"));
      assert.doesNotMatch(svg, /NaN|undefined|Infinity/, `token ${id}`);
    }
  });

  it("follows the trait weights roughly (rare traits stay rare)", function () {
    const counts: Record<string, number> = {};
    for (let id = 1; id <= COLLECTION.maxSupply; id++) {
      const { Palette, Glow } = traitsFor(id);
      counts[Palette] = (counts[Palette] ?? 0) + 1;
      counts[`glow:${Glow}`] = (counts[`glow:${Glow}`] ?? 0) + 1;
    }
    assert.ok(counts["Obsidian"] < counts["Luna"], "Obsidian (5%) should be rarer than Luna (22%)");
    assert.ok(counts["glow:Radiant"] > 0 && counts["glow:Radiant"] < 70);
  });
});

describe("allowlist", function () {
  const addrs = ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"];

  it("builds proofs that OpenZeppelin's verifier accepts, case-insensitively and deduplicated", function () {
    const list = buildAllowlist([...addrs, addrs[0].toLowerCase()]);
    assert.equal(Object.keys(list.proofs).length, 2);
    for (const a of addrs) {
      assert.ok(StandardMerkleTree.verify(list.root, ["address"], [a.toLowerCase()], list.proofs[a.toLowerCase()]));
    }
  });

  it("rejects bad input", function () {
    assert.throws(() => buildAllowlist([]), /empty/);
    assert.throws(() => buildAllowlist(["0x1234"]), /not an address/);
  });
});

describe("frontend ABI", function () {
  it("matches the compiled contract (run `npx hardhat moths:abi` if this fails)", async function () {
    const { abi } = await hre.artifacts.readArtifact("LumenMoths");
    assert.equal(await readFile(ABI_FILE, "utf8"), renderAbiModule(abi));
  });
});

describe("moths:deploy task", function () {
  it("deploys with the collection's provenance and root, opens the phase and writes both deployment files", async function () {
    const dir = await mkdtemp(path.join(tmpdir(), "moths-deploy-"));
    const previous = process.env.DEPLOYMENTS_DIR;
    process.env.DEPLOYMENTS_DIR = dir;
    try {
      const { moths } = await hre.tasks.getTask("moths:deploy").run({
        phase: "public", reserveMint: 2, baseUrl: "https://moths.example", rpcUrl: "https://rpc.example",
      });
      const front = JSON.parse(await readFile(path.join(dir, "deployment.json"), "utf8"));
      const record = JSON.parse(await readFile(path.join(dir, `${front.chainId}.json`), "utf8"));
      assert.equal(front.rpcUrl, "https://rpc.example");
      assert.equal(getAddress(record.address), getAddress(front.address));
      assert.equal(record.provenance, PROVENANCE);

      // On-chain state, read through the task's own connection (each in-process chain is separate).
      assert.equal(getAddress(moths.address), getAddress(front.address));
      assert.equal(await moths.read.provenanceHash(), PROVENANCE);
      assert.equal(await moths.read.merkleRoot(), record.merkleRoot);
      assert.equal((await moths.read.saleConfig())[0], 2);
      assert.equal(await moths.read.reserveMinted(), 2n);
      assert.equal(await moths.read.maxSupply(), BigInt(COLLECTION.maxSupply));
      assert.equal(await moths.read.tokenURI([1n]), "https://moths.example/collection/unrevealed.json");
    } finally {
      if (previous === undefined) delete process.env.DEPLOYMENTS_DIR;
      else process.env.DEPLOYMENTS_DIR = previous;
      await rm(dir, { recursive: true, force: true });
    }
  });
});

export function acknowledgeReceipt(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function queueMessage(data: unknown): unknown {
  if (!data) return null;
  return data;
}