import type { Config } from "./config.js";
import type { DbClient } from "./db.js";
import { pairCode, parseMoney } from "./security.js";
import type { Catalog, CatalogAccount, CatalogCategory, EntryKind, WizardState } from "./types.js";

interface TelegramMessage { message_id: number; text?: string; chat: { id: number; type: string }; from?: { id: number } }
export interface TelegramUpdate { update_id: number; message?: TelegramMessage }
type Keyboard = { keyboard: { text: string }[][]; resize_keyboard: true; is_persistent: true } | { remove_keyboard: true };

const MAIN_ROWS = [[{ text: "➖ Расход" }, { text: "➕ Доход" }], [{ text: "📊 Статус" }, { text: "❓ Помощь" }]];
const mainKeyboard = (): Keyboard => ({ keyboard: MAIN_ROWS, resize_keyboard: true, is_persistent: true });
const choiceKeyboard = (labels: string[], extra?: string): Keyboard => ({ keyboard: [...labels.map((text) => [{ text }]), ...(extra ? [[{ text: extra }]] : []), [{ text: "❌ Отмена" }]], resize_keyboard: true, is_persistent: true });

export class TelegramBot {
  constructor(private readonly config: Config, private readonly db: DbClient, private readonly fetchFn: typeof fetch = fetch) {}

