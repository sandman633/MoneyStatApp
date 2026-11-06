import { test, expect } from "@playwright/test";

test("импорт Monefy заменяет базу, переводит названия и сохраняет переводы", async ({ page }) => {
  const csv = [
    "date,account,category,amount,currency,converted amount,currency,description",
    "01.10.2026,Cash,InitialBalance,90000,RUB,90000,RUB,",
    "20.10.2026,Cash,ExpenseTransfer,-80000,RUB,-80000,RUB,Пополнение бс",
    "20.10.2026,Активы Фонда,IncomeTransfer,80000,RUB,80000,RUB,Пополнение бс",
    "21.10.2026,Cash,Food,-100,RUB,-100,RUB,Обед",
  ].join("\n");
  const upload = { name: "monefy.csv", mimeType: "text/csv", buffer: Buffer.from(csv) };
  await page.goto("/");
  await page.getByRole("button", { name: "Доход", exact: true }).click();
  await page.getByLabel("Сумма · RUB").fill("123");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const picker = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Импортировать историю Monefy", exact: true }).click();
  await (await picker).setFiles(upload);
  await expect(page.locator(".import-preview")).toContainText("1 переводов");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Заменить все данные", exact: true }).click();
  await expect(page.locator(".import-preview")).toBeVisible();
  await page.getByRole("button", { name: "Обзор", exact: true }).click();
  await expect(page.locator(".entry")).toHaveCount(1);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const transfer = await page.evaluateHandle((text) => {
    const data = new DataTransfer();
    data.items.add(new File([text], "monefy.csv", { type: "text/csv" }));
    return data;
  }, csv);
  await page.getByLabel("Перетащите CSV Monefy").dispatchEvent("drop", { dataTransfer: transfer });
  await transfer.dispose();
  await expect(page.locator(".import-preview")).toContainText("1 переводов");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Заменить все данные", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Все данные заменены");
  await page.getByRole("button", { name: "Обзор", exact: true }).click();
  await expect(page.locator(".entry")).toHaveCount(2);
  await expect(page.locator(".entry-name").filter({ hasText: "Перевод" })).toContainText("Наличные → Активы Фонда");
  await expect(page.locator(".stat-card").filter({ hasText: "Доходы" })).toContainText("0,00");
  await expect(page.locator(".stat-card").filter({ hasText: "Расходы" })).toContainText("100,00");
  await page.reload();
  await page.getByRole("button", { name: "Счета", exact: true }).click();
  await expect(page.locator(".account-card")).toHaveCount(2);
  await expect(page.locator(".account-card").filter({ hasText: "Наличные" })).toContainText("9 900,00");
  await expect(page.locator(".account-card").filter({ hasText: "Активы Фонда" })).toContainText("80 000,00");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page.getByLabel("CSV истории Monefy").setInputFiles({ ...upload, buffer: Buffer.from(csv.replace("IncomeTransfer", "Food")) });
  await expect(page.locator(".history-import [role=alert]")).toContainText("пар перевода");
  await expect(page.getByRole("button", { name: "Заменить все данные", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Счета", exact: true }).click();
  await expect(page.locator(".account-card")).toHaveCount(2);
});
