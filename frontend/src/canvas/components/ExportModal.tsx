import * as React from "react";

export type ExportFormat = "json" | "png" | "svg";

export type ExportOptions = {
  fileName: string;         // без расширения
  format: ExportFormat;
  pngScale: 1 | 2;
  transparentBg: boolean;
};

type Props = {
  open: boolean;
  defaultFileName?: string;
  onClose: () => void;
  onConfirm: (opts: ExportOptions) => void;
};

export default function ExportModal({
  open,
  defaultFileName = "diagram",
  onClose,
  onConfirm,
}: Props) {
  const [fileName, setFileName] = React.useState(defaultFileName);
  const [format, setFormat] = React.useState<ExportFormat>("json");
  const [pngScale, setPngScale] = React.useState<1 | 2>(2);
  const [transparentBg, setTransparentBg] = React.useState(true);

  React.useEffect(() => {
    if (!open) return;
    setFileName(defaultFileName || "diagram");
    setFormat("json");
    setPngScale(2);
    setTransparentBg(true);
  }, [open, defaultFileName]);

  if (!open) return null;

  const safeName = (fileName || "").trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onMouseDown={onClose}
      />

      {/* modal */}
      <div
        className="relative w-[520px] max-w-[92vw] rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Экспорт
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Укажи имя файла и формат. PNG/SVG — “скрин” текущего вида диаграммы.
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

        <div className="mt-4 space-y-4">
          {/* filename */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Имя файла
            </label>
            <div className="flex items-center gap-2">
              <input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="diagram"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                .{format}
              </span>
            </div>
          </div>

          {/* format */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Формат
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="json">JSON</option>
                <option value="png">PNG</option>
                <option value="svg">SVG</option>
              </select>
            </div>

            {/* png options */}
            <div className={`transition-opacity ${format === "png" ? "opacity-100" : "opacity-40"}`}>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Качество PNG
              </label>
              <select
                disabled={format !== "png"}
                value={pngScale}
                onChange={(e) => setPngScale((e.target.value === "1" ? 1 : 2))}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed"
              >
                <option value="1">1x</option>
                <option value="2">2x (рекоменд.)</option>
              </select>
            </div>
          </div>

          {/* background */}
          <div className={`flex items-center justify-between rounded-2xl border border-gray-200 dark:border-gray-800 p-3`}>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Прозрачный фон
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Полезно для вставки в документы/презентации.
              </div>
            </div>

            <label className="inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={transparentBg}
                onChange={(e) => setTransparentBg(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-gray-300 peer-checked:bg-indigo-600 rounded-full relative transition">
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-4" />
              </div>
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200"
            onClick={onClose}
          >
            Отмена
          </button>

          <button
            disabled={!safeName}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onConfirm({ fileName: safeName, format, pngScale, transparentBg })}
          >
            Экспортировать
          </button>
        </div>
      </div>
    </div>
  );
}
