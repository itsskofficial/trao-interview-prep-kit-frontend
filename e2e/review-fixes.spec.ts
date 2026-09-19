import { expect, test, type Page } from "@playwright/test";
import { createKit, register } from "./support";

/** One test per defect a code review found, so none of them comes back quietly. */

const technical = (page: Page) => page.locator("section", { has: page.getByRole("heading", { name: /^Technical/ }) });
const prompts = (page: Page) => technical(page).getByRole("textbox", { name: /^Prompt of question/ });
const values = (page: Page) => prompts(page).evaluateAll((nodes) => nodes.map((node) => (node as HTMLTextAreaElement).value));

test("signing in never sends the visitor off this site, whatever the next parameter says", async ({ page }) => {
  // Browsers read a backslash as a slash, so "/\evil.example" would otherwise mean "//evil.example".
  await page.goto("/register?next=/%5Cevil.example/phish");
  await page.getByLabel("Email").fill(`e2e-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "My kits" })).toBeVisible();
  expect(new URL(page.url()).host).toBe(new URL(page.url()).host.replace("evil.example", ""));
  expect(page.url()).not.toContain("evil.example");
});

test.describe("on a kit", () => {
  test.beforeEach(async ({ page }) => {
    await register(page);
    await createKit(page);
    await expect(page.getByRole("heading", { name: "Company brief" })).toBeVisible();
  });

  test("reordering while a delete can still be undone does not corrupt the list", async ({ page }) => {
    await page.getByRole("tab", { name: /^Questions/ }).click();
    await expect(prompts(page)).toHaveCount(3);
    const [first, second, third] = await values(page);

    await technical(page).getByRole("button", { name: /^Delete question 1 of/ }).click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeFocused();
    // The list now shows two questions. Move the second one up while the undo window is still open.
    await technical(page).getByRole("button", { name: /^Move question 2 of 2 up/ }).click();

    await expect(page.getByText("All changes saved")).toBeVisible();
    await expect(page.getByText("One change could not be saved")).toBeHidden();
    expect(await values(page)).toEqual([third, second]);

    // And it was saved that way: the deleted question is gone and the order holds after a reload.
    await page.reload();
    await expect(prompts(page)).toHaveCount(2);
    expect(await values(page)).toEqual([third, second]);
    expect(first).toBeTruthy();
  });

  test("a space typed at the end of a line is still there after the save lands", async ({ page }) => {
    await page.getByRole("tab", { name: /^Questions/ }).click();
    const prompt = prompts(page).first();
    await prompt.fill("Explain closures ");
    await expect(page.getByText("All changes saved")).toBeVisible();
    await page.waitForTimeout(300);
    await expect(prompt).toHaveValue("Explain closures ");
    await prompt.pressSequentially("and scope");
    await expect(prompt).toHaveValue("Explain closures and scope");
  });

  test("clearing a prompt marks it invalid and keeps the old text on the server until something is typed", async ({ page }) => {
    await page.getByRole("tab", { name: /^Questions/ }).click();
    const prompt = prompts(page).first();
    const original = await prompt.inputValue();

    await prompt.fill("");
    await page.waitForTimeout(1_200);
    await expect(prompt).toHaveAttribute("aria-invalid", "true");
    await expect(prompt).toHaveValue("");
    await expect(page.getByText("One change could not be saved")).toBeHidden();

    await page.reload();
    await expect(prompts(page).first()).toHaveValue(original);
  });

  test("coming straight back from the one-page summary shows the kit, not a loading skeleton", async ({ page }) => {
    await page.getByRole("link", { name: "One-page summary" }).click();
    await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
    await page.getByRole("link", { name: "Back to the kit" }).click();
    await expect(page.getByRole("heading", { name: "Company brief" })).toBeVisible();
  });

  test("practice shortcuts leave buttons, links and dialogs alone", async ({ page }) => {
    await page.getByRole("tab", { name: /^Practice/ }).click();
    await page.getByRole("button", { name: /Start practising/ }).click();
    await expect(page.getByText("Card 1 of")).toBeVisible();

    // Enter on a focused control activates that control; it does not reveal the card.
    await page.getByRole("button", { name: "Delete", exact: true }).focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByText("How confident did you feel?")).toBeHidden();

    // With the dialog open, Enter on Cancel cancels, and digits do not rate the card behind it.
    await dialog.getByRole("button", { name: "Cancel" }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Card 1 of")).toBeVisible();
  });

  test("the day field can be cleared and retyped", async ({ page }) => {
    await page.getByRole("tab", { name: /^Practice/ }).click();
    await page.getByRole("button", { name: /Start practising/ }).click();
    await page.keyboard.press("Space");
    await page.keyboard.press("1");
    await page.getByRole("tab", { name: /^Schedule/ }).click();

    const day = page.getByLabel("I am on day");
    await day.press("Backspace");
    await expect(day).toHaveValue("");
    await day.pressSequentially("3");
    await expect(page.getByRole("button", { name: "Re-plan from day 3 around these" })).toBeVisible();
    await day.fill("99");
    await day.blur();
    await expect(day).toHaveValue("5");
  });
});

test("a cases file whose entries are not cases is refused with a message, not a crash", async ({ page }) => {
  await register(page);
  await page.goto("/new");
  await page.getByLabel("Cases file").setInputFiles({ name: "cases.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify([null, 1, "x"])) });
  await expect(page.getByText("Entry 1 is not a case.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "New kit" })).toBeVisible();
});
