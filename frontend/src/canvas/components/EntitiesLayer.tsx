/** frontend/src/canvas/components/EntitiesLayer.tsx
 * Отрисовка карточек сущностей + добавление/удаление/редактирование атрибутов.
 * Карточка НЕ меняет размеры; редактор атрибута — компактный, в несколько строк.
 */

import React, { memo } from "react";
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
  color?: string; // NEW
};

export type EntitiesLayerProps = {
  entities: EntityVM[];
  sizes: Record<string, Size>;
  cardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;

  selectedEntityIds: Set<string>;

  // NEW: pulse/highlight after jump
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
  removeEntity: (id: string) => void;
  addAttribute: (entityId: string, name: string, type: string, isPk: boolean) => void;
  removeAttribute: (entityId: string, attrId: string) => void;

  newAttrName: string;
  setNewAttrName: React.Dispatch<React.SetStateAction<string>>;
  newAttrType: string;
  setNewAttrType: React.Dispatch<React.SetStateAction<string>>;
  isPrimaryKey: boolean;
  setIsPrimaryKey: React.Dispatch<React.SetStateAction<boolean>>;
};

const typeOptions = [
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

function allowIdentASCII(input: string, max: number) {
  return (input ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, max);
}

/**Палитра (детерминированные пресеты, чтобы было единообразно) */
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

  // из стора: правка существующих атрибутов
  const updateAttributeName = useERStore((s) => s.updateAttributeName);
  const updateAttributeType = useERStore((s) => s.updateAttributeType);
  const setAttributePrimary = useERStore((s) => s.setAttributePrimaryKey);

  // NEW: цвет сущности
  const setEntityColor = useERStore((s) => s.setEntityColor);

  // настройка подтверждения удаления
  const confirmDelete = useAppStore((s) => s.confirmDelete);

  // черновик имени сущности при переименовании
  const [renameDraft, setRenameDraft] = React.useState<string>("");

  // инлайн-редактор строки атрибута
  const [editingAttr, setEditingAttr] = React.useState<{
    entityId: string;
    attrId: string;
    name: string;
    type: string;
    isPk: boolean;
  } | null>(null);

  // подтверждение удаления сущности
  const [confirmEntity, setConfirmEntity] = React.useState<{ id: string; name: string } | null>(
    null
  );

  // NEW: меню палитры (открыто только для одной сущности)
  const [colorMenuFor, setColorMenuFor] = React.useState<string | null>(null);
  const colorMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!renamingId) return;
    const ent = entities.find((e) => e.id === renamingId);
    setRenameDraft(ent ? ent.name : "");
  }, [renamingId, entities]);

  // NEW: закрытие палитры по Esc / клику снаружи
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

  const commitAttrEdit = React.useCallback(() => {
    if (!editingAttr) return;
    const cleanName = allowIdentASCII(editingAttr.name, ATTR_NAME_MAX);
    const nextType = (editingAttr.type || "").trim();
    if (cleanName) updateAttributeName(editingAttr.entityId, editingAttr.attrId, cleanName);
    if (nextType) updateAttributeType(editingAttr.entityId, editingAttr.attrId, nextType);
    setAttributePrimary(editingAttr.entityId, editingAttr.attrId, editingAttr.isPk);
    setEditingAttr(null);
  }, [editingAttr, updateAttributeName, updateAttributeType, setAttributePrimary]);

  return (
    <>
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
            className={`absolute z-20 w-56 shadow-md rounded-2xl border select-none p-2 transition-all duration-150 ease-out ${
              isSelected
                ? "border-indigo-600 ring-2 ring-indigo-400 scale-[1.02]"
                : linkedByHoverOrSel
                ? "border-purple-500 ring-2 ring-purple-400 scale-[1.02]"
                : "border-indigo-400 hover:border-indigo-600 hover:scale-[1.02] hover:shadow-lg"
            } bg-white dark:bg-gray-800 text-left`}
            style={cardStyle}
            onMouseDown={(e) => onMouseDownEntity(e, entity.id)}
            onClick={(e) => onEntityClick(entity.id, e)}
          >
            {/* NEW: pulse overlay (после Jump to issue) */}
            {isPulsed && (
              <>
                <div
                  key={`ping:${entity.id}:${pulseToken ?? 0}`}
                  className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-indigo-400 opacity-60 animate-ping"
                />
                <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-indigo-500 opacity-70" />
              </>
            )}

            {/* Заголовок + действия - ОБНОВЛЕННЫЙ ДИЗАЙН */}
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
                    className="font-bold text-lg text-gray-900 dark:text-gray-100 bg-transparent border-b-2 border-indigo-500 focus:outline-none w-full min-w-0 pb-1"
                    maxLength={ENTITY_NAME_MAX}
                    placeholder="Entity_Name"
                  />
                ) : (
                  <p
                    className="font-bold text-lg text-gray-900 dark:text-gray-100 cursor-text whitespace-nowrap overflow-hidden text-ellipsis pb-1"
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

              <div className="relative flex items-center gap-2 shrink-0">
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setColorMenuFor((cur) => (cur === entity.id ? null : entity.id));
                  }}
                  className="text-sm text-gray-500 hover:text-indigo-500"
                  title="Цвет карточки"
                  aria-label="Цвет карточки"
                >
                  🎨
                </button>

                {colorMenuFor === entity.id && (
                  <div
                    ref={colorMenuRef}
                    className="absolute right-0 top-6 z-[80] w-44 rounded-xl p-2 shadow-2xl border"
                    style={{
                      background: "rgba(17,24,39,0.92)",
                      borderColor: "rgba(99,102,241,0.45)",
                      backdropFilter: "blur(6px)",
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-xs text-gray-200 mb-2">Цвет карточки</div>

                    <div className="grid grid-cols-4 gap-2">
                      {COLOR_PRESETS.map((c) => {
                        const selected = (entity.color || "default") === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            title={c.label}
                            aria-label={c.label}
                            className={`h-8 w-8 rounded-lg border transition ${
                              selected ? "ring-2 ring-indigo-400" : "hover:scale-[1.03]"
                            }`}
                            style={{
                              background: c.bg ? c.bg : "rgba(255,255,255,0.08)",
                              borderColor: selected
                                ? "rgba(129,140,248,0.85)"
                                : "rgba(148,163,184,0.25)",
                            }}
                            onClick={() => {
                              setEntityColor(entity.id, c.id);
                              setColorMenuFor(null);
                            }}
                          />
                        );
                      })}
                    </div>

                    <div className="mt-2 text-[11px] text-gray-300 opacity-80">
                      Esc / клик снаружи — закрыть
                    </div>
                  </div>
                )}

                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId((cur) => (cur === entity.id ? null : entity.id));
                    setEditingAttr(null);
                  }}
                  className="text-sm text-gray-500 hover:text-indigo-500"
                  title="Редактировать атрибуты"
                >
                  ⚙️
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
                  className="text-sm text-red-500 hover:text-red-700"
                  title="Удалить сущность"
                >
                  🗑
                </button>
              </div>
            </div>

            {/* Горизонтальная линия-разделитель */}
            <hr className="border-t-2 border-gray-400 dark:border-gray-500 mb-3" />

            {/* Список атрибутов */}
            <ul className="text-sm text-gray-700 dark:text-gray-300">
              {entity.attributes.map((a, index) => {
                const isRowEditing =
                  editingAttr && editingAttr.entityId === entity.id && editingAttr.attrId === a.id;

                if (isRowEditing) {
                  const mergedTypeOptions = typeOptions.includes(editingAttr.type)
                    ? typeOptions
                    : [...typeOptions, editingAttr.type];

                  return (
                    <li
                      key={a.id}
                      className="pt-2 mt-2"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs flex items-center gap-1">
                          <input
                            type="checkbox"
                            className="mr-1"
                            checked={editingAttr.isPk}
                            onChange={(e) =>
                              setEditingAttr((s) => (s ? { ...s, isPk: e.target.checked } : s))
                            }
                          />
                          PK
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                            onClick={commitAttrEdit}
                          >
                            ✓
                          </button>
                          <button
                            className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                            onClick={() => setEditingAttr(null)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <input
                        autoFocus
                        className="w-full text-sm p-1 border rounded mb-1 dark:bg-gray-900 dark:text-gray-100"
                        value={editingAttr.name}
                        maxLength={ATTR_NAME_MAX}
                        onChange={(e) =>
                          setEditingAttr((s) =>
                            s ? { ...s, name: allowIdentASCII(e.target.value, ATTR_NAME_MAX) } : s
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitAttrEdit();
                          if (e.key === "Escape") setEditingAttr(null);
                        }}
                      />

                      <select
                        className="w-full text-sm p-1 border rounded dark:bg-gray-900 dark:text-gray-100"
                        value={editingAttr.type}
                        onChange={(e) => setEditingAttr((s) => (s ? { ...s, type: e.target.value } : s))}
                      >
                        {mergedTypeOptions.map((t) => (
                          <option key={t || "_"} value={t}>
                            {t || "Тип"}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                }

                return (
                  <React.Fragment key={a.id}>
                    {index > 0 && (
                      <hr className="border-t border-gray-100 dark:border-gray-700 my-1" />
                    )}
                    <li className="flex justify-between items-center py-1">
                      <span className={`${a.isPrimaryKey ? "font-bold text-indigo-600 dark:text-indigo-300" : ""}`}>
                        {a.isPrimaryKey && "🔑 "}
                        {a.name}: {a.type}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() =>
                            setEditingAttr({
                              entityId: entity.id,
                              attrId: a.id,
                              name: a.name,
                              type: a.type,
                              isPk: !!a.isPrimaryKey,
                            })
                          }
                          className="text-xs text-gray-500 hover:text-indigo-600"
                          title="Редактировать атрибут"
                        >
                          ✎
                        </button>
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => removeAttribute(entity.id, a.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                          title="Удалить атрибут"
                        >
                          ✖
                        </button>
                      </div>
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>

            {/* Редактор: добавить атрибут */}
            {props.editingId === entity.id && (
              <div
                className="mt-2 border-t border-gray-300 dark:border-gray-700 pt-2"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  value={newAttrName}
                  onChange={(e) => setNewAttrName(allowIdentASCII(e.target.value, ATTR_NAME_MAX))}
                  placeholder="имя"
                  maxLength={ATTR_NAME_MAX}
                  className="w-full text-sm p-1 border rounded mb-1 dark:bg-gray-900 dark:text-gray-100"
                />
                <div className="flex gap-2 items-center">
                  <select
                    value={newAttrType}
                    onChange={(e) => setNewAttrType(e.target.value)}
                    className="flex-1 text-sm p-1 border rounded dark:bg-gray-900 dark:text-gray-100"
                  >
                    {typeOptions.map((t) => (
                      <option key={t || "_"} value={t}>
                        {t || "Тип"}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={isPrimaryKey}
                      onChange={(e) => props.setIsPrimaryKey(e.target.checked)}
                    />
                    PK
                  </label>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!newAttrName || !newAttrType) return;
                      addAttribute(entity.id, newAttrName, newAttrType, isPrimaryKey);
                      props.setNewAttrName("");
                      props.setNewAttrType("");
                      props.setIsPrimaryKey(false);
                    }}
                    className="text-sm bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-600"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Модалка подтверждения удаления сущности */}
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