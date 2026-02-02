// frontend/src/canvas/components/SQLPanel.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import {
  sql as sqlLang,
  PostgreSQL,
  MySQL,
  SQLite,
  MSSQL,
  SQLDialect as CmSqlDialect,
} from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import type { SqlDialect } from "../../utils/sql/types";

function storageKeyFor(d: SqlDialect) {
  return `sqlpanel:draft:${d}`;
}

export default function SQLPanel({
  sql,
  dialect,
  onChangeDialect,
  onCopyAll,
  className = "",
  editable = true,
  onChangeSql,
  blocked = false,
  errorCount = 0,
  onShowIssues,
  onClose,
  onResetToGenerated,
}: {
  sql: string;
  dialect: SqlDialect;
  onChangeDialect: (d: SqlDialect) => void;
  onCopyAll: () => void;
  className?: string;
  editable?: boolean;
  onChangeSql?: (next: string) => void;

  //    NEW: blocked state
  blocked?: boolean;
  errorCount?: number;
  onShowIssues?: () => void;
  onClose?: () => void;
  onResetToGenerated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const key = storageKeyFor(dialect);

  //    восстанавливаем черновик (на случай ремоунта)
  const [value, setValue] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved != null) return saved;
    } catch {
      // ignore
    }
    return sql ?? "";
  });

  const [dirty, setDirty] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(key) != null;
    } catch {
      return false;
    }
  });

  const isDark = useIsDarkMode();

  const lastPropSqlRef = useRef<string>(sql ?? "");
  const prevDialectRef = useRef<SqlDialect>(dialect);

  // если заблокировали — закрываем выпадашку
  useEffect(() => {
    if (blocked) setOpen(false);
  }, [blocked]);

  //    сохраняем/чистим черновик
  useEffect(() => {
    try {
      if (!dirty) {
        sessionStorage.removeItem(key);
        return;
      }
      sessionStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }, [dirty, value, key]);

  //    синхронизация пропа sql с value (без "отката" при dirty)
  useEffect(() => {
    const nextSql = sql ?? "";
    const dialectChanged = prevDialectRef.current !== dialect;

    prevDialectRef.current = dialect;

    if (dialectChanged) {
      // При смене диалекта: если есть черновик — он важнее
      try {
        const saved = sessionStorage.getItem(key);
        if (saved != null) {
          setValue(saved);
          setDirty(true);
          lastPropSqlRef.current = nextSql;
          return;
        }
      } catch {
        // ignore
      }

      setValue(nextSql);
      setDirty(false);
      lastPropSqlRef.current = nextSql;
      return;
    }

    lastPropSqlRef.current = nextSql;

    if (!dirty) {
      setValue(nextSql);
    }
  }, [sql, dialect, dirty, key]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  const cmDialect: CmSqlDialect = useMemo(() => {
    switch (dialect) {
      case "postgres":
        return PostgreSQL;
      case "mysql":
        return MySQL;
      case "sqlite":
        return SQLite;
      case "mssql":
        return MSSQL;
      default:
        return PostgreSQL;
    }
  }, [dialect]);

  const extensions = useMemo(() => [sqlLang({ dialect: cmDialect })], [cmDialect]);

  const handleChange = (next: string) => {
    if (!editable || blocked) return;
    setValue(next);
    setDirty(true);
    onChangeSql?.(next);
  };

  const handleCopy = async () => {
    if (blocked) return;
    try {
      await navigator.clipboard?.writeText(value);
      onCopyAll?.();
      setCopied(true);
    } catch {
      // ignore
    }
  };

  const handleResetToGenerated = () => {
    if (blocked) return;
    const next = lastPropSqlRef.current ?? "";
    setValue(next);
    setDirty(false);
    onChangeSql?.(next);
    onResetToGenerated?.();
  };

  return (
    <aside
      className={[
        "shrink-0 h-full min-h-0 flex flex-col overflow-hidden",
        "border-l border-black/10 dark:border-white/10",
        "bg-white/80 dark:bg-white/[0.08] backdrop-blur-xl",
        className,
      ].join(" ")}
      style={{ width: 420, minWidth: 360, maxWidth: 520 }}
    >
      {/* Заголовок панели с градиентным фоном */}
      <div className="shrink-0 p-4 flex items-center gap-3 border-b border-black/10 dark:border-white/10 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/30 dark:to-purple-950/30">
        {blocked && (
          <div className="px-3 py-1.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-red-100 to-red-200/80 dark:from-red-900/40 dark:to-red-800/30 text-red-900 dark:text-red-200 border border-red-200/60 dark:border-red-800/40 shadow-sm">
            SQL заблокирован{errorCount ? ` (${errorCount})` : ""}
          </div>
        )}

        {/* Выбор диалекта с улучшенным стилем */}
        <div className="relative">
          <button
            onClick={() => !blocked && setOpen((v) => !v)}
            disabled={blocked}
            className={`
              group relative flex items-center gap-2 px-4 py-2.5 rounded-2xl
              transition-all duration-200 hover:scale-[1.02] text-sm font-medium
              ${blocked
                ? "bg-black/[0.03] dark:bg-white/[0.04] text-gray-400 dark:text-gray-500 cursor-not-allowed"
                : "bg-white/70 dark:bg-white/[0.08] text-indigo-900 dark:text-white hover:bg-white/90 dark:hover:bg-white/[0.12] shadow-sm"
              }
            `}
            title={blocked ? "Недоступно при ошибках модели" : "Выбор диалекта"}
          >
            <span className="text-base opacity-90">🗣️</span>
            <span className="font-semibold">{labelOf(dialect)}</span>
            <span className={`text-xs opacity-70 ${blocked ? 'text-gray-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
              ▾
            </span>
          </button>

          {/* Выпадающий список диалектов */}
          {open && !blocked && (
            <div
              className="absolute z-50 mt-2 w-56 rounded-2xl bg-white/90 dark:bg-gray-900/95 backdrop-blur-xl shadow-[0_20px_60px_-18px_rgba(0,0,0,0.35)] border border-black/10 dark:border-white/10 overflow-hidden"
              onMouseLeave={() => setOpen(false)}
            >
              {(["postgres", "mysql", "sqlite", "mssql"] as SqlDialect[]).map((d) => (
                <button
                  key={d}
                  className={`
                    w-full px-4 py-3 text-sm text-left transition-all duration-200
                    ${dialect === d
                      ? "bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/40 dark:to-purple-900/30 text-indigo-900 dark:text-white font-semibold"
                      : "text-gray-900 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10"
                    }
                  `}
                  onClick={() => {
                    onChangeDialect(d);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base opacity-80">
                      {d === "postgres" ? "🐘" : 
                       d === "mysql" ? "🐬" : 
                       d === "sqlite" ? "🗃️" : "🏢"}
                    </span>
                    <span>{labelOf(d)}</span>
                    {dialect === d && (
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200">
                        Активен
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Кнопка сброса при наличии изменений */}
        {dirty && !blocked && (
          <button
            onClick={handleResetToGenerated}
            className="group px-4 py-2.5 rounded-2xl text-sm bg-gradient-to-r from-amber-50/80 to-amber-100/60 dark:from-amber-900/25 dark:to-amber-800/20 text-amber-900 dark:text-amber-100 hover:from-amber-100 dark:hover:from-amber-900/35 transition-all duration-200 hover:scale-[1.02] shadow-sm"
            title="Сбросить к сгенерированному SQL"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">↺</span>
              Отменить
            </span>
          </button>
        )}

        {/* Кнопка показа ошибок в заблокированном состоянии */}
        {blocked && onShowIssues && (
          <button
            onClick={onShowIssues}
            className="px-4 py-2.5 rounded-2xl text-sm bg-gradient-to-r from-red-50/80 to-red-100/60 dark:from-red-900/25 dark:to-red-800/20 text-red-900 dark:text-red-200 hover:from-red-100 dark:hover:from-red-900/35 transition-all duration-200 hover:scale-[1.02] shadow-sm"
            title="Открыть список проблем"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              Ошибки
            </span>
          </button>
        )}

        {/* Кнопка закрытия в заблокированном состоянии */}
        {blocked && onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl text-sm bg-black/[0.03] dark:bg-white/[0.06] text-gray-900 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-200 hover:scale-[1.02] shadow-sm"
            title="Закрыть панель"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">✕</span>
              Закрыть
            </span>
          </button>
        )}

        {/* Кнопка копирования с градиентом */}
        <button
          onClick={handleCopy}
          disabled={blocked}
          className={`
            ml-auto px-5 py-2.5 rounded-2xl text-sm font-bold text-white
            transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg
            ${blocked
              ? "bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-600 cursor-not-allowed opacity-70"
              : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-indigo-500/25"
            }
          `}
          title={blocked ? "Недоступно при ошибках модели" : "Скопировать весь SQL"}
        >
          <span className="flex items-center gap-2">
            {copied ? (
              <>
                <span className="text-base">  </span>
                <span>Скопировано</span>
              </>
            ) : (
              <>
                <span className="text-base">📋</span>
                <span>Скопировать</span>
              </>
            )}
          </span>
        </button>
      </div>

      {/* Основная область с кодом */}
      <div className="h-0 flex-1 min-h-0 overflow-hidden p-1">
        {blocked ? (
          <div className="h-full p-6 flex flex-col gap-4 items-center justify-center text-center">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-red-50/60 to-red-100/40 dark:from-red-900/20 dark:to-red-800/10 border border-red-200/50 dark:border-red-800/30">
              <span className="text-4xl mb-2 block">🚫</span>
              <div className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                SQL недоступен
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 max-w-xs">
                В модели есть критические ошибки{errorCount ? ` (${errorCount})` : ""}. Исправьте их — и снова нажмите "SQL".
              </div>
            </div>
            
            {onShowIssues && (
              <button
                type="button"
                onClick={onShowIssues}
                className="px-5 py-3 rounded-2xl text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:scale-[1.02] hover:shadow-indigo-500/40"
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">🔧</span>
                  Открыть подсказки
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="h-full rounded-2xl overflow-hidden border border-black/5 dark:border-white/10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
            <CodeMirror
              value={value}
              onChange={handleChange}
              extensions={extensions}
              theme={isDark ? oneDark : undefined}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                autocompletion: true,
                bracketMatching: true,
                syntaxHighlighting: true,
              }}
              editable={editable}
              height="100%"
              className="h-full [&_.cm-editor]:bg-transparent [&_.cm-scroller]:font-mono [&_.cm-content]:font-mono"
            />
          </div>
        )}
      </div>

      {/* Статусная строка внизу */}
      <div className="shrink-0 px-4 py-2.5 text-xs text-gray-500 dark:text-white/50 border-t border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
              <span>Готово</span>
            </span>
            {dirty && !blocked && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100/60 dark:bg-amber-900/25 text-amber-800 dark:text-amber-200 text-[11px]">
                Есть изменения
              </span>
            )}
          </div>
          <div className="text-[11px] opacity-70">
            {value.split('\n').length} строк • {value.length} символов
          </div>
        </div>
      </div>
    </aside>
  );
}

function labelOf(d: SqlDialect) {
  switch (d) {
    case "postgres":
      return "PostgreSQL";
    case "mysql":
      return "MySQL";
    case "sqlite":
      return "SQLite";
    case "mssql":
      return "MS SQL Server";
    default:
      return d;
  }
}

function useIsDarkMode() {
  const [dark, setDark] = useState<boolean>(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false
  );
  useEffect(() => {
    const mo = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark"))
    );
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}