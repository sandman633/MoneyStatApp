import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { importMonefy } from "./monefyImport";
import type { State } from "./model";

export default function HistoryImport({ replace, backup }: { replace: (state: State) => Promise<void>; backup: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ReturnType<typeof importMonefy> | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const working = useRef(false);
  const [busy, setBusy] = useState(false);
  async function select(file?: File) {
    if (!file || working.current) return;
    working.current = true;
    setPreview(null); setError(""); setBusy(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw Error("Файл больше 10 МБ.");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      setPreview(importMonefy(text));
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось прочитать CSV."); }
    finally { working.current = false; setBusy(false); }
  }
  async function apply() {
    if (!preview || busy) return;
    if (!confirm(`Заменить ВСЕ данные MoneyStat историей Monefy?\n${preview.summary.accounts.length} счетов, ${preview.summary.operations} операций, включая ${preview.summary.transfers} переводов.\nТекущие счета, категории, операции и курсы будут удалены. Для возврата нужна экспортированная JSON-копия.`)) return;
    working.current = true;
    setBusy(true); setError("");
    try { await replace(preview.state); setPreview(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка импорта. Попробуйте снова."); }
    finally { working.current = false; setBusy(false); }
  }
  return <section className="panel history-import">
    <div className="panel-heading"><h2>Импорт истории</h2><Upload size={20} /></div>
    <p className="help">Загрузите CSV из Monefy. Импорт полностью заменит счета, категории, операции и курсы на этом устройстве — без добавления к существующей истории.</p>
    <p className="help">Переводы объединяются в одну операцию, начальные остатки не считаются доходом. Стандартные английские названия переводятся на русский. Поддерживается CSV в UTF-8 со счетами в RUB.</p>
    <div className={"import-dropzone" + (dragging ? " dragging" : "")} aria-label="Перетащите CSV Monefy" aria-busy={busy}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = busy ? "none" : "copy"; if (!busy) setDragging(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={(e) => {
        e.preventDefault(); setDragging(false);
        if (working.current) return;
        if (e.dataTransfer.files.length !== 1) { setPreview(null); setError("Перетащите один CSV-файл Monefy."); return; }
        void select(e.dataTransfer.files[0]);
      }}>
      <Upload size={24} /><p>{busy ? "Обрабатываем файл…" : "Перетащите сюда CSV-файл Monefy"}</p>
      <small>или выберите файл кнопкой ниже · до 10 МБ</small>
    <div className="backup-buttons">
      <button type="button" disabled={busy} onClick={() => input.current?.click()}><Upload size={18} /> Импортировать историю Monefy</button>
      <button type="button" disabled={busy} onClick={backup}>Сохранить текущую копию</button>
    </div>
    </div>
    <input ref={input} hidden type="file" accept=".csv,text/csv" aria-label="CSV истории Monefy" disabled={busy} onChange={(e) => { void select(e.target.files?.[0]); e.target.value = ""; }} />
    {error && <p role="alert" className="alert">{error}</p>}
    {preview && <div className="import-preview">
      <h3>Проверено: {preview.summary.sourceRows} строк</h3>
      <p>{preview.summary.dateFrom} — {preview.summary.dateTo}</p>
      <p>{preview.summary.expenses} расходов · {preview.summary.incomes} доходов · {preview.summary.transfers} переводов · {preview.summary.openingBalances} начальных остатков.</p>
      <p>{preview.summary.accounts.length} счетов · {preview.summary.categories} категорий. Балансы совпадают с CSV.</p>
      <details><summary>Счета и итоговые балансы</summary><ul>{preview.summary.accounts.map((a) => <li key={a.name}>{a.name}: {new Intl.NumberFormat("ru-RU", { style: "currency", currency: a.currency }).format(a.balance / 100)}</li>)}</ul></details>
      <p className="help">Сначала сохраните текущую копию, если она может понадобиться. Начальные остатки без записи в CSV равны нулю.</p>
      <div className="backup-buttons"><button type="button" className="primary" disabled={busy} onClick={apply}>{busy ? "Импортируем…" : "Заменить все данные"}</button><button type="button" disabled={busy} onClick={() => setPreview(null)}><X size={16} /> Отмена</button></div>
    </div>}
  </section>;
}
