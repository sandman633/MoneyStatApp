import { test, expect } from "@playwright/test";

test("привязка Telegram, превью, импорт и защита от дублей", async ({ page }) => {
  let accountId = "", categoryId = "", acknowledgements = 0;
  await page.route("http://127.0.0.1:5173/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS" } });
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(value) });
    if (url.pathname === "/v1/link") return json({ token: "device-token" });
    if (url.pathname === "/v1/catalog") {
      expect(route.request().headers().authorization).toBe("Bearer device-token");
      const body = route.request().postDataJSON();
      accountId = body.accounts[0].id;
      categoryId = body.categories.find((item: { kind: string }) => item.kind === "expense").id;
      return json({ ok: true });
    }
    if (url.pathname === "/v1/entries/pending") return json({ entries: [{
      id: "tg-1", kind: "expense", accountId, categoryId, amount: 35000,
      date: "2026-11-06", note: "Семейный ужин", createdByName: "Таня",
    }] });
    if (url.pathname === "/v1/entries/ack") { acknowledgements++; return json({ ok: true }); }
    return json({ error: "not found" }, 404);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page.getByLabel("Адрес сервера").fill("http://127.0.0.1:5173/path");
  await page.getByLabel("Код привязки").fill("12345678");
  await page.getByRole("button", { name: "Подключить Telegram", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Telegram подключён");
  await page.getByRole("button", { name: "Подгрузить из Telegram", exact: true }).click();
  await expect(page.locator(".telegram-preview")).toContainText("Семейный ужин");
  await expect(page.locator(".telegram-preview")).toContainText("Таня");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Добавить в MoneyStat", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("добавлено 1");
  expect(acknowledgements).toBe(1);
  await page.getByRole("button", { name: "Подгрузить из Telegram", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Добавить в MoneyStat", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("добавлено 0");
  expect(acknowledgements).toBe(2);
  await page.getByRole("button", { name: "Обзор", exact: true }).click();
  await page.getByLabel("Период").selectOption("day");
  await page.getByRole("textbox", { name: "День", exact: true }).fill("2026-11-06");
  await expect(page.locator(".entry-name").filter({ hasText: "Семейный ужин" })).toHaveCount(1);
});
