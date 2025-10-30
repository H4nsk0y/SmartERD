/**
 * canvas/components/EntitiesLayer
 * Отрисовка карточек сущностей + добавление/удаление атрибутов.
 * Логика редактирования имени сущности/атрибута вынесена сюда, чтобы разгрузить EditorCanvas.
 * Ввод имён атрибутов ограничен: только [A-Za-z0-9_] и без ведущей цифры (кириллица игнорится).
 */

import React from "react";
import type { Size } from "../types";
import { sanitizeIdentifierInput } from "../utils";

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

  /** Подсветка: функция говорит, связана ли сущность с выделенной/ховерной связью */
  isLinked: (entityId: string) => boolean;

  /** Обработчики из стора/родителя */
  onMouseDownEntity: (e: React.MouseEvent<HTMLDivElement>, id: string) => void;
  onEntityClick: (id: string, e: React.MouseEvent) => void;
  renameEntity: (id: string, nextName: string) => void;
  removeEntity: (id: string) => void;
  addAttribute: (entityId: string, name: string, type: string, isPk: boolean) => void;
  removeAttribute: (entityId: string, attrId: string) => void;

  /** Локальный стейт ввода нового атрибута (держим в родителе, чтобы не терялся при перерендере) */
  newAttrName: string;
  setNewAttrName: React.Dispatch<React.SetStateAction<string>>;
  newAttrType: string;
  setNewAttrType: React.Dispatch<React.SetStateAction<string>>;
  isPrimaryKey: boolean;
  setIsPrimaryKey: React.Dispatch<React.SetStateAction<boolean>>;
};

/** Фильтр ввода идентификатора: удаляем всё, что не [A-Za-z0-9_], не подставляем '_' вместо кириллицы.
 *  Также не даём начинать с цифры.
 */
function filterIdentifier(raw: string): string {
  // оставляем только латиницу/цифры/нижнее подчёркивание
  let s = raw.replace(/[^A-Za-z0-9_]/g, "");
  // без ведущей цифры
  if (/^[0-9]/.test(s)) s = "_" + s;
  return s;
}

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

export default function EntitiesLayer(props: EntitiesLayerProps) {
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

  return (
    <>
      {entities.map((entity) => {
        const linkedByHoverOrSel = isLinked(entity.id);

        return (
          <div
            key={entity.id}
            ref={(el) => {
              if (el) props.cardRefs.current[entity.id] = el;
              else delete props.cardRefs.current[entity.id];
            }}
            className={`absolute z-20 w-56 shadow-md rounded-lg border select-none p-2 transition-all duration-150 ease-out ${
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
                  defaultValue={entity.name}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      renameEntity(
                        entity.id,
                        (e.target as HTMLInputElement).value.trim() || entity.name
                      );
                      setRenamingId(null);
                    }
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onBlur={(e) => {
                    renameEntity(entity.id, e.target.value.trim() || entity.name);
                    setRenamingId(null);
                  }}
                  className="font-semibold text-indigo-700 dark:text-indigo-300 bg-transparent border-b border-indigo-400 focus:outline-none w-32"
                />
              ) : (
                <p
                  className="font-semibold text-indigo-700 dark:text-indigo-300 cursor-text"
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
                  className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-1 mt-1"
                >
                  <span
                    className={`${
                      (a as any).isPrimaryKey
                        ? "font-bold text-indigo-600 dark:text-indigo-300"
                        : ""
                    }`}
                  >
                    {(a as any).isPrimaryKey && "🔑 "}
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
            {editingId === entity.id && (
              <div
                className="mt-2 border-t border-gray-300 dark:border-gray-700 pt-2"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  value={newAttrName}
                  onChange={(e) => {
                    // не подставляем '_' за кириллицу — просто игнорим запрещённые символы
                    const filtered = filterIdentifier(e.target.value);
                    setNewAttrName(filtered);
                  }}
                  // без некрасивых подсказок — просто пустой placeholder
                  placeholder="имя"
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
                    onChange={(e) => setIsPrimaryKey(e.target.checked)}
                    className="mr-1"
                  />
                  PK
                </label>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!newAttrName || !newAttrType) return;
                    addAttribute(entity.id, newAttrName, newAttrType, isPrimaryKey);
                    // сброс локального ввода
                    setNewAttrName("");
                    setNewAttrType("");
                    setIsPrimaryKey(false);
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


export { sanitizeIdentifierInput };
