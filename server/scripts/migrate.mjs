import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw Error("Missing required environment variable DATABASE_URL");
const pool = new Pool({ connectionString, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false });
const client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock(7720261106)");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const name = "001_initial";
  const applied = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
  if (applied.rowCount) console.log(`Migration ${name} already applied`);
  else {
    const sql = await readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8");
    await client.query("BEGIN");
    try { await client.query(sql); await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]); await client.query("COMMIT"); }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    console.log(`Migration ${name} applied`);
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(7720261106)").catch(() => undefined);
  client.release();
  await pool.end();
}
