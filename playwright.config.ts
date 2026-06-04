import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:9003";
const headed = process.env.E2E_HEADED === "1" || process.env.E2E_HEADED === "true";
const headless = process.env.E2E_HEADLESS === "1" || process.env.E2E_HEADLESS === "true";

/**
 * Headed vs headless:
 * - Default: headless (CI-friendly)
 * - `E2E_HEADED=1 npm run test:e2e:perf` — watch the run
 * - `E2E_HEADLESS=1` — force headless (overrides headed)
 */
const useHeadless = headless || !headed;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "e2e/report/html" }],
    ["json", { outputFile: "e2e/report/results.json" }],
  ],
  outputDir: "e2e/test-results",
  timeout: 10 * 60 * 1000,
  expect: { timeout: 30_000 },
  use: {
    baseURL,
    headless: useHeadless,
    trace: process.env.E2E_TRACE === "1" ? "on" : "retain-on-failure",
    video: process.env.E2E_VIDEO === "1" ? "on" : "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_SKIP_WEB_SERVER
    ? undefined
    : {
        command: process.env.E2E_WEB_COMMAND ?? "npm run dev:test",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
