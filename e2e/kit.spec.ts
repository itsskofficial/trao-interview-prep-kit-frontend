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

test("the one-page summary reflects the user's edits", async ({ page }) => {
  await page.getByRole("textbox", { name: "Company summary" }).fill("My own one-line summary of Acme.");
  await saved(page);
  await page.getByRole("link", { name: "One-page summary" }).click();

  await expect(page.getByRole("heading", { name: "Their interview process" })).toBeVisible();
  await expect(page.getByText("My own one-line summary of Acme.")).toBeVisible();
  await expect(page.getByText("Must have:")).toBeVisible();
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
});

test("the coverage map links each requirement to the questions that cover it, and the kit downloads as JSON", async ({ page }) => {
  const map = page.locator("section", { has: page.getByRole("heading", { name: "Coverage map" }) });
  await expect(map.getByRole("rowheader").first()).toContainText("Must-have");
  await expect(map.getByText("No question yet")).toHaveCount(0);

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download JSON" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^kit-.*\.json$/);

  await map.getByRole("link").first().click();
  await expect(page).toHaveURL(/tab=questions#question-q\d+/);
  await expect(page.locator("li[data-highlighted]")).toBeVisible();
});

test("a kit can be deleted, after a confirmation that names it", async ({ page }) => {
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Senior Backend Engineer");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete kit" }).click();
  await expect(page.getByText("No kits yet")).toBeVisible();
});

test("flashcards reorder from the keyboard and by dragging, and the order survives a reload", async ({ page }) => {
  await tab(page, "Flashcards").click();
  const fronts = page.getByRole("textbox", { name: /^Front of flashcard/ });
  await expect(fronts.first()).toBeVisible();
  const before = await fronts.evaluateAll((nodes) => nodes.map((node) => (node as HTMLTextAreaElement).value));

  // From the keyboard. The cards sit in a two-column grid, so the second card is to the right of the first.
  await page.getByRole("button", { name: /^Reorder flashcard 1 of/ }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByText(/Picked up draggable item|was moved over/)).toBeAttached();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(250);
  await page.keyboard.press("Space");
  await saved(page);
  expect((await fronts.evaluateAll((nodes) => nodes.map((node) => (node as HTMLTextAreaElement).value))).slice(0, 2)).toEqual([before[1], before[0]]);

  // With the mouse: put it back.
  const handle = page.getByRole("button", { name: /^Reorder flashcard 2 of/ });
  const target = page.getByRole("button", { name: /^Reorder flashcard 1 of/ });
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await saved(page);

  await page.reload();
  await tab(page, "Flashcards").click();
  await expect(fronts.first()).toHaveValue(before[0]!);
  await expect(fronts.nth(1)).toHaveValue(before[1]!);
});

test("a question can be dragged into another category, and that changes its category for good", async ({ page }) => {
  // Tall enough to hold both lists, so the drag is one straight movement and not a fight with auto-scrolling.
  await page.setViewportSize({ width: 1280, height: 1800 });
  await tab(page, "Questions").click();
  const behavioural = page.locator("section", { has: page.getByRole("heading", { name: /^Behavioural/ }) });
  const moving = await prompts(page).first().inputValue();
  const technicalBefore = await prompts(page).count();
  const behaviouralBefore = await behavioural.getByRole("textbox", { name: /^Prompt of question/ }).count();

  const handle = technical(page).getByRole("button", { name: /^Reorder question 1 of/ });
  const target = behavioural.getByRole("button", { name: /^Reorder question 1 of/ });
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 20, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();
  await saved(page);

  await expect(prompts(page)).toHaveCount(technicalBefore - 1);
  await expect(behavioural.getByRole("textbox", { name: /^Prompt of question/ })).toHaveCount(behaviouralBefore + 1);
  await expect(behavioural.getByRole("textbox", { name: /^Prompt of question/ }).first()).toHaveValue(moving);

  // Moving a question is a decision about it, so it is kept when its new category is regenerated.
  await page.reload();
  await tab(page, "Questions").click();
  await expect(behavioural.getByRole("textbox", { name: /^Prompt of question/ }).first()).toHaveValue(moving);
  await expect(behavioural.getByRole("button", { name: /^Unpin question 1 of/ })).toBeVisible();
});
