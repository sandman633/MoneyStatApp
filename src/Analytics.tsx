import { Fragment, useEffect, useRef, useState } from "react";
import "./analytics.css";
import { BarChart3 } from "lucide-react";
import { today, type State, type Category } from "./model";
import { categoryIcons } from "./CategoryAppearance";
import { changeText, expenseReport, monthRange, shiftRange, validRange, type Bucket, type DateRange, type Grain } from "./analyticsModel";

const money = (n: number, currency: string) => new Intl.NumberFormat("ru-RU", { style: "currency", currency }).format(n / 100);
const rangeText = (r: DateRange) => `${r.start.split("-").reverse().join(".")} — ${r.end.split("-").reverse().join(".")}`;
function Histogram({ report, previous, range, reference, categories, currency, max, kind }: {
  report: ReturnType<typeof expenseReport>; previous?: ReturnType<typeof expenseReport>;
  range: DateRange; reference: DateRange; categories: Category[]; currency: string; max: number; kind: "expense" | "income";
}) {
  const [active, setActive] = useState<number | "total" | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1);
      const next = Math.max(0, Math.min(element.scrollWidth - element.clientWidth, element.scrollLeft + delta));
      if (next === element.scrollLeft) return;
      event.preventDefault();
      element.scrollLeft = next;
      setActive(null);
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  const title = kind === "income" ? "Доходы" : "Расходы";
  const buckets = report.buckets;
  const bucket = typeof active === "number" ? buckets[active] : undefined;
  const before = typeof active === "number" ? previous?.buckets[active] : undefined;
  const label = (b?: Bucket) => !b ? "—" : b.key.length === 10 ? b.key.slice(8) + "." + b.key.slice(5, 7) : b.key.length === 7 ? b.key.slice(5) + "." + b.key.slice(0, 4) : b.key;
  const count = Math.max(buckets.length, previous?.buckets.length ?? 0);
  const stack = (b: Bucket) => <span className="histogram-stack" style={{ height: `${max ? b.total / max * 100 : 0}%` }}>
    {categories.map((c) => b.categories[c.id] > 0 && <span key={c.id} style={{ backgroundColor: c.color, height: `${b.categories[c.id] / b.total * 100}%` }} />)}
  </span>;
  return <section className="panel analytics-chart" onKeyDown={(e) => { if (e.key === "Escape") setActive(null); }}>
    <h2>{title}{previous ? " · сравнение периодов" : ""}</h2>
    <div className="chart-periods" onMouseLeave={() => setActive(null)}>
      {previous && <button type="button" className="previous-period" onMouseEnter={() => setActive("total")} onFocus={() => setActive("total")} onBlur={() => setActive(null)} onClick={() => setActive("total")}><i />Сравнение · {rangeText(reference)}<b>{money(previous.total, currency)}</b></button>}
      <button type="button" onMouseEnter={() => setActive("total")} onFocus={() => setActive("total")} onBlur={() => setActive(null)} onClick={() => setActive("total")}><i />Текущий период · {rangeText(range)}<b>{money(report.total, currency)}</b></button>
    </div>
    <p className="help">{currency} · 0 — {money(max, currency)}{previous ? " · Сравнение слева, текущий период справа. Столбцы сопоставлены по порядку внутри периодов" : ""}</p>
    <div className="histogram-canvas" onMouseLeave={() => setActive(null)} onKeyDown={(e) => { if (e.key === "Escape") setActive(null); }}>
    {active !== null && <div className="histogram-detail" role="tooltip" aria-live="polite">
      {active === "total" ? <><b>Итого за периоды</b>{previous && <span>{rangeText(reference)}: {money(previous.total, currency)} · {previous.count} операций</span>}<span>{rangeText(range)}: {money(report.total, currency)} · {report.count} операций</span>
        {previous && <><strong data-testid="analytics-change">{changeText(report.total, previous.total, currency, kind)}</strong>
          {report.days !== previous.days && <small>{previous.days} и {report.days} дней · в день: {money(Math.round(previous.total / previous.days), currency)} / {money(Math.round(report.total / report.days), currency)}. Суммы без нормализации.</small>}</>}
      </> : <><b>{bucket?.key ?? "Нет соответствующей даты"} · {bucket ? money(bucket.total, currency) : "—"}</b>
        {previous && <><span>{before?.key ?? "Нет соответствующей даты"} · {before ? money(before.total, currency) : "—"}</span>{bucket && before && <strong>{changeText(bucket.total, before.total, currency, kind)}</strong>}</>}
        <div className="analytics-legend">{categories.filter((c) => (bucket?.categories[c.id] ?? 0) > 0 || (before?.categories[c.id] ?? 0) > 0).map((c) => <span key={c.id}><i style={{ background: c.color }} />{c.name}: {bucket ? money(bucket.categories[c.id] ?? 0, currency) : "—"}{previous ? ` / ${before ? money(before.categories[c.id] ?? 0, currency) : "—"}` : ""}</span>)}</div>
        <small>Операций: {bucket?.count ?? "—"}{previous ? ` / ${before?.count ?? "—"}` : ""}</small>
      </>}
    </div>}
    <div ref={scroll} className="histogram-scroll" tabIndex={0} aria-label={title + ", горизонтальная прокрутка"}>
      <div className="histogram" style={{ minWidth: Math.max(260, count * (previous ? 70 : 48)) }}>
        {Array.from({ length: count }, (_, index) => <div className="histogram-pair" key={index}>
          <div className="histogram-pair-bars">
            {[...(previous ? [previous.buckets[index]] : []), buckets[index]].map((b, side) => b ? <button type="button" className={`histogram-column ${previous && side === 0 ? "previous-column" : "current-column"}`} key={side} aria-label={`${previous && side === 0 ? "Сравнение, " : ""}${b.key}: ${money(b.total, currency)}, операций: ${b.count}`}
              aria-pressed={active === index} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} onClick={() => setActive(index)}>
              <span className="histogram-track">{stack(b)}</span>
            </button> : <span className="histogram-missing" key={side} aria-label="Нет соответствующей даты" />)}
          </div>
          <span className="histogram-label">{previous && <small>{label(previous.buckets[index])}</small>}{label(buckets[index])}</span>
        </div>)}
      </div>
    </div>
    </div>
  </section>;
}

