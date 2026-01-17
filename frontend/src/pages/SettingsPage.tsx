// frontend/src/pages/SettingsPage.tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-black/5 text-gray-900 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white">
      {children}
    </span>
  );
}

function SectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-black/10 bg-white/70 p-5 shadow-[0_10px_40px_-18px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
      <div className="flex items-start gap-3">
        <IconWrap>{icon}</IconWrap>
        <div className="min-w-0">
          <div className="text-lg font-extrabold text-gray-900 dark:text-white">{title}</div>
          {subtitle && (
            <div className="mt-0.5 text-sm text-gray-600 dark:text-white/60">{subtitle}</div>
          )}
        </div>
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
}

function Row({
  label,
  hint,
  right,
}: {
  label: string;
  hint?: string;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 bg-black/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="min-w-0">
        <div className="font-semibold text-gray-900 dark:text-white">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-gray-600 dark:text-white/60">{hint}</div>}
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; sub?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-stretch gap-2 rounded-2xl border border-black/10 bg-white/60 p-1 dark:border-white/10 dark:bg-white/[0.04]">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={[
              "relative flex flex-col justify-center rounded-2xl px-4 py-2 text-left transition active:scale-[0.99]",
              active
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25"
                : "text-gray-900 hover:bg-black/5 dark:text-white dark:hover:bg-white/5",
            ].join(" ")}
          >
            <span className="text-sm font-bold">{o.label}</span>
            {o.sub && (
              <span
                className={[
                  "text-[11px] leading-snug",
                  active ? "text-white/80" : "text-gray-600 dark:text-white/60",
                ].join(" ")}
              >
                {o.sub}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "relative h-8 w-14 rounded-full border transition",
        checked
          ? "border-indigo-400/40 bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/25"
          : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/10",
      ].join(" ")}
      aria-pressed={checked}
    >
      <span
        className={[
          "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition",
          checked ? "left-7" : "left-1",
        ].join(" ")}
      />
      {checked && (
        <span className="pointer-events-none absolute -right-1 -top-1">
          <span className="absolute inline-flex h-3 w-3 rounded-full bg-indigo-400 opacity-70 motion-safe:animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-500" />
        </span>
      )}
    </button>
  );
}

