import { useEffect, useState } from "react";
import { formatEther, parseEventLogs, zeroAddress, type Hash, type Hex } from "viem";

import { lumenMothsAbi } from "../abi";
import type { AppContext, WalletConnection } from "../hooks";
import { chainLabel } from "../lib/config";
import { describeError } from "../lib/errors";
import { mintPlan, type SaleState, type WalletState } from "../lib/sale";

type TxState =
  | { status: "idle" }
  | { status: "confirm" }
  | { status: "pending"; hash: Hash }
  | { status: "success"; hash: Hash; ids: bigint[] }
  | { status: "error"; message: string };

const PHASE_LABEL = { Closed: "Sale closed", Allowlist: "Allowlist sale", Public: "Public sale" } as const;

type Props = {
  ctx: AppContext;
  conn: WalletConnection;
  sale: SaleState;
  walletState: WalletState | null;
  proof: Hex[] | null;
  onMinted(): void;
};

export function MintPanel({ ctx, conn, sale, walletState, proof, onMinted }: Props) {
  const { client, deployment } = ctx;
  const plan = mintPlan(sale, conn.account ? walletState : null, proof);
  const [qty, setQty] = useState(1);
  const [tx, setTx] = useState<TxState>({ status: "idle" });
  const busy = tx.status === "confirm" || tx.status === "pending";

  const max = plan.canMint ? plan.max : 1;
  useEffect(() => setQty((q) => Math.min(Math.max(1, q), max)), [max]);

  const minted = Number(sale.totalMinted);
  const supply = Number(sale.maxSupply);
  const pct = supply ? Math.min(100, (minted / supply) * 100) : 0;
  const total = plan.price !== null ? plan.price * BigInt(qty) : null;
  const explorerTx = (h: Hash) => (deployment.explorerUrl ? `${deployment.explorerUrl}/tx/${h}` : null);

  async function mint() {
    if (!plan.canMint || !conn.walletClient || !conn.account) return;
    setTx({ status: "confirm" });
    try {
      const value = plan.price * BigInt(qty);
      const wallet = conn.walletClient;
      const base = { address: deployment.address, abi: lumenMothsAbi, account: conn.account, value, chain: wallet.chain } as const;
      // Simulate first: a revert shows the contract's reason here instead of a vague wallet warning.
      let hash: Hash;
      if (plan.fn === "allowlistMint") {
        const args = [BigInt(qty), proof ?? []] as const;
        await client.simulateContract({ ...base, functionName: "allowlistMint", args });
        hash = await wallet.writeContract({ ...base, functionName: "allowlistMint", args });
      } else {
        const args = [BigInt(qty)] as const;
        await client.simulateContract({ ...base, functionName: "mint", args });
        hash = await wallet.writeContract({ ...base, functionName: "mint", args });
      }
      setTx({ status: "pending", hash });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted on-chain.");
      const ids = parseEventLogs({ abi: lumenMothsAbi, logs: receipt.logs, eventName: "Transfer" })
        .filter((l) => l.address.toLowerCase() === deployment.address.toLowerCase() && l.args.from === zeroAddress)
        .map((l) => l.args.tokenId);
      setTx({ status: "success", hash, ids });
      onMinted();
    } catch (e) {
      setTx({ status: "error", message: describeError(e).message });
    }
  }

  let action: React.ReactNode;
  if (!conn.account) {
    action = <p className="hint">Connect a wallet to mint.</p>;
  } else if (conn.wrongChain) {
    action = (
      <button className="btn btn-primary btn-block" onClick={conn.switchChain}>
        Switch to {chainLabel(deployment.chainId)}
      </button>
    );
  } else {
    action = (
      <button className="btn btn-primary btn-block" onClick={mint} disabled={!plan.canMint || busy} data-testid="mint-button">
        {tx.status === "confirm"
          ? "Confirm in your wallet…"
          : tx.status === "pending"
            ? "Minting…"
            : plan.canMint
              ? `Mint ${qty} for ${formatEther(total ?? 0n)} ETH`
              : "Mint"}
      </button>
    );
  }

  return (
    <section className="card mint-card" aria-labelledby="mint-title">
      <div className="mint-head">
        <span className={`phase phase-${sale.phase.toLowerCase()}`} data-testid="phase">
          {PHASE_LABEL[sale.phase]}
        </span>
        <span className="muted small">{chainLabel(deployment.chainId)}</span>
      </div>
      <h1 id="mint-title">Mint a moth</h1>

      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={supply} aria-valuenow={minted}>
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>
      <p className="progress-label">
        <strong data-testid="minted">{minted}</strong> / {supply} minted
        <span className="muted"> · {sale.publicRemaining.toString()} left in sale</span>
      </p>

      <dl className="stats">
        <div>
          <dt>Price</dt>
          <dd>{plan.price !== null ? `${formatEther(plan.price)} ETH` : "—"}</dd>
        </div>
        <div>
          <dt>Per wallet</dt>
          <dd>{sale.phase === "Allowlist" ? sale.allowlistWalletLimit : sale.publicWalletLimit}</dd>
        </div>
        <div>
          <dt>You can mint</dt>
          <dd data-testid="wallet-left">{plan.walletLeft ?? "—"}</dd>
        </div>
      </dl>

      {plan.canMint && conn.account && !conn.wrongChain ? (
        <div className="qty">
          <button className="btn btn-ghost" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1 || busy} aria-label="Fewer">
            −
          </button>
          <output aria-live="polite" data-testid="qty">{qty}</output>
          <button className="btn btn-ghost" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max || busy} aria-label="More">
            +
          </button>
          <span className="muted small">max {max}</span>
        </div>
      ) : null}

      {action}

      {!plan.canMint && conn.account && !conn.wrongChain ? <p className="hint" data-testid="reason">{plan.reason}</p> : null}
      {plan.canMint && sale.phase === "Allowlist" ? <p className="ok small">✓ This wallet is on the allowlist.</p> : null}
      {conn.error ? <p className="error">{conn.error}</p> : null}

      <div aria-live="polite" data-testid="tx-status">
        {tx.status === "pending" ? (
          <p className="tx tx-pending">
            <span className="spinner" /> Waiting for the block…{" "}
            <TxLink hash={tx.hash} href={explorerTx(tx.hash)} />
          </p>
        ) : null}
        {tx.status === "success" ? (
          <p className="tx tx-success">
            Minted {tx.ids.map((id) => `#${id}`).join(", ")}. <TxLink hash={tx.hash} href={explorerTx(tx.hash)} />
          </p>
        ) : null}
        {tx.status === "error" ? <p className="tx tx-error">{tx.message}</p> : null}
      </div>
    </section>
  );
}

function TxLink({ hash, href }: { hash: Hash; href: string | null }) {
  const label = `${hash.slice(0, 10)}…`;
  return href ? (
    <a href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  ) : (
    <code title={hash}>{label}</code>
  );
}

export function revokeAccess(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function revokeAccess(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function logEvent(data: unknown): unknown {
  if (!data) return null;
  return data;
}