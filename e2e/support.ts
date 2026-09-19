import { expect, type Page } from "@playwright/test";

export const FIXTURES = "http://localhost:8099";

export const ACME_JD = `Senior Backend Engineer
Acme Logistics - Remote (EU)

Requirements
- 5+ years building services with Node.js
- Strong SQL and PostgreSQL experience
- Experience mentoring junior engineers

Nice to have
- Exposure to Kubernetes`;

/** A new account per test, so tests never see each other's kits. */
export async function register(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "My kits" })).toBeVisible();
  return email;
}

/** Creates a kit through the interface and waits on the kit page. */
export async function createKit(page: Page, options: { jd?: string; company?: string; days?: number } = {}): Promise<void> {
  await page.goto("/new");
  await page.getByLabel("Job description").fill(options.jd ?? ACME_JD);
  await page.getByLabel("Company website").fill(`${FIXTURES}/${options.company ?? "acme"}/`);
  await page.getByLabel("Days until the interview").fill(String(options.days ?? 5));
  await page.getByRole("button", { name: "Generate kit" }).click();
  await page.waitForURL(/\/jobs\//);
  await page.waitForURL(/\/kits\//, { timeout: 45_000 });
}
