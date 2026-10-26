import { test, expect } from "@playwright/test";
test("доход, расход, валютный перевод, перезапуск и копия", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Доход", exact: true }).click();
  await page.getByLabel("Сумма · RUB").fill("50000");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.locator(".balance-card strong")).toContainText("50");
  await page.getByRole("button", { name: "Расход", exact: true }).click();
  await page.getByLabel("Сумма · RUB").fill("1250,50");
  await page.getByRole("button", { name: "Еда", exact: true }).click();
  await page.getByLabel("Заметка").fill("Продукты на неделю");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.locator(".entry")).toHaveCount(2);
  await page.getByRole("button", { name: "Счета", exact: true }).click();
  await page.getByRole("button", { name: "Новый счёт", exact: true }).click();
  await page.getByLabel("Название счёта").fill("Долларовый");
  await page.getByLabel("Валюта", { exact: true }).selectOption("USD");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByRole("button", { name: "Перевод", exact: true }).click();
  await page.getByLabel("Сумма · RUB").fill("9000");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.locator(".account-card").filter({ hasText: "Долларовый" }),
  ).toContainText("100,00");
  await page.reload();
  await expect(page.locator(".entry")).toHaveCount(3);
  await expect(
    page.locator(".stat-card").filter({ hasText: "Расходы за месяц" }),
  ).toContainText("1 250,50");
  await page.screenshot({
    path: `test-results/overview-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await page.getByLabel("Название", { exact: true }).fill("Кофе");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.locator(".category-chips")).toContainText([
    "Кофе",
    "Зарплата",
  ]);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON" }).click();
  const download = await downloadEvent;
  const path = await download.path();
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator("input[type=file]").setInputFiles(path!);
  await expect(page.getByRole("status")).toContainText("восстановлена");
});
