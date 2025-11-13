/**
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
type EntityVM = { id: string; name: string; x: number; y: number; attributes: Attribute[] };

export type EntitiesLayerProps = {
  entities: EntityVM[];
  sizes: Record<string, Size>;
  cardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;

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

function EntitiesLayerImpl(props: EntitiesLayerProps) {
  const {
    entities,
    cardRefs,
    editingId,
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
    setIsPrimaryKey,
  } = props;

  // из стора: правка существующих атрибутов
  const updateAttributeName = useERStore((s) => s.updateAttributeName);
  const updateAttributeType = useERStore((s) => s.updateAttributeType);
  const setAttributePrimary = useERStore((s) => s.setAttributePrimaryKey);

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
  const [confirmEntity, setConfirmEntity] = React.useState<{ id: string; name: string } | null>(null);

  React.useEffect(() => {
    if (!renamingId) return;
    const ent = entities.find((e) => e.id === renamingId);
    setRenameDraft(ent ? ent.name : "");
  }, [renamingId, entities]);

  const commitAttrEdit = React.useCallback(() => {
    if (!editingAttr) return;
    const cleanName = allowIdentASCII(editingAttr.name, ATTR_NAME_MAX);
    const nextType = (editingAttr.type || "").trim();
    if (cleanName) updateAttributeName(editingAttr.entityId, editingAttr.attrId, cleanName);
    if (nextType)   updateAttributeType(editingAttr.entityId, editingAttr.attrId, nextType);
    setAttributePrimary(editingAttr.entityId, editingAttr.attrId, editingAttr.isPk);
    setEditingAttr(null);
  }, [editingAttr, updateAttributeName, updateAttributeType, setAttributePrimary]);

  return (
    <>
      {entities.map((entity) => {
        const linkedByHoverOrSel = isLinked(entity.id);

        return (
          <div
            key={entity.id}
            ref={(el) => {
              if (el) cardRefs.current[entity.id] = el;
              else delete cardRefs.current[entity.id];
            }}
            data-entity-id={entity.id}
            className={`absolute z-20 w-56 shadow-md rounded-2xl border select-none p-2 transition-all duration-150 ease-out ${
              linkedByHoverOrSel
                ? "border-purple-500 ring-2 ring-purple-400 bg-indigo-50 dark:bg-indigo-900/30 scale-[1.02]"
                : "border-indigo-400 hover:border-indigo-600 hover:scale-[1.02] hover:shadow-lg"
            } bg-white dark:bg-gray-800 text-left`}
            style={{ left: entity.x, top: entity.y }}
            onMouseDown={(e) => onMouseDownEntity(e, entity.id)}
            onClick={(e) => onEntityClick(entity.id, e)}
          >
            {/* Заголовок + действия */}
            <div
              className="flex justify-between items-center cursor-move active:cursor-grabbing"
              onMouseDown={(e) => onMouseDownEntity(e, entity.id)}
            >
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
                  className="font-semibold text-indigo-700 dark:text-indigo-300 bg-transparent border-b border-indigo-400 focus:outline-none w-40"
                  maxLength={ENTITY_NAME_MAX}
                  placeholder="Entity_Name"
                />
              ) : (
                <p
                  className="font-semibold text-indigo-700 dark:text-indigo-300 cursor-text whitespace-nowrap overflow-hidden text-ellipsis max-w-[160px]"
                  title={entity.name}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(entity.id);
                  }}
                >
                  {entity.name}
                </p>
              )}

              <div className="flex items-center gap-2">
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

            {/* Список атрибутов */}
            <ul className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {entity.attributes.map((a) => {
                const isRowEditing =
                  editingAttr && editingAttr.entityId === entity.id && editingAttr.attrId === a.id;

                if (isRowEditing) {
                  const mergedTypeOptions = typeOptions.includes(editingAttr.type)
                    ? typeOptions
                    : [...typeOptions, editingAttr.type];

                  return (
                    <li
                      key={a.id}
                      className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2"
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
                        onChange={(e) =>
                          setEditingAttr((s) => (s ? { ...s, type: e.target.value } : s))
                        }
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

                // режим просмотра
                return (
                  <li
                    key={a.id}
                    className="flex justify-between items-center border-top border-gray-200 dark:border-gray-700 pt-1 mt-1"
                  >
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
