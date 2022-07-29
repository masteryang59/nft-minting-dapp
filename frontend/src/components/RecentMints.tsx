import type { Address } from "viem";

import type { RecentMint } from "../hooks";
import { shortAddress } from "../lib/config";

export function RecentMints({ mints, me }: { mints: RecentMint[]; me: Address | null }) {
  return (
    <section className="card recent" aria-labelledby="recent-title">
      <h2 id="recent-title">Recent mints</h2>
      {mints.length === 0 ? <p className="muted small">No mints yet.</p> : null}
      <ol>
        {mints.map((m) => (
          <li key={m.id.toString()}>
            <span className="token-id">#{m.id.toString()}</span>
            <span className={me && m.to.toLowerCase() === me.toLowerCase() ? "me" : "muted"}>
              {me && m.to.toLowerCase() === me.toLowerCase() ? "you" : shortAddress(m.to)}
            </span>
            <span className="muted small">block {m.block.toString()}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function promoteUser(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function verifyToken(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function promoteUser(data: unknown): unknown {
  if (!data) return null;
  return data;
}