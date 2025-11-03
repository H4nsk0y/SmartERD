/**
 * canvas/components/SQLPanel.tsx
 * Правый столбец с результатом генерации SQL.
 * Скролл ТОЛЬКО внутри области кода; шапка фиксированной высоты.
 */

import * as React from "react";

export type SqlDialect = "postgres" | "mysql" | "sqlite" | "mssql";

export default function SQLPanel({
  sql,
  dialect,
  onChangeDialect,
  onCopyAll,
  className = "",
}: {
  sql: string;
  dialect: SqlDialect;
  onChangeDialect: (d: SqlDialect) => void;
  onCopyAll: () => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <aside
      className={`shrink-0 h-full min-h-0 flex flex-col overflow-hidden border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${className}`}
      style={{ width: 420, minWidth: 360, maxWidth: 520 }}
    >
      {/* Шапка панели (не прокручивается) */}
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
          onClick={() => {
            onCopyAll();
            setCopied(true);
          }}
          className="ml-auto px-3 py-1.5 rounded-md text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          title="Скопировать весь SQL"
        >
          {copied ? "Скопировано ✓" : "Скопировать"}
        </button>
      </div>

      {/* Область кода: прокручивается ТОЛЬКО она.
          ВАЖНО: h-0 + flex-1 + min-h-0 не даёт блоку растягивать родителей. */}
      <div className="h-0 flex-1 min-h-0 overflow-auto p-3">
        {sql ? (
          <pre className="m-0 text-xs leading-5 whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100">
            <code className="block">{sql}</code>
          </pre>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Нажми «🧩 Сгенерировать SQL», чтобы увидеть результат здесь.
          </div>
        )}
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
