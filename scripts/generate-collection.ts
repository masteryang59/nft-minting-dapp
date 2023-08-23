// Writes the art, ERC-721 metadata, provenance and allowlist proofs into frontend/public/collection.
//   node scripts/generate-collection.ts
// PUBLIC_BASE_URL sets the absolute URLs inside the metadata (default http://localhost:5173).
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderMoth, renderUnrevealed, traitsFor } from "../art/moth.ts";
import { buildAllowlist, COLLECTION, provenanceOf } from "../lib/collection.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  /* no .env file */
}
const outDir = path.join(root, "frontend", "public", "collection");
const baseUrl = (process.env.PUBLIC_BASE_URL ?? "http://localhost:5173").replace(/\/+$/, "");

await rm(outDir, { recursive: true, force: true });
await mkdir(path.join(outDir, "images"), { recursive: true });
await mkdir(path.join(outDir, "metadata"), { recursive: true });

const images: string[] = [];
const counts: Record<string, Record<string, number>> = {};
for (let id = 1; id <= COLLECTION.maxSupply; id++) {
  const svg = renderMoth(id);
  images.push(svg);
  const traits = traitsFor(id);
  for (const [trait, value] of Object.entries(traits)) {
    counts[trait] ??= {};
    counts[trait][value] = (counts[trait][value] ?? 0) + 1;
  }
  const metadata = {
    name: `${COLLECTION.name} #${id}`,
    description: COLLECTION.description,
    image: `${baseUrl}/collection/images/${id}.svg`,
    attributes: Object.entries(traits).map(([trait_type, value]) => ({ trait_type, value })),
  };
  await writeFile(path.join(outDir, "images", `${id}.svg`), svg);
  await writeFile(path.join(outDir, "metadata", `${id}.json`), JSON.stringify(metadata, null, 2));
}

await writeFile(path.join(outDir, "unrevealed.svg"), renderUnrevealed());
await writeFile(
  path.join(outDir, "unrevealed.json"),
  JSON.stringify(
    {
      name: `${COLLECTION.name} (cocoon)`,
      description: "This moth hasn't hatched yet. The art is revealed after the sale.",
      image: `${baseUrl}/collection/unrevealed.svg`,
    },
    null,
    2,
  ),
);

const provenance = provenanceOf(images);
await writeFile(path.join(outDir, "provenance.json"), JSON.stringify({ provenance, maxSupply: COLLECTION.maxSupply, traitCounts: counts }, null, 2));

const { addresses } = JSON.parse(await readFile(path.join(root, "allowlist", "addresses.json"), "utf8")) as { addresses: string[] };
const allowlist = buildAllowlist(addresses);
await writeFile(path.join(outDir, "allowlist.json"), JSON.stringify(allowlist, null, 2));

console.log(`wrote ${COLLECTION.maxSupply} moths to ${path.relative(root, outDir)}`);
console.log(`provenance ${provenance}`);
console.log(`allowlist root ${allowlist.root} (${Object.keys(allowlist.proofs).length} wallets)`);

export function evictStale(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function warmCache(data: unknown): unknown {
  if (!data) return null;
  return data;
}