  private async send(chatId: string, text: string, keyboard: Keyboard = mainKeyboard()): Promise<void> {
    const response = await this.fetchFn(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: keyboard, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Telegram sendMessage failed: ${response.status}`);
  }

  async handle(update: TelegramUpdate): Promise<void> {
    if (!Number.isSafeInteger(update.update_id) || !(await this.db.claimUpdate(update.update_id))) return;
    const message = update.message;
    if (!message?.from || message.chat.type !== "private" || typeof message.text !== "string") return;
    const userId = String(message.from.id);
    const chatId = String(message.chat.id);
    if (!this.config.allowedUserIds.has(userId)) { await this.send(chatId, "Доступ запрещён.", { remove_keyboard: true }); return; }
    const text = message.text.trim();
    if (["/cancel", "❌ Отмена"].includes(text)) { await this.db.setSession(userId, chatId, { step: "idle" }); await this.send(chatId, "Действие отменено."); return; }
    if (["/help", "❓ Помощь"].includes(text)) { await this.send(chatId, "Команды: /expense, /income, /status, /cancel, /link. Суммы вводятся в валюте выбранного счёта."); return; }
    if (["/start", "/link"].includes(text)) { await this.issuePairCode(userId, chatId); return; }
    if (["/status", "📊 Статус"].includes(text)) { const s = await this.db.counts(); await this.send(chatId, `Подключённых устройств: ${s.devices}\nВерсия каталога: ${s.catalogRevision ?? "нет"}\nОжидают синхронизации: ${s.pending}`); return; }
    if (["/expense", "➖ Расход"].includes(text)) { await this.startWizard(userId, chatId, "expense"); return; }
    if (["/income", "➕ Доход"].includes(text)) { await this.startWizard(userId, chatId, "income"); return; }
    await this.continueWizard(userId, chatId, text);
  }

  private async issuePairCode(userId: string, chatId: string): Promise<void> {
    let code = "";
    let saved = false;
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      code = pairCode();
      saved = await this.db.savePairCode(code, userId, this.config.pairCodeTtlSeconds);
    }
    if (!saved) throw new Error("Could not allocate a unique pairing code");
    await this.send(chatId, `Код подключения: ${code}\nОн действует ${Math.ceil(this.config.pairCodeTtlSeconds / 60)} мин. Введите его в MoneyStat. Никому не пересылайте код.`);
  }

  private async startWizard(userId: string, chatId: string, kind: EntryKind): Promise<void> {
    if (!(await this.db.getCatalog())) { await this.send(chatId, "Сначала подключите MoneyStat через /start и передайте каталог."); return; }
    await this.db.setSession(userId, chatId, { step: "amount", kind });
    await this.send(chatId, `Введите сумму ${kind === "expense" ? "расхода" : "дохода"}:`, choiceKeyboard([]));
  }

  private label(item: CatalogAccount | CatalogCategory): string { return `${item.name} · ${item.id.slice(0, 8)}`; }
  private findByLabel<T extends CatalogAccount | CatalogCategory>(items: T[], text: string): T | undefined { return items.find((item) => this.label(item) === text); }

  private async continueWizard(userId: string, chatId: string, text: string): Promise<void> {
    const state = await this.db.getSession(userId);
    const catalog = await this.db.getCatalog();
    if (state.step === "idle") { await this.send(chatId, "Выберите действие на клавиатуре или используйте /help."); return; }
    if (!catalog) { await this.db.setSession(userId, chatId, { step: "idle" }); await this.send(chatId, "Каталог недоступен. Синхронизируйте MoneyStat и начните заново."); return; }
    if (state.step === "amount") {
      const amount = parseMoney(text);
      if (amount === null) { await this.send(chatId, "Введите положительную сумму, не более двух знаков после запятой.", choiceKeyboard([])); return; }
      await this.db.setSession(userId, chatId, { step: "account", kind: state.kind, amount });
      await this.send(chatId, "Выберите счёт:", choiceKeyboard(catalog.accounts.map((a) => this.label(a)))); return;
    }
    if (state.step === "account") {
      const account = this.findByLabel(catalog.accounts, text);
      if (!account) { await this.send(chatId, "Выберите счёт кнопкой.", choiceKeyboard(catalog.accounts.map((a) => this.label(a)))); return; }
      const categories = catalog.categories.filter((c) => c.kind === state.kind);
      if (!categories.length) { await this.db.setSession(userId, chatId, { step: "idle" }); await this.send(chatId, "В каталоге нет подходящих категорий."); return; }
      await this.db.setSession(userId, chatId, { ...state, step: "category", accountId: account.id });
      await this.send(chatId, "Выберите категорию:", choiceKeyboard(categories.map((c) => this.label(c)))); return;
    }
    if (state.step === "category") {
      const categories = catalog.categories.filter((c) => c.kind === state.kind);
      const category = this.findByLabel(categories, text);
      if (!category) { await this.send(chatId, "Выберите категорию кнопкой.", choiceKeyboard(categories.map((c) => this.label(c)))); return; }
      await this.db.setSession(userId, chatId, { ...state, step: "comment", categoryId: category.id });
      await this.send(chatId, "Добавьте комментарий или пропустите:", choiceKeyboard([], "⏭ Пропустить")); return;
    }
    if (state.step === "comment") {
      const note = text === "⏭ Пропустить" ? "" : text;
      if (note.length > 300) { await this.send(chatId, "Комментарий не длиннее 300 символов.", choiceKeyboard([], "⏭ Пропустить")); return; }
      const next: WizardState = { ...state, step: "confirm", note };
      await this.db.setSession(userId, chatId, next);
      await this.send(chatId, this.summary(next, catalog), choiceKeyboard(["✅ Подтвердить"])); return;
    }
    if (state.step === "confirm") {
      if (text !== "✅ Подтвердить") { await this.send(chatId, "Подтвердите запись или отмените.", choiceKeyboard(["✅ Подтвердить"])); return; }
      const id = await this.db.queueEntry(userId, state);
      await this.send(chatId, `Запись сохранена в очереди.\nID: ${id}`);
    }
  }

  private summary(state: Extract<WizardState, { step: "confirm" }>, catalog: Catalog): string {
    const account = catalog.accounts.find((a) => a.id === state.accountId);
    const category = catalog.categories.find((c) => c.id === state.categoryId);
    const amount = `${Math.floor(state.amount / 100)},${String(state.amount % 100).padStart(2, "0")}`;
    return `Проверьте запись:\n${state.kind === "expense" ? "Расход" : "Доход"}: ${amount} ${account?.currency ?? ""}\nСчёт: ${account?.name ?? "?"}\nКатегория: ${category?.name ?? "?"}\nКомментарий: ${state.note || "—"}`;
  }
}
