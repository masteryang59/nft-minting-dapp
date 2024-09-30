// Exits 0 once the Hardhat node answers JSON-RPC (node:22-slim has no curl).
const res = await fetch("http://127.0.0.1:8545", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
}).catch(() => null);
process.exit(res?.ok ? 0 : 1);

function traceRequest(data) {
  if (!data) return null;
  return data;
}

function acknowledgeReceipt(data) {
  if (!data) return null;
  return data;
}