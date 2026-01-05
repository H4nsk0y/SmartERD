import React, { useMemo, useState } from "react";

type TabId = "theory" | "normalization" | "tasks" | "literature" | "guide";

const TABS: Array<{ id: TabId; title: string; subtitle: string; icon: React.ReactNode }> = [
  { id: "theory", title: "Теория", subtitle: "ER-модель, ключи, связи", icon: "📚" },
  { id: "normalization", title: "Нормализация", subtitle: "1НФ → 3НФ → BCNF", icon: "🧼" },
  { id: "tasks", title: "Задачи", subtitle: "Тренажёр + ответы", icon: "🧩" },
  { id: "literature", title: "Литература", subtitle: "Книги, статьи, доки", icon: "🔗" },
  { id: "guide", title: "Руководство", subtitle: "Как пользоваться SmartERD", icon: "🧭" },
];

function cx(...s: Array<string | false | undefined | null>) {
  return s.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone = "indigo",
}: {
  children: React.ReactNode;
  tone?: "indigo" | "gray" | "green" | "amber";
}) {
  const cls =
    tone === "indigo"
      ? "bg-indigo-600/10 text-indigo-700 dark:text-indigo-200 border-indigo-600/20"
      : tone === "green"
      ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-200 border-emerald-600/20"
      : tone === "amber"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-200 border-amber-500/20"
      : "bg-gray-500/10 text-gray-700 dark:text-gray-200 border-gray-500/20";

  return (
    <span className={cx("inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs", cls)}>
      {children}
    </span>
  );
}

function Card({
  title,
  desc,
  children,
  right,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white/85 dark:bg-gray-900/70 border border-gray-200/70 dark:border-gray-700/60 shadow-lg backdrop-blur px-6 py-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            {right}
          </div>
          {desc && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{desc}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-gray-200/80 dark:bg-gray-700/60 my-4" />;
}

function Reveal({
  title,
  children,
  defaultOpen = false,
  hint,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  hint?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white/60 dark:bg-gray-900/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
      >
        <div className="text-left">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</div>
          {hint && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</div>}
        </div>
        <span
          className={cx(
            "text-gray-500 dark:text-gray-300 transition-transform duration-200",
            open && "rotate-180"
          )}
        >
          ▾
        </span>
      </button>

      <div
        className={cx(
          "px-4 overflow-hidden transition-[max-height] duration-300 ease-out",
          open ? "max-h-[900px]" : "max-h-0"
        )}
      >
        <div className={cx("pb-4 text-sm text-gray-800 dark:text-gray-200", open && "animate-fadeIn")}>
          {children}
        </div>
      </div>
    </div>
  );
}

function KbLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group block rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-4 py-3 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:underline">
            {title}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">{desc}</div>
        </div>
        <div className="text-gray-400 group-hover:text-indigo-500 transition">↗</div>
      </div>
    </a>
  );
}

