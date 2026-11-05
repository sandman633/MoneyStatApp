import type { Catalog } from "./types.js";

const plainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 80): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;

export function validateCatalog(value: unknown): Catalog | null {
  if (!plainObject(value) || !Array.isArray(value.accounts) || !Array.isArray(value.categories) || !Array.isArray(value.currencies)) return null;
  if (!value.accounts.length || value.accounts.length > 200 || value.categories.length > 500 || !value.currencies.length || value.currencies.length > 100) return null;
  if (!value.currencies.every((currency) => typeof currency === "string" && /^[A-Z]{3}$/.test(currency)) || new Set(value.currencies).size !== value.currencies.length) return null;
  const currencies = new Set(value.currencies as string[]);
  const ids = new Set<string>();
  for (const account of value.accounts) {
    if (!plainObject(account) || !text(account.id) || ids.has(account.id) || !text(account.name) || typeof account.currency !== "string" || !currencies.has(account.currency)) return null;
    ids.add(account.id);
  }
  for (const category of value.categories) {
    if (!plainObject(category) || !text(category.id) || ids.has(category.id) || !text(category.name) || !["expense", "income"].includes(String(category.kind))) return null;
    ids.add(category.id);
  }
  return value as unknown as Catalog;
}

export function validateAck(value: unknown): string[] | null {
  if (!plainObject(value) || !Array.isArray(value.ids) || value.ids.length > 500) return null;
  if (!value.ids.every((id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))) return null;
  return [...new Set(value.ids as string[])];
}
