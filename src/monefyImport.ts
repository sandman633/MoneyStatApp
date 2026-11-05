import { balance, money, validate, type State, type Entry, type Category } from "./model.ts";

// CSV headers contain two columns named currency; preserve columns by position.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += c;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field); field = ""; closed = false;
      if (c !== ',') {
        if (c === '\r' && input[i + 1] === '\n') i++;
        if (row.some((value) => value !== "")) rows.push(row);
        row = [];
      }
    } else if (closed) throw Error("Некорректный CSV: символ после закрывающей кавычки.");
    else if (c === '"') {
      if (field) throw Error("Некорректный CSV: кавычка внутри неэкранированного поля.");
      quoted = true;
    } else field += c;
  }
  if (quoted) throw Error("Некорректный CSV: незакрытая кавычка.");
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  return rows;
}

const appearance: Record<string, [string, string]> = {
  House: ["home", "#78a9be"], Pets: ["cat", "#99a47d"], Health: ["health", "#e57c7c"],
  Food: ["food", "#e5a55d"], Gifts: ["gift", "#bd94ba"], "Eating out": ["utensils", "#d5946a"],
  Transport: ["car", "#7594a4"], Clothes: ["clothes", "#cc8cb2"], Bills: ["receipt", "#8d8fbe"],
  Salary: ["salary", "#65a88c"], Communications: ["phone", "#99a47d"], Entertainment: ["fun", "#c5a265"],
  Savings: ["savings", "#93ae68"], Deposits: ["bank", "#7aa9a1"], Toiletry: ["water", "#78a9be"], Taxi: ["car", "#7594a4"],
};
const russianNames: Record<string, string> = {
  Cash: "Наличные", House: "Дом", Pets: "Питомцы", Health: "Здоровье",
  Food: "Еда", Gifts: "Подарки", "Eating out": "Рестораны", Transport: "Транспорт",
  Clothes: "Одежда", Bills: "Счета и платежи", Salary: "Зарплата",
  Communications: "Связь", Entertainment: "Развлечения", Savings: "Накопления",
  Deposits: "Вклады", Toiletry: "Гигиена", Taxi: "Такси",
};

