import * as React from "react";

export type EditorToolbarProps = {
  isLinking: boolean;
  showMinimap: boolean;
  showSqlPanel: boolean;
  showAIPanel: boolean;                 
  onAddEntity: () => void;
  onToggleLink: () => void;
  onExportJSON: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateSQL: () => void;
  onToggleSqlPanel: () => void;
  onToggleAIPanel: () => void;          
  onClearAll: () => void;
  onFitAll: () => void;
  onReset1x: () => void;
  onToggleMinimap: () => void;
};

function IconBtn(
  props: React.PropsWithChildren<
    React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; label: string }
  >
) {
  const { active, label, className, children, ...rest } = props;
  return (
    <button
      className={[
        "tool-btn-sliced tool-btn-icon",
        active ? "ring-2 ring-indigo-400" : "",
        className || "",
      ].join(" ")}
      title={label}
      aria-label={label}
      {...rest}
    >
      <span className="corner-anchor" />
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

export default function EditorToolbar(props: EditorToolbarProps) {
  const {
    isLinking,
    showMinimap,
    showSqlPanel,
    showAIPanel,             
    onAddEntity,
    onToggleLink,
    onExportJSON,
    onImportJSON,
    onGenerateSQL,
    onToggleSqlPanel,
    onToggleAIPanel,         
    onClearAll,
    onFitAll,
    // onReset1x,
    onToggleMinimap,
  } = props;

  return (
    <div className="mb-2 flex items-center gap-3 md:gap-4 flex-nowrap overflow-x-auto px-2 py-1">
      <IconBtn onClick={onAddEntity} label="Добавить сущность">➕</IconBtn>
      <IconBtn onClick={onToggleLink} active={isLinking} label="Связять сущности (вкл/выкл)">🔗</IconBtn>

      <IconBtn onClick={onExportJSON} label="Экспорт JSON">💾</IconBtn>
      <label className="tool-btn-sliced tool-btn-icon cursor-pointer" title="Импорт JSON" aria-label="Импорт JSON">
        <span className="corner-anchor" />
        <span aria-hidden="true">📂</span>
        <input type="file" accept=".json" onChange={onImportJSON} className="hidden" />
      </label>

      <IconBtn onClick={onGenerateSQL} label="Сгенерировать SQL">🧩</IconBtn>

      {/* Взаимоисключаемые панели */}
      <IconBtn onClick={onToggleSqlPanel} active={showSqlPanel} label="SQL-панель (вкл/выкл)">📜</IconBtn>
      <IconBtn onClick={onToggleAIPanel}  active={showAIPanel}  label="AI-панель (вкл/выкл)">🤖</IconBtn>

      <IconBtn onClick={onClearAll} label="Очистить">🗑</IconBtn>
      <IconBtn onClick={onFitAll} label="Fit (вписать всё)">🖼️</IconBtn>
      <IconBtn onClick={onToggleMinimap} active={showMinimap} label="Minimap (вкл/выкл)">🗺️</IconBtn>
    </div>
  );
}