export default function KnowledgeBasePage() {
  const [tab, setTab] = useState<TabId>("theory");
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();

  const filteredTabs = useMemo(() => {
    if (!query) return null;
    // “поиск по базе” — простая подсказка: куда лучше пойти по ключевым словам
    const hints: Array<{ when: string[]; go: TabId; label: string }> = [
      { when: ["1нф", "2нф", "3нф", "bcnf", "нормал"], go: "normalization", label: "Нормализация" },
      { when: ["ключ", "pk", "первич"], go: "theory", label: "Ключи и PK" },
      { when: ["sql", "ddl", "fk", "внешн"], go: "theory", label: "Связи и ключи (PK/FK)" },
      { when: ["задач", "тест", "квиз"], go: "tasks", label: "Задачи" },
      { when: ["как", "инструк", "гайд", "пользоват"], go: "guide", label: "Руководство" },
    ];

    const best = hints.find((h) => h.when.some((w) => query.includes(w)));
    return best ?? null;
  }, [query]);

  return (
    <div className="w-full h-full min-h-0 overflow-y-auto px-4 py-6">
      {/* HERO */}
      <div className="max-w-6xl mx-auto">
        <div className="rounded-[28px] border border-indigo-200/70 dark:border-indigo-500/30 bg-white/70 dark:bg-gray-900/50 shadow-xl backdrop-blur p-6 sm:p-8 animate-fadeIn">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-indigo-700 dark:text-indigo-200">
                  База знаний SmartERD
                </h1>
                <Pill tone="indigo">теория + практика</Pill>
                <Pill tone="green">мини-тренажёр</Pill>
                <Pill tone="amber">гайд по приложению</Pill>
              </div>
              <p className="mt-3 text-gray-700 dark:text-gray-300 max-w-2xl">
                Здесь собрано практически все, что нужно для работы со SmartERD: ключи, связи, нормальные формы, типовые ошибки,
                задачи с ответами и руководство пользователя по SmartERD.
              </p>
            </div>

            {/* Search */}
            <div className="w-full sm:w-[360px]">
              <label className="text-xs text-gray-500 dark:text-gray-400">Поиск по базе</label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/40 px-3 py-2">
                <span className="text-gray-400">⌕</span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Напр.: 3НФ, первичный ключ, FK, гайд…"
                  className="w-full bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                    title="Очистить"
                  >
                    ✕
                  </button>
                )}
              </div>

              {filteredTabs && (
                <button
                  type="button"
                  onClick={() => setTab(filteredTabs.go)}
                  className="mt-2 w-full text-left text-xs rounded-xl border border-indigo-200/70 dark:border-indigo-500/30 bg-indigo-600/10 dark:bg-indigo-500/10 px-3 py-2 hover:bg-indigo-600/15 dark:hover:bg-indigo-500/15 transition"
                >
                  Подсказка: похоже, тебе в раздел <b>{filteredTabs.label}</b> → нажми, чтобы открыть
                </button>
              )}
            </div>
          </div>

          <Divider />

          {/* Tabs */}
          <div className="flex flex-nowrap overflow-x-auto gap-2 pb-1">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cx(
                    "shrink-0 rounded-2xl px-4 py-3 border transition-all",
                    active
                      ? "border-indigo-300 dark:border-indigo-500/40 bg-indigo-600/10 dark:bg-indigo-500/10 shadow"
                      : "border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/30 hover:bg-white/70 dark:hover:bg-gray-900/45"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cx("text-xl", active && "animate-bob")}>{t.icon}</div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.title}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">{t.subtitle}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTENT */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fadeIn">
          {/* Left: main */}
          <div className="lg:col-span-2 space-y-4">
            {tab === "theory" && <TheorySection />}
            {tab === "normalization" && <NormalizationSection />}
            {tab === "tasks" && <TasksSection />}
            {tab === "literature" && <LiteratureSection />}
            {tab === "guide" && <GuideSection />}
          </div>

          {/* Right: sticky tips */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-4 space-y-4">
              <Card
                title="Шпаргалка"
                desc="Ключевые определения и хоткеи для быстрого доступа."
              >
                <ul className="text-sm text-gray-800 dark:text-gray-200 space-y-2">
                  <li>• <b>PK</b> — уникально идентифицирует строку, не NULL.</li>
                  <li>• <b>FK</b> — ссылка на PK/UK другой таблицы.</li>
                  <li>• <b>1НФ</b> — атомарность значений, нет повторяющихся групп.</li>
                  <li>• <b>2НФ</b> — нет частичных зависимостей от части составного PK.</li>
                  <li>• <b>3НФ</b> — нет транзитивных зависимостей от PK.</li>
                </ul>
              </Card>

             

              <Card title="Хоткеи">
                <div className="text-sm text-gray-800 dark:text-gray-200 space-y-2">
                  <p>• <b>Ctrl/⌘ + Z</b> — Undo</p>
                  <p>• <b>Ctrl/⌘ + Y</b> или <b>Ctrl/⌘ + Shift + Z</b> — Redo</p>
                  <p>• <b>Del/Backspace</b> — удалить связь (если включено подтверждение — спросит)</p>
                  <p>• <b>Esc</b> — закрыть/выйти из режимов</p>
                </div>
              </Card>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">
          SmartERD • База знаний — будет расширяться.
        </div>
      </div>
    </div>
  );
}

