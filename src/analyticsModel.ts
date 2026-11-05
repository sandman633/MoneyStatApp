import { convert, type State } from "./model";

export type Grain = "day" | "month" | "year";
export type DateRange = { start: string; end: string };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const date = (s: string) => new Date(s + "T12:00:00Z");
export function validRange(range: DateRange) {
  return [range.start, range.end].every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(date(s).getTime()) && iso(date(s)) === s) && range.start <= range.end;
}
export function monthRange(month: string): DateRange {
  const start = month + "-01";
  const last = date(start);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  return { start, end: iso(last) };
}
export function shiftDate(value: string, months: number) {
  const d = date(value), day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(d);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  d.setUTCDate(Math.min(day, last.getUTCDate()));
  return iso(d);
}
export function shiftRange(range: DateRange, months: number): DateRange {
  const fullMonth = range.start.endsWith("-01") && range.end === monthRange(range.end.slice(0, 7)).end;
  const start = shiftDate(range.start, months);
  const end = shiftDate(range.end, months);
  return { start, end: fullMonth ? monthRange(end.slice(0, 7)).end : end };
}
export type Bucket = { key: string; total: number; count: number; categories: Record<string, number> };
const keyOf = (value: string, grain: Grain) => value.slice(0, grain === "day" ? 10 : grain === "month" ? 7 : 4);
export function expenseReport(s: State, range: DateRange, grain: Grain, categoryIds: string[], accountId: string, currency: string) {
  if (!validRange(range)) throw Error("Укажите корректные даты: начало не позже окончания.");
  const buckets: Bucket[] = [];
  const cursor = date(grain === "year" ? range.start.slice(0, 4) + "-01-01" : grain === "month" ? range.start.slice(0, 7) + "-01" : range.start);
  while (iso(cursor) <= range.end) {
    if (buckets.length >= 1500) throw Error("Слишком много столбцов. Выберите разрез по месяцам или годам либо сократите период (до 1500 столбцов).");
    buckets.push({ key: keyOf(iso(cursor), grain), total: 0, count: 0, categories: {} });
    if (grain === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (grain === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  const selected = new Set(categoryIds);
  const accounts = new Map(s.accounts.map((a) => [a.id, a]));
  const categories: Record<string, { total: number; count: number }> = {};
  const activeDays = new Set<string>();
  let total = 0, count = 0;
  for (const e of s.entries) {
    if (e.kind !== "expense" || !selected.has(e.categoryId!) || e.date < range.start || e.date > range.end || (accountId !== "all" && e.accountId !== accountId)) continue;
    const amount = convert(s, e.amount, accounts.get(e.accountId)!.currency, currency);
    const bucket = byKey.get(keyOf(e.date, grain))!;
    bucket.total += amount;
    bucket.count++;
    bucket.categories[e.categoryId!] = (bucket.categories[e.categoryId!] ?? 0) + amount;
    const c = categories[e.categoryId!] ??= { total: 0, count: 0 };
    c.total += amount;
    c.count++;
    total += amount;
    count++;
    activeDays.add(e.date);
  }
  const days = Math.round((date(range.end).getTime() - date(range.start).getTime()) / 86400000) + 1;
  return { buckets, categories, total, count, activeDays: activeDays.size, days, average: count ? Math.round(total / count) : 0 };
}
export function changeText(current: number, previous: number, currency: string) {
  const delta = current - previous;
  if (!delta) return "Без изменений";
  const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency }).format(Math.abs(delta) / 100);
  if (!previous) return `Ранее расходов не было · +${money}`;
  return `${delta > 0 ? "Больше" : "Меньше"} на ${money} (${(Math.abs(delta) / previous * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%)`;
}
