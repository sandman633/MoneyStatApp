import { useState } from "react";
import { Download, Link2, Send, Unlink } from "lucide-react";
import type { State } from "./model";
import { acknowledgeTelegramDrafts, fetchTelegramDrafts, importTelegramDrafts, linkTelegram,
  loadTelegramConfig, pushTelegramCatalog, saveTelegramConfig, type TelegramConfig, type TelegramDraft } from "./telegramSyncModel";

const fmt = (amount: number, currency: string) => new Intl.NumberFormat("ru-RU", { style: "currency", currency }).format(amount / 100);
export default function TelegramSync({ state, apply }: { state: State; apply: (fn: (state: State) => void) => Promise<boolean> }) {
  const [config, setConfig] = useState<TelegramConfig | null>(() => loadTelegramConfig());
  const [url, setUrl] = useState(config?.url ?? "");
  const [code, setCode] = useState("");
  const [drafts, setDrafts] = useState<TelegramDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function connect() {
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await linkTelegram(url, code);
      await pushTelegramCatalog(next, state);
      setConfig(next); setUrl(next.url); setCode(""); setNotice("Telegram подключён, счета и категории переданы боту.");
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось подключить Telegram."); }
    finally { setBusy(false); }
  }
  async function refresh() {
    if (!config) return;
    setBusy(true); setError(""); setNotice("");
    try { await pushTelegramCatalog(config, state); const values = await fetchTelegramDrafts(config); setDrafts(values); if (!values.length) setNotice("Новых операций из Telegram нет."); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить операции."); }
    finally { setBusy(false); }
  }
  async function commit() {
    if (!config || !drafts.length) return;
    if (!confirm(`Добавить ${drafts.length} операций из Telegram в MoneyStat?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      let added = 0;
      const saved = await apply((next) => { added = importTelegramDrafts(next, drafts); });
      if (!saved) throw Error("MoneyStat не смог сохранить операции.");
      await acknowledgeTelegramDrafts(config, drafts.map((draft) => draft.id));
      setDrafts([]); setNotice(`Готово: добавлено ${added} операций. Повторы пропущены.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка импорта Telegram."); }
    finally { setBusy(false); }
  }
  function disconnect() { if (!confirm("Отключить это устройство от Telegram? Операции на сервере не удалятся.")) return; saveTelegramConfig(null); setConfig(null); setDrafts([]); setNotice("Telegram отключён на этом устройстве."); }
  return <section className="panel telegram-sync">
    <div className="panel-heading"><h2>Telegram-бот</h2><Send size={20} /></div>
    {!config ? <>
      <p className="help">Откройте семейного бота, отправьте <code>/start</code> и получите одноразовый 8-значный код. Бот хранит только справочник и очередь новых операций.</p>
      <div className="form-row"><label>Адрес сервера<input type="url" placeholder="https://money.example.com" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <label>Код привязки<input inputMode="numeric" pattern="[0-9]{8}" maxLength={8} placeholder="12345678" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></label></div>
      <button type="button" className="primary" disabled={busy || !url || code.length !== 8} onClick={connect}><Link2 size={18} /> Подключить Telegram</button>
    </> : <>
      <p className="help">Подключено к {config.url}. Перед загрузкой приложение обновляет в боте список счетов и категорий.</p>
      <div className="backup-buttons"><button type="button" className="primary" disabled={busy} onClick={refresh}><Download size={18} /> Подгрузить из Telegram</button><button type="button" disabled={busy} onClick={disconnect}><Unlink size={18} /> Отключить</button></div>
      {drafts.length > 0 && <div className="telegram-preview"><h3>Новые операции: {drafts.length}</h3>{drafts.map((draft) => { const account = state.accounts.find((a) => a.id === draft.accountId)!; const category = state.categories.find((c) => c.id === draft.categoryId)!; return <div key={draft.id}><span><b>{draft.kind === "expense" ? "Расход" : "Доход"} · {category?.name}</b><small>{draft.date} · {account?.name}{draft.createdByName ? ` · ${draft.createdByName}` : ""}{draft.note ? ` · ${draft.note}` : ""}</small></span><strong>{fmt(draft.amount, account?.currency ?? "RUB")}</strong></div>; })}<button type="button" className="primary" disabled={busy} onClick={commit}>Добавить в MoneyStat</button></div>}
    </>}
    {error && <p role="alert" className="alert">{error}</p>}{notice && <p role="status" className="notice">{notice}</p>}
  </section>;
}
