// frontend/src/pages/AccountPage.tsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/useAuthStore";
import { useAppStore } from "../store/useAppStore";
import { apiProjectDelete, apiProjectUpdate, apiProjectGet } from "../api/projects";

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

function Pill({ children, tone }: { children: React.ReactNode; tone: "ok" | "info" | "warn" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
      : tone === "info"
      ? "border-sky-400/25 bg-sky-500/10 text-sky-700 dark:text-sky-200"
      : "border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${cls}`}>
      {children}
    </span>
  );
}

function Dot({ tone }: { tone: "green" | "blue" }) {
  const base = tone === "green" ? "bg-emerald-500" : "bg-sky-500";
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <span className={`absolute inline-flex h-full w-full rounded-full ${base} opacity-30 motion-safe:animate-ping`} />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${base}`} />
    </span>
  );
}

const I = {
  list: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l3 2" />
    </svg>
  ),
  sync: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 0 0-15.5-6.5" />
      <path d="M3 12a9 9 0 0 0 15.5 6.5" />
      <path d="M6 5V3H4" />
      <path d="M18 19v2h2" />
    </svg>
  ),
  pencil: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  ),
};

export default function AccountPage() {
  const { t } = useTranslation();
  const nav = useNavigate();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);

  const user = useAuthStore((s) => s.user);
  const projects = useAuthStore((s) => s.projects);

  const logout = useAuthStore((s) => s.logout);
  const fetchProjects = useAuthStore((s) => s.fetchProjects);
  const loadingProjects = useAuthStore((s) => s.loadingProjects);

  const upsertProject = useAuthStore((s) => s.upsertProject);
  const removeProjectLocal = useAuthStore((s) => s.removeProject);

  const { theme } = useAppStore();

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const [renameId, setRenameId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [renameError, setRenameError] = React.useState<string | null>(null);
  const [renameSaving, setRenameSaving] = React.useState(false);

  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const [editingName, setEditingName] = React.useState(false);
  const [nameValue, setNameValue] = React.useState("");

  const [emailModalOpen, setEmailModalOpen] = React.useState(false);

  const [counts, setCounts] = React.useState<Record<string, { entities: number; relationships: number }>>({});
  const [countsBusy, setCountsBusy] = React.useState(false);

  const sessionStartedAt = React.useMemo(() => new Date(), []);
  const [lastRefreshAt, setLastRefreshAt] = React.useState<Date | null>(null);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    fetchProjects()
      .then(() => setLastRefreshAt(new Date()))
      .catch(() => {});
  }, [isAuthenticated, fetchProjects]);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isAuthenticated || !token) return;
      if (!projects || projects.length === 0) return;

      const missing = projects.filter((p) => !counts[p.id]);
      if (missing.length === 0) return;

      setCountsBusy(true);
      try {
        const list = missing.slice(0, 25);
        for (const p of list) {
          if (cancelled) return;
          try {
            const full = await apiProjectGet(token, p.id);
            const data: any = full?.data ?? null;
            const eCount = Array.isArray(data?.entities) ? data.entities.length : 0;
            const rCount = Array.isArray(data?.relationships) ? data.relationships.length : 0;
            if (!cancelled) {
              setCounts((prev) => ({ ...prev, [p.id]: { entities: eCount, relationships: rCount } }));
            }
          } catch {
            // ignore
          }
        }
      } finally {
        if (!cancelled) setCountsBusy(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token, projects]);

  const initials =
    (user?.name || "U")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join("") || "U";

  async function doRenameProject() {
    const id = renameId;
    const name = renameValue.trim();

    setRenameError(null);

    if (!id) return;
    if (!name) {
      setRenameError("Введите название проекта.");
      return;
    }
    if (!token) {
      alert("Нужно войти в аккаунт.");
      return;
    }

    setRenameSaving(true);
    try {
      const updated = await apiProjectUpdate(token, id, { name });
      upsertProject(updated);
      setRenameId(null);
      setRenameValue("");
    } catch (e: any) {
      alert(e?.message || "Не удалось переименовать проект.");
    } finally {
      setRenameSaving(false);
    }
  }

  async function doDeleteProject() {
    const id = deleteId;
    if (!id) return;

    if (!token) {
      alert("Нужно войти в аккаунт.");
      return;
    }

    setDeleteBusy(true);
    try {
      await apiProjectDelete(token, id);
      removeProjectLocal(id);
      setDeleteId(null);
      setCounts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e: any) {
      alert(e?.message || "Не удалось удалить проект.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function beginEditName() {
    setNameValue(user?.name || "");
    setEditingName(true);
  }

  function commitEditName() {
    const next = nameValue.trim();
    if (!next) {
      setEditingName(false);
      return;
    }
    useAuthStore.setState((s: any) => ({
      ...s,
      user: s.user ? { ...s.user, name: next } : s.user,
    }));
    setEditingName(false);
  }

  if (!isAuthenticated) {
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

          {/* grid */}
          <div className="absolute inset-0 opacity-[0.12] dark:opacity-[0.18] bg-[linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>

        <div className="relative w-full max-w-xl">
          <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_10px_40px_-18px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
            <div className="text-2xl font-extrabold text-gray-900 dark:text-white">Войдите в аккаунт</div>
            <div className="mt-2 text-gray-600 dark:text-white/60">Чтобы просмотреть свой профиль и проекты.</div>

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => nav("/login")}
                className="rounded-2xl bg-indigo-600 px-5 py-3 font-bold text-white transition hover:bg-indigo-700 active:scale-[0.98]"
              >
                Перейти к входу
              </button>
              <Link
                to="/"
                className="rounded-2xl border border-black/10 bg-white/60 px-5 py-3 font-bold text-gray-900 transition hover:bg-black/5 active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/5"
              >
                На главную
              </Link>
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 h-10 w-[80%] blur-2xl bg-indigo-500/15 dark:bg-indigo-500/20" />
        </div>
      </div>
    );
  }

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

        {/* grid */}
        <div className="absolute inset-0 opacity-[0.12] dark:opacity-[0.18] bg-[linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 py-10">
        {/* header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-extrabold shadow-lg shadow-indigo-500/25">
              {initials}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {!editingName ? (
                  <>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white truncate">
                      {user?.name || t("account.title", { defaultValue: "Личный кабинет" })}
                    </h1>
                    <button
                      type="button"
                      onClick={beginEditName}
                      className="shrink-0 rounded-xl border border-black/10 bg-white/60 p-2 text-gray-900 transition hover:bg-black/5 active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/5"
                      title="Редактировать имя"
                      aria-label="Редактировать имя"
                    >
                      {I.pencil}
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      className="w-full max-w-md rounded-2xl border border-black/10 bg-white/70 px-4 py-2 font-extrabold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
                      placeholder="Ваше имя"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEditName();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                    />
                    <button
                      type="button"
                      onClick={commitEditName}
                      className="rounded-2xl bg-indigo-600 px-4 py-2 font-bold text-white transition hover:bg-indigo-700 active:scale-[0.98]"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingName(false)}
                      className="rounded-2xl border border-black/10 bg-white/60 px-4 py-2 font-bold text-gray-900 transition hover:bg-black/5 active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/5"
                    >
                      Отмена
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-2 text-gray-600 dark:text-white/60">
                Управляйте своими проектами и настройками профиля.
              </div>

              <div className="mt-2 text-sm text-gray-700 dark:text-white/70">
                <span className="font-semibold">{user?.email}</span>
              </div>
            </div>
          </div>

          <div className="mt-2 md:mt-0 flex items-center gap-2">
            <button
              onClick={() => {
                logout();
                nav("/login");
              }}
              className="rounded-2xl border border-red-200 bg-white/70 px-4 py-2 font-bold text-red-700 shadow-sm transition hover:bg-red-50 active:scale-[0.98] dark:border-red-500/30 dark:bg-white/[0.06] dark:text-red-300 dark:hover:bg-red-900/20"
            >
              {t("account.logout", { defaultValue: "Выйти" })}
            </button>
          </div>
        </div>

        {/* content */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* left column */}
          <div className="space-y-5 lg:col-span-2">
            <SectionCard
              title={t("account.projects", { defaultValue: "Мои проекты" })}
              subtitle="Открывайте, переименовывайте и удаляйте сохранённые диаграммы."
              icon={I.list}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    data-testid="project-new"
                    onClick={() => nav("/editor")}
                    className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110 active:scale-[0.98]"
                  >
                    {t("account.newProject", { defaultValue: "Новый проект" })}
                  </button>

                  <button
                    onClick={() =>
                      fetchProjects()
                        .then(() => setLastRefreshAt(new Date()))
                        .catch(() => {})
                    }
                    className="rounded-2xl border border-black/10 bg-white/60 px-4 py-2 font-bold text-gray-900 transition hover:bg-black/5 active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/5"
                    title="Обновить список"
                  >
                    Обновить
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {countsBusy && <Pill tone="info">Считаю содержимое…</Pill>}
                  <Pill tone="info">{projects.length} проектов</Pill>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-black/10 bg-white/60 overflow-hidden dark:border-white/10 dark:bg-white/[0.04]">
                {loadingProjects ? (
                  <div className="p-4 text-gray-700 dark:text-white/80 flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black/60 dark:border-white/30 dark:border-t-white animate-spin" />
                    Загружаю проекты…
                  </div>
                ) : projects.length === 0 ? (
                  <div className="p-4 text-gray-700 dark:text-white/80">
                    {t("account.noProjects", { defaultValue: "Проектов пока нет." })}
                  </div>
                ) : (
                  <div className="divide-y divide-black/5 dark:divide-white/10">
                    {projects.map((p) => {
                      const c = counts[p.id];
                      const metaText = c ? `${c.entities} сущн. • ${c.relationships} связ.` : "—";
                      return (
                        <div
                          key={p.id}
                          data-testid={`project-item-${p.id}`}
                          className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="font-extrabold text-gray-900 dark:text-white truncate">
                                {p.name}
                              </div>
                              <span className="shrink-0">
                                <Pill tone="info">{metaText}</Pill>
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-gray-600 dark:text-white/60">
                              Обновлён: {new Date(p.updatedAt as any).toLocaleString()}
                            </div>
                          </div>

                          <div className="shrink-0 flex flex-wrap items-center gap-2">
                            <button
                              data-testid={`project-open-${p.id}`}
                              onClick={() => nav(`/editor/${p.id}`)}
                              className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 active:scale-[0.98]"
                            >
                              {t("account.open", { defaultValue: "Открыть" })}
                            </button>

                            <button
                              onClick={() => {
                                setRenameError(null);
                                setRenameId(p.id);
                                setRenameValue(p.name);
                              }}
                              className="rounded-2xl border border-black/10 bg-white/60 px-4 py-2 text-sm font-bold text-gray-900 transition hover:bg-black/5 active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/5"
                            >
                              Переименовать
                            </button>

                            <button
                              onClick={() => setDeleteId(p.id)}
                              className="rounded-2xl border border-red-200 bg-white/60 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 active:scale-[0.98] dark:border-red-500/30 dark:bg-white/[0.04] dark:text-red-300 dark:hover:bg-red-900/20"
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {lastRefreshAt && (
                <div className="mt-3 text-xs text-gray-600 dark:text-white/55">
                  Последнее обновление списка: {lastRefreshAt.toLocaleString()}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Активность" subtitle="Короткая сводка по текущей сессии." icon={I.clock}>
              <div className="space-y-3">
                <Row
                  label="Последний вход"
                  hint="Текущая сессия"
                  right={
                    <div className="flex items-center gap-2">
                      <Dot tone="green" />
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {sessionStartedAt.toLocaleString()}
                      </span>
                    </div>
                  }
                />
                <Row
                  label="Создано проектов"
                  hint="Всего в аккаунте"
                  right={
                    <div className="flex items-center gap-2">
                      <Dot tone="blue" />
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {projects.length}
                      </span>
                    </div>
                  }
                />
                <div className="rounded-2xl border border-black/10 bg-white/60 p-4 text-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70">
                  Совет: для больших диаграмм включите миникарту и SQL-панель в настройках — так быстрее проверять связи и результат генерации.
                </div>
              </div>
            </SectionCard>
          </div>

          {/* right column */}
          <div className="space-y-5">
            <SectionCard title="Профиль" subtitle="Основная информация аккаунта." icon={I.user}>
              <div className="space-y-3">
                <Row
                  label="Email"
                  hint="Почта для входа"
                  right={
                    <button
                      type="button"
                      onClick={() => setEmailModalOpen(true)}
                      className="rounded-2xl border border-black/10 bg-white/60 px-4 py-2 text-sm font-bold text-gray-900 transition hover:bg-black/5 active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/5"
                    >
                      Изменить
                    </button>
                  }
                />
                <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="font-semibold text-gray-900 dark:text-white">Текущий email</div>
                  <div className="mt-0.5 text-sm text-gray-700 dark:text-white/70 break-words">{user?.email}</div>
                </div>

                <Row
                  label="Дата регистрации"
                  hint="Создание аккаунта"
                  right={
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {user?.createdAt ? new Date(user.createdAt as any).toLocaleDateString() : "—"}
                    </span>
                  }
                />

                <Row
                  label="План"
                  hint="Текущий тариф"
                  right={
                    <div className="flex items-center gap-2">
                      <Pill tone="ok">Бесплатный</Pill>
                      <button
                        type="button"
                        disabled
                        className="rounded-2xl border border-black/10 bg-white/60 px-4 py-2 text-sm font-bold text-gray-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/30"
                        title="Скоро"
                      >
                        Обновить
                      </button>
                    </div>
                  }
                />
              </div>
            </SectionCard>

            <SectionCard title="Статус аккаунта" subtitle="Синхронизация проектов и соединение." icon={I.sync}>
              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-extrabold">
                    <span className="inline-flex">
                      <span className="relative inline-flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-30 motion-safe:animate-ping" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                      </span>
                    </span>
                    Синхронизация активна
                  </div>
                  <div className="mt-1 text-emerald-800/80 dark:text-emerald-200/80">
                    Проекты сохраняются на сервере и доступны с любого устройства после входа.
                  </div>
                </div>

                <Row
                  label="Состояние списка"
                  hint="Загрузка проектов"
                  right={loadingProjects ? <Pill tone="warn">загрузка…</Pill> : <Pill tone="ok">готово</Pill>}
                />

                <div className="text-xs text-gray-600 dark:text-white/55">
                  Если список кажется неактуальным — нажмите «Обновить» в разделе проектов.
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        <div className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 h-10 w-[80%] blur-2xl bg-indigo-500/15 dark:bg-indigo-500/20" />
      </div>

      {/* RENAME PROJECT MODAL */}
      {renameId && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={() => {
            if (renameSaving) return;
            setRenameId(null);
            setRenameValue("");
            setRenameError(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-[28px] border border-black/10 bg-white/75 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-extrabold text-gray-900 dark:text-white">Переименовать проект</div>
            <div className="mt-2 text-sm text-gray-600 dark:text-white/60">
              Введите новое название и нажмите «Сохранить».
            </div>

            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mt-4 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
              placeholder="Название проекта"
              onKeyDown={(e) => {
                if (e.key === "Enter") doRenameProject();
                if (e.key === "Escape" && !renameSaving) {
                  setRenameId(null);
                  setRenameValue("");
                  setRenameError(null);
                }
              }}
            />

            {renameError && <div className="mt-2 text-sm text-red-600 dark:text-red-300">{renameError}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                disabled={renameSaving}
                onClick={() => {
                  setRenameId(null);
                  setRenameValue("");
                  setRenameError(null);
                }}
                className="rounded-2xl border border-black/10 bg-white/60 px-4 py-2 font-bold text-gray-900 transition hover:bg-black/5 active:scale-[0.98] disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/5"
              >
                Отмена
              </button>

              <button
                disabled={renameSaving}
                onClick={doRenameProject}
                className="rounded-2xl bg-indigo-600 px-4 py-2 font-bold text-white transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
              >
                {renameSaving ? "Сохраняю..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE PROJECT MODAL */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[28px] border border-black/10 bg-white/75 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
            <div className="text-xl font-extrabold text-gray-900 dark:text-white">Удалить проект?</div>
            <div className="mt-2 text-sm text-gray-600 dark:text-white/60">
              Проект удалится навсегда. Восстановить его будет нельзя.
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                disabled={deleteBusy}
                onClick={() => setDeleteId(null)}
                className="rounded-2xl border border-black/10 bg-white/60 px-4 py-2 font-bold text-gray-900 transition hover:bg-black/5 active:scale-[0.98] disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/5"
              >
                Отмена
              </button>

              <button
                disabled={deleteBusy}
                onClick={doDeleteProject}
                className="rounded-2xl border border-red-200 bg-white/60 px-4 py-2 font-bold text-red-700 transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-60 dark:border-red-500/30 dark:bg-white/[0.04] dark:text-red-300 dark:hover:bg-red-900/20"
              >
                {deleteBusy ? "Удаляю..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL MODAL (stub) */}
      {emailModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={() => setEmailModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[28px] border border-black/10 bg-white/75 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-extrabold text-gray-900 dark:text-white">Изменение email</div>
            <div className="mt-2 text-sm text-gray-600 dark:text-white/60">
              Эта функция появится позже. Сейчас email используется только для входа и отображения в профиле.
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setEmailModalOpen(false)}
                className="rounded-2xl bg-indigo-600 px-4 py-2 font-bold text-white transition hover:bg-indigo-700 active:scale-[0.98]"
              >
                Понял
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