export default function Analytics({ state }: { state: State }) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [expanded, setExpanded] = useState<string[]>([]);
  const title = kind === "income" ? "Доходы" : "Расходы";
  const noun = kind === "income" ? "доходов" : "расходов";
  const currentMonth = today().slice(0, 7);
  const [range, setRange] = useState<DateRange>(() => monthRange(currentMonth));
  const [grain, setGrain] = useState<Grain>("day");
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [account, setAccount] = useState("all");
  const [currency, setCurrency] = useState("RUB");
  const [compare, setCompare] = useState("month");
  const [custom, setCustom] = useState<DateRange>(() => shiftRange(monthRange(currentMonth), -1));
  const categories = state.categories.filter((c) => c.kind === kind);
  const selected = categories.filter((c) => chosen === null || chosen.includes(c.id));
  const ids = selected.map((c) => c.id);
  const displayCurrency = Object.hasOwn(state.rates, currency) ? currency : "RUB";
  let report: ReturnType<typeof expenseReport> | undefined;
  let previous: ReturnType<typeof expenseReport> | undefined;
  let reference = custom;
  let error = "";
  try {
    report = expenseReport(state, range, grain, ids, account, displayCurrency, kind);
    if (compare !== "none") {
      reference = compare === "custom" ? custom : shiftRange(range, compare === "year" ? -12 : -1);
      previous = expenseReport(state, reference, grain, ids, account, displayCurrency, kind);
    }
  } catch (e) { error = e instanceof Error ? e.message : "Проверьте период."; }
  const max = Math.max(0, ...(report?.buckets.map((b) => b.total) ?? []), ...(previous?.buckets.map((b) => b.total) ?? []));
  function toggle(id: string) {
    setChosen(ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id]);
  }
  return <div className="analytics-page">
    <section className="panel analytics-filters" aria-label="Фильтры аналитики">
      <div className="analytics-fields">
        <label>Тип операций<select value={kind} onChange={(e) => { setKind(e.target.value as "expense" | "income"); setChosen(null); setExpanded([]); }}><option value="expense">Расходы</option><option value="income">Доходы</option></select></label>
        <label>Месяц целиком<input type="month" value={validRange(range) && range.start.endsWith("-01") && range.end === monthRange(range.start.slice(0, 7)).end ? range.start.slice(0, 7) : ""} onChange={(e) => e.target.value && setRange(monthRange(e.target.value))} /></label>
        <label>Начало периода<input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} /></label>
        <label>Конец периода<input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} /></label>
        <label>Разрез<select value={grain} onChange={(e) => setGrain(e.target.value as Grain)}><option value="day">Дни</option><option value="month">Месяцы</option><option value="year">Годы</option></select></label>
        <label>Счёт аналитики<select value={account} onChange={(e) => setAccount(e.target.value)}><option value="all">Все счета</option>{state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label>
        <label>Валюта аналитики<select value={displayCurrency} onChange={(e) => setCurrency(e.target.value)}>{Object.keys(state.rates).map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>
      <div className="analytics-presets">
        <button onClick={() => setRange(monthRange(currentMonth))}>Этот месяц</button>
        <button onClick={() => { setRange({ start: today().slice(0, 4) + "-01-01", end: today().slice(0, 4) + "-12-31" }); setGrain("month"); }}>Этот год</button>
        <small>Даты без записанных операций показаны нулевыми столбцами. Прогноз не рассчитывается.</small>
      </div>
      <fieldset className="analytics-categories"><legend>Категории {noun} · {ids.length} из {categories.length}</legend>
        <div className="analytics-presets"><button type="button" onClick={() => setChosen(null)}>Все категории</button><button type="button" onClick={() => setChosen([])}>Снять выбор</button></div>
        <div className="analytics-category-list">{categories.map((c) => { const Icon = categoryIcons[c.icon] ?? categoryIcons.other; return <label key={c.id} className={ids.includes(c.id) ? "checked" : ""}>
          <input type="checkbox" checked={ids.includes(c.id)} onChange={() => toggle(c.id)} /><Icon size={18} style={{ color: c.color }} />{c.name}
        </label>; })}</div>
      </fieldset>
      <div className="analytics-fields">
        <label>Сравнение<select value={compare} onChange={(e) => setCompare(e.target.value)}><option value="none">Без сравнения</option><option value="month">С месяцем ранее</option><option value="year">С годом ранее</option><option value="custom">Другой период</option></select></label>
        {compare === "custom" && <><label>Начало сравнения<input type="date" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} /></label><label>Конец сравнения<input type="date" value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} /></label></>}
      </div>
      <p className="help">{title}. Переводы и начальные остатки не учитываются. Все суммы, включая прошлые периоды, рассчитаны по текущим курсам.</p>
    </section>
    {error ? <p role="alert" className="alert">{error}</p> : report && <>
      {!ids.length && <p role="status" className="notice">Выберите хотя бы одну категорию.</p>}
      <div className="analytics-metrics">
        <section className="panel"><small>Всего {noun}</small><strong data-testid="analytics-total">{money(report.total, displayCurrency)}</strong><small>{rangeText(range)}</small></section>
        <section className="panel"><small>Операций</small><strong>{report.count}</strong><small>Дней с операциями: {report.activeDays} из {report.days}</small></section>
        <section className="panel"><small>Средняя операция</small><strong>{money(report.average, displayCurrency)}</strong><small>В день: {money(Math.round(report.total / report.days), displayCurrency)}</small></section>
      </div>
      {!report.count && <p className="notice"><BarChart3 size={18} /> За выбранный период {noun} нет.</p>}
      <Histogram key={`${kind}-${range.start}-${range.end}-${reference.start}-${reference.end}-${grain}-${compare}`} report={report} previous={previous} range={range} reference={reference} categories={selected} currency={displayCurrency} max={max} kind={kind} />
      <section className="panel"><h2>По категориям</h2><div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Категория</th>{previous && <th>Период сравнения</th>}<th>{title} · текущий период</th><th>Операций</th>{previous && <th>Изменение</th>}</tr></thead><tbody>
        {selected.map((c) => {
          const current = report.categories[c.id] ?? { total: 0, count: 0, entries: [] }, before = previous?.categories[c.id]?.total ?? 0;
          const open = expanded.includes(c.id);
          return <Fragment key={c.id}><tr><th scope="row"><button type="button" className="category-toggle" aria-expanded={open} aria-controls={"category-details-" + c.id} onClick={() => setExpanded(open ? expanded.filter((id) => id !== c.id) : [...expanded, c.id])}><span aria-hidden="true">{open ? "▾" : "▸"}</span><i style={{ background: c.color }} />{c.name}</button></th>{previous && <td>{money(before, displayCurrency)}</td>}<td>{money(current.total, displayCurrency)}</td><td>{current.count}</td>{previous && <td>{changeText(current.total, before, displayCurrency, kind)}</td>}</tr>
            <tr hidden={!open} id={"category-details-" + c.id}><td colSpan={previous ? 5 : 3} className="category-details">
              {open && <div className="category-periods">{[...(previous ? [{ label: "Период сравнения", data: previous.categories[c.id] }] : []), { label: "Текущий период", data: current }].map(({ label, data }) => <section key={label}><h3>{label}</h3>{!data?.count ? <p>Операций нет.</p> : <ul className="category-entries">{[...data.entries].sort((a, b) => b.entry.date.localeCompare(a.entry.date)).map(({ entry, amount }) => {
                const source = state.accounts.find((a) => a.id === entry.accountId)!;
                return <li key={entry.id}><time dateTime={entry.date}>{entry.date.split("-").reverse().join(".")}</time><span>{source.name}<small>{entry.note || "Без заметки"}</small></span><span><b>{money(amount, displayCurrency)}</b>{source.currency !== displayCurrency && <small>{money(entry.amount, source.currency)}</small>}</span></li>;
              })}</ul>}</section>)}</div>}
            </td></tr></Fragment>;
        })}
      </tbody></table></div></section>
    </>}
  </div>;
}
