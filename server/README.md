# MoneyStat Telegram bot and sync API

An intentionally small companion service for one family workspace. It stores the client-provided account/category catalog and bot-created entries only until a linked MoneyStat device acknowledges them. It does **not** upload balances, existing entries, rates, or full finance history.

## Requirements and deployment

- Node.js 22+
- PostgreSQL 14+
- A Telegram bot and a public HTTPS endpoint

Install and build:

```powershell
cd server
npm.cmd ci
npm.cmd run migrate
npm.cmd run build
npm.cmd start
```

Copy `.env.example` to the deployment secret store and set every required value. Do not commit `.env`. `DATABASE_SSL=true` uses certificate verification; provide a trusted CA through the normal Node/PostgreSQL environment when the database uses a private CA.

Register the webhook using Telegram's `setWebhook` method with:

- URL: `https://your-host.example/telegram/webhook`
- `secret_token`: exactly `TELEGRAM_WEBHOOK_SECRET`
- `allowed_updates`: `["message"]`
- `drop_pending_updates`: appropriate for the deployment; normally `false`

Keep `TELEGRAM_BOT_TOKEN` in the deployment secret store. It is used only in the outbound Telegram URL and is never returned by this service. Avoid putting it into shell history or logs when configuring the webhook. Run one application replica unless update processing is known to be safe for your hosting setup; PostgreSQL provides idempotency, but Telegram replies are external side effects.

After deployment, configure both the webhook and Telegram command menu without putting the token in a URL:

```powershell
npm.cmd run webhook:set -- https://your-host.example
```

The script reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` from the environment.

The process serves `GET /healthz`, handles `SIGINT`/`SIGTERM`, and has request/header timeouts. Run `npm.cmd run migrate` as a separate release/pre-deploy step before starting the process. A provider-neutral `Dockerfile` is included; database migration remains a separate command so failed migrations cannot be hidden inside process startup.

For browser, Android, and Electron clients configure exact CORS origins. Typical development/Capacitor origins are `http://127.0.0.1:5173`, `http://localhost:5173`, and `http://localhost`; Electron loaded from `file:` can send origin `null`, which may be explicitly allowed for this bearer-token-protected personal service. Do not use `*`.

## Pairing and synchronization

1. An allowlisted Telegram user opens a private chat and sends `/start` or `/link`.
2. The bot issues an eight-digit, single-use code. Only its SHA-256 hash is stored, and it expires after `PAIR_CODE_TTL_SECONDS`.
3. MoneyStat calls `POST /v1/link`. The response contains the device bearer token exactly once. Store it in secure local application storage. Only its SHA-256 hash is stored server-side.
4. The client uploads the current catalog. Each upload atomically replaces the server copy.
5. The bot can create entries. The client polls pending entries, validates/reconciles them against its current State v1 data, persists locally, then acknowledges the server queue IDs. A retry is safe: IDs are stable and acknowledgements are idempotent.

When importing an entry, the client should use the queue `id` as the MoneyStat entry ID (or durably record a mapping) before acknowledging it. This prevents duplicate local entries if the client crashes after local persistence but before acknowledgement.

## HTTP interface

All request and response bodies are JSON. Authenticated endpoints require `Authorization: Bearer <device-token>`. Error responses are `{ "error": "..." }`. Unknown routes return 404. Browser origins are denied unless listed exactly in `CORS_ALLOWED_ORIGINS`; non-browser/native clients do not need CORS.

### `POST /v1/link`

Unauthenticated. Subject to the global IP rate limit. Consumes a one-time code.

```json
{ "code": "12345678", "deviceName": "Домашний ноутбук" }
```

Success `201`:

```json
{ "token": "one-time-plaintext-token" }
```

Invalid, expired, or already-used codes return `401` without distinguishing the reason.

### `PUT /v1/catalog`

Uploads and replaces the minimal client catalog. Account/category IDs must be unique across the catalog, every account currency must occur in `currencies`, and currency codes use three uppercase letters. At least one account and currency are required. Limits: 200 accounts, 500 categories, 100 currencies, names/IDs 80 characters.

```json
{
  "accounts": [{ "id": "client-account-id", "name": "Карта", "currency": "RUB" }],
  "categories": [{ "id": "client-category-id", "name": "Еда", "kind": "expense" }],
  "currencies": ["RUB"]
}
```

Success `200`: `{ "ok": true }`.

### `GET /v1/entries/pending`

Returns at most 200 oldest unacknowledged records:

```json
{
  "entries": [{
    "id": "uuid",
    "kind": "expense",
    "accountId": "client-account-id",
    "categoryId": "client-category-id",
    "amount": 12550,
    "date": "2026-11-06",
    "note": "Продукты"
  }]
}
```

`amount` is always integer hundredths. `date` is the current `Europe/Moscow` calendar date when the user confirms. Transfers are not produced.

### `POST /v1/entries/ack`

Acknowledges up to 500 queue IDs. Unknown/already acknowledged IDs are harmless.

```json
{ "ids": ["550e8400-e29b-41d4-a716-446655440000"] }
```

Success `200`: `{ "acknowledged": 1 }`.

### `POST /telegram/webhook`

Telegram-only endpoint. Requires `X-Telegram-Bot-Api-Secret-Token`. Duplicate `update_id` values are ignored. Only allowlisted users in private chats are processed.

## Bot behavior

Commands: `/start`, `/link`, `/expense`, `/income`, `/cancel`, `/status`, `/help`. The persistent reply keyboard exposes expense, income, status, and help actions. Entry wizard:

`amount → account → category filtered by kind → optional comment/Skip → confirmation`

Wizard state is persisted in PostgreSQL. `/cancel` works at every step. Confirmation queues one UUID entry. The catalog is read again throughout the wizard so removed choices cannot silently produce stale records.

## Security and operations

- Configure a long random URL-safe webhook secret and an explicit numeric Telegram user allowlist.
- Default JSON body limit is 64 KiB. Content type must be `application/json`.
- The in-process fixed-window IP limiter is basic abuse protection, not a replacement for an edge rate limiter. With `TRUST_PROXY=true`, only deploy behind a trusted proxy that overwrites `X-Forwarded-For`.
- Database credentials, bot token, webhook secret, and device tokens must be treated as secrets. Application errors do not echo them.
- Periodically delete expired/consumed pairing codes, old Telegram update IDs, acknowledged entries, and idle sessions according to your retention policy. Do not delete unacknowledged entries.
- Back up PostgreSQL and monitor 5xx responses. Rotation currently means relinking a device; device revocation can be performed by setting `devices.revoked_at` administratively.

## Checks

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Tests are dependency-light Node tests for money parsing, credential parsing, configuration, and sync payload validation. Integration deployment should additionally exercise the migration against the target PostgreSQL version and use Telegram's `getWebhookInfo` to verify delivery.
