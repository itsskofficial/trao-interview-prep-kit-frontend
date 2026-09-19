import { expect, test } from "@playwright/test";

/**
 * One full pass against a deployed instance with the real model and a real company site.
 * Only runs when PROD_URL is set:  PROD_URL=https://... npx playwright test e2e/production-smoke.spec.ts
 */
const PROD_URL = process.env.PROD_URL;
test.skip(!PROD_URL, "set PROD_URL to run against a deployment");
test.setTimeout(6 * 60_000);

const JD = `Senior Product Engineer
PostHog - Remote

What you'll do
- Ship features end to end across our product analytics and session replay tools
- Talk to customers and decide what to build next

Requirements
- Strong experience with TypeScript and React
- Experience with Python and Django, or willingness to learn quickly
- You have shipped products end to end and owned them in production
- Comfortable talking directly to users and making product decisions

Nice to have
- Experience with ClickHouse or other analytical databases
- You have worked at an early-stage startup`;

test("a real kit, end to end, on the deployed app", async ({ page }) => {
  const shot = (name: string) => page.screenshot({ path: `e2e/shots/prod-${name}.png`, fullPage: true });

  await page.goto(`${PROD_URL}/register`);
  await page.getByLabel("Email").fill(`e2e-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "My kits" })).toBeVisible({ timeout: 90_000 });

  await page.goto(`${PROD_URL}/new`);
  await page.getByLabel("Job description").fill(JD);
  await page.getByLabel("Company website").fill("https://posthog.com");
  await page.getByLabel("Days until the interview").fill("7");
  await page.getByRole("button", { name: "Generate kit" }).click();
  await page.waitForURL(/\/jobs\//, { timeout: 60_000 });
  await page.waitForTimeout(20_000);
  await shot("progress");

  await page.waitForURL(/\/kits\//, { timeout: 5 * 60_000 });
  await expect(page.getByRole("heading", { name: "Company brief" })).toBeVisible({ timeout: 60_000 });
  await shot("overview");
  await page.getByRole("tab", { name: /^Questions/ }).click();
  await page.waitForTimeout(800);
  await shot("questions");
  await page.getByRole("tab", { name: /^Schedule/ }).click();
  await page.waitForTimeout(800);
  await shot("schedule");
});
