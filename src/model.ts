export type Kind = "expense" | "income" | "transfer";
export interface Account {
  id: string;
  name: string;
  currency: string;
  opening: number;
}
export interface Category {
  id: string;
  name: string;
  kind: "expense" | "income";
  color: string;
  icon: string;
}
export interface Entry {
  id: string;
  kind: Kind;
  accountId: string;
  amount: number;
  date: string;
  note: string;
  categoryId?: string;
  toId?: string;
  received?: number;
}
export interface State {
  version: 1;
  accounts: Account[];
  categories: Category[];
  entries: Entry[];
  rates: Record<string, number>;
}
export const id = () => crypto.randomUUID();
const categorySeeds = [
  ["Еда", "expense", "#e5a55d", "food"],
  ["Дом", "expense", "#78a9be", "home"],
  ["Ипотека", "expense", "#8d8fbe", "home"],
  ["Транспорт", "expense", "#7594a4", "car"],
  ["Здоровье", "expense", "#e57c7c", "health"],
  ["Покупки", "expense", "#cc8cb2", "bag"],
  ["Развлечения", "expense", "#c5a265", "fun"],
  ["Связь", "expense", "#99a47d", "phone"],
  ["Образование", "expense", "#8b9bce", "book"],
  ["Другое", "expense", "#a2aaa5", "other"],
  ["Зарплата", "income", "#65a88c", "work"],
  ["Дивиденды", "income", "#93ae68", "chart"],
  ["Подарки", "income", "#bd94ba", "gift"],
  ["Другой доход", "income", "#7aa9a1", "other"],
];
export function initialState(): State {
  return {
    version: 1,
    accounts: [
      { id: id(), name: "Основной счёт", currency: "RUB", opening: 0 },
    ],
    categories: categorySeeds.map(([name, kind, color, icon]) => ({
      id: id(),
      name,
      kind: kind as Category["kind"],
      color,
      icon,
    })),
    entries: [],
    rates: { RUB: 1, USD: 90, EUR: 100 },
  };
}
export function money(value: string, allowNegative = false): number {
  const normalized = value.trim().replace(",", ".");
  if (
    !(allowNegative ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).test(
      normalized,
    )
  )
    throw Error("Введите сумму с точностью до двух знаков.");
  const [whole, fraction = ""] = normalized.replace("-", "").split(".");
  const amount =
    (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) *
    (normalized.startsWith("-") ? -1 : 1);
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > 1e12)
    throw Error("Сумма слишком большая.");
  return amount;
}
export function balance(s: State, a: Account): number {
  return s.entries.reduce(
    (sum, e) =>
      sum +
      (e.accountId === a.id
        ? e.kind === "income"
          ? e.amount
          : -e.amount
        : 0) +
      (e.kind === "transfer" && e.toId === a.id ? e.received! : 0),
    a.opening,
  );
}
export function rub(s: State, amount: number, currency: string) {
  return Math.round(amount * s.rates[currency]);
}
export function totals(s: State, entries: Entry[]) {
  return entries.reduce(
    (t, e) => {
      if (e.kind !== "transfer")
        t[e.kind] += rub(
          s,
          e.amount,
          s.accounts.find((a) => a.id === e.accountId)!.currency,
        );
      return t;
    },
    { income: 0, expense: 0 },
  );
}
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function validate(s: State): void {
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.accounts) ||
    !Array.isArray(s.categories) ||
    !Array.isArray(s.entries) ||
    !s.rates ||
    typeof s.rates !== "object"
  )
    throw Error("Неверный формат резервной копии.");
  const fail = () => {
    throw Error("Данные содержат некорректные значения или ссылки.");
  };
  const text = (v: unknown, max = 80) =>
    typeof v === "string" && v.trim().length > 0 && v.length <= max;
  const integer = (v: unknown) =>
    typeof v === "number" && Number.isSafeInteger(v) && Math.abs(v) <= 1e12;
  const ids = new Set<string>();
  for (const item of [...s.accounts, ...s.categories, ...s.entries]) {
    if (!item || !text(item.id) || ids.has(item.id)) fail();
    ids.add(item.id);
  }
  if (!s.accounts.length || s.rates.RUB !== 1) fail();
  for (const [code, rate] of Object.entries(s.rates))
    if (
      !/^[A-Z]{3}$/.test(code) ||
      typeof rate !== "number" ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      rate > 1e6
    )
      fail();
  for (const a of s.accounts)
    if (
      !text(a.name) ||
      !Object.hasOwn(s.rates, a.currency) ||
      !integer(a.opening)
    )
      fail();
  for (const c of s.categories)
    if (
      !text(c.name) ||
      !["income", "expense"].includes(c.kind) ||
      !/^#[0-9a-f]{6}$/i.test(c.color) ||
      !text(c.icon)
    )
      fail();
  for (const e of s.entries) {
    if (
      !["income", "expense", "transfer"].includes(e.kind) ||
      !s.accounts.some((a) => a.id === e.accountId) ||
      !integer(e.amount) ||
      e.amount <= 0 ||
      typeof e.note !== "string" ||
      e.note.length > 300 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
      !Number.isFinite(Date.parse(e.date)) ||
      new Date(e.date).toISOString().slice(0, 10) !== e.date
    )
      fail();
    if (e.kind === "transfer") {
      if (
        !s.accounts.some((a) => a.id === e.toId) ||
        e.toId === e.accountId ||
        !integer(e.received) ||
        e.received! <= 0
      )
        fail();
      if (
        s.accounts.find((a) => a.id === e.accountId)?.currency ===
          s.accounts.find((a) => a.id === e.toId)?.currency &&
        e.amount !== e.received
      )
        fail();
    } else if (
      !s.categories.some((c) => c.id === e.categoryId && c.kind === e.kind)
    )
      fail();
  }
  for (const a of s.accounts)
    if (!Number.isSafeInteger(balance(s, a)) || Math.abs(balance(s, a)) > 1e12)
      fail();
}
