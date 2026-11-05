import { describe, it, expect } from "vitest";
import { initialState } from "../src/model";
import { expenseReport, monthRange, shiftRange, changeText } from "../src/analyticsModel";

describe("аналитика расходов", () => {
  it("группирует выбранные категории, валюты и нулевые дни, исключая переводы и доходы", () => {
    const s = initialState(), account = s.accounts[0].id, food = s.categories[0].id, home = s.categories[1].id;
    s.accounts.push({ id: "usd", name: "USD", currency: "USD", opening: 0 });
    s.entries = [
      { id: "a", kind: "expense", accountId: account, categoryId: food, date: "2026-10-01", amount: 9000, note: "" },
      { id: "b", kind: "expense", accountId: "usd", categoryId: food, date: "2026-10-01", amount: 100, note: "" },
      { id: "c", kind: "expense", accountId: account, categoryId: home, date: "2026-10-03", amount: 18000, note: "" },
      { id: "d", kind: "income", accountId: account, date: "2026-10-01", amount: 1000, note: "" },
      { id: "t", kind: "transfer", accountId: account, toId: "usd", date: "2026-10-01", amount: 9000, received: 100, note: "" },
      { id: "outside", kind: "expense", accountId: account, categoryId: food, date: "2026-09-30", amount: 1000, note: "" },
    ];
    const range = { start: "2026-10-01", end: "2026-10-03" };
    const report = expenseReport(s, range, "day", [food, home], "all", "USD");
    expect(report.buckets.map((b) => b.total)).toEqual([200, 0, 200]);
    expect(report.count).toBe(3);
    expect(report.activeDays).toBe(2);
    expect(report.days).toBe(3);
    expect(report.total).toBe(400);
    expect(expenseReport(s, range, "day", [food], account, "USD").total).toBe(100);
    expect(expenseReport(s, range, "day", [], "all", "RUB").total).toBe(0);
    expect(expenseReport(s, range, "month", [food, home], "all", "USD").buckets[0].total).toBe(400);
    expect(expenseReport(s, range, "year", [food, home], "all", "USD").buckets[0].key).toBe("2026");
  });
  it("сравнивает календарные месяцы и годы с учётом високосности", () => {
    expect(monthRange("2024-02").end).toBe("2024-02-29");
    expect(shiftRange(monthRange("2024-03"), -1)).toEqual(monthRange("2024-02"));
    expect(shiftRange(monthRange("2024-02"), -12)).toEqual(monthRange("2023-02"));
    expect(shiftRange({ start: "2024-01-01", end: "2024-12-31" }, -12)).toEqual({ start: "2023-01-01", end: "2023-12-31" });
    expect(shiftRange({ start: "2024-03-15", end: "2024-03-31" }, -1)).toEqual({ start: "2024-02-15", end: "2024-02-29" });
  });
  it("отклоняет некорректные и слишком длинные дневные периоды", () => {
    const s = initialState();
    for (const range of [{ start: "", end: "2026-01-01" }, { start: "2026-02-30", end: "2026-03-01" }, { start: "2026-03-01", end: "2026-02-01" }])
      expect(() => expenseReport(s, range, "day", [], "all", "RUB")).toThrow();
    expect(() => expenseReport(s, { start: "2020-01-01", end: "2026-12-31" }, "day", [], "all", "RUB")).toThrow("Слишком много");
    expect(expenseReport(s, { start: "2020-01-01", end: "2026-12-31" }, "year", [], "all", "RUB").buckets).toHaveLength(7);
  });
  it("обрабатывает нулевую базу сравнения без бесконечных процентов", () => {
    expect(changeText(0, 0, "RUB")).toBe("Без изменений");
    expect(changeText(100, 0, "RUB")).toContain("Ранее расходов не было");
    expect(changeText(0, 100, "RUB")).toContain("100%");
    expect(changeText(150, 100, "RUB")).toContain("50%");
  });
});
