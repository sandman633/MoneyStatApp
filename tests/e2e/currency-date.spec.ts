import { test, expect } from "@playwright/test";
import { initialState, today } from "../../src/model";

test("валютный знак, диаграмма, дата и смена валюты основного счёта", async ({ page }) => {
  const state = initialState();
  const date = today();
  state.accounts[0].opening = 90000;
  state.entries = [{ id: "expense", kind: "expense", accountId: state.accounts[0].id,
    amount: 9000, categoryId: state.categories[0].id, date, note: "Проверка валюты" }];
  await page.goto("/");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator('input[accept=".json,application/json"]').setInputFiles({ name: "fixture.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(state)) });
  await expect(page.getByRole("status")).toContainText("восстановлена");
  await page.getByRole("button", { name: "Обзор", exact: true }).click();
  await page.getByLabel("Валюта отображения").selectOption("USD");
  await expect(page.locator(".balance-card strong")).toHaveText("9,00 $");
  await expect(page.locator(".donut-hole strong")).toHaveText("1,00 $");
  await expect(page.locator(".legend b")).toHaveText("1,00 $");
  await expect(page.locator(".legend small")).toContainText("100%");
  await page.getByLabel("Валюта отображения").selectOption("EUR");
  await expect(page.locator(".balance-card strong")).toHaveText("8,10 €");
  await page.getByLabel("Период", { exact: true }).selectOption("day");
  await page.getByLabel("День", { exact: true }).fill(date);
  await expect(page.locator(".entry")).toHaveCount(1);
  await page.getByRole("button", { name: "Следующий день", exact: true }).click();
  await expect(page.locator(".entry")).toHaveCount(0);
  await expect(page.locator(".balance-card strong")).toHaveText("8,10 €");
  await page.getByRole("button", { name: "Счета", exact: true }).click();
  await page.getByLabel("Валюта счёта Основной счёт").selectOption("USD");
  await expect(page.locator(".account-card > strong")).toHaveText("9,00 $");
  await page.reload();
  await page.getByLabel("Фильтр счетов").selectOption(state.accounts[0].id);
  await expect(page.locator(".balance-card strong")).toHaveText("9,00 $");
  await expect(page.locator(".donut-hole strong")).toHaveText("1,00 $");
  await expect(page.locator(".entry-amount b")).toContainText("1,00 $");
});
