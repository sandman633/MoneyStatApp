import { describe, expect, it } from "vitest";
import { initialState, validate } from "../src/model";
import { importTelegramDrafts, normalizeServerUrl, type TelegramDraft } from "../src/telegramSyncModel";

describe("синхронизация Telegram", () => {
  it("добавляет расход и доход один раз", () => {
    const state = initialState();
    const expense = state.categories.find((c) => c.kind === "expense")!;
    const income = state.categories.find((c) => c.kind === "income")!;
    const drafts: TelegramDraft[] = [
      { id: "a", kind: "expense", accountId: state.accounts[0].id, categoryId: expense.id, amount: 12345, date: "2026-11-06", note: "Кофе" },
      { id: "b", kind: "income", accountId: state.accounts[0].id, categoryId: income.id, amount: 50000, date: "2026-11-06", note: "" },
    ];
    expect(importTelegramDrafts(state, drafts)).toBe(2);
    expect(importTelegramDrafts(state, drafts)).toBe(0);
    expect(state.entries).toHaveLength(2);
    expect(state.entries.map((e) => e.externalId)).toEqual(["telegram:a", "telegram:b"]);
    validate(state);
  });
  it("отклоняет неизвестные справочники, повторы ответа и неверные суммы", () => {
    const state = initialState(), category = state.categories[0];
    const valid: TelegramDraft = { id: "a", kind: "expense", accountId: state.accounts[0].id, categoryId: category.id, amount: 100, date: "2026-11-06", note: "" };
    expect(() => importTelegramDrafts(state, [{ ...valid, accountId: "missing" }])).toThrow("не существует");
    expect(() => importTelegramDrafts(state, [valid, valid])).toThrow("повторяющийся");
    const fresh = initialState();
    expect(() => importTelegramDrafts(fresh, [{ ...valid, accountId: fresh.accounts[0].id, categoryId: fresh.categories[0].id, amount: 0 }])).toThrow("сумму");
  });
  it("разрешает только HTTPS и локальный HTTP", () => {
    expect(normalizeServerUrl("https://money.example.com/path")).toBe("https://money.example.com");
    expect(normalizeServerUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(() => normalizeServerUrl("http://money.example.com")).toThrow("HTTPS");
  });
});
