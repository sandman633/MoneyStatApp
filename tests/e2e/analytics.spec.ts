import { test, expect } from "@playwright/test";
import { initialState } from "../../src/model";

test("аналитика: категории, дни, месяцы, годы, сравнение и подсказка обзора", async ({ page }, info) => {
  const s = initialState(), accountId = s.accounts[0].id, food = s.categories[0].id;
  s.categories.push({ id: "restaurants", name: "Рестораны", kind: "expense", color: "#65a88c", icon: "utensils" });
  s.entries = [
    { id: "salary", kind: "income", accountId, categoryId: s.categories.find(c => c.kind === "income")!.id, date: "2026-10-03", amount: 500000, note: "Октябрьская зарплата" },
    { id: "a", kind: "expense", accountId, categoryId: food, date: "2026-10-03", amount: 10000, note: "" },
    { id: "b", kind: "expense", accountId, categoryId: "restaurants", date: "2026-10-03", amount: 20000, note: "" },
    { id: "c", kind: "expense", accountId, categoryId: food, date: "2026-10-15", amount: 30000, note: "" },
    { id: "d", kind: "expense", accountId, categoryId: food, date: "2026-09-03", amount: 20000, note: "" },
    { id: "e", kind: "expense", accountId, categoryId: food, date: "2025-10-03", amount: 10000, note: "" },
  ];
  await page.goto("/");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator('input[accept=".json,application/json"]').setInputFiles({ name: "analytics.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(s)) });
  await expect(page.getByRole("status")).toContainText("восстановлена");
  await page.getByRole("button", { name: "Аналитика", exact: true }).click();
  await page.getByLabel("Месяц целиком").fill("2026-10");
  await page.getByRole("button", { name: "Снять выбор", exact: true }).click();
  await page.getByRole("checkbox", { name: "Еда", exact: true }).check();
  await page.getByRole("checkbox", { name: "Рестораны", exact: true }).check();
  await expect(page.getByTestId("analytics-total")).toHaveText("600,00 ₽");
  await expect(page.locator(".analytics-comparison")).toHaveCount(0);
  await expect(page.locator(".analytics-chart")).toHaveCount(1);
  await page.locator(".chart-periods button").first().click();
  await expect(page.getByTestId("analytics-change")).toContainText("200%");
  await expect(page.locator(".current-column")).toHaveCount(31);
  await expect(page.locator(".previous-column")).toHaveCount(30);
  await page.locator(".current-column").last().click();
  await expect(page.getByRole("tooltip")).toContainText("Нет соответствующей даты");
  await page.getByRole("button", { name: "2026-10-03: 300,00 ₽, операций: 2", exact: true }).click();
  await expect(page.locator(".histogram-detail").first()).toContainText("Рестораны: 200,00");
  const scroll = page.locator(".histogram-scroll");
  await scroll.evaluate(el => { el.scrollLeft = 0; });
  await scroll.hover();
  await page.mouse.wheel(0, 400);
  await expect.poll(() => scroll.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  const bars = page.locator(".histogram-pair-bars").first();
  const left = await bars.locator(".previous-column").boundingBox();
  const right = await bars.locator(".current-column").boundingBox();
  expect(left!.x).toBeLessThan(right!.x);
  await expect(page.locator(".chart-periods button").first()).toContainText("Сравнение");
  await expect(page.locator(".analytics-table thead th").nth(1)).toHaveText("Период сравнения");
  const category = page.getByRole("button", { name: "Еда", exact: true });
  await category.click();
  await expect(category).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".category-details:visible")).toContainText("15.10.2026");
  await expect(page.locator(".category-details:visible .category-periods section").first()).toContainText("Период сравнения");
  await category.click();
  await expect(page.locator(".category-details:visible")).toHaveCount(0);
  await page.getByLabel("Тип операций").selectOption("income");
  await expect(page.getByTestId("analytics-total")).toHaveText("5 000,00 ₽");
  await page.getByRole("button", { name: "Зарплата", exact: true }).click();
  await expect(page.locator(".category-details:visible")).toContainText("Октябрьская зарплата");
  await page.getByLabel("Тип операций").selectOption("expense");
  await page.screenshot({ path: `test-results/analytics-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("combobox", { name: "Разрез", exact: true }).selectOption("month");
  await expect(page.locator(".current-column")).toHaveCount(1);
  await page.getByRole("combobox", { name: "Сравнение", exact: true }).selectOption("year");
  await page.locator(".chart-periods button").first().click();
  await expect(page.getByTestId("analytics-change")).toContainText("500%");
  await page.getByRole("combobox", { name: "Разрез", exact: true }).selectOption("year");
  await page.getByLabel("Начало периода", { exact: true }).fill("2025-01-01");
  await page.getByLabel("Конец периода", { exact: true }).fill("2026-12-31");
  await expect(page.locator(".current-column")).toHaveCount(2);
  await expect(page.getByTestId("analytics-total")).toHaveText("900,00 ₽");
  await page.getByRole("combobox", { name: "Валюта аналитики", exact: true }).selectOption("USD");
  await expect(page.getByTestId("analytics-total")).toContainText("$");
  await page.getByLabel("Начало периода", { exact: true }).fill("2027-01-01");
  await expect(page.locator(".analytics-page [role=alert]")).toContainText("начало не позже");
  await page.getByRole("button", { name: "Обзор", exact: true }).click();
  await page.getByLabel("Месяц", { exact: true }).fill("2026-10");
  await page.locator(".legend button").filter({ hasText: "Еда" }).focus();
  await expect(page.getByRole("tooltip")).toContainText("Больше на 200,00");
  await expect(page.getByRole("tooltip")).toContainText("100%");
});
