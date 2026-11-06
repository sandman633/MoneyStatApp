import { test, expect } from "@playwright/test";

test("формы закрываются кликом снаружи и остаются открытыми при клике внутри", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Расход", "Доход"] as const) {
    await page.getByRole("button", { name, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("heading").click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(dialog).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Счета", exact: true }).click();
  for (const name of ["Новый счёт", "Перевод"] as const) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});
