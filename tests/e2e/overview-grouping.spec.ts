import { test, expect } from "@playwright/test";
import { initialState } from "../../src/model";

test("группировка истории и быстрый ввод с нужного счёта", async ({ page }) => {
  const state = initialState();
  state.accounts.push({ id: "second", name: "Карта", currency: "RUB", opening: 0 });
  const food = state.categories.find((c) => c.name === "Еда")!.id;
  const salary = state.categories.find((c) => c.name === "Зарплата")!.id;
  state.entries = [
    { id: "food-1", kind: "expense", accountId: "second", categoryId: food, date: "2026-10-04", amount: 10000, note: "Обед" },
    { id: "food-2", kind: "expense", accountId: "second", categoryId: food, date: "2026-10-03", amount: 20000, note: "Ужин" },
    { id: "salary", kind: "income", accountId: "second", categoryId: salary, date: "2026-10-03", amount: 50000, note: "" },
    { id: "move", kind: "transfer", accountId: state.accounts[0].id, toId: "second", date: "2026-10-03", amount: 10000, received: 10000, note: "" },
  ];
  await page.goto("/");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator('input[accept=".json,application/json"]').setInputFiles({ name: "grouping.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(state)) });
  await page.getByRole("button", { name: "Обзор", exact: true }).click();
  await page.getByLabel("Месяц", { exact: true }).fill("2026-10");
  await expect(page.locator(".history-group")).toHaveCount(2);
  const dateGroup = page.locator(".history-group").filter({ has: page.getByRole("button", { name: /3 октября 2026/ }) });
  const dateToggle = dateGroup.locator(".history-group-toggle");
  await expect(dateGroup.locator(".entry")).toHaveCount(3);
  await expect(dateGroup.locator(".history-group-totals")).toContainText("−200,00 ₽");
  await expect(dateGroup.locator(".history-group-totals")).toContainText("+500,00 ₽");
  await expect(dateGroup.locator(".history-group-totals")).toContainText("Переводы: 100,00 ₽");
  await dateToggle.click();
  await expect(dateToggle).toHaveAttribute("aria-expanded", "false");
  await expect(dateGroup.locator(".entry")).toHaveCount(0);
  await expect(dateGroup.locator(".history-group-totals")).toContainText("+500,00 ₽");
  await dateToggle.press("Enter");
  await expect(dateGroup.locator(".entry")).toHaveCount(3);
  await page.getByLabel("Группировка истории").selectOption("category");
  await expect(page.locator(".history-group")).toHaveCount(3);
  const foodGroup = page.locator(".history-group").filter({ has: page.getByRole("button", { name: /Еда/ }) });
  await expect(foodGroup.locator(".entry")).toHaveCount(2);
  await expect(foodGroup.locator(".history-group-totals")).toContainText("−300,00 ₽");
  await foodGroup.locator(".history-group-toggle").click();
  await expect(foodGroup.locator(".entry")).toHaveCount(0);
  await expect(foodGroup.locator(".history-group-toggle .count")).toHaveText("2");
  await foodGroup.locator(".history-group-toggle").click();
  await expect(foodGroup.locator(".entry")).toHaveCount(2);
  await expect(page.locator(".history-group").filter({ has: page.getByRole("button", { name: /Переводы/ }) }).locator(".history-group-totals")).toContainText("100,00 ₽");
  await page.getByRole("button", { name: "Счета", exact: true }).click();
  const card = page.locator(".account-card").filter({ hasText: "Карта" });
  await card.getByRole("button", { name: "Добавить расход со счёта Карта" }).click();
  await expect(page.getByRole("dialog").getByRole("combobox", { name: "Счёт", exact: true })).toHaveValue("second");
  await page.getByRole("dialog").getByRole("button", { name: "Закрыть", exact: true }).click();
  await card.getByRole("button", { name: "Добавить доход на счёт Карта" }).click();
  await expect(page.getByRole("dialog").getByRole("combobox", { name: "Счёт", exact: true })).toHaveValue("second");
});
