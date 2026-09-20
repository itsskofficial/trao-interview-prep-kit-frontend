import { test } from "@playwright/test";
import { createKit, register } from "./support";

/** Not assertions: a walk through the app that saves what each screen looks like, for review. Run with SHOTS=1. */
test.skip(!process.env.SHOTS, "screenshots are only taken on request");
// SHOTS_THEME=dark takes the same walk in the dark theme; the files get a -dark suffix.
const DARK = process.env.SHOTS_THEME === "dark";
test.use({ colorScheme: DARK ? "dark" : "light" });

test("capture the main screens", async ({ page }) => {
  const shot = (name: string) => page.screenshot({ path: `e2e/shots/${name}${DARK ? "-dark" : ""}.png`, fullPage: true, animations: "disabled" });

  await page.goto("/login");
  await shot("01-login");
  await register(page);
  await shot("02-empty");
  await createKit(page);
  await page.getByRole("heading", { name: "Company brief" }).waitFor();
  await shot("05-kit-overview");
  await page.getByRole("button", { name: "Show the run" }).click();
  await page.getByText("Total time").waitFor();
  await page.getByText(/model calls?, /).click();
  await page.getByRole("region", { name: "How this kit was made" }).screenshot({ path: "e2e/shots/09-run-trace.png" });
  await page.getByRole("button", { name: "Hide the run" }).click();

  for (const tab of ["Questions", "Flashcards", "Schedule", "Practice"]) {
    await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
    await page.waitForTimeout(500);
    await shot(`06-kit-${tab.toLowerCase()}`);
  }

  await page.getByRole("button", { name: /Start practising/ }).click();
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  await shot("07-practice-revealed");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: /^Questions/ }).click();
  await page.waitForTimeout(400);
  await shot("08-questions-phone");
});
