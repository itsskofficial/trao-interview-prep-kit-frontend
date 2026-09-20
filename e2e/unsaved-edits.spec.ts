import { expect, test, type Page } from "@playwright/test";
import { createKit, register } from "./support";

const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
const technical = (page: Page) => page.locator("section", { has: page.getByRole("heading", { name: /^Technical/ }) });
const prompts = (page: Page) => technical(page).getByRole("textbox", { name: /^Prompt of question/ });

test("edits made offline survive closing the tab, and are sent on the next visit", async ({ page, context }) => {
  await register(page);
  await createKit(page);
  await expect(page.getByRole("heading", { name: "Company brief" })).toBeVisible();
  const kitUrl = page.url();

  await tab(page, "Questions").click();
  const untouched = await prompts(page).nth(1).inputValue();

  // The connection goes. The user keeps working, and then closes the tab.
  await context.setOffline(true);
  await prompts(page).first().fill("Written on a train, in a tunnel.");
  await technical(page).getByRole("button", { name: /^Pin question 2 of/ }).click();
  await expect(page.getByText(/could not|not saved|Retry/i).first()).toBeVisible();
  await page.close();

  // Later, online again, in a new tab.
  await context.setOffline(false);
  const next = await context.newPage();
  await next.goto(kitUrl);
  await expect(next.getByText("2 unsaved changes were recovered")).toBeVisible();
  await tab(next, "Questions").click();
  await expect(prompts(next).first()).toHaveValue("Written on a train, in a tunnel.");
  await expect(prompts(next).nth(1)).toHaveValue(untouched);
  await expect(next.getByText("All changes saved")).toBeVisible();

  // They reached the server: a fresh load shows them, and there is nothing left to recover.
  await next.reload();
  await tab(next, "Questions").click();
  await expect(prompts(next).first()).toHaveValue("Written on a train, in a tunnel.");
  await expect(technical(next).getByRole("button", { name: /^Unpin question 2 of/ })).toBeVisible();
  await expect(next.getByText(/unsaved changes? (was|were) recovered/)).toHaveCount(0);
});

test("a recovered change the kit has moved past is dropped quietly", async ({ page }) => {
  await register(page);
  await createKit(page);
  await expect(page.getByRole("heading", { name: "Company brief" })).toBeVisible();
  const kitId = page.url().split("/kits/")[1]!.split(/[/?#]/)[0]!;

  // What an earlier visit might have left behind: an edit to a question that no longer exists.
  await page.evaluate((id) => {
    window.localStorage.setItem(`prep-kit:unsaved:${id}`, JSON.stringify({ version: 1, savedAt: Date.now(), ops: [{ type: "patchQuestion", id: "q999", patch: { prompt: "For a question deleted since" } }] }));
  }, kitId);
  await page.reload();

  await expect(page.getByText("All changes saved")).toBeVisible();
  await expect(page.getByText("One change could not be saved")).toHaveCount(0);

  // A recovered change the server refuses must not stay on screen either: it was shown on trust, and the trust was misplaced.
  await tab(page, "Questions").click();
  const original = await prompts(page).first().inputValue();
  const firstId = await page.evaluate(async (id) => ((await (await fetch(`/api/kits/${id}`)).json()) as { kit: { questions: Array<{ id: string; category: string }> } }).kit.questions.find((q) => q.category === "technical")!.id, kitId);
  await page.evaluate(([id, questionId]) => {
    window.localStorage.setItem(`prep-kit:unsaved:${id}`, JSON.stringify({ version: 1, savedAt: Date.now(), ops: [{ type: "patchQuestion", id: questionId, patch: { prompt: "" } }] }));
  }, [kitId, firstId] as const);
  await page.reload();
  await tab(page, "Questions").click();
  await expect(prompts(page).first()).toHaveValue(original);
  expect(await page.evaluate((id) => window.localStorage.getItem(`prep-kit:unsaved:${id}`), kitId)).toBeNull();
});

test("storage that holds nonsense is ignored", async ({ page }) => {
  await register(page);
  await createKit(page);
  await expect(page.getByRole("heading", { name: "Company brief" })).toBeVisible();
  const kitId = page.url().split("/kits/")[1]!.split(/[/?#]/)[0]!;

  for (const nonsense of [
    '{"version":1,"savedAt":"yesterday","ops":[{"type":"dropDatabase"}]}',
    // The right name with nothing behind it: this used to reach code that expects a list of ids.
    JSON.stringify({ version: 1, savedAt: Date.now(), ops: [{ type: "reorderQuestions" }] }),
    JSON.stringify({ version: 1, savedAt: Date.now(), ops: [{ type: "patchQuestion", id: "q1", patch: { prompt: 42, origin: "user" } }] }),
    "not json at all",
  ]) {
    await page.evaluate(([id, value]) => window.localStorage.setItem(`prep-kit:unsaved:${id}`, value!), [kitId, nonsense] as const);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Company brief" })).toBeVisible();
    await expect(page.getByText(/recovered/)).toHaveCount(0);
    expect(await page.evaluate((id) => window.localStorage.getItem(`prep-kit:unsaved:${id}`), kitId)).toBeNull();
  }

  await expect(page.getByRole("heading", { name: "Company brief" })).toBeVisible();
  await expect(page.getByText(/recovered/)).toHaveCount(0);
});
