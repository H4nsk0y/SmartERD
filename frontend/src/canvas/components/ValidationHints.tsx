// frontend/src/canvas/components/ValidationHints.tsx
import * as React from "react";
import type { ValidationIssue } from "../../utils/validateModel";

type Props = {
  issues: ValidationIssue[];
  open: boolean;
  onToggle: () => void;
  onJump?: (whereIds: string[]) => void;
  className?: string;
};

export default function ValidationHints({ issues, open, onToggle, onJump, className = "" }: Props) {
  const counts = React.useMemo(() => {
    let err = 0, warn = 0, info = 0;
    for (const i of issues) {
      if (i.level === "error") err += 1;
      else if (i.level === "warning") warn += 1;
      else info += 1;
    }
    return { err, warn, info, total: issues.length };
  }, [issues]);

  const sortedIssues = React.useMemo(() => {
    const order: Record<ValidationIssue["level"], number> = {
      error: 0,
      warning: 1,
      info: 2,
    };
    return [...issues].sort((a, b) => order[a.level] - order[b.level]);
  }, [issues]);

  return (
    <div
      className={`max-w-sm w-[360px] rounded-xl border bg-white/95 dark:bg-gray-900/95 backdrop-blur shadow-lg
      border-gray-200 dark:border-gray-700 ${className}`}
    >
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-t-xl"
        title={open ? "Свернуть подсказки" : "Развернуть подсказки"}
      >
        <span className="font-medium text-gray-900 dark:text-gray-100">Проблемы модели</span>
        <div className="ml-auto grid grid-cols-3 gap-2 text-xs min-w-[240px]">
          <Badge tone="red"   label="ошибки"   value={counts.err} />
          <Badge tone="amber" label="предупр." value={counts.warn} />
          <Badge tone="blue"  label="инфо"     value={counts.info} />
        </div>

        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="max-h-64 overflow-auto divide-y divide-gray-200 dark:divide-gray-800">
          {sortedIssues.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
              Всё чисто. Подсказок нет.
            </div>
          ) : (
            sortedIssues.map((i, idx) => (
              <div key={idx} className="px-3 py-2 flex items-start gap-2">
                <LevelIcon level={i.level} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 dark:text-gray-100">
                    {i.message}
                  </div>
                  {i.suggestion && (
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      <span className="opacity-80">Подсказка: </span>{i.suggestion}
                    </div>
                  )}
                  {(i.where && i.where.length > 0 && onJump) && (
                    <div className="mt-2">
                      <button
                        onClick={() => onJump(i.where!)}
                        className="text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        Показать на диаграмме
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Badge({ tone, label, value }: { tone: "red" | "amber" | "blue"; label: string; value: number }) {
  const toneCls =
    tone === "red"
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      : tone === "amber"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  return (
    <span className={`inline-flex items-center justify-center gap-1 w-full px-2 py-0.5 rounded-full ${toneCls}`}>
      <span>{label}:</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function LevelIcon({ level }: { level: "error" | "warning" | "info" }) {
  if (level === "error") {
    return <span title="Ошибка" className="mt-0.5 text-red-600 dark:text-red-400">⛔</span>;
  }
  if (level === "warning") {
    return <span title="Предупреждение" className="mt-0.5 text-amber-600 dark:text-amber-300">⚠️</span>;
  }
  return <span title="Информация" className="mt-0.5 text-blue-600 dark:text-blue-300">ℹ️</span>;
}
