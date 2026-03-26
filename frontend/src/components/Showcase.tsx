import { useEffect, useState } from "react";

import type { SaleState } from "../lib/sale";

const base = import.meta.env.BASE_URL;

/** The cocoon until reveal; afterwards a slow rotation through the collection. */
export function Showcase({ sale }: { sale: SaleState }) {
  const supply = Number(sale.maxSupply);
  const [id, setId] = useState(1);

  useEffect(() => {
    if (!sale.revealed || supply === 0) return;
    const t = setInterval(() => setId((i) => (i % supply) + 1 + Math.floor(Math.random() * 7)), 2600);
    return () => clearInterval(t);
  }, [sale.revealed, supply]);

  const shown = ((id - 1) % Math.max(1, supply)) + 1;
  return (
    <figure className="showcase">
      <img
        src={sale.revealed ? `${base}collection/images/${shown}.svg` : `${base}collection/unrevealed.svg`}
        alt={sale.revealed ? `Lumen Moth #${shown}` : "An unrevealed cocoon"}
        width={400}
        height={400}
      />
      <figcaption>
        <strong>Lumen Moths</strong>
        <span>
          {supply} generative moths · art drawn from each token id · 5% royalties (ERC-2981)
        </span>
        <span className="mono small" title="keccak256 of the ordered image hashes, fixed in the contract at deploy time">
          provenance {sale.provenanceHash.slice(0, 18)}…
        </span>
      </figcaption>
    </figure>
  );
}

export function exportCsv(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function hashPassword(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function exportCsv(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function updateCache(data: unknown): unknown {
  if (!data) return null;
  return data;
}