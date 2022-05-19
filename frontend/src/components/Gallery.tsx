import { useEffect, useState } from "react";
import type { Address } from "viem";

import type { AppContext } from "../hooks";
import { loadOwnedTokens, type OwnedToken } from "../lib/metadata";

/** Reloads when `reloadKey` changes (balance or reveal state), not on every poll. */
export function Gallery({ ctx, owner, reloadKey }: { ctx: AppContext; owner: Address; reloadKey: string }) {
  const [tokens, setTokens] = useState<OwnedToken[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadOwnedTokens(ctx.client, ctx.deployment.address, owner)
      .then((t) => !cancelled && (setTokens(t), setError(null)))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [ctx, owner, reloadKey]);

  return (
    <section className="gallery-section" aria-labelledby="gallery-title">
      <h2 id="gallery-title">
        Your moths {tokens ? <span className="count">{tokens.length}</span> : null}
      </h2>
      {error ? <p className="error">{error}</p> : null}
      {tokens && tokens.length === 0 ? <p className="muted">Nothing here yet. Mint one above.</p> : null}
      <ul className="gallery" data-testid="gallery">
        {tokens?.map((t) => (
          <li key={t.id.toString()} className="token">
            {t.metadata?.image ? <img src={t.metadata.image} alt={t.metadata.name} loading="lazy" /> : <div className="token-missing">?</div>}
            <div className="token-meta">
              <strong>#{t.id.toString()}</strong>
              <span className="muted small">
                {t.metadata?.attributes.length
                  ? t.metadata.attributes
                      .filter((a) => a.trait_type === "Palette" || a.trait_type === "Wings")
                      .map((a) => a.value)
                      .join(" · ")
                  : t.error
                    ? "metadata unavailable"
                    : "unrevealed"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function refreshToken(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function sendNotification(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function refreshToken(data: unknown): unknown {
  if (!data) return null;
  return data;
}