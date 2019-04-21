// Starts a dedicated Hardhat node (port 8546) and deploys with the real deploy task into
// e2e/.deployment, so a dev chain on 8545 and its deployment files are left alone.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

import { DEPLOYMENT_DIR, E2E_RPC, E2E_RPC_PORT, ROOT, rpc } from "./chain.ts";

let node: ChildProcess | undefined;

function killTree(child: ChildProcess | undefined) {
  if (!child?.pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

export default async function globalSetup() {
  if (!existsSync(path.join(ROOT, "frontend", "public", "collection", "allowlist.json"))) {
    const gen = spawnSync(process.execPath, ["scripts/generate-collection.ts"], { cwd: ROOT, stdio: "inherit" });
    if (gen.status !== 0) throw new Error("collection generation failed");
  }

  const reachable = await rpc("eth_chainId").then(() => true, () => false);
  if (reachable) throw new Error(`port ${E2E_RPC_PORT} is already in use; stop whatever is running on ${E2E_RPC}`);

  node = spawn("npx", ["hardhat", "node", "--hostname", "127.0.0.1", "--port", String(E2E_RPC_PORT)], {
    cwd: ROOT,
    shell: process.platform === "win32",
    stdio: "ignore",
  });
  const deadline = Date.now() + 60_000;
  while (!(await rpc("eth_chainId").then(() => true, () => false))) {
    if (Date.now() > deadline) {
      killTree(node);
      throw new Error("hardhat node didn't start within 60 s");
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  rmSync(DEPLOYMENT_DIR, { recursive: true, force: true });
  const deploy = spawnSync("npx", ["hardhat", "moths:deploy", "--network", "localhost", "--phase", "allowlist", "--reserve-mint", "3"], {
    cwd: ROOT,
    shell: process.platform === "win32",
    env: { ...process.env, LOCAL_RPC_URL: E2E_RPC, DEPLOYMENTS_DIR: DEPLOYMENT_DIR, PUBLIC_BASE_URL: "http://127.0.0.1:5174" },
    encoding: "utf8",
  });
  if (deploy.status !== 0) {
    killTree(node);
    throw new Error(`deploy failed:\n${deploy.stdout}\n${deploy.stderr}`);
  }

  return async () => killTree(node);
}
