// frontend/src/canvas/components/EntitiesLayer.tsx
/**
 * Отрисовка карточек сущностей + добавление/удаление атрибутов.
 * Имя сущности/атрибута: только [A-Za-z0-9_], без ведущей цифры, max 32.
 */

import React, { memo } from "react";
import type { Size } from "../types";
import {
  sanitizeIdentifierInput,
  ENTITY_NAME_MAX,
  ATTR_NAME_MAX,
} from "../utils";

type Attribute = { id: string; name: string; type: string; isPrimaryKey?: boolean };
type EntityVM = { id: string; name: string; x: number; y: number; attributes: Attribute[] };

export type EntitiesLayerProps = {
  entities: EntityVM[];

  /** Размеры карточек, измеренные родителем (в мировых координатах) */
  sizes: Record<string, Size>;

  /** refs карточек, чтобы родитель мог их измерять */
  cardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;

  /** id карточки в режиме редактирования атрибутов */
  editingId: string | null;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;

  /** id карточки в режиме переименования */
  renamingId: string | null;
  setRenamingId: React.Dispatch<React.SetStateAction<string | null>>;

  /** Подсветка: связана ли сущность с выделенной/ховерной связью */
  isLinked: (entityId: string) => boolean;

  /** Обработчики из стора/родителя */
  onMouseDownEntity: (e: React.MouseEvent<HTMLDivElement>, id: string) => void;
  onEntityClick: (id: string, e: React.MouseEvent) => void;
  renameEntity: (id: string, nextName: string) => void;
  removeEntity: (id: string) => void;
  addAttribute: (entityId: string, name: string, type: string, isPk: boolean) => void;
  removeAttribute: (entityId: string, attrId: string) => void;

  /** Локальный стейт ввода нового атрибута (живёт в родителе, чтобы не терялся) */
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

  /** Локальный черновик имени при переименовании (контролируемый input) */
  const [renameDraft, setRenameDraft] = React.useState<string>("");

  // Когда начинаем/переключаем переименование — подхватываем текущее имя
  React.useEffect(() => {
    if (!renamingId) return;
    const ent = entities.find((e) => e.id === renamingId);
    setRenameDraft(ent ? ent.name : "");
  }, [renamingId, entities]);

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
                  onChange={(e) =>
                    setRenameDraft(
                      sanitizeIdentifierInput(e.target.value).slice(0, ENTITY_NAME_MAX)
                    )
                  }
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const next = sanitizeIdentifierInput(renameDraft).slice(0, ENTITY_NAME_MAX).trim();
                      if (next) renameEntity(entity.id, next);
                      setRenamingId(null);
                    }
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onBlur={() => {
                    const next = sanitizeIdentifierInput(renameDraft).slice(0, ENTITY_NAME_MAX).trim();
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
                    removeEntity(entity.id);
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
              {entity.attributes.map((a) => (
                <li
                  key={a.id}
                  className="flex justify-between items-center border-top border-gray-200 dark:border-gray-700 pt-1 mt-1"
                >
                  <span
                    className={`${a.isPrimaryKey ? "font-bold text-indigo-600 dark:text-indigo-300" : ""}`}
                  >
                    {a.isPrimaryKey && "🔑 "}
                    {a.name}: {a.type}
                  </span>
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => removeAttribute(entity.id, a.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                    title="Удалить атрибут"
                  >
                    ✖
                  </button>
                </li>
              ))}
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
                  onChange={(e) => {
                    const filtered = sanitizeIdentifierInput(e.target.value).slice(0, ATTR_NAME_MAX);
                    setNewAttrName(filtered);
                  }}
                  placeholder="имя"
                  maxLength={ATTR_NAME_MAX}
                  className="text-sm p-1 border rounded mr-1 w-28 dark:bg-gray-900 dark:text-gray-100"
                />
                <select
                  value={newAttrType}
                  onChange={(e) => setNewAttrType(e.target.value)}
                  className="text-sm p-1 border rounded mr-1 w-28 dark:bg-gray-900 dark:text-gray-100"
                >
                  {typeOptions.map((t) => (
                    <option key={t || "_"} value={t}>
                      {t || "Тип"}
                    </option>
                  ))}
                </select>
                <label className="text-xs text-gray-600 dark:text-gray-300 mr-2">
                  <input
                    type="checkbox"
                    checked={isPrimaryKey}
                    onChange={(e) => props.setIsPrimaryKey(e.target.checked)}
                    className="mr-1"
                  />
                  PK
                </label>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!newAttrName || !newAttrType) return;
                    addAttribute(entity.id, newAttrName, newAttrType, isPrimaryKey);
                    // reset локального ввода
                    props.setNewAttrName("");
                    props.setNewAttrType("");
                    props.setIsPrimaryKey(false);
                  }}
                  className="text-sm bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-600"
                >
                  +
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/** memo: снижает количество перерендеров слоя при обновлении стора/камеры */
const EntitiesLayer = memo(EntitiesLayerImpl);
export default EntitiesLayer;
