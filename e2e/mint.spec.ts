// Browser tests against a real Hardhat chain and the real contract. The wallet is e2e/dev-wallet.js,
// an EIP-6963 provider that forwards to the node (MetaMask itself isn't automated here).
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { ACCOUNTS, asOwner, contractAddress, frontendDeployment, publicClient, ROOT, rpc } from "./chain.ts";
import { lumenMothsAbi } from "../frontend/src/abi.ts";

const walletScript = readFileSync(path.join(ROOT, "e2e", "dev-wallet.js"), "utf8");

type WalletOptions = { account: string; startChainId?: number; knownChains?: number[]; rejectNext?: boolean; rejectSwitch?: boolean };

async function open(page: Page, wallet: WalletOptions | null) {
  await page.route("**/deployment.json", (route) => route.fulfill({ contentType: "application/json", body: frontendDeployment() }));
  if (wallet) {
    await page.addInitScript((cfg) => ((window as any).__DEV_WALLET__ = cfg), { rpcUrl: "http://127.0.0.1:8546", startChainId: 31337, ...wallet });
    await page.addInitScript(walletScript);
  }
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mint a moth" })).toBeVisible();
}

async function connect(page: Page) {
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await page.getByRole("button", { name: "Test Wallet (Hardhat)" }).click();
}

let snapshot: string;
test.beforeEach(async () => {
  snapshot = await rpc<string>("evm_snapshot");
});
test.afterEach(async () => {
  await rpc("evm_revert", [snapshot]);
});

test("without a wallet the page still reads the sale and points to MetaMask", async ({ page }) => {
  await open(page, null);
  await expect(page.getByTestId("phase")).toHaveText("Allowlist sale");
  await expect(page.getByTestId("minted")).toHaveText("3");
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.getByText("No browser wallet found.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Install MetaMask" })).toHaveAttribute("href", /metamask\.io/);
});

test("an allowlisted wallet on the wrong chain switches, then mints with its Merkle proof", async ({ page }) => {
  await open(page, { account: ACCOUNTS.alice, startChainId: 1 });
  await connect(page);
  // The connect flow asks the wallet to switch to the deployment's chain (4902 -> add -> switch).
  await expect(page.getByText("Hardhat local").first()).toBeVisible();
  await expect(page.getByText("✓ This wallet is on the allowlist.")).toBeVisible();
  await expect(page.getByTestId("wallet-left")).toHaveText("2");

  await page.getByRole("button", { name: "More" }).click();
  await expect(page.getByTestId("mint-button")).toHaveText("Mint 2 for 0.02 ETH");
  await page.getByTestId("mint-button").click();

  await expect(page.getByTestId("tx-status")).toContainText("Minted #4, #5.");
  await expect(page.getByTestId("minted")).toHaveText("5");
  await expect(page.getByTestId("wallet-left")).toHaveText("0");
  await expect(page.getByTestId("reason")).toHaveText("This wallet has minted its limit for this phase.");
  await expect(page.getByTestId("gallery").locator("li")).toHaveCount(2);
  await expect(page.locator(".recent")).toContainText("#5");

  const owned = await publicClient.readContract({ address: contractAddress(), abi: lumenMothsAbi, functionName: "tokensOfOwner", args: [ACCOUNTS.alice] });
  expect(owned).toEqual([4n, 5n]);
  const log: string[] = await page.evaluate(() => (window as any).__DEV_WALLET_LOG__);
  expect(log).toContain("wallet_addEthereumChain");
});

test("declining the network switch keeps the wallet connected and offers the switch again", async ({ page }) => {
  await open(page, { account: ACCOUNTS.alice, startChainId: 1, knownChains: [31337], rejectSwitch: true });
  await connect(page);
  await expect(page.getByText("You rejected the request in your wallet.")).toBeVisible();
  await expect(page.getByTestId("mint-button")).toHaveCount(0);
  const switchButton = page.locator(".mint-card").getByRole("button", { name: "Switch to Hardhat local" });
  await expect(switchButton).toBeVisible();

  await page.evaluate(() => ((window as any).__DEV_WALLET__.rejectSwitch = false));
  await switchButton.click();
  await expect(page.getByTestId("mint-button")).toBeEnabled();
  await expect(page.getByText("You rejected the request in your wallet.")).toHaveCount(0);
});

test("a wallet that isn't on the allowlist can't mint in the allowlist phase", async ({ page }) => {
  await open(page, { account: ACCOUNTS.dave });
  await connect(page);
  await expect(page.getByTestId("reason")).toHaveText("This wallet isn't on the allowlist. The public sale opens next.");
  await expect(page.getByTestId("mint-button")).toBeDisabled();
});

test("rejecting the transaction in the wallet leaves nothing minted", async ({ page }) => {
  await open(page, { account: ACCOUNTS.bob, rejectNext: true });
  await connect(page);
  await page.getByTestId("mint-button").click();
  await expect(page.getByTestId("tx-status")).toHaveText("You rejected the request in your wallet.");
  await expect(page.getByTestId("minted")).toHaveText("3");
  // The next attempt goes through.
  await page.getByTestId("mint-button").click();
  await expect(page.getByTestId("tx-status")).toContainText("Minted #4.");
});

test("public sale: mint up to the per-transaction cap, then the reveal swaps in the real art", async ({ page }) => {
  await asOwner({ functionName: "setPhase", args: [2] });
  await open(page, { account: ACCOUNTS.dave });
  await connect(page);
  await expect(page.getByTestId("phase")).toHaveText("Public sale");
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "More" }).click({ force: true }).catch(() => undefined);
  await expect(page.getByTestId("qty")).toHaveText("5");
  await expect(page.getByTestId("mint-button")).toHaveText("Mint 5 for 0.1 ETH");
  await page.getByTestId("mint-button").click();
  await expect(page.getByTestId("tx-status")).toContainText("Minted #4, #5, #6, #7, #8.");
  await expect(page.getByTestId("gallery").locator("li").first()).toContainText("unrevealed");

  await asOwner({ functionName: "reveal", args: ["http://127.0.0.1:5174/collection/metadata/"] });
  // The gallery reloads when the poll sees `revealed` flip, and shows each moth's traits.
  const first = page.getByTestId("gallery").locator("li").first();
  await expect(first).toContainText("#8");
  await expect(first).not.toContainText("unrevealed", { timeout: 15_000 });
  const meta = JSON.parse(readFileSync(path.join(ROOT, "frontend", "public", "collection", "metadata", "8.json"), "utf8"));
  const palette = meta.attributes.find((a: { trait_type: string }) => a.trait_type === "Palette").value;
  await expect(first).toContainText(palette);
  await expect(first.locator("img")).toHaveAttribute("alt", "Lumen Moths #8");
});

export function extractText(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function transcodeVideo(data: unknown): unknown {
  if (!data) return null;
  return data;
}