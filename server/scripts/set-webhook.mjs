const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const baseUrl = (process.argv[2] ?? process.env.PUBLIC_BASE_URL)?.replace(/\/$/, "");
if (!token || !secret || !baseUrl) throw Error("Usage: set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET, then npm run webhook:set -- https://server.example.com");
if (!baseUrl.startsWith("https://")) throw Error("Webhook base URL must use HTTPS");
async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw Error(`${method} failed: ${result.description ?? response.status}`);
}
await telegram("setWebhook", { url: `${baseUrl}/telegram/webhook`, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: false });
await telegram("setMyCommands", { commands: [
  { command: "start", description: "Подключить MoneyStat" },
  { command: "expense", description: "Добавить расход" },
  { command: "income", description: "Добавить доход" },
  { command: "status", description: "Ожидают загрузки" },
  { command: "cancel", description: "Отменить ввод" },
  { command: "help", description: "Помощь" },
] });
console.log("Telegram webhook and commands configured");
