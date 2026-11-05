import { describe, expect, it } from "vitest";
import { importMonefy, parseCsv } from "../src/monefyImport";

const header = "date,account,category,amount,currency,converted amount,currency,description\r\n";
describe("перенос Monefy", () => {
  it("сохраняет остатки и заметки, объединяет две стороны перевода без искажения статистики", () => {
    const result = importMonefy(header + [
      "01.07.2026,Cash,InitialBalance,100,RUB,100,RUB,",
      '02.07.2026,Cash,Food,-1.25,RUB,-1.25,RUB,"Кофе, булочка"',
      "02.07.2026,Cash,Salary,20,RUB,20,RUB,",
      "03.07.2026,Cash,ExpenseTransfer,-10,RUB,-10,RUB,",
      "03.07.2026,Savings,IncomeTransfer,10,RUB,10,RUB,",
    ].join("\r\n"));
    expect(result.summary).toMatchObject({ sourceRows: 5, operations: 3, incomes: 1, expenses: 1, transfers: 1, openingBalances: 1 });
    expect(result.summary.accounts.map((a) => a.balance)).toEqual([10875, 1000]);
    expect(result.state.entries[0].note).toBe("Кофе, булочка");
    expect(result.state.accounts.map((a) => a.name)).toEqual(["Наличные", "Накопления"]);
    expect(result.state.categories.map((c) => c.name)).toEqual(["Еда", "Зарплата"]);
  });
  it("обрабатывает BOM, кавычки, переносы строк и повторяющиеся реальные операции", () => {
    expect(parseCsv('\uFEFFa,b\r\n"x""y","a\nb"\r\n')).toEqual([["a", "b"], ['x"y', "a\nb"]]);
    const row = '01.07.2026,Cash,Food,-10,RUB,-10,RUB,"Заметка\nсо строкой"';
    expect(importMonefy(header + row + "\n" + row).state.entries).toHaveLength(2);
  });
  it("останавливает неоднозначный или неполный перевод", () => {
    const out = "01.07.2026,Cash,ExpenseTransfer,-10,RUB,-10,RUB,";
    expect(() => importMonefy(header + out)).toThrow("пар перевода");
    expect(() => importMonefy(header + [out, "01.07.2026,A,IncomeTransfer,10,RUB,10,RUB,", "01.07.2026,B,IncomeTransfer,10,RUB,10,RUB,"].join("\n"))).toThrow("пар перевода");
  });
  it("не скрывает ошибки даты, валюты и незакрытые кавычки", () => {
    expect(() => importMonefy(header + "31.02.2026,Cash,Food,-10,RUB,-10,RUB,")).toThrow("дата");
    expect(() => importMonefy(header + "01.07.2026,Cash,Food,-10,USD,-900,RUB,")).toThrow("только RUB");
    expect(() => parseCsv('a,"b')).toThrow("незакрытая");
  });
});
