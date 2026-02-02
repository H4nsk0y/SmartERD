import React, { memo, useCallback } from "react";
import type { Size } from "../types";
import { ENTITY_NAME_MAX, ATTR_NAME_MAX } from "../utils";
import { useERStore } from "../../store/useERStore";
import { useAppStore } from "../../store/useAppStore";
import ConfirmModal from "../components/ConfirmModal";

type Attribute = { id: string; name: string; type: string; isPrimaryKey?: boolean };
type EntityVM = {
  id: string;
  name: string;
  x: number;
  y: number;
  attributes: Attribute[];
  color?: string;
};

export type EntitiesLayerProps = {
  entities: EntityVM[];
  sizes: Record<string, Size>;
  cardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;

  selectedEntityIds: Set<string>;
  pulseEntityIds?: Set<string>;
  pulseToken?: number;

  editingId: string | null;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;

  renamingId: string | null;
  setRenamingId: React.Dispatch<React.SetStateAction<string | null>>;

  isLinked: (entityId: string) => boolean;

  onMouseDownEntity: (e: React.MouseEvent<HTMLDivElement>, id: string) => void;
  onEntityClick: (id: string, e: React.MouseEvent) => void;
  renameEntity: (id: string, nextName: string) => void;
  removeEntity: (id: string) => boolean | void;
  addAttribute: (entityId: string, name: string, type: string, isPk: boolean) => void;
  removeAttribute: (entityId: string, attrId: string) => void;

  newAttrName: string;
  setNewAttrName: React.Dispatch<React.SetStateAction<string>>;
  newAttrType: string;
  setNewAttrType: React.Dispatch<React.SetStateAction<string>>;
  isPrimaryKey: boolean;
  setIsPrimaryKey: React.Dispatch<React.SetStateAction<boolean>>;
};

/**
 * Базовые типы — компактно, чтобы новичка не пугать.
 * (Расширенные доступны через Advanced / datalist ниже)
 */
const BASE_TYPE_OPTIONS = [
  "",
  "INT",
  "BIGINT",
  "UUID",
  "VARCHAR(255)",
  "TEXT",
  "DATE",
  "TIMESTAMP",
  "BOOLEAN",
  "FLOAT",
  "DECIMAL(10,2)",
];

/**
 * Расширенные типы — НЕ в <select>, чтобы не делать “простыню”.
 * Появляются только в Advanced (через datalist / поиск).
 * Сюда можно добавлять новые типы без риска “вирвиглазности”.
 */
const ADVANCED_TYPE_SUGGESTIONS = [
  "JSON",
  "JSONB",
  "SMALLINT",
  "REAL",
  "DOUBLE PRECISION",
  "NUMERIC(10,2)",
  "NUMERIC(18,4)",
  "DECIMAL(18,4)",
  "CHAR(36)",
  "VARCHAR(50)",
  "VARCHAR(1024)",
  "TIME",
  "DATETIME",
  "TIMESTAMPTZ",
  "UUID[]",
];

const BASE_TYPE_SET = new Set(BASE_TYPE_OPTIONS.filter(Boolean));
const DL_ID = "smarted_type_suggestions_v1";

/**
 *    Правило идентификатора:
 * - только латиница, цифры, _
 * - не начинаться с цифры
 */
function allowIdentASCII(input: string, max: number) {
  let s = (input ?? "").replace(/[^A-Za-z0-9_]/g, "").slice(0, max);
  s = s.replace(/^\d+/, "");
  return s;
}
function allowAttrNameStart(input: string, max: number) {
  return allowIdentASCII(input, max);
}

/**
 * Тип данных — не идентификатор. Разрешаем полезные символы для типов:
 * A-Z 0-9 _ ( ) , пробел
 */
