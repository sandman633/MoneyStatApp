import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256 = (value: string): Buffer => createHash("sha256").update(value, "utf8").digest();
export const randomToken = (): string => randomBytes(32).toString("base64url");

export function pairCode(): string {
  const value = randomBytes(4).readUInt32BE() % 100_000_000;
  return value.toString().padStart(8, "0");
}

export function safeEqualText(left: string | undefined, right: string): boolean {
  if (left === undefined) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseBearer(value: string | undefined): string | null {
  const match = /^Bearer ([A-Za-z0-9_-]{40,})$/.exec(value ?? "");
  return match?.[1] ?? null;
}

export function parseMoney(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "", fraction = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 1_000_000_000_000 ? amount : null;
}
