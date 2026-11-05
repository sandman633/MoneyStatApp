import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

const env = { DATABASE_URL: "postgres://localhost/db", TELEGRAM_BOT_TOKEN: "token", TELEGRAM_WEBHOOK_SECRET: "long_safe_secret_123", TELEGRAM_ALLOWED_USER_IDS: "12,34" };
test("configuration parses allowlists and safe defaults", () => {
  const config = loadConfig(env);
  assert.deepEqual([...config.allowedUserIds], ["12", "34"]);
  assert.equal(config.bodyLimitBytes, 65536);
});
test("configuration rejects a weak webhook secret", () => assert.throws(() => loadConfig({ ...env, TELEGRAM_WEBHOOK_SECRET: "short" })));
