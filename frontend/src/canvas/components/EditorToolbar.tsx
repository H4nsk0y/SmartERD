// frontend/src/canvas/components/EditorToolbar.tsx
import * as React from "react";
import { useAppStore } from "../../store/useAppStore";

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
  onToggleMinimap: () => void;

  // На будущее: появится, когда будет авторизация и БД
  onSaveProject?: () => void;
  canSaveProject?: boolean;
};

function Icon({
  children,
  className = "",
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <span className={["inline-flex items-center justify-center", className].join(" ")}>
      {children}
    </span>
  );
}

function Svg({
  children,
  className = "",
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const I = {
  plus: (
    <Svg>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  ),
  link: (
    <Svg>
      <path d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 0 1 7 7L17 13" />
      <path d="M14 11a5 5 0 0 1 0 7L12.5 19.5a5 5 0 0 1-7-7L7 11" />
    </Svg>
  ),
  download: (
    <Svg>
      <path d="M12 3v10" />
      <path d="M8 9l4 4 4-4" />
      <path d="M4 17v3h16v-3" />
    </Svg>
  ),
  upload: (
    <Svg>
      <path d="M12 21V11" />
      <path d="M8 15l4-4 4 4" />
      <path d="M4 7V4h16v3" />
    </Svg>
  ),
  sql: (
    <Svg>
      <path d="M8 9l-3 3 3 3" />
      <path d="M16 9l3 3-3 3" />
      <path d="M10 19l4-14" />
    </Svg>
  ),
  panel: (
    <Svg>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
    </Svg>
  ),
  bot: (
    <Svg>
      <path d="M12 8V4" />
      <path d="M9 4h6" />
      <rect x="6" y="8" width="12" height="12" rx="3" />
      <path d="M9 13h.01" />
      <path d="M15 13h.01" />
      <path d="M9 17c1.5 1 4.5 1 6 0" />
    </Svg>
  ),
  fit: (
    <Svg>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </Svg>
  ),
  map: (
    <Svg>
      <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </Svg>
  ),
  trash: (
    <Svg>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Svg>
  ),
  save: (
    <Svg>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </Svg>
  ),
};

function Separator() {
  return <div className="mx-1 h-7 w-px bg-gray-200 dark:bg-gray-700 shrink-0" />;
}

function Btn({
  compact,
  active,
  label,
  onClick,
  icon,
  danger,
  disabled,
}: {
  compact: boolean;
  active?: boolean;
  label: string;
  onClick?: () => void;
  icon: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  const base = compact ? "tool-btn-icon tool-btn-sliced" : "tool-btn-wide";
  const ring = active ? "ring-2 ring-indigo-400" : "";
  const dangerCls = danger
    ? "border-red-300 dark:border-red-700/60 bg-red-50/80 dark:bg-red-900/25 hover:bg-red-100 dark:hover:bg-red-900/35"
    : "";
  return (
    <button
      type="button"
      className={[base, ring, dangerCls].join(" ")}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="corner-anchor" />
      <Icon className={compact ? "" : "text-indigo-700 dark:text-indigo-200"}>{icon}</Icon>
      {!compact && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}

function FileBtn({
  compact,
  label,
  icon,
  accept,
  onChange,
}: {
  compact: boolean;
  label: string;
  icon: React.ReactNode;
  accept: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const cls = compact ? "tool-btn-icon tool-btn-sliced" : "tool-btn-wide";
  return (
    <label className={[cls, "cursor-pointer"].join(" ")} title={label} aria-label={label}>
      <span className="corner-anchor" />
      <Icon className={compact ? "" : "text-indigo-700 dark:text-indigo-200"}>{icon}</Icon>
      {!compact && <span className="text-sm font-medium">{label}</span>}
      <input type="file" accept={accept} onChange={onChange} className="hidden" />
    </label>
  );
}

export default function EditorToolbar(props: EditorToolbarProps) {
  const compactToolbar = useAppStore((s) => s.compactToolbar);

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
    onToggleMinimap,

    onSaveProject,
    canSaveProject,
  } = props;

  const compact = compactToolbar;

  return (
    <div className="mb-2 flex items-center gap-2 flex-nowrap overflow-x-auto px-2 py-1">
      {/* Создание/связи */}
      <Btn compact={compact} onClick={onAddEntity} label="Сущность" icon={I.plus} />
      <Btn
        compact={compact}
        onClick={onToggleLink}
        active={isLinking}
        label="Связь"
        icon={I.link}
      />

      <Separator />

      {/* Импорт/экспорт */}
      <Btn compact={compact} onClick={onExportJSON} label="Экспорт" icon={I.download} />
      <FileBtn
        compact={compact}
        label="Импорт"
        icon={I.upload}
        accept=".json,application/json"
        onChange={onImportJSON}
      />

      {/* На будущее: сохранение проекта в аккаунт */}
      {canSaveProject && onSaveProject && (
        <Btn compact={compact} onClick={onSaveProject} label="Сохранить" icon={I.save} />
      )}

      <Separator />

      {/* Генерация */}
      <Btn compact={compact} onClick={onGenerateSQL} label="SQL" icon={I.sql} />

      <Separator />

      {/* Панели */}
      <Btn
        compact={compact}
        onClick={onToggleSqlPanel}
        active={showSqlPanel}
        label="SQL панель"
        icon={I.panel}
      />
      <Btn
        compact={compact}
        onClick={onToggleAIPanel}
        active={showAIPanel}
        label="AI панель"
        icon={I.bot}
      />

      <Separator />

      {/* Вид */}
      <Btn compact={compact} onClick={onFitAll} label="Вписать" icon={I.fit} />
      <Btn
        compact={compact}
        onClick={onToggleMinimap}
        active={showMinimap}
        label="Миникарта"
        icon={I.map}
      />

      <Separator />

      {/* Потенциально опасное */}
      <Btn compact={compact} onClick={onClearAll} label="Очистить" icon={I.trash} danger />
    </div>
  );
}
