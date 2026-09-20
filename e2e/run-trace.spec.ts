import { expect, test } from "@playwright/test";
import { createKit, register } from "./support";

test("shows how a kit was made, only when asked, and quotes the page for each hiring stage", async ({ page }) => {
  await register(page);

  const traceRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/trace")) traceRequests.push(request.url());
  });

  await createKit(page);
  await page.getByRole("heading", { name: "Company brief" }).waitFor();

  // Each published stage carries the sentence it was taken from.
  const stages = page.getByRole("heading", { name: /How they hire/ }).locator("xpath=following-sibling::ol[1]");
  const recruiterCall = stages.getByRole("listitem").filter({ hasText: "Recruiter call" });
  await expect(recruiterCall).toContainText("Motivation, salary expectations");

  // The trace is the largest thing a kit has; it is not fetched until someone opens it.
  const toggle = page.getByRole("button", { name: "Show the run" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(traceRequests).toEqual([]);

  await toggle.click();
  await expect(page.getByRole("button", { name: "Hide the run" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Total time")).toBeVisible();
  await expect(page.getByText("Read the posting")).toBeVisible();
  await expect(page.getByText("Validate the kit")).toBeVisible();
  expect(traceRequests).toHaveLength(1);

  // The detail tables open from the keyboard.
  const calls = page.getByText(/model calls?, /);
  await calls.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("table", { name: "Every call to a model in this run" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "extract-requirements" })).toBeVisible();

  await page.getByRole("button", { name: "Hide the run" }).click();
  await expect(page.getByText("Total time")).toBeHidden();
});
