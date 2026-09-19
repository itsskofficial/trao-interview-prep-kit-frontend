import { expect, test, type Page } from "@playwright/test";
import { createKit, register } from "./support";

const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
const technical = (page: Page) => page.locator("section", { has: page.getByRole("heading", { name: /^Technical/ }) });
const prompts = (page: Page) => technical(page).getByRole("textbox", { name: /^Prompt of question/ });
const saved = (page: Page) => expect(page.getByText("All changes saved")).toBeVisible();

test.beforeEach(async ({ page }) => {
  await register(page);
  await createKit(page);
  await expect(page.getByRole("heading", { name: "Company brief" })).toBeVisible();
});

test("a kit shows what was researched, including a hiring page found by crawling", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Senior Backend Engineer" }).first()).toBeVisible();
  await expect(page.getByText("How they hire, as published on their site")).toBeVisible();
  await expect(page.getByText("Take-home exercise").first()).toBeVisible();
  await expect(page.getByText("/acme/handbook/people/talent/stage-guide.html").first()).toBeVisible();
  await expect(page.getByText("Every requirement has at least one question.")).toBeVisible();
});

test("an edit is saved, and a regeneration of the same category keeps it", async ({ page }) => {
  await tab(page, "Questions").click();
  const first = prompts(page).first();
  const original = await first.inputValue();
  const untouched = await prompts(page).nth(1).inputValue();

  await first.fill("How would you keep a Node.js event loop unblocked under load?");
  await saved(page);
  await expect(technical(page).getByText("Edited", { exact: true })).toBeVisible();

  await technical(page).getByRole("button", { name: "Regenerate" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("you wrote, edited or pinned will be kept")).toBeVisible();
  await expect(dialog.locator("li").nth(1)).toContainText("1 item");
  await dialog.getByRole("button", { name: "Regenerate" }).click();

  await expect(page.getByText("Regenerated the technical questions")).toBeVisible({ timeout: 20_000 });
  await expect(prompts(page).first()).toHaveValue("How would you keep a Node.js event loop unblocked under load?");
  await expect(prompts(page).nth(1)).not.toHaveValue(untouched);

  // It survives a reload, so it really was saved and really was kept.
  await page.reload();
  await expect(prompts(page).first()).toHaveValue("How would you keep a Node.js event loop unblocked under load?");

  // And the regeneration can be undone: the replaced question comes back, the edit stays.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(technical(page).getByRole("textbox", { name: /^Prompt of question/ }).filter({ hasText: untouched })).toHaveCount(1);
  expect(original).not.toBe("");
});

test("questions reorder from the keyboard, and the order survives a reload", async ({ page }) => {
  await tab(page, "Questions").click();
  await expect(prompts(page).first()).toBeVisible();
  const before = await prompts(page).evaluateAll((nodes) => nodes.map((node) => (node as HTMLTextAreaElement).value));

  await technical(page).getByRole("button", { name: /^Reorder question 1 of/ }).focus();
  // The drag library announces each step and needs a moment between them, as a person would give it.
  await page.keyboard.press("Space");
  await expect(page.getByText(/Picked up draggable item|was moved over/)).toBeAttached();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(250);
  await page.keyboard.press("Space");
  await saved(page);

  const after = await prompts(page).evaluateAll((nodes) => nodes.map((node) => (node as HTMLTextAreaElement).value));
  expect(after.slice(0, 2)).toEqual([before[1], before[0]]);

  await page.reload();
  await expect(prompts(page).first()).toHaveValue(before[1]!);
});

test("a question can be added, pinned, moved to another category and deleted with undo", async ({ page }) => {
  await tab(page, "Questions").click();
  await page.getByRole("button", { name: "+ Add a technical question" }).click();
  await page.getByLabel("Your question").fill("What is backpressure?");
  await page.getByRole("button", { name: "Add question" }).click();
  await expect(technical(page).getByText("Yours", { exact: true })).toBeVisible();

  const mine = technical(page).locator("li", { has: page.getByText("Yours", { exact: true }) });
  await mine.getByLabel("Category").selectOption("behavioural");
  await expect(page.locator("section", { has: page.getByRole("heading", { name: /^Behavioural/ }) }).getByText("What is backpressure?")).toBeVisible();

  const count = await prompts(page).count();
  await technical(page).getByRole("button", { name: /^Delete question 1 of/ }).click();
  await expect(prompts(page)).toHaveCount(count - 1);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(prompts(page)).toHaveCount(count);

  await technical(page).getByRole("button", { name: /^Pin question 1 of/ }).click();
  await expect(technical(page).getByText("Pinned", { exact: true })).toBeVisible();
  await saved(page);
});

test("practice records confidence, reports weak spots, and the schedule can be re-planned around them", async ({ page }) => {
  await tab(page, "Practice").click();
  await page.getByRole("button", { name: "Start practising" }).click();
  await expect(page.getByText("Card 1 of")).toBeVisible();

  // Entirely from the keyboard: Space reveals, a digit rates.
  await page.keyboard.press("Space");
  await expect(page.getByText("How confident did you feel?")).toBeVisible();
  await page.keyboard.press("1");
  await expect(page.getByText("Card 2 of")).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("4");
  await expect(page.getByText("2 / ")).toBeVisible();

  await tab(page, "Schedule").click();
  await expect(page.getByText("5-day plan")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Weak spots" })).toBeVisible();
  await page.getByLabel("I am on day").fill("2");
  await page.getByRole("button", { name: /^Re-plan from day 2/ }).click();
  await expect(page.getByText("Re-planned from day 2 around your weak spots")).toBeVisible();
  await expect(page.getByText("weak spot").first()).toBeVisible();

  await page.getByRole("button", { name: "Back to the default plan" }).click();
  await expect(page.getByText("Re-planned from day 2 around your weak spots")).toBeHidden();
});
