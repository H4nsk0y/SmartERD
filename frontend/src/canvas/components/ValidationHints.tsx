// frontend/src/canvas/components/ValidationHints.tsx
import * as React from "react";
import type { ValidationIssue } from "../../utils/validateModel";

type Mode = "validation" | "normalization";

/** Универсальный экшен (нормализатор кладёт actions прямо в issue) */
type IssueAction = {
  kind: string;
  label: string;
  payload?: any;
};

type IssueWithActions = ValidationIssue & {
  actions?: IssueAction[];
};

type Props = {
  issues: ValidationIssue[];
  normalizationIssues?: ValidationIssue[];
  open: boolean;
  onToggle: () => void;
  onJump?: (whereIds: string[]) => void;
  onAction?: (action: IssueAction) => void;
  className?: string;
};

export default function ValidationHints({
  issues,
  normalizationIssues = [],
  open,
  onToggle,
  onJump,
  onAction,
  className = "",
}: Props) {
  const [mode, setMode] = React.useState<Mode>("validation");

  const viewIssues = mode === "validation" ? issues : normalizationIssues;

  const counts = React.useMemo(() => {
    let err = 0,
      warn = 0,
      info = 0;
    for (const i of viewIssues) {
      if (i.level === "error") err += 1;
      else if (i.level === "warning") warn += 1;
      else info += 1;
    }
    return { err, warn, info, total: viewIssues.length };
  }, [viewIssues]);

  const sortedIssues = React.useMemo(() => {
    const order: Record<ValidationIssue["level"], number> = {
      error: 0,
      warning: 1,
      info: 2,
    };
    return [...viewIssues].sort((a, b) => order[a.level] - order[b.level]);
  }, [viewIssues]);

  const toggleMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMode((m) => (m === "validation" ? "normalization" : "validation"));
  };

  const title = mode === "validation" ? "Проблемы модели" : "Нормализация";
  const actionLabel = mode === "validation" ? "Нормализация" : "Валидация";

  return (
    <div
      className={[
        "w-[520px] max-w-none rounded-xl border bg-white/95 dark:bg-gray-900/95 backdrop-blur shadow-lg",
        "border-gray-200 dark:border-gray-700",
        className,
      ].join(" ")}
    >
      {/* Header */}
      <div className="shrink-0 p-3 border-b border-gray-200 dark:border-gray-700">
        {/* строка 1: заголовок + раскрытие */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex-1 min-w-0 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-lg px-2 py-1"
            title={open ? "Свернуть" : "Развернуть"}
          >
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {title}
            </span>
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {open ? "▾" : "▸"}
            </span>
          </button>
        </div>

        {/* строка 2: бейджи + кнопка режима */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 grid grid-cols-3 gap-2 text-xs min-w-0">
            <Badge tone="red" label="ошибки" value={counts.err} />
            <Badge tone="amber" label="предупр." value={counts.warn} />
            <Badge tone="blue" label="инфо" value={counts.info} />
          </div>

          <button
            type="button"
            onClick={toggleMode}
            className={[
              "shrink-0 w-[140px] text-center px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap",
              mode === "validation"
                ? "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                : "bg-indigo-600 hover:bg-indigo-700 text-white",
            ].join(" ")}
            title={
              mode === "validation"
                ? "Показать подсказки по нормализации"
                : "Вернуться к валидации"
            }
          >
            {actionLabel}
          </button>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="max-h-72 overflow-auto divide-y divide-gray-200 dark:divide-gray-800">
          {sortedIssues.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
              {mode === "validation"
                ? "Всё чисто. Подсказок нет."
                : "Подсказок по нормализации нет."}
            </div>
          ) : (
            sortedIssues.map((i, idx) => {
              const withActions = i as IssueWithActions;
              const actions = withActions.actions ?? [];

              return (
                <div key={idx} className="px-3 py-2 flex items-start gap-2">
                  <LevelIcon level={i.level} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {i.message}
                    </div>

                    {i.suggestion && (
                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        <span className="opacity-80">Подсказка: </span>
                        {i.suggestion}
                      </div>
                    )}

                    {/* actions (обычно есть у normalizationIssues) */}
                    {onAction && actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {actions.map((a, k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => onAction(a)}
                            className="text-xs px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                            title="Применить автоматическое изменение модели"
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {i.where && i.where.length > 0 && onJump && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onJump(i.where!);
                            }}
                            className={[
                              "inline-flex items-center gap-1",
                              "text-xs font-medium px-2.5 py-1.5 rounded-md",
                              "transition shadow-sm",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2",
                              "ring-offset-white dark:ring-offset-gray-900",
                            // light
                            "bg-blue-800 hover:bg-blue-900 text-white",
                            // dark (контрастнее + рамка)
                            "dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-white dark:border dark:border-blue-500/50",
                            ].join(" ")}
                          >
                            <span aria-hidden></span>
                            Показать на диаграмме
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function Badge({
  tone,
  label,
  value,
}: {
  tone: "red" | "amber" | "blue";
  label: string;
  value: number;
}) {
  const toneCls =
    tone === "red"
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      : tone === "amber"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  return (
    <span
      className={`inline-flex items-center justify-center gap-1 w-full px-2 py-0.5 rounded-full ${toneCls}`}
    >
      <span className="truncate">{label}:</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function LevelIcon({ level }: { level: "error" | "warning" | "info" }) {
  if (level === "error") {
    return (
      <span title="Ошибка" className="mt-0.5 text-red-600 dark:text-red-400">
        ⛔
      </span>
    );
  }
  if (level === "warning") {
    return (
      <span title="Предупреждение" className="mt-0.5 text-amber-600 dark:text-amber-300">
        ⚠️
      </span>
    );
  }
  return (
    <span title="Информация" className="mt-0.5 text-blue-600 dark:text-blue-300">
      ℹ️
    </span>
  );
}
