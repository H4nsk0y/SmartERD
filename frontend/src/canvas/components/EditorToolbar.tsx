import * as React from "react";

export type EditorToolbarProps = {
  isLinking: boolean;
  showMinimap: boolean;
  showSqlPanel: boolean;                    // NEW
  onAddEntity: () => void;
  onToggleLink: () => void;
  onExportJSON: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateSQL: () => void;
  onToggleSqlPanel: () => void;             // NEW
  onClearAll: () => void;
  onFitAll: () => void;
  onReset1x: () => void;
  onToggleMinimap: () => void;
};

export default function EditorToolbar(props: EditorToolbarProps) {
  const {
    isLinking,
    showMinimap,
    showSqlPanel,            // NEW
    onAddEntity,
    onToggleLink,
    onExportJSON,
    onImportJSON,
    onGenerateSQL,
    onToggleSqlPanel,        // NEW
    onClearAll,
    onFitAll,
    onReset1x,
    onToggleMinimap,
  } = props;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <button className="tool-btn-sliced" onClick={onAddEntity}>
        <span className="corner-anchor" />+ Сущность
      </button>

      <button className="tool-btn-sliced" onClick={onToggleLink}>
        <span className="corner-anchor" />🔗 Связь{isLinking ? " (ON)" : ""}
      </button>

      <button className="tool-btn-sliced" onClick={onExportJSON}>
        <span className="corner-anchor" />💾 Экспорт JSON
      </button>

      <label className="tool-btn-sliced cursor-pointer">
        <span className="corner-anchor" />📂 Импорт JSON
        <input type="file" accept=".json" onChange={onImportJSON} className="hidden" />
      </label>

      <button className="tool-btn-sliced" onClick={onGenerateSQL}>
        <span className="corner-anchor" />🧩 Сгенерировать SQL
      </button>

      {/* NEW: Переключатель SQL-панели — строго после «Сгенерировать SQL» */}
      <button className="tool-btn-sliced" onClick={onToggleSqlPanel}>
        <span className="corner-anchor" />
        {showSqlPanel ? "SQL панель: On" : "SQL панель: Off"}
      </button>

      <button className="tool-btn-sliced" onClick={onClearAll}>
        <span className="corner-anchor" />🗑 Очистить
      </button>

      <button className="tool-btn-sliced" onClick={onFitAll}>
        <span className="corner-anchor" />Fit
      </button>

      <button className="tool-btn-sliced" onClick={onReset1x}>
        <span className="corner-anchor" />1:1
      </button>

      <button
        className="tool-btn-sliced"
        onClick={onToggleMinimap}
        title={showMinimap ? "Скрыть мини-карту" : "Показать мини-карту"}
      >
        <span className="corner-anchor" />
        {showMinimap ? "Minimap: On" : "Minimap: Off"}
      </button>
    </div>
  );
}
