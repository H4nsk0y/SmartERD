// frontend/src/canvas/components/SQLPanel.tsx
// Правый столбец с результатом генерации SQL.
// Теперь с редактированием и подсветкой синтаксиса (CodeMirror).

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
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

export type SqlDialect = "postgres" | "mysql" | "sqlite" | "mssql";

export default function SQLPanel({
  sql,
  dialect,
  onChangeDialect,
  onCopyAll,
  className = "",
  // новые необязательные пропсы — для обратной совместимости можно не передавать
  editable = true,
  onChangeSql, // если не передан — просто локально редактируем без поднятия наверх
}: {
  sql: string;
  dialect: SqlDialect;
  onChangeDialect: (d: SqlDialect) => void;
  onCopyAll: () => void;
  className?: string;
  editable?: boolean;
  onChangeSql?: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [value, setValue] = useState<string>(sql ?? "");

  // синхронизация входного sql -> редактор
  useEffect(() => {
    setValue(sql ?? "");
  }, [sql]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  // тёмная тема: читаем класс на <html>
  const isDark = useIsDarkMode();

  // маппинг диалекта на CodeMirror
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
    setValue(next);
    onChangeSql?.(next);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(value);
      onCopyAll?.(); // для обратной совместимости — дергаем старый колбэк тоже
      setCopied(true);
    } catch {
      // ignore
    }
  };

  return (
    <aside
      className={[
        "shrink-0 h-full min-h-0 flex flex-col overflow-hidden border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900",
        className,
      ].join(" ")}
      style={{ width: 420, minWidth: 360, maxWidth: 520 }}
    >
      {/* Шапка панели (фиксированная) */}
      <div className="shrink-0 p-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
        {/* Диалект */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="px-3 py-1.5 rounded-md text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
            title="Выбор диалекта"
          >
            Диалект: {labelOf(dialect)} ▾
          </button>
          {open && (
            <div
              className="absolute z-50 mt-1 w-48 rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              onMouseLeave={() => setOpen(false)}
            >
              {(["postgres", "mysql", "sqlite", "mssql"] as SqlDialect[]).map((d) => (
                <div
                  key={d}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                  onClick={() => {
                    onChangeDialect(d);
                    setOpen(false);
                  }}
                >
                  {labelOf(d)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Скопировать */}
        <button
          onClick={handleCopy}
          className="ml-auto px-3 py-1.5 rounded-md text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          title="Скопировать весь SQL"
        >
          {copied ? "Скопировано ✓" : "Скопировать"}
        </button>
      </div>

      {/* Редактор: прокручивается только он */}
      <div className="h-0 flex-1 min-h-0 overflow-hidden">
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
          }}
          editable={editable}
          height="100%"
          className="h-full"
        />
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
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false
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
