import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  initialState,
  money,
  balance,
  totals,
  validate,
  type State,
} from "../src/model";
import { db, load, change, restore } from "../src/store";
let s: State;
beforeEach(async () => {
  s = initialState();
  await db.data.clear();
});
describe("финансовый учёт", () => {
  it("разбирает деньги без дробных копеек", () => {
    expect(money("0,29")).toBe(29);
    expect(money("-12.04", true)).toBe(-1204);
    for (const v of ["1.001", "NaN", "-1", "1e3", ""])
      expect(() => money(v)).toThrow();
  });
  it("считает доходы и расходы на конкретном счёте", () => {
    const a = s.accounts[0];
    a.opening = 10000;
    s.entries = [
      {
        id: "a",
        kind: "income",
        amount: 20000,
        accountId: a.id,
        categoryId: s.categories.find((c) => c.kind === "income")!.id,
        date: "2026-10-10",
        note: "",
      },
      {
        id: "b",
        kind: "expense",
        amount: 5000,
        accountId: a.id,
        categoryId: s.categories[0].id,
        date: "2026-10-11",
        note: "",
      },
    ];
    validate(s);
    expect(balance(s, a)).toBe(25000);
    expect(totals(s, s.entries)).toEqual({ income: 20000, expense: 5000 });
  });
  it("фиксирует обе стороны валютного перевода и исключает его из статистики", () => {
    s.accounts.push({ id: "usd", name: "USD", currency: "USD", opening: 0 });
    s.entries.push({
      id: "t",
      kind: "transfer",
      accountId: s.accounts[0].id,
      toId: "usd",
      amount: 90000,
      received: 1000,
      date: "2026-10-01",
      note: "",
    });
    validate(s);
    expect(balance(s, s.accounts[0])).toBe(-90000);
    expect(balance(s, s.accounts[1])).toBe(1000);
    expect(totals(s, s.entries)).toEqual({ income: 0, expense: 0 });
    s.rates.USD = 95;
    expect(balance(s, s.accounts[1])).toBe(1000);
  });
  it("запрещает перевод самому себе, неверную категорию и дату", () => {
    const e = {
      id: "bad",
      kind: "transfer" as const,
      accountId: s.accounts[0].id,
      toId: s.accounts[0].id,
      amount: 1,
      received: 1,
      date: "2026-02-30",
      note: "",
    };
    s.entries.push(e);
    expect(() => validate(s)).toThrow();
    s.entries = [
      {
        id: "x",
        kind: "expense",
        amount: 100,
        accountId: s.accounts[0].id,
        categoryId: s.categories.find((c) => c.kind === "income")!.id,
        date: "2026-10-01",
        note: "",
      },
    ];
    expect(() => validate(s)).toThrow();
  });
  it("отклоняет повреждённые копии и некорректные курсы", () => {
    expect(() => validate({} as State)).toThrow();
    s.rates.USD = 0;
    expect(() => validate(s)).toThrow();
    s.rates.USD = 90;
    s.accounts.push({ ...s.accounts[0] });
    expect(() => validate(s)).toThrow();
  });
  it("удаление перевода восстанавливает оба баланса", () => {
    s.accounts.push({ id: "b", name: "Второй", currency: "RUB", opening: 0 });
    s.entries = [
      {
        id: "t",
        kind: "transfer",
        accountId: s.accounts[0].id,
        toId: "b",
        amount: 100,
        received: 100,
        date: "2026-10-01",
        note: "",
      },
    ];
    validate(s);
    s.entries = [];
    expect(s.accounts.map((a) => balance(s, a))).toEqual([0, 0]);
  });
});
describe("локальная база", () => {
  it("сохраняет изменения после повторного открытия и восстанавливает копию", async () => {
    await load();
    await change((st) => {
      st.accounts[0].name = "Карта";
    });
    expect((await load()).accounts[0].name).toBe("Карта");
    const copy = JSON.parse(JSON.stringify(await load()));
    await change((st) => {
      st.accounts[0].name = "Другой";
    });
    await restore(copy);
    expect((await load()).accounts[0].name).toBe("Карта");
  });
  it("откатывает невалидную запись целиком", async () => {
    const before = await load();
    await expect(
      change((st) => {
        st.accounts[0].name = "";
      }),
    ).rejects.toThrow();
    expect(await load()).toEqual(before);
    await expect(restore({ version: 7 })).rejects.toThrow();
    expect(await load()).toEqual(before);
  });
  it("не теряет параллельные изменения", async () => {
    await load();
    await Promise.all([
      change((st) => {
        st.rates.GBP = 110;
      }),
      change((st) => {
        st.rates.CNY = 12;
      }),
    ]);
    expect((await load()).rates).toMatchObject({ GBP: 110, CNY: 12 });
  });
});