function TheorySection() {
  return (
    <div className="space-y-4">
      <Card
        title="ER-модель: сущности, атрибуты, связи"
        desc="ER-диаграмма описывает предметную область: кто/что существует, какие свойства имеет и как связано."
      >
        <div className="space-y-3 text-sm text-gray-800 dark:text-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white/60 dark:bg-gray-900/40">
              <div className="font-semibold">Сущность (Entity)</div>
              <div className="text-gray-600 dark:text-gray-300 mt-1">
                Объект предметной области: <i>User</i>, <i>Order</i>, <i>Product</i>.
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white/60 dark:bg-gray-900/40">
              <div className="font-semibold">Атрибут (Attribute)</div>
              <div className="text-gray-600 dark:text-gray-300 mt-1">
                Свойство сущности: <i>email</i>, <i>created_at</i>, <i>price</i>.
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white/60 dark:bg-gray-900/40">
            <div className="font-semibold">Связи (Relationships)</div>
            <ul className="mt-2 space-y-1 text-gray-700 dark:text-gray-300">
              <li>• <b>1:1</b> — один к одному (редко, часто можно объединить таблицы)</li>
              <li>• <b>1:N</b> — один ко многим (самый частый случай)</li>
              <li>• <b>N:M</b> — многие ко многим (реализуется через таблицу-связку)</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card
        title="Ключи: PK, UK, FK"
        desc="Ключи — основа целостности данных и корректных связей."
        right={<Pill tone="indigo">очень важно</Pill>}
      >
        <div className="space-y-3 text-sm text-gray-800 dark:text-gray-200">
          <Reveal title="Первичный ключ (PK)" hint="Как понять, что это PK?">
            <ul className="space-y-1">
              <li>• Уникально идентифицирует запись.</li>
              <li>• Не должен быть NULL.</li>
              <li>• Должен быть стабильным (не меняться “по жизни”).</li>
            </ul>
            <div className="mt-2 text-gray-700 dark:text-gray-300">
              Пример: <b>users(id)</b>, <b>orders(id)</b>, иногда составной: <b>(order_id, product_id)</b>.
            </div>
          </Reveal>

          <Reveal title="Уникальный ключ (UK)" hint="Не PK, но тоже уникальность">
            <p className="text-gray-700 dark:text-gray-300">
              Обеспечивает уникальность значения(й) без роли “главного идентификатора”.
              Пример: <b>users(email)</b>.
            </p>
          </Reveal>

          <Reveal title="Внешний ключ (FK)" hint="Ссылка на другую таблицу">
            <p className="text-gray-700 dark:text-gray-300">
              FK хранит значение PK/UK другой таблицы. Пример: <b>orders.user_id → users.id</b>.
            </p>
            <p className="mt-2 text-gray-700 dark:text-gray-300">
              Важное: FK помогает гарантировать ссылочную целостность (нет “битых” ссылок).
            </p>
          </Reveal>
        </div>
      </Card>
    </div>
  );
}