function PresetCard({
  title,
  desc,
  bullets,
  onApply,
}: {
  title: string;
  desc: string;
  bullets: string[];
  onApply: () => void;
}) {
  return (
    <div className="group relative h-full rounded-2xl border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/[0.05]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-extrabold text-gray-900 dark:text-white">{title}</div>
          <div className="mt-1 text-sm text-gray-600 dark:text-white/60 leading-snug">
            {desc}
          </div>
        </div>
        <button
          type="button"
          onClick={onApply}
          className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 active:scale-[0.98]"
        >
          Применить
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        {bullets.map((b, i) => (
          <div key={i} className="text-xs text-gray-700 dark:text-white/70">
            • {b}
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/0 transition group-hover:ring-black/5 dark:group-hover:ring-white/10" />
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();

  const {
    language, setLanguage,
    theme, setTheme,
    compactToolbar, setCompactToolbar,
    defaultShowSqlPanel, setDefaultShowSqlPanel,
    defaultShowMinimap, setDefaultShowMinimap,
    confirmDelete, setConfirmDelete,
    resetSettings
  } = useAppStore();

  // На всякий случай: синхроним tailwind dark-mode через класс на <html>
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const applyPreset = (key: "beginner" | "productivity" | "minimal") => {
    if (key === "beginner") {
      setTheme("dark");
      setLanguage("ru");
      setCompactToolbar(false);
      setDefaultShowSqlPanel(true);
      setDefaultShowMinimap(true);
      setConfirmDelete(true);
      return;
    }
    if (key === "productivity") {
      setTheme("dark");
      setCompactToolbar(true);
      setDefaultShowSqlPanel(true);
      setDefaultShowMinimap(true);
      setConfirmDelete(false);
      return;
    }
    // minimal
    setTheme("light");
    setCompactToolbar(true);
    setDefaultShowSqlPanel(false);
    setDefaultShowMinimap(false);
    setConfirmDelete(true);
  };

  return (
    <div className="relative w-full min-h-[calc(100vh-64px)] flex items-start justify-center px-4 py-10 overflow-y-auto">
      {/* фон */}
      
      <div className="pointer-events-none fixed inset-0 -z-10">
        {/* light */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:hidden" />
        <div className="absolute -top-24 -left-24 h-[520px] w-[520px] rounded-full bg-indigo-500/15 blur-3xl dark:hidden" />
        <div className="absolute -bottom-28 -right-24 h-[560px] w-[560px] rounded-full bg-fuchsia-500/10 blur-3xl dark:hidden" />

        {/* dark */}
        <div className="hidden dark:block absolute inset-0 bg-gradient-to-b from-[#0b1220] via-[#0b1220] to-[#070b14]" />
        <div className="hidden dark:block absolute -top-24 -left-24 h-[520px] w-[520px] rounded-full bg-indigo-600/25 blur-3xl motion-safe:animate-pulse" />
        <div className="hidden dark:block absolute -bottom-28 -right-24 h-[560px] w-[560px] rounded-full bg-fuchsia-500/15 blur-3xl motion-safe:animate-pulse" />

        {/* subtle grid */}
        <div className="absolute inset-0 opacity-[0.12] dark:opacity-[0.18] bg-[linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 py-10">
        {/* header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white">
              {t("settings.title", { defaultValue: "Настройки" })}
            </h1>
            <div className="mt-2 text-gray-600 dark:text-white/60">
              Настрой интерфейс под свой стиль — изменения сохраняются автоматически.
            </div>
          </div>

          <div className="mt-4 md:mt-0 flex items-center gap-2">
            <button
              onClick={() => resetSettings()}
              className="rounded-2xl border border-red-200 bg-white/70 px-4 py-2 font-bold text-red-700 shadow-sm transition hover:bg-red-50 active:scale-[0.98] dark:border-red-500/30 dark:bg-white/[0.06] dark:text-red-300 dark:hover:bg-red-900/20"
            >
              {t("settings.reset", { defaultValue: "Сбросить" })}
            </button>
          </div>
        </div>

        {/* content */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* left column */}
          <div className="space-y-5 lg:col-span-2">
            <SectionCard
              title={t("settings.sections.appearance", { defaultValue: "Внешний вид" })}
              subtitle="Тема, язык и компактность панели."
              icon={
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3a9 9 0 1 0 9 9" />
                  <path d="M12 3v9h9" />
                </svg>
              }
            >
              <div className="space-y-3">
                <Row
                  label={t("settings.appearance.theme", { defaultValue: "Тема" })}
                  hint="Выбирай, что комфортнее глазам."
                  right={
                    <Segmented
                      value={theme}
                      onChange={(v) => setTheme(v as any)}
                      options={[
                        { value: "light", label: t("settings.appearance.light", { defaultValue: "Светлая" }), sub: "контраст и чистота" },
                        { value: "dark", label: t("settings.appearance.dark", { defaultValue: "Тёмная" }), sub: "фокус и атмосфера" },
                      ]}
                    />
                  }
                />

                <Row
                  label={t("settings.appearance.language", { defaultValue: "Язык" })}
                  hint="Локализация интерфейса."
                  right={
                    <Segmented
                      value={language}
                      onChange={(v) => setLanguage(v as any)}
                      options={[
                        { value: "ru", label: "RU", sub: "русский" },
                        { value: "en", label: "EN", sub: "english" },
                      ]}
                    />
                  }
                />

                <Row
                  label={t("settings.appearance.compactToolbar", { defaultValue: "Компактная панель" })}
                  hint="Больше места на диаграмме — меньше текста в кнопках."
                  right={<Toggle checked={compactToolbar} onChange={setCompactToolbar} />}
                />
              </div>
            </SectionCard>

            <SectionCard
              title={t("settings.sections.editor", { defaultValue: "Редактор" })}
              subtitle="Поведение панелей при открытии."
              icon={
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 5h16" />
                  <path d="M4 12h16" />
                  <path d="M4 19h16" />
                </svg>
              }
            >
              <div className="space-y-3">
                <Row
                  label={t("settings.editor.sqlPanelDefault", { defaultValue: "SQL панель по умолчанию" })}
                  hint="Открывать SQL панель сразу при входе в редактор."
                  right={<Toggle checked={defaultShowSqlPanel} onChange={setDefaultShowSqlPanel} />}
                />
                <Row
                  label={t("settings.editor.minimapDefault", { defaultValue: "Миникарта по умолчанию" })}
                  hint="Полезно для больших диаграмм."
                  right={<Toggle checked={defaultShowMinimap} onChange={setDefaultShowMinimap} />}
                />
                <Row
                  label={t("settings.editor.confirmDelete", { defaultValue: "Подтверждать удаление" })}
                  hint="Добавляет защиту от случайных кликов."
                  right={<Toggle checked={confirmDelete} onChange={setConfirmDelete} />}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-black/10 bg-white/60 p-4 text-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70">
                Настройки применяются мгновенно — попробуй переключить тему, язык или панели. Все изменения сохраняются автоматически и будут работать при следующем открытии редактора.
              </div>
            </SectionCard>
          </div>

          {/* right column */}
          <div className="space-y-5">
            <SectionCard
              title="Быстрые пресеты"
              subtitle="Готовые наборы под разные сценарии."
              icon={
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5.5 20l2-7L2 9h7z" />
                </svg>
              }
            >
              <div className="grid grid-cols-1 gap-3">
                <PresetCard
                  title="Новичок"
                  desc="Комфортный старт и подсказки."
                  bullets={[
                    "Тёмная тема • RU",
                    "SQL панель + миникарта",
                    "Подтверждение удаления",
                  ]}
                  onApply={() => applyPreset("beginner")}
                />
                <PresetCard
                  title="Продуктивность"
                  desc="Максимум места на холсте."
                  bullets={[
                    "Компактная панель",
                    "SQL панель + миникарта",
                    "Без лишних подтверждений",
                  ]}
                  onApply={() => applyPreset("productivity")}
                />
                <PresetCard
                  title="Минимализм"
                  desc="Чисто и спокойно."
                  bullets={[
                    "Светлая тема",
                    "Компактная панель",
                    "Без SQL панели и миникарты",
                  ]}
                  onApply={() => applyPreset("minimal")}
                />
              </div>
            </SectionCard>

            <div className="rounded-[28px] border border-black/10 bg-white/70 p-5 text-sm text-gray-700 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70">
              <div className="font-extrabold text-gray-900 dark:text-white">Статус</div>
              <div className="mt-2">
                Приложение в активной разработке — часть интерфейса может меняться, а новые фичи появляться “на ходу”.
              </div>
              <div className="mt-3 text-xs text-gray-500 dark:text-white/50">
                React • Tailwind • Zustand • PostgreSQL • Prisma
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 h-10 w-[80%] blur-2xl bg-indigo-500/15 dark:bg-indigo-500/20" />
      </div>
    </div>
  );
}