export function importMonefy(csv: string) {
  const [header, ...raw] = parseCsv(csv);
  const expected = ["date", "account", "category", "amount", "currency", "converted amount", "currency", "description"];
  if (!header || header.length !== 8 || header.some((v, i) => v.trim().toLowerCase() !== expected[i]))
    throw Error("Неизвестный заголовок CSV Monefy. Ожидаются 8 колонок.");
  if (!raw.length) throw Error("В CSV нет записей.");
  const state: State = { version: 1, accounts: [], categories: [], entries: [], rates: { RUB: 1 } };
  const accountIds = new Map<string, string>(), categoryIds = new Map<string, string>();
  const sourceBalances = new Map<string, number>();
  const openings = new Set<string>();
  const rows = raw.map((cells, index) => {
    const number = index + 2;
    if (cells.length !== 8) throw Error(`Запись ${number}: ожидалось 8 колонок, получено ${cells.length}.`);
    const [date, account, category, amount, currency, converted, baseCurrency, note] = cells;
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) throw Error(`Запись ${number}: неверная дата.`);
    const iso = date.split('.').reverse().join('-');
    if (!Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString().slice(0, 10) !== iso) throw Error(`Запись ${number}: несуществующая дата.`);
    if (!account.trim() || !category.trim()) throw Error(`Запись ${number}: пустой счёт или категория.`);
    // Never invent exchange rates or infer cross-currency transfer pairs.
    if (currency !== "RUB" || baseCurrency !== "RUB") throw Error(`Запись ${number}: этот перенос поддерживает только RUB; для других валют нужно согласовать курсы.`);
    const signed = money(amount, true);
    if (money(converted, true) !== signed) throw Error(`Запись ${number}: исходная и пересчитанная суммы RUB не совпадают.`);
    let accountId = accountIds.get(account);
    if (!accountId) {
      accountId = `monefy-account-${accountIds.size + 1}`;
      accountIds.set(account, accountId);
      state.accounts.push({ id: accountId, name: russianNames[account] ?? account, currency, opening: 0 });
    }
    sourceBalances.set(accountId, (sourceBalances.get(accountId) ?? 0) + signed);
    return { number, date: iso, accountId, category, signed, note };
  });
  const incoming = rows.filter((r) => r.category === "IncomeTransfer");
  const used = new Set<number>();
  for (const r of rows) {
    if (r.category === "InitialBalance") {
      if (openings.has(r.accountId)) throw Error(`Запись ${r.number}: несколько начальных остатков одного счёта, требуется уточнение.`);
      if (r.note) throw Error(`Запись ${r.number}: у начального остатка есть заметка, требуется уточнение её переноса.`);
      openings.add(r.accountId);
      state.accounts.find((a) => a.id === r.accountId)!.opening = r.signed;
      continue;
    }
    if (!r.signed) throw Error(`Запись ${r.number}: нулевая операция.`);
    if (r.category === "IncomeTransfer") {
      if (r.signed <= 0) throw Error(`Запись ${r.number}: неверный знак входящего перевода.`);
      continue;
    }
    let entry: Entry;
    if (r.category === "ExpenseTransfer") {
      if (r.signed >= 0) throw Error(`Запись ${r.number}: неверный знак исходящего перевода.`);
      const matches = incoming.filter((other) => !used.has(other.number) && other.date === r.date && other.accountId !== r.accountId && other.signed === -r.signed && other.note === r.note);
      if (matches.length !== 1) throw Error(`Запись ${r.number}: найдено ${matches.length} пар перевода, требуется ручное уточнение.`);
      const target = matches[0];
      used.add(target.number);
      entry = { id: `monefy-entry-${r.number}`, kind: "transfer", accountId: r.accountId, toId: target.accountId, amount: -r.signed, received: target.signed, date: r.date, note: r.note };
    } else {
      const kind = r.signed > 0 ? "income" : "expense";
      const key = `${kind}:${r.category}`;
      let categoryId = categoryIds.get(key);
      if (!categoryId) {
        categoryId = `monefy-category-${categoryIds.size + 1}`;
        categoryIds.set(key, categoryId);
        const [icon, color] = appearance[r.category] ?? ["other", "#a2aaa5"];
        const category: Category = { id: categoryId, name: russianNames[r.category] ?? r.category, kind, icon, color };
        state.categories.push(category);
      }
      entry = { id: `monefy-entry-${r.number}`, kind, accountId: r.accountId, amount: Math.abs(r.signed), categoryId, date: r.date, note: r.note };
    }
    state.entries.push(entry);
  }
  if (used.size !== incoming.length) throw Error("Есть входящие переводы без исходящей пары. Перенос остановлен.");
  state.entries.sort((a, b) => a.date.localeCompare(b.date));
  validate(state);
  for (const a of state.accounts) if (balance(state, a) !== sourceBalances.get(a.id)) throw Error(`Контроль баланса не пройден: ${a.name}.`);
  if (raw.length !== state.entries.length + used.size + openings.size) throw Error("Не все строки учтены.");
  return { state, summary: {
    sourceRows: raw.length, operations: state.entries.length,
    expenses: state.entries.filter((e) => e.kind === "expense").length,
    incomes: state.entries.filter((e) => e.kind === "income").length,
    transfers: used.size, openingBalances: openings.size,
    dateFrom: rows.map((r) => r.date).sort()[0], dateTo: rows.map((r) => r.date).sort().at(-1),
    accounts: state.accounts.map((a) => ({ name: a.name, currency: a.currency, opening: a.opening, balance: balance(state, a) })),
    categories: state.categories.length,
  } };
}
