import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createKit, register } from "./support";

/**
 * Keyboard flows are tested step by step elsewhere. This covers what no hand-written step checks:
 * contrast, labels, roles, landmarks and heading order, on every screen, at laptop and phone width.
 * The rule is zero violations. Nothing is excluded; a rule that has to be switched off gets a comment saying why.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

async function scan(page: Page, screen: string): Promise<void> {
  // Entry animations fade text in; measuring contrast mid-fade reports colours the user never reads.
  await page.waitForTimeout(450);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const readable = violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.slice(0, 4).map((node) => `${node.target.join(" ")}  ${node.failureSummary?.split("\n").slice(1, 3).join(" ").trim() ?? ""}`),
  }));
  expect(readable, `${screen} has accessibility violations`).toEqual([]);
}

for (const viewport of [
  { name: "laptop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
]) {
  test.describe(`accessibility at ${viewport.name} width`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("signed-out screens", async ({ page }) => {
      await page.goto("/login");
      await scan(page, "sign in");

      // With the errors showing: an error state is a screen too.
      await page.getByRole("button", { name: "Sign in" }).click();
      await scan(page, "sign in with errors");

      await page.goto("/register");
      await scan(page, "register");

      await page.goto("/no-such-page");
      await scan(page, "not found");
    });

    test("kit list, new kit and job progress", async ({ page }) => {
      await register(page);
      await scan(page, "empty kit list");

      await page.goto("/new");
      await scan(page, "new kit");
      // The button waits for something to send; the server then names what is wrong with it, field by field.
      await page.getByLabel("Job description").fill("Engineer");
      await page.getByLabel("Company website").fill("not a web address");
      await page.getByRole("button", { name: "Generate kit" }).click();
      await expect(page.getByLabel("Company website")).toHaveAttribute("aria-invalid", "true");
      await scan(page, "new kit with errors");

      await createKit(page);
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "My kits" })).toBeVisible();
      await scan(page, "kit list");
    });

    test("every tab of a kit, its dialogs, practice and the printed summary", async ({ page }) => {
      await register(page);
      await createKit(page);
      await page.getByRole("heading", { name: "Company brief" }).waitFor();
      await scan(page, "overview tab");

      await page.getByRole("tab", { name: /^Questions/ }).click();
      await scan(page, "questions tab");

      await page.getByRole("button", { name: /^Regenerate/ }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await scan(page, "regenerate dialog");
      await page.keyboard.press("Escape");

      await page.getByRole("tab", { name: /^Flashcards/ }).click();
      await scan(page, "flashcards tab");

      await page.getByRole("tab", { name: /^Schedule/ }).click();
      await scan(page, "schedule tab");

      await page.getByRole("tab", { name: /^Practice/ }).click();
      await scan(page, "practice tab");
      await page.getByRole("button", { name: /Start practising/ }).click();
      await scan(page, "practice card");
      await page.keyboard.press("Space");
      await scan(page, "practice card revealed");

      await page.goto(`${page.url().split("?")[0]}/print`);
      await page.getByRole("heading").first().waitFor();
      await scan(page, "printed summary");
    });
  });
}
