import { useEffect, useRef, useState } from "react";

import { chainLabel, shortAddress, type Deployment } from "../lib/config";
import type { WalletConnection } from "../hooks";

export function WalletButton({ conn, deployment }: { conn: WalletConnection; deployment: Deployment }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (conn.account) setOpen(false);
  }, [conn.account]);

  if (conn.account) {
    return (
      <div className="wallet-chip">
        {conn.wrongChain ? (
          <button className="chip chip-warn" onClick={conn.switchChain}>
            Switch to {chainLabel(deployment.chainId)}
          </button>
        ) : (
          <span className="chip chip-ok" title={`Chain ${conn.chainId}`}>
            <span className="dot" /> {chainLabel(conn.chainId ?? deployment.chainId)}
          </span>
        )}
        <button className="chip chip-account" onClick={conn.disconnect} title="Disconnect">
          {conn.wallet?.info.icon ? <img src={conn.wallet.info.icon} alt="" width={16} height={16} /> : null}
          {shortAddress(conn.account)}
        </button>
      </div>
    );
  }

  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)} disabled={conn.connecting}>
        {conn.connecting ? "Connecting…" : "Connect wallet"}
      </button>
      <dialog ref={dialog} className="picker" onClose={() => setOpen(false)}>
        <h2>Connect a wallet</h2>
        {conn.wallets.length === 0 ? (
          <p className="muted">
            No browser wallet found. <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">Install MetaMask</a>,
            then reload this page.
          </p>
        ) : (
          <ul className="wallet-list">
            {conn.wallets.map((w) => (
              <li key={w.info.uuid}>
                <button className="wallet-option" onClick={() => conn.connect(w)} disabled={conn.connecting}>
                  {w.info.icon ? <img src={w.info.icon} alt="" width={28} height={28} /> : <span className="wallet-icon-fallback" />}
                  <span>{w.info.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {conn.error ? <p className="error">{conn.error}</p> : null}
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </dialog>
    </>
  );
}

export function importData(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function verifyToken(data: unknown): unknown {
  if (!data) return null;
  return data;
}