function NormalizationSection() {
  return (
    <div className="space-y-4">
      <Card
        title="Нормальные формы — цель"
        desc="Снизить дублирование, устранить аномалии вставки/обновления/удаления."
      >
        <div className="text-sm text-gray-800 dark:text-gray-200 space-y-3">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white/60 dark:bg-gray-900/40">
            <div className="font-semibold">Три аномалии</div>
            <ul className="mt-2 space-y-1 text-gray-700 dark:text-gray-300">
              <li>• Аномалия <b>вставки</b> — нельзя добавить факт без лишних данных.</li>
              <li>• Аномалия <b>обновления</b> — одно и то же приходится менять в 5 местах.</li>
              <li>• Аномалия <b>удаления</b> — удаляя одно, случайно теряешь другое.</li>
            </ul>
          </div>

          <Reveal title="1НФ (первая нормальная форма)" hint="Атомарность + нет повторяющихся групп" defaultOpen>
            <ul className="space-y-1 text-gray-700 dark:text-gray-300">
              <li>• Значения в ячейке — <b>атомарные</b> (не списки через запятую).</li>
              <li>• Нет повторяющихся наборов столбцов вида phone1/phone2/phone3.</li>
            </ul>
            <div className="mt-2 text-gray-700 dark:text-gray-300">
              Плохо: <b>phones = “+7…, +7…”</b> → Хорошо: отдельная таблица <b>user_phones</b>.
            </div>
          </Reveal>

          <Reveal title="2НФ" hint="Только для таблиц с составным PK">
            <div className="text-gray-700 dark:text-gray-300 space-y-2">
              <p>
                Нет <b>частичных</b> зависимостей неключевых атрибутов от части составного PK.
              </p>
              <p>
                Пример: PK = <b>(order_id, product_id)</b>, а поле <b>order_date</b> зависит только от
                <b> order_id</b> → выносим в таблицу <b>orders</b>.
              </p>
            </div>
          </Reveal>

          <Reveal title="3НФ" hint="Убираем транзитивные зависимости">
            <div className="text-gray-700 dark:text-gray-300 space-y-2">
              <p>
                Неключевые атрибуты не должны зависеть от других неключевых.
              </p>
              <p>
                Пример: <b>users(city_id, city_name)</b> — city_name зависит от city_id → вынести
                справочник <b>cities</b>.
              </p>
            </div>
          </Reveal>

          <Reveal title="BCNF (усиленная 3НФ)" hint="Строже: любой детерминант — ключ">
            <div className="text-gray-700 dark:text-gray-300 space-y-2">
              <p>
                Если <b>X → Y</b>, то <b>X</b> должен быть суперключом. Часто всплывает в “хитрых” таблицах
                с несколькими кандидатными ключами.
              </p>
            </div>
          </Reveal>
        </div>
      </Card>

      <Card
        title="Практический совет"
        desc="Нормализация — это инструмент. Иногда допустима денормализация ради скорости, но осознанно."
        right={<Pill tone="gray">практика</Pill>}
      >
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Всегда помним: 
          <b> “Сначала проектируем в 3НФ, затем при необходимости денормализуем под нагрузку, сохраняя целостность.”</b>
        </div>
      </Card>
    </div>
  );
}

function TasksSection() {
  return (
    <div className="space-y-4">
      <Card title="Задачи — первичный ключ" desc="Потренируем выбор PK/UK/FK на понятных кейсах.">
        <div className="space-y-3">
          <Reveal title="Задача 1: Пользователи" hint="Выбери лучший PK">
            <p className="text-gray-700 dark:text-gray-300">
              Таблица <b>users</b>: (email, phone, name, created_at). Какой PK выбрать?
            </p>
            <Divider />
            <p className="text-gray-700 dark:text-gray-300">
              <b>Ответ:</b> лучше завести суррогатный PK <b>id</b>, а <b>email</b> сделать UK.
              Email может меняться, а id — стабильный. Phone тоже может меняться/быть пустым.
            </p>
          </Reveal>

          <Reveal title="Задача 2: Заказ и позиции" hint="Как реализовать N:M?">
            <p className="text-gray-700 dark:text-gray-300">
              Есть <b>orders</b> и <b>products</b>. Один заказ содержит много товаров, и товар встречается
              в разных заказах. Как хранить?
            </p>
            <Divider />
            <p className="text-gray-700 dark:text-gray-300">
              <b>Ответ:</b> нужна таблица-связка <b>order_items(order_id FK, product_id FK, qty, price)</b>,
              PK чаще всего составной <b>(order_id, product_id)</b> или суррогатный <b>id</b> + UK на пару.
            </p>
          </Reveal>
        </div>
      </Card>

      <Card title="Задачи — нормальные формы" desc="Короткие кейсы: определить нарушение и исправить.">
        <div className="space-y-3">
          <Reveal title="Задача 3: 1НФ" hint="Где нарушение?">
            <p className="text-gray-700 dark:text-gray-300">
              Таблица <b>customers(id, name, phones)</b>, где phones = “+7..., +7...”.
            </p>
            <Divider />
            <p className="text-gray-700 dark:text-gray-300">
              <b>Ответ:</b> нарушение 1НФ (неатомарность). Решение: <b>customer_phones(customer_id, phone)</b>.
            </p>
          </Reveal>

          <Reveal title="Задача 4: 3НФ" hint="Транзитивная зависимость">
            <p className="text-gray-700 dark:text-gray-300">
              Таблица <b>orders(id, user_id, user_email)</b>. В чём проблема?
            </p>
            <Divider />
            <p className="text-gray-700 dark:text-gray-300">
              <b>Ответ:</b> user_email зависит от user_id (не ключевой → не ключевой), транзитивность.
              user_email должен жить в <b>users</b>, а в orders только <b>user_id</b>.
            </p>
          </Reveal>
        </div>
      </Card>
    </div>
  );
}

