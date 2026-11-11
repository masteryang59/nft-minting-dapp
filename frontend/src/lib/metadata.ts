// Token metadata: tokenURI -> JSON -> image, with ipfs://, ar:// and data: URIs handled.
import type { Address, PublicClient } from "viem";

import { lumenMothsAbi } from "../abi";

export const IPFS_GATEWAY = (import.meta.env.VITE_IPFS_GATEWAY as string | undefined) ?? "https://ipfs.io/ipfs/";

export function resolveUri(uri: string, gateway = IPFS_GATEWAY): string {
  if (uri.startsWith("ipfs://")) return gateway + uri.slice("ipfs://".length).replace(/^ipfs\//, "");
  if (uri.startsWith("ar://")) return `https://arweave.net/${uri.slice("ar://".length)}`;
  return uri;
}

export type TokenMetadata = {
  name: string;
  description?: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
};

export function parseMetadata(raw: unknown): TokenMetadata {
  const m = (raw ?? {}) as Record<string, unknown>;
  return {
    name: typeof m.name === "string" ? m.name : "Untitled",
    description: typeof m.description === "string" ? m.description : undefined,
    image: typeof m.image === "string" ? resolveUri(m.image) : "",
    attributes: Array.isArray(m.attributes)
      ? m.attributes.filter((a): a is { trait_type: string; value: string | number } => !!a && typeof a.trait_type === "string")
      : [],
  };
}

async function fetchJson(uri: string, fetchImpl: typeof fetch): Promise<unknown> {
  if (uri.startsWith("data:application/json;base64,")) return JSON.parse(atob(uri.slice(29)));
  if (uri.startsWith("data:application/json,")) return JSON.parse(decodeURIComponent(uri.slice(22)));
  const res = await fetchImpl(resolveUri(uri));
  if (!res.ok) throw new Error(`metadata ${res.status} for ${uri}`);
  return res.json();
}

/** Unrevealed tokens all share one URI, so this caches by URI (and refetches after a reveal). */
const cache = new Map<string, Promise<TokenMetadata>>();

export function loadMetadata(uri: string, fetchImpl: typeof fetch = fetch): Promise<TokenMetadata> {
  let p = cache.get(uri);
  if (!p) {
    p = fetchJson(uri, fetchImpl).then(parseMetadata);
    p.catch(() => cache.delete(uri));
    cache.set(uri, p);
  }
  return p;
}

export type OwnedToken = { id: bigint; uri: string; metadata: TokenMetadata | null; error?: string };

export async function loadOwnedTokens(client: PublicClient, address: Address, owner: Address): Promise<OwnedToken[]> {
  const ids = await client.readContract({ address, abi: lumenMothsAbi, functionName: "tokensOfOwner", args: [owner] });
  return Promise.all(
    [...ids].reverse().map(async (id) => {
      const uri = await client.readContract({ address, abi: lumenMothsAbi, functionName: "tokenURI", args: [id] });
      try {
        return { id, uri, metadata: await loadMetadata(uri) };
      } catch (e) {
        return { id, uri, metadata: null, error: (e as Error).message };
      }
    }),
  );
}

export function pruneOldData(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function pruneOldData(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function checkHealth(data: unknown): unknown {
  if (!data) return null;
  return data;
}