function sanitizeTypeInput(v: string) {
  return (v ?? "")
    .replace(/[^A-Za-z0-9_(),\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const COLOR_PRESETS: Array<{ id: string; label: string; bg?: string }> = [
  { id: "default", label: "По умолчанию" },
  { id: "sky", label: "Небесный", bg: "rgba(135,206,250,0.25)" },
  { id: "lime", label: "Лаймовый", bg: "rgba(50,205,50,0.25)" },
  { id: "violet", label: "Фиолетовый", bg: "rgba(138,43,226,0.25)" },
  { id: "gold", label: "Золотой", bg: "rgba(255,215,0,0.25)" },
  { id: "turquoise", label: "Бирюзовый", bg: "rgba(64,224,208,0.25)" },
  { id: "slate", label: "Сланцевый", bg: "rgba(112,128,144,0.25)" },
  { id: "orchid", label: "Орхидея", bg: "rgba(218,112,214,0.25)" },
  { id: "khaki", label: "Хаки", bg: "rgba(240,230,140,0.25)" },
  { id: "tomato", label: "Томатный", bg: "rgba(255,99,71,0.25)" },
  { id: "plum", label: "Сливовый", bg: "rgba(221,160,221,0.25)" },
  { id: "wheat", label: "Пшеничный", bg: "rgba(245,222,179,0.25)" },
];

function bgForColorId(colorId?: string) {
  const hit = COLOR_PRESETS.find((c) => c.id === (colorId || "default"));
  return hit?.bg;
}

function EntitiesLayerImpl(props: EntitiesLayerProps) {
  const {
    entities,
    cardRefs,
    selectedEntityIds,
    pulseEntityIds,
    pulseToken,
    setEditingId,
    renamingId,
    setRenamingId,
    isLinked,
    onMouseDownEntity,
    onEntityClick,
    renameEntity,
    removeEntity,
    addAttribute,
    removeAttribute,
    newAttrName,
    setNewAttrName,
    newAttrType,
    setNewAttrType,
    isPrimaryKey,
  } = props;

  const updateAttributeName = useERStore((s) => s.updateAttributeName);
  const updateAttributeType = useERStore((s) => s.updateAttributeType);
  const setAttributePrimary = useERStore((s) => s.setAttributePrimaryKey);
  const setEntityColor = useERStore((s) => s.setEntityColor);
  const confirmDelete = useAppStore((s) => s.confirmDelete);

  const [renameDraft, setRenameDraft] = React.useState<string>("");
  const [editingAttr, setEditingAttr] = React.useState<{
    entityId: string;
    attrId: string;
    name: string;
    type: string;
    isPk: boolean;
  } | null>(null);

  // показываем “Advanced types” только когда пользователь сам попросил
  const [advTypeEditOpen, setAdvTypeEditOpen] = React.useState(false);
  const [advTypeNewOpen, setAdvTypeNewOpen] = React.useState(false);

  const [confirmEntity, setConfirmEntity] = React.useState<{ id: string; name: string } | null>(
    null
  );
  const [colorMenuFor, setColorMenuFor] = React.useState<string | null>(null);
  const colorMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!renamingId) return;
    const ent = entities.find((e) => e.id === renamingId);
    setRenameDraft(ent ? ent.name : "");
  }, [renamingId, entities]);

  React.useEffect(() => {
    if (!colorMenuFor) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setColorMenuFor(null);
    };
    const onDown = (e: MouseEvent) => {
      if (!colorMenuRef.current) return;
      if (!colorMenuRef.current.contains(e.target as Node)) setColorMenuFor(null);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [colorMenuFor]);

  const commitAttrEdit = useCallback(() => {
    if (!editingAttr) return;
    const cleanName = allowAttrNameStart(editingAttr.name, ATTR_NAME_MAX);
    const nextType = sanitizeTypeInput(editingAttr.type || "");
    if (cleanName) updateAttributeName(editingAttr.entityId, editingAttr.attrId, cleanName);
    if (nextType) updateAttributeType(editingAttr.entityId, editingAttr.attrId, nextType);
    setAttributePrimary(editingAttr.entityId, editingAttr.attrId, editingAttr.isPk);
    setEditingAttr(null);
    setAdvTypeEditOpen(false);
  }, [editingAttr, updateAttributeName, updateAttributeType, setAttributePrimary]);

  const handleAddAttribute = useCallback(
    (entityId: string) => {
      const cleanName = allowAttrNameStart(newAttrName, ATTR_NAME_MAX);
      const cleanType = sanitizeTypeInput(newAttrType);
      if (!cleanName.trim() || !cleanType.trim()) return;

      addAttribute(entityId, cleanName, cleanType, isPrimaryKey);
      props.setNewAttrName("");
      props.setNewAttrType("");
      props.setIsPrimaryKey(false);
      setAdvTypeNewOpen(false);
    },
    [newAttrName, newAttrType, isPrimaryKey, addAttribute, props]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      action();
    }
    if (e.key === "Escape") {
      setEditingAttr(null);
      setAdvTypeEditOpen(false);
    }
  }, []);

  const renderTypeSelectOptions = (currentType: string) => {
    const cur = sanitizeTypeInput(currentType || "");
    const isCustom = !!cur && !BASE_TYPE_SET.has(cur);

    return (
      <>
        {isCustom && (
          <option key={`__custom__${cur}`} value={cur}>
            {cur} (custom)
          </option>
        )}
        {BASE_TYPE_OPTIONS.map((t) => (
          <option key={t || "__empty__"} value={t}>
            {t || "Выберите тип"}
          </option>
        ))}
      </>
    );
  };

  return (
    <>
      {/* datalist один на слой */}
      <datalist id={DL_ID}>
        {ADVANCED_TYPE_SUGGESTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {entities.map((entity) => {
        const isSelected = selectedEntityIds.has(entity.id);
        const linkedByHoverOrSel = isLinked(entity.id);
        const isPulsed = pulseEntityIds?.has(entity.id) ?? false;

        const customBg = bgForColorId(entity.color);
        const cardStyle: React.CSSProperties = {
          left: entity.x,
          top: entity.y,
          ...(customBg ? { backgroundColor: customBg } : null),
        };

        return (
          <div
            key={entity.id}
            ref={(el) => {
              if (el) cardRefs.current[entity.id] = el;
              else delete cardRefs.current[entity.id];
            }}
            data-entity-id={entity.id}
            className={`absolute z-20 w-56 shadow-lg rounded-2xl border select-none p-3 transition-all duration-200 ease-out ${
              isSelected
                ? "border-indigo-600 ring-3 ring-indigo-500/30 scale-[1.02] shadow-indigo-500/20"
                : linkedByHoverOrSel
                ? "border-purple-500 ring-3 ring-purple-400/30 scale-[1.02] shadow-purple-500/20"
                : "border-gray-300 dark:border-gray-600 hover:border-indigo-500 hover:scale-[1.02] hover:shadow-xl"
            } bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm text-left`}
            style={cardStyle}
            onMouseDown={(e) => onMouseDownEntity(e, entity.id)}
            onClick={(e) => onEntityClick(entity.id, e)}
          >
            {isPulsed && (
              <>
                <div
                  key={`ping:${entity.id}:${pulseToken ?? 0}`}
                  className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-indigo-400 opacity-60 animate-ping"
                />
                <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-indigo-500 opacity-70" />
              </>
            )}

            {/* Заголовок */}
            <div
              className="flex items-center justify-between gap-2 cursor-move active:cursor-grabbing mb-3"
              onMouseDown={(e) => onMouseDownEntity(e, entity.id)}
            >
              <div className="min-w-0 flex-1">
                {renamingId === entity.id ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(allowIdentASCII(e.target.value, ENTITY_NAME_MAX))}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const next = allowIdentASCII(renameDraft, ENTITY_NAME_MAX);
                        if (next) renameEntity(entity.id, next);
                        setRenamingId(null);
                      }
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => {
                      const next = allowIdentASCII(renameDraft, ENTITY_NAME_MAX);
                      if (next) renameEntity(entity.id, next);
                      setRenamingId(null);
                    }}
                    className="font-bold text-lg text-gray-900 dark:text-gray-100 bg-transparent border-b-2 border-indigo-500 focus:outline-none w-full min-w-0 pb-1 px-1 focus:ring-0 focus:border-indigo-600"
                    maxLength={ENTITY_NAME_MAX}
                    placeholder="Entity_Name"
                  />
                ) : (
                  <p
                    className="font-bold text-lg text-gray-900 dark:text-gray-100 cursor-text whitespace-nowrap overflow-hidden text-ellipsis pb-1 px-1 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded transition-colors"
                    title={entity.name}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(entity.id);
                    }}
                  >
                    {entity.name}
                  </p>
                )}
              </div>

              <div className="relative flex items-center gap-1 shrink-0">
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setColorMenuFor((cur) => (cur === entity.id ? null : entity.id));
                  }}
                  className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="Цвет карточки"
                  aria-label="Цвет карточки"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm12 4a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V8a2 2 0 00-2-2h-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {colorMenuFor === entity.id && (
                  <div
                    ref={colorMenuRef}
                    className="absolute right-0 top-8 z-[80] w-48 rounded-xl p-3 shadow-2xl border"
                    style={{
                      background: "rgba(17,24,39,0.95)",
                      borderColor: "rgba(99,102,241,0.5)",
                      backdropFilter: "blur(8px)",
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-sm font-medium text-gray-200 mb-2 flex justify-between items-center">
                      <span>Цвет карточки</span>
                      <button
                        onClick={() => setColorMenuFor(null)}
                        className="text-xs text-gray-400 hover:text-gray-200"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {COLOR_PRESETS.map((c) => {
                        const selected = (entity.color || "default") === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            title={c.label}
                            aria-label={c.label}
                            className={`h-9 w-9 rounded-lg border-2 transition-all duration-200 transform ${
                              selected ? "ring-2 ring-white scale-110 shadow-lg" : "hover:scale-105 hover:shadow-md"
                            }`}
                            style={{
                              background: c.bg ? c.bg : "rgba(255,255,255,0.1)",
                              borderColor: selected ? "rgba(255,255,255,0.9)" : "rgba(148,163,184,0.3)",
                            }}
                            onClick={() => {
                              setEntityColor(entity.id, c.id);
                              setColorMenuFor(null);
                            }}
                          />
                        );
                      })}
                    </div>

                    <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-700">
                      Esc или клик снаружи
                    </div>
                  </div>
                )}

                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId((cur) => (cur === entity.id ? null : entity.id));
                    setEditingAttr(null);
                    setAdvTypeEditOpen(false);
                    setAdvTypeNewOpen(false);
                  }}
                  className={`p-1.5 rounded-full transition-colors ${
                    props.editingId === entity.id
                      ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30"
                      : "text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-700"
                  }`}
                  title="Редактировать атрибуты"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>

                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirmDelete) {
                      setConfirmEntity({ id: entity.id, name: entity.name });
                    } else {
                      removeEntity(entity.id);
                    }
                  }}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="Удалить сущность"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 011.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <hr className="border-t border-gray-300 dark:border-gray-600 mb-3" />

            {/* Список атрибутов */}
            <ul className="text-sm">
              {entity.attributes.map((a, index) => {
                const isRowEditing =
                  editingAttr && editingAttr.entityId === entity.id && editingAttr.attrId === a.id;

                if (isRowEditing) {
                  return (
                    <li
                      key={a.id}
                      className="mb-2 p-2 bg-indigo-50 dark:bg-gray-700/50 rounded-lg border border-indigo-100 dark:border-gray-600"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                          <input
                            type="checkbox"
                            className="rounded border-gray-400 text-indigo-600 focus:ring-indigo-500"
                            checked={editingAttr.isPk}
                            onChange={(e) =>
                              setEditingAttr((s) => (s ? { ...s, isPk: e.target.checked } : s))
                            }
                          />
                          Первичный ключ
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-full transition-colors"
                            onClick={commitAttrEdit}
                            title="Сохранить"
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                          <button
                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full transition-colors"
                            onClick={() => {
                              setEditingAttr(null);
                              setAdvTypeEditOpen(false);
                            }}
                            title="Отменить"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <input
                          autoFocus
                          className="w-full max-w-full text-sm px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition dark:bg-gray-800 dark:text-gray-100"
                          value={editingAttr.name}
                          maxLength={ATTR_NAME_MAX}
                          onChange={(e) =>
                            setEditingAttr((s) =>
                              s ? { ...s, name: allowAttrNameStart(e.target.value, ATTR_NAME_MAX) } : s
                            )
                          }
                          onKeyDown={(e) => handleKeyDown(e, commitAttrEdit)}
                          placeholder="Имя атрибута"
                        />

                        {/* Тип: базовый select + компактный Advanced */}
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <select
                              className="w-full max-w-full text-sm px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition dark:bg-gray-800 dark:text-gray-100 appearance-none pr-8 cursor-pointer"
                              value={sanitizeTypeInput(editingAttr.type)}
                              onChange={(e) =>
                                setEditingAttr((s) => (s ? { ...s, type: sanitizeTypeInput(e.target.value) } : s))
                              }
                            >
                              {renderTypeSelectOptions(editingAttr.type)}
                            </select>
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>

                          <button
                            type="button"
                            className={`p-2 rounded-md border transition-colors ${
                              advTypeEditOpen
                                ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-500/40"
                                : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700/50"
                            }`}
                            title="Advanced: ввод/поиск типа"
                            onClick={() => setAdvTypeEditOpen((v) => !v)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6V4m0 16v-2m8-6h2M4 12H2m15.364-5.364 1.414-1.414M7.222 16.778l-1.414 1.414m0-12.728L7.222 7.222m10.142 10.142 1.414 1.414"
                              />
                            </svg>
                          </button>
                        </div>

                        {advTypeEditOpen && (
                          <div className="space-y-1">
                            <input
                              className="w-full text-sm px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition dark:bg-gray-800 dark:text-gray-100"
                              value={editingAttr.type}
                              onChange={(e) =>
                                setEditingAttr((s) => (s ? { ...s, type: sanitizeTypeInput(e.target.value) } : s))
                              }
                              onKeyDown={(e) => handleKeyDown(e, commitAttrEdit)}
                              placeholder="Напр: JSON, VARCHAR(50), NUMERIC(10,2)..."
                              list={DL_ID}
                            />
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              Можно вводить вручную. Подсказки появляются при вводе.
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                }

                return (
                  <React.Fragment key={a.id}>
                    {index > 0 && <hr className="border-t border-gray-100 dark:border-gray-700/50 my-1" />}
                    <li className="group flex justify-between items-center py-1.5 px-1 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded transition-colors">
                      <div className="flex items-center min-w-0 flex-1">
                        {a.isPrimaryKey && (
                          <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 mr-1.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded text-xs">
                            PK
                          </span>
                        )}
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div
                            className={`text-sm flex items-center min-w-0 ${
                              a.isPrimaryKey
                                ? "font-semibold text-indigo-700 dark:text-indigo-300"
                                : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            <span className="font-medium truncate flex-shrink-0" title={a.name}>
                              {a.name}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 mx-1 flex-shrink-0">:</span>
                            <span className="font-mono text-gray-600 dark:text-gray-300 truncate flex-1 min-w-0" title={a.type}>
                              {a.type}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => {
                            setEditingAttr({
                              entityId: entity.id,
                              attrId: a.id,
                              name: a.name,
                              type: sanitizeTypeInput(a.type),
                              isPk: !!a.isPrimaryKey,
                            });
                            setAdvTypeEditOpen(false);
                          }}
                          className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-600 rounded transition-colors"
                          title="Редактировать"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => removeAttribute(entity.id, a.id)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-gray-600 rounded transition-colors"
                          title="Удалить"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>

            {/* Добавление нового атрибута */}
            {props.editingId === entity.id && (
              <div
                className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Новый атрибут
                </div>

                <div className="space-y-2">
                  <input
                    value={newAttrName}
                    onChange={(e) => setNewAttrName(allowAttrNameStart(e.target.value, ATTR_NAME_MAX))}
                    onKeyDown={(e) => handleKeyDown(e, () => handleAddAttribute(entity.id))}
                    placeholder="Введите имя"
                    maxLength={ATTR_NAME_MAX}
                    className="w-full text-sm px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition dark:bg-gray-800 dark:text-gray-100"
                  />

                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <select
                          value={sanitizeTypeInput(newAttrType)}
                          onChange={(e) => setNewAttrType(sanitizeTypeInput(e.target.value))}
                          className="w-full text-sm px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition dark:bg-gray-800 dark:text-gray-100 appearance-none pr-8 cursor-pointer"
                        >
                          {renderTypeSelectOptions(newAttrType)}
                        </select>
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`p-2 rounded-md border transition-colors ${
                          advTypeNewOpen
                            ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-500/40"
                            : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700/50"
                        }`}
                        title="Advanced: ввод/поиск типа"
                        onClick={() => setAdvTypeNewOpen((v) => !v)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6V4m0 16v-2m8-6h2M4 12H2m15.364-5.364 1.414-1.414M7.222 16.778l-1.414 1.414m0-12.728L7.222 7.222m10.142 10.142 1.414 1.414"
                          />
                        </svg>
                      </button>

                      <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer shrink-0">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={isPrimaryKey}
                            onChange={(e) => props.setIsPrimaryKey(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 rounded-full peer-checked:bg-indigo-600 transition-colors"></div>
                          <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                        </div>
                        <span className="text-xs font-medium whitespace-nowrap">PK</span>
                      </label>

                      <button
                        onClick={() => handleAddAttribute(entity.id)}
                        disabled={!newAttrName.trim() || !sanitizeTypeInput(newAttrType).trim()}
                        className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all ${
                          newAttrName.trim() && sanitizeTypeInput(newAttrType).trim()
                            ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-700 hover:to-indigo-600 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                        }`}
                        title="Добавить атрибут"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>

                    {advTypeNewOpen && (
                      <div className="space-y-1">
                        <input
                          className="w-full text-sm px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition dark:bg-gray-800 dark:text-gray-100"
                          value={newAttrType}
                          onChange={(e) => setNewAttrType(sanitizeTypeInput(e.target.value))}
                          onKeyDown={(e) => handleKeyDown(e, () => handleAddAttribute(entity.id))}
                          placeholder="Напр: JSON, VARCHAR(50), NUMERIC(10,2)..."
                          list={DL_ID}
                        />
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          Подсказки появляются при вводе. Тип нормализуется (UPPERCASE).
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {confirmEntity && (
        <ConfirmModal
          open={true}
          title="Удалить сущность?"
          message={`Удалить сущность «${confirmEntity.name}» и все её связи?`}
          confirmText="Удалить"
          cancelText="Отмена"
          onCancel={() => setConfirmEntity(null)}
          onConfirm={() => {
            removeEntity(confirmEntity.id);
            setConfirmEntity(null);
          }}
        />
      )}
    </>
  );
}

const EntitiesLayer = memo(EntitiesLayerImpl);
export default EntitiesLayer;