function LiteratureSection() {
  return (
    <div className="space-y-4">
      <Card
        title="Книги"
        desc="Классика. Базовые понятия и углублённое понимание."
        right={<Pill tone="gray">классика</Pill>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white/60 dark:bg-gray-900/40">
            <div className="font-semibold text-gray-900 dark:text-gray-100">Elmasri & Navathe</div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
              Fundamentals of Database Systems — ER, нормализация, проектирование.
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white/60 dark:bg-gray-900/40">
            <div className="font-semibold text-gray-900 dark:text-gray-100">Silberschatz et al.</div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
              Database System Concepts — теория + практика на SQL.
            </div>
          </div>
        </div>
      </Card>

      <Card title="Онлайн-источники" desc="Документация и справочные материалы (удобно для ссылок).">
        <div className="grid grid-cols-1 gap-3">
          <KbLink
            href="https://www.postgresql.org/docs/"
            title="PostgreSQL Documentation"
            desc="Официальная документация: ограничения, индексы, внешние ключи, каскады."
          />
          <KbLink
            href="https://dev.mysql.com/doc/"
            title="MySQL Documentation"
            desc="Официальная документация MySQL."
          />
          <KbLink
            href="https://learn.microsoft.com/en-us/sql/"
            title="Microsoft SQL Server docs"
            desc="Официальные материалы по MS SQL Server."
          />
          <KbLink
            href="https://en.wikipedia.org/wiki/Database_normalization"
            title="Database normalization (Wikipedia)"
            desc="Быстрый обзор нормальных форм (как справка)."
          />
        </div>
      </Card>
    </div>
  );
}

function GuideSection() {
  return (
    <div className="space-y-4">
      <Card
        title="Руководство пользователя SmartERD"
        desc="Как быстро сделать диаграмму, проверить, экспортировать и получить SQL."
        right={<Pill tone="green">user guide</Pill>}
      >
        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-3">
          <Reveal title="1) Создание сущностей и атрибутов" defaultOpen>
            <ul className="space-y-1">
              <li>• Нажми <b>Сущность</b>, кликни по холсту — появится карточка.</li>
              <li>• Двойной клик по названию — переименование.</li>
              <li>• Нажмите на ⚙️ в карточке, чтобы перейти в режим добавления/редактирования атрибутов (тип + PK).</li>
              <li>• Нажмите на ⚙️ еще раз, чтобы выйти из режима добавления/редактирования атрибутов.</li>
            </ul>
          </Reveal>

          <Reveal title="2) Создание связей">
            <ul className="space-y-1">
              <li>• Нажмите <b>Связь</b> (режим линковки).</li>
              <li>• Кликните по 2 сущностям — создастся связь.</li>
              <li>• Тип связи можно менять через меню на лейбле связи.</li>
            </ul>
          </Reveal>

          <Reveal title="3) Проверка подсказок и ошибок">
            <ul className="space-y-1">
              <li>• Панель подсказок показывает ошибки/предупреждения.</li>
              <li>• Нажимайте на "Показать на диаграмме", чтобы совершить прыжок к сущности/связи.</li>
              <li>• Нормализация: действия "применить" (если доступны) могут помочь исправить ошибки нормализации.</li>
            </ul>
          </Reveal>

          <Reveal title="4) SQL и AI панели">
            <ul className="space-y-1">
              <li>• <b>SQL</b> генерирует SQL по текущей ER-модели и автоматически вызывает SQL панель.</li>
              <li>• <b>SQL панель</b> — просмотр/копирование, выбор диалекта.</li>
              <li>• <b>AI панель</b> — чат и генерация ER по описанию.</li>
            </ul>
          </Reveal>

          <Reveal title="5) Экспорт/импорт и проекты">
            <ul className="space-y-1">
              <li>• <b>Экспорт</b> — JSON/PNG/SVG (через модалку экспорта).</li>
              <li>• <b>Импорт</b> — загрузи JSON и продолжай работу.</li>
              <li>• Если вы авторизованы: <b>Сохранить</b> — кладёт проект в “Личный кабинет”.</li>
            </ul>
          </Reveal>
        </div>
      </Card>

      
    </div>
  );
}
