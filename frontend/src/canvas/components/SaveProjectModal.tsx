import * as React from "react";

type Props = {
  open: boolean;
  defaultName?: string;
  onClose: () => void;
  onConfirm: (projectName: string) => void;
};

export default function SaveProjectModal({
  open,
  defaultName = "My Project",
  onClose,
  onConfirm,
}: Props) {
  const [name, setName] = React.useState(defaultName);

  React.useEffect(() => {
    if (!open) return;
    setName(defaultName);
  }, [open, defaultName]);

  if (!open) return null;

  const safe = (name || "").trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onMouseDown={onClose} />

      <div
        className="relative w-[520px] max-w-[92vw] rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Сохранить проект
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Пока без БД: сохраняем “проект” локально (заготовка под личный кабинет).
            </div>
          </div>

          <button
            className="shrink-0 w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
            onClick={onClose}
            aria-label="Закрыть"
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Название проекта
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Например: Курсовая ERD"
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200"
            onClick={onClose}
          >
            Отмена
          </button>

          <button
            disabled={!safe}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onConfirm(safe)}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
