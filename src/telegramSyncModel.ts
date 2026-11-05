import { id, type Entry, type State } from "./model";

export type TelegramDraft = {
  id: string;
  kind: "expense" | "income";
  accountId: string;
  categoryId: string;
  amount: number;
  date: string;
  note: string;
  createdByName?: string;
};

export type TelegramConfig = { url: string; token: string; revision: number };
const storageKey = "moneystat.telegram-sync.v1";

export function loadTelegramConfig(): TelegramConfig | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Partial<TelegramConfig> | null;
    return value?.url && value?.token ? { url: value.url, token: value.token, revision: Number.isSafeInteger(value.revision) ? value.revision! : 0 } : null;
  } catch { return null; }
}
export function saveTelegramConfig(value: TelegramConfig | null) {
  if (value) localStorage.setItem(storageKey, JSON.stringify(value));
  else localStorage.removeItem(storageKey);
}
export function normalizeServerUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
    throw Error("Для сервера нужен HTTPS (HTTP разрешён только для localhost)." );
  return url.origin;
}
async function request<T>(url: string, path: string, init: RequestInit, token?: string): Promise<T> {
  const response = await fetch(url + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const body = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw Error(body.error || `Сервер Telegram вернул ошибку ${response.status}.`);
  return body;
}
export async function linkTelegram(urlValue: string, code: string) {
  const url = normalizeServerUrl(urlValue);
  if (!/^\d{8}$/.test(code.trim())) throw Error("Код привязки должен состоять из 8 цифр.");
  const value = await request<{ token: string }>(url, "/v1/link", { method: "POST", body: JSON.stringify({ code: code.trim(), deviceName: "MoneyStat" }) });
  if (!value.token) throw Error("Сервер не вернул токен устройства.");
  const config = { url, token: value.token, revision: 0 };
  saveTelegramConfig(config);
  return config;
}
export async function pushTelegramCatalog(config: TelegramConfig, state: State) {
  const revision = Math.max(Date.now(), config.revision + 1);
  await request(config.url, "/v1/catalog", { method: "PUT", body: JSON.stringify({
    revision,
    accounts: state.accounts.map(({ id, name, currency }) => ({ id, name, currency })),
    categories: state.categories.map(({ id, name, kind }) => ({ id, name, kind })),
    currencies: Object.keys(state.rates),
  }) }, config.token);
  config.revision = revision;
  saveTelegramConfig(config);
}
export async function fetchTelegramDrafts(config: TelegramConfig) {
  const value = await request<{ entries: TelegramDraft[] }>(config.url, "/v1/entries/pending", { method: "GET" }, config.token);
  if (!Array.isArray(value.entries)) throw Error("Сервер вернул неверный список операций.");
  return value.entries;
}
export async function acknowledgeTelegramDrafts(config: TelegramConfig, ids: string[]) {
  if (!ids.length) return;
  await request(config.url, "/v1/entries/ack", { method: "POST", body: JSON.stringify({ ids }) }, config.token);
}
export function importTelegramDrafts(state: State, drafts: TelegramDraft[]) {
  const seenRemote = new Set<string>();
  const existing = new Set(state.entries.map((entry) => entry.externalId).filter(Boolean));
  let added = 0;
  for (const draft of drafts) {
    const externalId = `telegram:${draft.id}`;
    if (!draft.id || seenRemote.has(draft.id)) throw Error("Сервер вернул повторяющийся ID операции.");
    seenRemote.add(draft.id);
    if (existing.has(externalId)) continue;
    const account = state.accounts.find((item) => item.id === draft.accountId);
    const category = state.categories.find((item) => item.id === draft.categoryId && item.kind === draft.kind);
    if (!account || !category) throw Error("Счёт или категория из Telegram больше не существует. Обновите справочники и повторите.");
    if (!Number.isSafeInteger(draft.amount) || draft.amount <= 0 || draft.amount > 1e12) throw Error("Telegram вернул некорректную сумму.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || new Date(draft.date).toISOString().slice(0, 10) !== draft.date) throw Error("Telegram вернул некорректную дату.");
    if (typeof draft.note !== "string" || draft.note.length > 300) throw Error("Комментарий Telegram слишком длинный.");
    const entry: Entry = { id: id(), externalId, kind: draft.kind, accountId: account.id, categoryId: category.id,
      amount: draft.amount, date: draft.date, note: draft.note };
    state.entries.push(entry);
    existing.add(externalId);
    added++;
  }
  return added;
}
