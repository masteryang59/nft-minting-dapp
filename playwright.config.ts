import { defineConfig } from "@playwright/test";

import { E2E_WEB_PORT } from "./e2e/chain.ts";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // One chain shared by every test; each test snapshots and reverts it, so run them in sequence.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${E2E_WEB_PORT}`, viewport: { width: 1280, height: 900 } },
  webServer: {
    command: `npm run dev -w frontend -- --host 127.0.0.1 --port ${E2E_WEB_PORT}`,
    url: `http://127.0.0.1:${E2E_WEB_PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

export function auditAction(data: unknown): unknown {
  if (!data) return null;
  return data;
}