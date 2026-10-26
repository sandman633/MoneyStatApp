import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Plus,
  Minus,
  Wallet,
  ChartPie,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  ShoppingBasket,
  House,
  Car,
  Heart,
  ShoppingBag,
  PartyPopper,
  Phone,
  BookOpen,
  BriefcaseBusiness,
  TrendingUp,
  Gift,
  Shapes,
  Trash2,
  Download,
  Upload,
  Check,
  Leaf,
  type LucideIcon,
} from "lucide-react";
import {
  balance,
  id,
  money,
  rub,
  today,
  totals,
  type State,
  type Kind,
  type Entry,
  type Category,
} from "./model";
import { load, change, restore } from "./store";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
const icons: Record<string, LucideIcon> = {
  food: ShoppingBasket,
  home: House,
  car: Car,
  health: Heart,
  bag: ShoppingBag,
  fun: PartyPopper,
  phone: Phone,
  book: BookOpen,
  work: BriefcaseBusiness,
  chart: TrendingUp,
  gift: Gift,
  other: Shapes,
};
const fmt = (n: number, c = "RUB") =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 2,
  }).format(n / 100);
const monthName = (value: string) =>
  new Date(value + "-02T12:00:00").toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
function Symbol({ category }: { category?: Category }) {
  const Icon = icons[category?.icon ?? "other"] ?? Shapes;
  return <Icon size={22} />;
}
type Modal = Kind | "account" | "category" | null;
export default function App() {
  const [s, setS] = useState<State | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("overview"),
    [modal, setModal] = useState<Modal>(null),
    [month, setMonth] = useState(today().slice(0, 7)),
    [account, setAccount] = useState("all"),
    [category, setCategory] = useState("all"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    load()
      .then(setS)
      .catch(() =>
        setError(
          "Не удалось открыть локальную базу. Проверьте разрешение на хранение данных и перезапустите приложение.",
        ),
      );
  }, []);
  async function mutate(fn: (state: State) => void) {
    setBusy(true);
    setError("");
    try {
      setS(await change(fn));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function shift(n: number) {
    const d = new Date(month + "-02T12:00:00");
    d.setMonth(d.getMonth() + n);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  if (!s)
    return (
      <main className="loading">
        <Leaf size={36} />
        <h1>MoneyStat</h1>
        <p>{error || "Открываем ваши финансы…"}</p>
      </main>
    );
  const state = s;
  const filtered = s.entries.filter(
    (e) =>
      e.date.startsWith(month) &&
      (account === "all" || e.accountId === account || e.toId === account),
  );
  const total = totals(s, filtered),
    net = s.accounts
      .filter((a) => account === "all" || a.id === account)
      .reduce((sum, a) => sum + rub(s, balance(s, a), a.currency), 0);
  const groups = s.categories
    .filter((c) => c.kind === "expense")
    .map((c) => ({
      c,
      value: totals(
        s,
        filtered.filter((e) => e.categoryId === c.id),
      ).expense,
    }))
    .filter((g) => g.value > 0)
    .sort((a, b) => b.value - a.value);
  let cumulative = 0;
  const gradient = groups
    .map((g) => {
      const start = cumulative;
      cumulative += (g.value / total.expense) * 100;
      return `${g.c.color} ${start}% ${cumulative}%`;
    })
    .join(",");
  const visible = filtered
    .filter((e) => category === "all" || e.categoryId === category)
    .sort((a, b) => b.date.localeCompare(a.date));
  function open(m: Modal) {
    setError("");
    setModal(m);
  }
  async function remove(e: Entry) {
    if (confirm("Удалить операцию? Балансы счетов будут пересчитаны."))
      await mutate((st) => {
        st.entries = st.entries.filter((x) => x.id !== e.id);
      });
  }
  async function backup() {
    try {
      const data = JSON.stringify(state, null, 2),
        name = `moneystat-${today()}.json`;
      if (Capacitor.isNativePlatform()) {
        const file = await Filesystem.writeFile({
          path: name,
          data,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: "Резервная копия MoneyStat",
          url: file.uri,
        });
      } else {
        const blob = new Blob([data], { type: "application/json" }),
          url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setNotice(
        "Резервная копия подготовлена. Сохраните файл в безопасном месте.",
      );
    } catch {
      setError("Не удалось экспортировать копию. Попробуйте ещё раз.");
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw Error("Файл больше 10 МБ.");
      const value = JSON.parse(await file.text());
      if (
        !confirm(
          "Заменить все текущие данные резервной копией? Сначала сохраните экспорт.",
        )
      )
        return;
      setS(await restore(value));
      setAccount("all");
      setCategory("all");
      setNotice("Резервная копия восстановлена.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось прочитать файл.");
    }
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span>
            <Leaf size={23} />
          </span>
          MoneyStat<span className="brand-dot">.</span>
        </a>
        <div className="sidebar-label">ЛИЧНЫЕ ФИНАНСЫ</div>
        <nav>
          {[
            ["overview", "Обзор", ChartPie],
            ["accounts", "Счета", Wallet],
            ["settings", "Настройки", Settings],
          ].map(([key, label, Icon]) => {
            const I = Icon as LucideIcon;
            return (
              <button
                key={key as string}
                className={tab === key ? "active" : ""}
                onClick={() => setTab(key as string)}
              >
                <I size={21} />
                <span>{label as string}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <span className="offline-dot" /> Всё хранится на устройстве
          <p>Ваши деньги. Ваша ясность.</p>
        </div>
      </aside>
      <main className="main">
        <header>
          <div>
            <div className="eyebrow">ВАШ ФИНАНСОВЫЙ ДНЕВНИК</div>
            <h1>
              {tab === "overview"
                ? "Деньги под контролем"
                : tab === "accounts"
                  ? "Мои счета"
                  : "Всё по-вашему"}
            </h1>
            <p className="subtitle">
              {tab === "overview"
                ? "Маленькие привычки. Большие возможности."
                : tab === "accounts"
                  ? "Каждому счёту — своя валюта."
                  : "Категории, курсы и резервные копии."}
            </p>
          </div>
          <span className="local-badge">
            <span className="offline-dot" /> Локально
          </span>
        </header>
        {error && (
          <div role="alert" className="alert">
            {error}
            <button aria-label="Закрыть ошибку" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            {notice}
            <button
              aria-label="Закрыть уведомление"
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {tab === "overview" && (
          <>
            <section className="toolbar">
              <div className="period">
                <button aria-label="Предыдущий месяц" onClick={() => shift(-1)}>
                  <ChevronLeft size={20} />
                </button>
                <label>
                  <span className="sr-only">Месяц</span>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => e.target.value && setMonth(e.target.value)}
                  />
                </label>
                <button aria-label="Следующий месяц" onClick={() => shift(1)}>
                  <ChevronRight size={20} />
                </button>
              </div>
              <select
                aria-label="Фильтр счетов"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="all">Все счета</option>
                {s.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </option>
                ))}
              </select>
            </section>
            <section className="summary">
              <div className="balance-card">
                <div className="eyebrow">ОБЩИЙ БАЛАНС СЕЙЧАС</div>
                <strong>{fmt(net)}</strong>
                <span>
                  {account === "all"
                    ? `${s.accounts.length} счёт(а)`
                    : "Выбранный счёт"}{" "}
                  · в рублях по текущему курсу
                </span>
                <Wallet className="watermark" size={100} />
              </div>
              <div className="stat-card">
                <span className="stat-icon income">
                  <ArrowDownLeft />
                </span>
                <div>
                  <p>Доходы за месяц</p>
                  <strong className="green">{fmt(total.income)}</strong>
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-icon expense">
                  <ArrowUpRight />
                </span>
                <div>
                  <p>Расходы за месяц</p>
                  <strong>{fmt(total.expense)}</strong>
                </div>
              </div>
            </section>
            <section className="overview-grid">
              <div className="panel chart-panel">
                <div className="panel-heading">
                  <h2>Куда уходят деньги</h2>
                  <span>РАСХОДЫ</span>
                </div>
                <div className="chart-content">
                  <div
                    className="donut"
                    style={{
                      background: gradient
                        ? `conic-gradient(${gradient})`
                        : "#e7eee7",
                    }}
                  >
                    <div className="donut-hole">
                      <span>За {monthName(month).split(" ")[0]}</span>
                      <strong>{fmt(total.expense)}</strong>
                      <small>
                        {groups.length
                          ? `${groups.length} категорий`
                          : "Начните с первой записи"}
                      </small>
                    </div>
                  </div>
                  <div className="legend">
                    {groups.length ? (
                      groups.map((g) => (
                        <button
                          key={g.c.id}
                          className={category === g.c.id ? "selected" : ""}
                          onClick={() =>
                            setCategory(category === g.c.id ? "all" : g.c.id)
                          }
                        >
                          <span
                            className="category-icon"
                            style={{
                              color: g.c.color,
                              background: g.c.color + "18",
                            }}
                          >
                            <Symbol category={g.c} />
                          </span>
                          <span className="legend-name">
                            {g.c.name}
                            <small>
                              {Math.round((g.value / total.expense) * 100)}%
                              расходов
                            </small>
                          </span>
                          <b>{fmt(g.value)}</b>
                        </button>
                      ))
                    ) : (
                      <div className="empty">
                        <ShoppingBasket size={32} />
                        <h3>Пока всё спокойно</h3>
                        <p>
                          Добавьте расход, и здесь появится
                          <br />
                          наглядная картина ваших трат.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="actions">
                  <button
                    className="expense-button"
                    onClick={() => open("expense")}
                  >
                    <Minus size={22} /> Расход
                  </button>
                  <button
                    className="income-button"
                    onClick={() => open("income")}
                  >
                    <Plus size={22} /> Доход
                  </button>
                  <button
                    className="transfer-button"
                    onClick={() => open("transfer")}
                    title="Перевод между счетами"
                  >
                    <ArrowLeftRight size={20} />
                    <span>Перевод</span>
                  </button>
                </div>
              </div>
              <div className="panel accounts-preview">
                <div className="panel-heading">
                  <h2>Мои счета</h2>
                  <button
                    aria-label="Добавить счёт"
                    onClick={() => open("account")}
                  >
                    <Plus size={20} />
                  </button>
                </div>
                {s.accounts.map((a) => (
                  <div className="account-mini" key={a.id}>
                    <span className="account-symbol">
                      <Wallet size={20} />
                    </span>
                    <div>
                      <b>{a.name}</b>
                      <small>{a.currency}</small>
                    </div>
                    <strong>{fmt(balance(s, a), a.currency)}</strong>
                  </div>
                ))}
                <button
                  className="text-button"
                  onClick={() => setTab("accounts")}
                >
                  Управлять счетами <ArrowUpRight size={16} />
                </button>
                <div className="tip">
                  <Leaf size={22} />
                  <p>
                    Ясность начинается с малого.
                    <br />
                    <b>Запишите сегодняшние расходы.</b>
                  </p>
                </div>
              </div>
            </section>
            <section className="panel history">
              <div className="panel-heading">
                <h2>
                  История операций{" "}
                  <span className="count">{visible.length}</span>
                </h2>
                <select
                  aria-label="Фильтр категорий"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">Все категории</option>
                  {s.categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {visible.length ? (
                visible.map((e) => {
                  const a = s.accounts.find((a) => a.id === e.accountId)!,
                    c = s.categories.find((c) => c.id === e.categoryId),
                    to = s.accounts.find((a) => a.id === e.toId);
                  return (
                    <div className="entry" key={e.id}>
                      <span
                        className="category-icon"
                        style={{
                          color: c?.color ?? "#609a84",
                          background: (c?.color ?? "#609a84") + "18",
                        }}
                      >
                        {e.kind === "transfer" ? (
                          <ArrowLeftRight size={22} />
                        ) : (
                          <Symbol category={c} />
                        )}
                      </span>
                      <div className="entry-name">
                        <b>{e.kind === "transfer" ? "Перевод" : c?.name}</b>
                        <small>
                          {a.name}
                          {to ? ` → ${to.name}` : ""}
                          {e.note ? ` · ${e.note}` : ""}
                        </small>
                      </div>
                      <time dateTime={e.date}>
                        {new Date(e.date + "T12:00:00").toLocaleDateString(
                          "ru-RU",
                          { day: "numeric", month: "short" },
                        )}
                      </time>
                      <div
                        className={
                          "entry-amount " + (e.kind === "income" ? "green" : "")
                        }
                      >
                        <b>
                          {e.kind === "income"
                            ? "+"
                            : e.kind === "expense"
                              ? "−"
                              : ""}
                          {fmt(e.amount, a.currency)}
                        </b>
                        {to && <small>→ {fmt(e.received!, to.currency)}</small>}
                      </div>
                      <button
                        className="delete"
                        aria-label="Удалить операцию"
                        onClick={() => remove(e)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="history-empty">
                  Здесь будет ваша история.
                  <span>Добавьте операцию или выберите другой месяц.</span>
                </div>
              )}
            </section>
          </>
        )}
        {tab === "accounts" && (
          <>
            <div className="section-actions">
              <button className="primary" onClick={() => open("account")}>
                <Plus size={18} /> Новый счёт
              </button>
              <button onClick={() => open("transfer")}>
                <ArrowLeftRight size={18} /> Перевод
              </button>
            </div>
            <div className="account-grid">
              {s.accounts.map((a) => (
                <section className="panel account-card" key={a.id}>
                  <Wallet />
                  <span className="currency-tag">{a.currency}</span>
                  <h2>{a.name}</h2>
                  <strong>{fmt(balance(s, a), a.currency)}</strong>
                  <p>Начальный баланс: {fmt(a.opening, a.currency)}</p>
                  <small>
                    В сводке: {fmt(rub(s, balance(s, a), a.currency))}
                  </small>
                </section>
              ))}
            </div>
          </>
        )}
        {tab === "settings" && (
          <div className="settings-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Курсы валют</h2>
                <span>БАЗА: RUB</span>
              </div>
              <p className="help">
                Стоимость одной единицы валюты в рублях. Начальные USD 90 и EUR
                100 — условные: установите свои курсы. Сводка пересчитывается по
                текущим курсам; суммы операций не меняются.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget),
                    code = String(f.get("currency")).trim().toUpperCase(),
                    rate = Number(String(f.get("rate")).replace(",", "."));
                  if (
                    !/^[A-Z]{3}$/.test(code) ||
                    code === "RUB" ||
                    !Number.isFinite(rate) ||
                    rate <= 0 ||
                    rate > 1e6
                  ) {
                    setError(
                      "Укажите трёхбуквенный код валюты (кроме RUB) и положительный курс до 1 000 000.",
                    );
                    return;
                  }
                  if (
                    await mutate((st) => {
                      st.rates[code] = rate;
                    })
                  )
                    setNotice("Курс сохранён.");
                }}
              >
                <div className="rate-list">
                  {Object.entries(s.rates).map(([code, rate]) => (
                    <div key={code}>
                      <b>{code}</b>
                      <span>{rate.toLocaleString("ru-RU")} ₽</span>
                    </div>
                  ))}
                </div>
                <div className="form-row">
                  <label>
                    Код валюты
                    <input
                      name="currency"
                      placeholder="USD"
                      required
                      maxLength={3}
                    />
                  </label>
                  <label>
                    Курс к рублю
                    <input
                      name="rate"
                      placeholder="90,00"
                      inputMode="decimal"
                      required
                    />
                  </label>
                </div>
                <button className="primary" disabled={busy}>
                  Сохранить курс
                </button>
              </form>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Резервная копия</h2>
                <Download size={20} />
              </div>
              <p className="help">
                Данные хранятся только на этом устройстве. Сохраняйте копию
                перед переустановкой приложения. Файл содержит все счета,
                операции, категории и курсы без шифрования.
              </p>
              <div className="backup-buttons">
                <button onClick={backup}>
                  <Download size={18} /> Экспорт JSON
                </button>
                <label className="file-button">
                  <Upload size={18} /> Восстановить
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      void importFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="help">
                Синхронизации и авторизации нет. На Windows и Android ведутся
                независимые базы.
              </p>
            </section>
            <section className="panel categories-panel">
              <div className="panel-heading">
                <h2>Ваши категории</h2>
                <button onClick={() => open("category")}>
                  <Plus size={18} /> Добавить
                </button>
              </div>
              {(["expense", "income"] as const).map((kind) => (
                <div key={kind}>
                  <h3 className="eyebrow">
                    {kind === "expense" ? "РАСХОДЫ" : "ДОХОДЫ"}
                  </h3>
                  <div className="category-chips">
                    {s.categories
                      .filter((c) => c.kind === kind)
                      .map((c) => (
                        <span key={c.id} style={{ color: c.color }}>
                          <Symbol category={c} />
                          {c.name}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}
        <footer>
          MoneyStat <span>Место для спокойных финансов</span>
        </footer>
      </main>
      {modal && (
        <Editor
          kind={modal}
          state={s}
          busy={busy}
          error={error}
          close={() => setModal(null)}
          save={async (fn) => {
            if (await mutate(fn)) setModal(null);
          }}
        />
      )}
    </div>
  );
}
function Editor({
  kind,
  state,
  busy,
  error,
  close,
  save,
}: {
  kind: Exclude<Modal, null>;
  state: State;
  busy: boolean;
  error: string;
  close: () => void;
  save: (fn: (s: State) => void) => Promise<void>;
}) {
  const [from, setFrom] = useState(state.accounts[0].id),
    [to, setTo] = useState(state.accounts[1]?.id ?? ""),
    [amount, setAmount] = useState(""),
    [catKind, setCatKind] = useState<"expense" | "income">("expense"),
    [cat, setCat] = useState(
      state.categories.find((c) => c.kind === kind)?.id ?? "",
    ),
    [localError, setLocalError] = useState("");
  const source = state.accounts.find((a) => a.id === from)!,
    target = state.accounts.find((a) => a.id === to),
    cross = kind === "transfer" && target?.currency !== source.currency;
  let suggested = "";
  try {
    if (target)
      suggested = (
        Math.round(
          (money(amount) * state.rates[source.currency]) /
            state.rates[target.currency],
        ) / 100
      ).toFixed(2);
  } catch {
    /* Waiting for a valid amount. */
  }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const dialog = document.querySelector("dialog");
    dialog?.showModal();
    return () => previous?.focus();
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError("");
    const f = new FormData(e.currentTarget);
    try {
      if (kind === "account") {
        const a = {
          id: id(),
          name: String(f.get("name")).trim(),
          currency: String(f.get("currency")),
          opening: money(String(f.get("opening")), true),
        };
        await save((s) => {
          s.accounts.push(a);
        });
      } else if (kind === "category") {
        const c: Category = {
          id: id(),
          name: String(f.get("name")).trim(),
          kind: catKind,
          color: String(f.get("color")),
          icon: String(f.get("icon")),
        };
        await save((s) => {
          if (
            s.categories.some(
              (x) =>
                x.kind === c.kind &&
                x.name.toLowerCase() === c.name.toLowerCase(),
            )
          )
            throw Error("Такая категория уже есть.");
          s.categories.push(c);
        });
      } else {
        const entry: Entry = {
          id: id(),
          kind,
          accountId: from,
          amount: money(amount),
          date: String(f.get("date")),
          note: String(f.get("note")).trim(),
          ...(kind === "transfer"
            ? {
                toId: to,
                received: cross
                  ? money(String(f.get("received")))
                  : money(amount),
              }
            : { categoryId: cat }),
        };
        await save((s) => {
          s.entries.push(entry);
        });
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Проверьте поля.");
    }
  }
  const titles = {
    expense: "Новый расход",
    income: "Новый доход",
    transfer: "Перевод между счетами",
    account: "Новый счёт",
    category: "Новая категория",
  };
  return (
    <dialog
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="modal-heading">
        <div>
          <div className="eyebrow">MONEYSTAT</div>
          <h2>{titles[kind]}</h2>
        </div>
        <button
          type="button"
          disabled={busy}
          aria-label="Закрыть"
          onClick={close}
        >
          <X />
        </button>
      </div>
      <form onSubmit={submit}>
        {(localError || error) && (
          <p className="alert" role="alert">
            {localError || error}
          </p>
        )}
        {kind === "account" ? (
          <>
            <label>
              Название счёта
              <input
                name="name"
                placeholder="Например, Карта для покупок"
                required
                maxLength={80}
                autoFocus
              />
            </label>
            <label>
              Валюта
              <select name="currency" aria-label="Валюта">
                {Object.keys(state.rates).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <p className="help">
              Новые валюты добавляются в настройках курсов. Валюта счёта
              фиксируется при создании.
            </p>
            <label>
              Начальный баланс
              <input
                name="opening"
                defaultValue="0"
                inputMode="decimal"
                required
              />
            </label>
          </>
        ) : kind === "category" ? (
          <>
            <label>
              Название
              <input name="name" required maxLength={80} autoFocus />
            </label>
            <label>
              Тип
              <select
                value={catKind}
                onChange={(e) => setCatKind(e.target.value as typeof catKind)}
              >
                <option value="expense">Расход</option>
                <option value="income">Доход</option>
              </select>
            </label>
            <div className="form-row">
              <label>
                Цвет
                <input type="color" name="color" defaultValue="#65a88c" />
              </label>
              <label>
                Иконка
                <select name="icon">
                  {Object.keys(icons).map((key, i) => (
                    <option key={key} value={key}>
                      {
                        [
                          "Еда",
                          "Дом",
                          "Транспорт",
                          "Здоровье",
                          "Покупки",
                          "Досуг",
                          "Связь",
                          "Учёба",
                          "Работа",
                          "Инвестиции",
                          "Подарки",
                          "Другое",
                        ][i]
                      }
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        ) : (
          <>
            <label className="amount-input">
              Сумма · {source.currency}
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                required
                autoFocus
              />
            </label>
            <label>
              {kind === "transfer" ? "Со счёта" : "Счёт"}
              <select value={from} onChange={(e) => setFrom(e.target.value)}>
                {state.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </option>
                ))}
              </select>
            </label>
            {kind === "transfer" ? (
              <>
                <label>
                  На счёт
                  <select
                    required
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  >
                    <option value="" disabled>
                      Выберите счёт
                    </option>
                    {state.accounts
                      .filter((a) => a.id !== from)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.currency}
                        </option>
                      ))}
                  </select>
                </label>
                {state.accounts.length < 2 && (
                  <p className="help">Для перевода создайте второй счёт.</p>
                )}
                {cross && target && (
                  <label>
                    Зачислить · {target.currency}
                    <input
                      key={`${suggested}-${to}`}
                      name="received"
                      defaultValue={suggested}
                      inputMode="decimal"
                      required
                    />
                    <small>
                      По текущему курсу: {suggested || "—"}. Можно изменить
                      вручную.
                    </small>
                  </label>
                )}
                <p className="help">
                  Перевод изменит два баланса и не попадёт в доходы или расходы.
                </p>
              </>
            ) : (
              <fieldset>
                <legend>Категория</legend>
                <div className="category-picker">
                  {state.categories
                    .filter((c) => c.kind === kind)
                    .map((c) => (
                      <button
                        type="button"
                        className={cat === c.id ? "chosen" : ""}
                        key={c.id}
                        onClick={() => setCat(c.id)}
                        aria-pressed={cat === c.id}
                      >
                        <span style={{ color: c.color }}>
                          <Symbol category={c} />
                        </span>
                        {c.name}
                      </button>
                    ))}
                </div>
              </fieldset>
            )}
            <div className="form-row">
              <label>
                Дата
                <input
                  name="date"
                  type="date"
                  defaultValue={today()}
                  required
                />
              </label>
              <label>
                Заметка
                <input
                  name="note"
                  placeholder="Необязательно"
                  maxLength={300}
                />
              </label>
            </div>
          </>
        )}
        <button
          className="primary submit"
          disabled={busy || (kind === "transfer" && state.accounts.length < 2)}
        >
          <Check size={19} />
          {busy ? "Сохраняем…" : "Сохранить"}
        </button>
      </form>
    </dialog>
  );
}
