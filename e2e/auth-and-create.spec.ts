import { expect, test } from "@playwright/test";
import { ACME_JD, FIXTURES, createKit, register } from "./support";

test("a signed-out visitor is sent to sign in, and comes back to where they were going", async ({ page }) => {
  await page.goto("/new");
  await expect(page).toHaveURL(/\/login\?next=%2Fnew/);
  await page.getByRole("link", { name: "Create one" }).click();
  // Both screens have an Email field, so wait for the right one.
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page).toHaveURL(/\/register\?next=%2Fnew/);

  await page.getByLabel("Email").fill(`e2e-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "New kit" })).toBeVisible();
});

test("sign-in errors are shown beside the field they belong to", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
});

test("generation shows each step, and a dead company site still produces an honest kit", async ({ page }) => {
  await register(page);
  await expect(page.getByText("No kits yet")).toBeVisible();

  await createKit(page, { company: "no-such-company" });
  await expect(page.getByText("What this kit could not find")).toBeVisible();
  await expect(page.getByText(/based on the job description alone/)).toBeVisible();
  await expect(page.getByText(/No information about/)).toBeVisible();

  await page.getByRole("tab", { name: /^Questions/ }).click();
  await expect(page.getByText("Nothing about the company could be retrieved")).toBeVisible();
});

test("the same posting submitted twice offers the existing kit", async ({ page }) => {
  await register(page);
  await createKit(page);

  await page.goto("/new");
  await page.getByLabel("Job description").fill(ACME_JD);
  await page.getByLabel("Company website").fill(`${FIXTURES}/acme/`);
  await page.getByRole("button", { name: "Generate kit" }).click();
  await expect(page.getByText("You already have a kit for this posting")).toBeVisible();
  await page.getByRole("link", { name: "Open it" }).click();
  await expect(page).toHaveURL(/\/kits\//);
});

test("several roles can be uploaded at once, and a bad entry is reported beside the good ones", async ({ page }) => {
  await register(page);
  await page.goto("/new");
  const cases = [
    { id: "a", jd: ACME_JD, company_url: `${FIXTURES}/acme/`, days: 3 },
    { id: "b", jd: "", company_url: "nope", days: 3 },
    { id: "c", jd: "Data Engineer\n\nRequirements\n- Python\n- SQL", company_url: `${FIXTURES}/globex/`, days: 7 },
  ];
  await page.getByLabel("Cases file").setInputFiles({ name: "cases.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(cases)) });
  await page.getByRole("button", { name: "Generate 3 kits" }).click();

  await expect(page.getByText("Started: watch progress")).toHaveCount(2);
  await expect(page.getByText("Not started")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Data Engineer/ })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("link", { name: /Senior Backend Engineer/ })).toBeVisible({ timeout: 45_000 });
});

test("one user cannot open another user's kit", async ({ page, browser }) => {
  await register(page);
  await createKit(page);
  const kitUrl = page.url();

  const other = await (await browser.newContext()).newPage();
  await register(other);
  await other.goto(kitUrl);
  await expect(other.getByText("This kit does not exist")).toBeVisible();
});
