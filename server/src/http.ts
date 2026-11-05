import type { IncomingMessage, ServerResponse } from "node:http";
import type { Config } from "./config.js";
import type { Database } from "./db.js";
import { parseBearer, randomToken, safeEqualText } from "./security.js";
import { TelegramBot, type TelegramUpdate } from "./telegram.js";
import { validateAck, validateCatalog } from "./validation.js";

type Json = Record<string, unknown> | unknown[];

class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }

class RateLimiter {
  private readonly buckets = new Map<string, { start: number; count: number }>();
  constructor(private readonly limit: number) {}
  allow(key: string, now = Date.now()): boolean {
    const current = this.buckets.get(key);
    if (!current || now - current.start >= 60_000) { this.buckets.set(key, { start: now, count: 1 }); return true; }
    current.count += 1;
    if (this.buckets.size > 10_000) for (const [k, value] of this.buckets) if (now - value.start >= 60_000) this.buckets.delete(k);
    return current.count <= this.limit;
  }
}

export function json(res: ServerResponse, status: number, body: Json): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(payload), "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(payload);
}

async function readJson(req: IncomingMessage, limit: number): Promise<unknown> {
  const type = req.headers["content-type"]?.split(";", 1)[0]?.trim();
  if (type !== "application/json") throw new HttpError(415, "content-type must be application/json");
  const declared = Number(req.headers["content-length"] ?? 0);
  if (declared > limit) throw new HttpError(413, "request body too large");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += value.length;
    if (size > limit) throw new HttpError(413, "request body too large");
    chunks.push(value);
  }
  if (!size) throw new HttpError(400, "request body required");
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new HttpError(400, "invalid JSON"); }
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export function createHandler(config: Config, db: Database, bot = new TelegramBot(config, db)) {
  const limiter = new RateLimiter(config.rateLimitPerMinute);
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const origin = req.headers.origin;
      if (origin && config.corsOrigins.has(origin)) {
        res.setHeader("access-control-allow-origin", origin); res.setHeader("vary", "Origin");
        res.setHeader("access-control-allow-methods", "GET, POST, PUT, OPTIONS");
        res.setHeader("access-control-allow-headers", "Authorization, Content-Type");
        res.setHeader("access-control-max-age", "600");
      }
      if (req.method === "OPTIONS") {
        if (!origin || !config.corsOrigins.has(origin)) throw new HttpError(403, "origin not allowed");
        res.writeHead(204); res.end(); return;
      }
      const remote = config.trustProxy ? String(req.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim() : req.socket.remoteAddress;
      if (!limiter.allow(remote || "unknown")) throw new HttpError(429, "rate limit exceeded");
      const url = new URL(req.url ?? "/", "http://localhost");

      if (req.method === "GET" && url.pathname === "/healthz") { await db.health(); json(res, 200, { ok: true }); return; }
      if (req.method === "POST" && url.pathname === "/telegram/webhook") {
        if (!safeEqualText(req.headers["x-telegram-bot-api-secret-token"] as string | undefined, config.webhookSecret)) throw new HttpError(401, "invalid webhook secret");
        const update = await readJson(req, config.bodyLimitBytes) as TelegramUpdate;
        if (!object(update) || !Number.isSafeInteger(update.update_id)) throw new HttpError(400, "invalid Telegram update");
        await bot.handle(update); json(res, 200, { ok: true }); return;
      }
      if (req.method === "POST" && url.pathname === "/v1/link") {
        const body = await readJson(req, config.bodyLimitBytes);
        if (!object(body) || typeof body.code !== "string" || !/^\d{8}$/.test(body.code) || typeof body.deviceName !== "string" || body.deviceName.trim().length < 1 || body.deviceName.length > 80) throw new HttpError(400, "invalid link request");
        const token = randomToken();
        const linked = await db.consumePairCode(body.code, body.deviceName.trim(), token);
        if (!linked) throw new HttpError(401, "invalid or expired pairing code");
        json(res, 201, { token }); return;
      }

      if (url.pathname.startsWith("/v1/")) {
        const token = parseBearer(req.headers.authorization);
        if (!token) throw new HttpError(401, "bearer token required");
        const deviceId = await db.authenticate(token);
        if (!deviceId) throw new HttpError(401, "invalid bearer token");
        if (req.method === "PUT" && url.pathname === "/v1/catalog") {
          const catalog = validateCatalog(await readJson(req, config.bodyLimitBytes));
          if (!catalog) throw new HttpError(400, "invalid catalog");
          await db.putCatalog(deviceId, catalog);
          json(res, 200, { ok: true }); return;
        }
        if (req.method === "GET" && url.pathname === "/v1/entries/pending") {
          json(res, 200, { entries: await db.pendingEntries() }); return;
        }
        if (req.method === "POST" && url.pathname === "/v1/entries/ack") {
          const ids = validateAck(await readJson(req, config.bodyLimitBytes));
          if (!ids) throw new HttpError(400, "invalid acknowledgement");
          json(res, 200, { acknowledged: await db.acknowledge(ids) }); return;
        }
      }
      throw new HttpError(404, "not found");
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      if (error instanceof HttpError) { json(res, error.status, { error: error.message }); return; }
      console.error("Request failed", error);
      json(res, 500, { error: "internal server error" });
    }
  };
}
