import { test } from "@playwright/test";
import { createKit, register } from "./support";

/** Not assertions: a walk through the app that saves what each screen looks like, for review. Run with SHOTS=1. */
test.skip(!process.env.SHOTS, "screenshots are only taken on request");

test("capture the main screens", async ({ page }) => {
  const shot = (name: string) => page.screenshot({ path: `e2e/shots/${name}.png`, fullPage: true });

  await page.goto("/login");
  await shot("01-login");
  await register(page);
  await shot("02-empty");
  await page.goto("/new");
  await shot("03-new");
  await page.getByLabel("Job description").fill("Senior Backend Engineer\n\nRequirements\n- 5+ years with Node.js\n- PostgreSQL");
  await page.getByLabel("Company website").fill("http://localhost:8099/acme/");
  await page.getByRole("button", { name: "Generate kit" }).click();
  await page.waitForURL(/\/jobs\//);
  await page.waitForTimeout(600);
  await shot("04-progress");
  await page.waitForURL(/\/kits\//, { timeout: 45_000 });
  await page.waitForTimeout(800);
  await shot("05-kit");
  await page.goto("/");
  await page.waitForTimeout(500);
  await shot("06-list");

  await page.setViewportSize({ width: 390, height: 844 });
  await shot("07-list-phone");
  await page.goto("/new");
  await shot("08-new-phone");
  void createKit;
});
