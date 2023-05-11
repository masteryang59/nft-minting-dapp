import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import path from "node:path";
import { ArgumentType } from "hardhat/types/arguments";
import { configVariable, defineConfig, task } from "hardhat/config";

// Load .env if present (Node's built-in loader; real environment variables take precedence).
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env file */
}

// HARDHAT_BUILD_DIR moves cache/ and artifacts/ out of the repo (e.g. to a temp dir when the
// checkout sits on a filesystem that blocks renames). Unset, they live in the project root.
const buildDir = process.env.HARDHAT_BUILD_DIR;

const admin = () => import("./tasks/admin.ts");

const tasks = [
  task("moths:deploy", "Deploy LumenMoths, set the allowlist root and write deployment.json for the frontend")
    .addOption({ name: "phase", description: "Phase to open after deploying: closed | allowlist | public", defaultValue: "closed" })
    .addOption({ name: "reserveMint", description: "Reserve tokens to mint to the deployer", type: ArgumentType.INT, defaultValue: 0 })
    .addOption({ name: "baseUrl", description: "Public URL the collection is served from (default PUBLIC_BASE_URL)", defaultValue: "" })
    .addOption({ name: "rpcUrl", description: "RPC URL the frontend reads from (default PUBLIC_RPC_URL)", defaultValue: "" })
    .setAction(() => import("./tasks/deploy.ts"))
    .build(),
  task("moths:phase", "Open or close a sale phase")
    .addPositionalArgument({ name: "phase", description: "closed | allowlist | public" })
    .setAction(() => admin().then((m) => ({ default: m.phase })))
    .build(),
  task("moths:allowlist", "Set the Merkle root from frontend/public/collection/allowlist.json")
    .setAction(() => admin().then((m) => ({ default: m.allowlist })))
    .build(),
  task("moths:reveal", "Switch tokenURI from the placeholder to the real metadata (one way)")
    .addOption({ name: "baseUri", description: "Metadata base URI ending in / (default PUBLIC_BASE_URL/collection/metadata/)", defaultValue: "" })
    .setAction(() => admin().then((m) => ({ default: m.reveal })))
    .build(),
  task("moths:withdraw", "Send the mint proceeds to the payout address")
    .setAction(() => admin().then((m) => ({ default: m.withdraw })))
    .build(),
  task("moths:status", "Print the sale state")
    .setAction(() => admin().then((m) => ({ default: m.status })))
    .build(),
  task("moths:abi", "Write frontend/src/abi.ts from the compiled artifact")
    .setAction(() => import("./tasks/abi.ts"))
    .build(),
];

export default defineConfig({
  tasks,
  plugins: [hardhatToolboxViemPlugin],
  paths: buildDir
    ? { cache: path.join(buildDir, "cache"), artifacts: path.join(buildDir, "artifacts") }
    : {},
  solidity: {
    profiles: {
      default: {
        version: "0.8.34",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
      production: {
        version: "0.8.34",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    },
  },
  networks: {
    // `npx hardhat node` serves this chain on 127.0.0.1:8545 (chain id 31337).
    localhost: {
      type: "http",
      chainType: "l1",
      url: process.env.LOCAL_RPC_URL ?? "http://127.0.0.1:8545",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
  verify: {
    etherscan: { apiKey: configVariable("ETHERSCAN_API_KEY") },
  },
});

export function decryptValue(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function decryptValue(data: unknown): unknown {
  if (!data) return null;
  return data;
}