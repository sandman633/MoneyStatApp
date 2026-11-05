import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { sha256 } from "./security.js";
import type { Catalog, StoredCatalog, WizardState } from "./types.js";

export class Database {
  readonly pool: Pool;

  constructor(url: string, ssl: boolean) {
    this.pool = new Pool({ connectionString: url, ssl: ssl ? { rejectUnauthorized: true } : false, max: 10, idleTimeoutMillis: 30_000 });
    this.pool.on("error", (error) => console.error("Idle PostgreSQL client error", error));
  }

  async close(): Promise<void> { await this.pool.end(); }
  async health(): Promise<void> { await this.pool.query("SELECT 1"); }

  async savePairCode(code: string, userId: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO pairing_codes (code_hash, telegram_user_id, expires_at)
       VALUES ($1, $2, now() + $3 * interval '1 second')
       ON CONFLICT (code_hash) DO NOTHING`,
      [sha256(code), userId, ttlSeconds],
    );
    return Boolean(result.rowCount);
  }

  async consumePairCode(code: string, deviceName: string, rawToken: string): Promise<{ id: string } | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query<{ telegram_user_id: string }>(
        `UPDATE pairing_codes SET consumed_at = now()
         WHERE code_hash = $1 AND consumed_at IS NULL AND expires_at > now()
         RETURNING telegram_user_id`, [sha256(code)],
      );
      if (!found.rowCount) { await client.query("ROLLBACK"); return null; }
      const id = randomUUID();
      await client.query("INSERT INTO devices (id, name, token_hash) VALUES ($1, $2, $3)", [id, deviceName, sha256(rawToken)]);
      await client.query("COMMIT");
      return { id };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async authenticate(rawToken: string): Promise<string | null> {
    const result = await this.pool.query<{ id: string }>(
      `UPDATE devices SET last_seen_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL RETURNING id`, [sha256(rawToken)],
    );
    return result.rows[0]?.id ?? null;
  }

  async putCatalog(deviceId: string, catalog: Catalog): Promise<number> {
    const result = await this.pool.query<{ revision: string }>(
      `INSERT INTO catalog (singleton, accounts, categories, currencies, updated_by)
       VALUES (true, $1, $2, $3, $4)
       ON CONFLICT (singleton) DO UPDATE SET revision = catalog.revision + 1,
         accounts = EXCLUDED.accounts, categories = EXCLUDED.categories,
         currencies = EXCLUDED.currencies, updated_by = EXCLUDED.updated_by, updated_at = now()
       RETURNING revision`,
      [JSON.stringify(catalog.accounts), JSON.stringify(catalog.categories), JSON.stringify(catalog.currencies), deviceId],
    );
    return Number(result.rows[0]!.revision);
  }

  async getCatalog(): Promise<StoredCatalog | null> {
    const result = await this.pool.query<{ revision: string; accounts: Catalog["accounts"]; categories: Catalog["categories"]; currencies: string[] }>("SELECT revision, accounts, categories, currencies FROM catalog WHERE singleton = true");
    const row = result.rows[0];
    return row ? { revision: Number(row.revision), accounts: row.accounts, categories: row.categories, currencies: row.currencies } : null;
  }

  async claimUpdate(updateId: number): Promise<boolean> {
    const result = await this.pool.query("INSERT INTO telegram_updates (update_id) VALUES ($1) ON CONFLICT DO NOTHING", [updateId]);
    return Boolean(result.rowCount);
  }

  async getSession(userId: string): Promise<WizardState> {
    const result = await this.pool.query<{ state: WizardState }>("SELECT state FROM bot_sessions WHERE telegram_user_id = $1", [userId]);
    return result.rows[0]?.state ?? { step: "idle" };
  }

  async setSession(userId: string, chatId: string, state: WizardState): Promise<void> {
    await this.pool.query(
      `INSERT INTO bot_sessions (telegram_user_id, chat_id, state) VALUES ($1, $2, $3)
       ON CONFLICT (telegram_user_id) DO UPDATE SET chat_id = EXCLUDED.chat_id, state = EXCLUDED.state, updated_at = now()`,
      [userId, chatId, JSON.stringify(state)],
    );
  }

  async queueEntry(userId: string, state: Extract<WizardState, { step: "confirm" }>): Promise<string> {
    const id = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO pending_entries (id, telegram_user_id, kind, account_id, category_id, amount, entry_date, note)
         VALUES ($1, $2, $3, $4, $5, $6, (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Moscow')::date, $7)`,
        [id, userId, state.kind, state.accountId, state.categoryId, state.amount, state.note],
      );
      await client.query("UPDATE bot_sessions SET state = '{\"step\":\"idle\"}'::jsonb, updated_at = now() WHERE telegram_user_id = $1", [userId]);
      await client.query("COMMIT");
      return id;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async pendingEntries(limit = 200): Promise<object[]> {
    const result = await this.pool.query(
      `SELECT id, kind, account_id AS "accountId", category_id AS "categoryId",
              amount::text, to_char(entry_date, 'YYYY-MM-DD') AS date, note
       FROM pending_entries WHERE acknowledged_at IS NULL ORDER BY created_at, id LIMIT $1`, [limit],
    );
    return result.rows.map((row) => ({ ...row, amount: Number(row.amount) }));
  }

  async acknowledge(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const result = await this.pool.query(
      "UPDATE pending_entries SET acknowledged_at = now() WHERE id = ANY($1::uuid[]) AND acknowledged_at IS NULL", [ids],
    );
    return result.rowCount ?? 0;
  }

  async counts(): Promise<{ pending: number; devices: number; catalogRevision: number | null }> {
    const result = await this.pool.query<{ pending: string; devices: string; revision: string | null }>(
      `SELECT (SELECT count(*) FROM pending_entries WHERE acknowledged_at IS NULL) AS pending,
              (SELECT count(*) FROM devices WHERE revoked_at IS NULL) AS devices,
              (SELECT revision FROM catalog WHERE singleton = true) AS revision`,
    );
    const row = result.rows[0]!;
    return { pending: Number(row.pending), devices: Number(row.devices), catalogRevision: row.revision === null ? null : Number(row.revision) };
  }
}

export type DbClient = Pick<Database, "savePairCode" | "getCatalog" | "claimUpdate" | "getSession" | "setSession" | "queueEntry" | "counts">;
