import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests drive the real interface against the real backend running in its offline mode
 * (in-memory MongoDB, a mechanical stand-in for the model, fixture company sites). Nothing here
 * needs a key, a database or the open internet.
 *
 * Expects the backend checked out beside this repository. Override with BACKEND_DIR.
 */
const backendDir = process.env.BACKEND_DIR ?? "../backend";
const PORT = Number(process.env.E2E_PORT ?? 3210);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev:offline",
      cwd: backendDir,
      url: "http://localhost:4000/api/health",
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: `npm run dev -- -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
