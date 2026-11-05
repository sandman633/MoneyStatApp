export interface Config {
  port: number;
  databaseUrl: string;
  databaseSsl: boolean;
  botToken: string;
  webhookSecret: string;
  allowedUserIds: Set<string>;
  corsOrigins: Set<string>;
  pairCodeTtlSeconds: number;
  rateLimitPerMinute: number;
  bodyLimitBytes: number;
  trustProxy: boolean;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${key}`);
  return value;
}

function integer(env: NodeJS.ProcessEnv, key: string, fallback: number, min: number, max: number): number {
  const value = env[key] === undefined ? fallback : Number(env[key]);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}`);
  return value;
}

export function loadConfig(env = process.env): Config {
  const secret = required(env, "TELEGRAM_WEBHOOK_SECRET");
  if (secret.length < 16 || !/^[A-Za-z0-9_-]+$/.test(secret)) throw new Error("TELEGRAM_WEBHOOK_SECRET must be at least 16 URL-safe characters");
  const allowed = new Set(required(env, "TELEGRAM_ALLOWED_USER_IDS").split(",").map((v) => v.trim()).filter((v) => /^\d+$/.test(v)));
  if (!allowed.size) throw new Error("TELEGRAM_ALLOWED_USER_IDS contains no valid IDs");
  return {
    port: integer(env, "PORT", 8080, 1, 65535),
    databaseUrl: required(env, "DATABASE_URL"),
    databaseSsl: env.DATABASE_SSL === "true",
    botToken: required(env, "TELEGRAM_BOT_TOKEN"),
    webhookSecret: secret,
    allowedUserIds: allowed,
    corsOrigins: new Set((env.CORS_ALLOWED_ORIGINS ?? "").split(",").map((v) => v.trim()).filter(Boolean)),
    pairCodeTtlSeconds: integer(env, "PAIR_CODE_TTL_SECONDS", 600, 60, 3600),
    rateLimitPerMinute: integer(env, "RATE_LIMIT_PER_MINUTE", 120, 10, 10000),
    bodyLimitBytes: integer(env, "BODY_LIMIT_BYTES", 65536, 1024, 1048576),
    trustProxy: env.TRUST_PROXY === "true",
  };
}
