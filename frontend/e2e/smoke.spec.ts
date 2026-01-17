import { test, expect } from "@playwright/test";

test("register -> create project -> save -> open", async ({ page }) => {
  const email = `e2e_${Date.now()}@test.local`;
  const password = "Passw0rd!123";
  const projectName = `E2E Project ${Date.now()}`;

  // register
  await page.goto("/register");
  await page.getByTestId("auth-name").fill("E2E User");
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-password2").fill(password);
  await page.getByTestId("auth-submit").click();

  await expect(page).toHaveURL(/\/account/);

  // go to editor (new project)
  await page.getByTestId("project-new").click();
  await expect(page).toHaveURL(/\/editor/);

  // save project (open modal -> fill -> confirm)
  await page.getByTestId("project-save").click();
  await page.getByTestId("project-name").fill(projectName);
  await page.getByTestId("project-create").click();

  // verify in account
  await page.goto("/account");
  const item = page.locator('[data-testid^="project-item-"]').filter({ hasText: projectName });
  await expect(item).toBeVisible();

  // open project
  await item.locator('[data-testid^="project-open-"]').click();
  await expect(page).toHaveURL(/\/editor\/.+/);
});
