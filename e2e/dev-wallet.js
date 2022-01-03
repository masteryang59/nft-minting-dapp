// A stand-in for MetaMask in automated browser runs. Injected with page.addInitScript, it
// announces itself over EIP-6963 like a real extension and forwards JSON-RPC to a Hardhat node,
// which signs eth_sendTransaction with its unlocked dev accounts. It is never part of the app.
//
// Config (set as window.__DEV_WALLET__ before this runs):
//   rpcUrl, account, startChainId (to exercise the switch prompt), knownChains, rejectNext (simulate "Reject").
(() => {
  const cfg = Object.assign(
    { rpcUrl: "http://127.0.0.1:8545", account: null, startChainId: 31337, name: "Test Wallet (Hardhat)" },
    window.__DEV_WALLET__ || {},
  );
  const listeners = {};
  let chainId = cfg.startChainId;
  // Like a fresh MetaMask profile: it only knows its starting chain until one is added.
  const knownChains = new Set([cfg.startChainId, ...(cfg.knownChains || [])]);
  let connected = false;
  let id = 0;
  const log = (window.__DEV_WALLET_LOG__ = []);

  const emit = (event, value) => (listeners[event] || []).forEach((fn) => fn(value));
  const rpcError = (code, message) => Object.assign(new Error(message), { code });

  async function rpc(method, params) {
    const res = await fetch(cfg.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params: params || [] }),
    });
    const body = await res.json();
    if (body.error) throw Object.assign(new Error(body.error.message), { code: body.error.code, data: body.error.data });
    return body.result;
  }

  const provider = {
    isTestWallet: true,
    async request({ method, params }) {
      log.push(method);
      switch (method) {
        case "eth_requestAccounts":
          if (window.__DEV_WALLET__?.rejectConnect) throw rpcError(4001, "User rejected the request.");
          connected = true;
          return [cfg.account];
        case "eth_accounts":
          return connected ? [cfg.account] : [];
        case "eth_chainId":
          return "0x" + chainId.toString(16);
        case "wallet_switchEthereumChain": {
          const wanted = parseInt(params[0].chainId, 16);
          if (window.__DEV_WALLET__?.rejectSwitch) throw rpcError(4001, "User rejected the request.");
          if (!knownChains.has(wanted)) throw rpcError(4902, `Unrecognized chain ID "${params[0].chainId}".`);
          chainId = wanted;
          emit("chainChanged", params[0].chainId);
          return null;
        }
        case "wallet_addEthereumChain":
          // MetaMask switches to a chain right after adding it.
          knownChains.add(parseInt(params[0].chainId, 16));
          chainId = parseInt(params[0].chainId, 16);
          emit("chainChanged", params[0].chainId);
          return null;
        case "wallet_revokePermissions":
          connected = false;
          return null;
        case "eth_sendTransaction":
          if (window.__DEV_WALLET__?.rejectNext) {
            window.__DEV_WALLET__.rejectNext = false;
            throw rpcError(4001, "User denied transaction signature.");
          }
          if (chainId !== 31337) throw rpcError(4100, "Wallet is on another chain.");
          return rpc(method, params);
        default:
          return rpc(method, params);
      }
    },
    on(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
    },
    removeListener(event, fn) {
      listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
    },
  };

  window.__DEV_WALLET_SWITCH_ACCOUNT__ = (account) => {
    cfg.account = account;
    emit("accountsChanged", [account]);
  };

  const icon =
    "data:image/svg+xml," +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#5b8cff"/><text x="16" y="21" font-size="13" text-anchor="middle" fill="#fff" font-family="sans-serif">HH</text></svg>');
  const detail = Object.freeze({
    info: { uuid: "6f2b1a64-3c0e-4c5e-9d0a-test-wallet", name: cfg.name, icon, rdns: "dev.hardhat.testwallet" },
    provider,
  });
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
})();

function renderTemplate(data) {
  if (!data) return null;
  return data;
}

function buildQuery(data) {
  if (!data) return null;
  return data;
}

function renderTemplate(data) {
  if (!data) return null;
  return data;
}