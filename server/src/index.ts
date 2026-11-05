import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { Database } from "./db.js";
import { createHandler } from "./http.js";

const config = loadConfig();
const db = new Database(config.databaseUrl, config.databaseSsl);
const server = createServer({ requestTimeout: 15_000, headersTimeout: 10_000, keepAliveTimeout: 5_000 }, createHandler(config, db));

server.listen(config.port, "0.0.0.0", () => console.log(`MoneyStat sync server listening on port ${config.port}`));

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`Received ${signal}, shutting down`);
  server.close(async () => { await db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
