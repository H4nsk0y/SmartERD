/**
 * canvas/components/RelationInspector
 * Панель настроек связи (FK / Link). Без стора — только UI + коллбеки.
 *
 * Пропсы:
 * - relation: { id, from, to, type, fk?, link? }
 * - entities: [{ id, name, attributes? }]
 * - onClose(): закрыть панель
 * - onSaveFK(patch): сохранить FK-метаданные (partial)
 * - onSaveLink(patch): сохранить Link-метаданные (partial)
 * - onReset(): сбросить метаданные связи (fk/link -> undefined)
 * - fkForm, setFkForm: локальная форма для FK
 * - linkForm, setLinkForm: локальная форма для Link
 *
 * Заметки:
 * - типы и утилиты — из canvas/types и canvas/utils
 * - динамические подсказки по имени FK (показываем, если в целевой таблице уже есть похожее имя)
 * - список типов для select, плюс ручной ввод
 */

import * as React from "react";
import type { FKForm, LinkForm, Action, RelationKind } from "../types";
import { sanitizeIdentifierInput, snake, toSingular } from "../utils";

type Attr = { name: string; type: string; isPrimaryKey?: boolean };
type EntityInfo = { id: string; name: string; attributes?: Attr[] };

export type Relation = {
  id: string;
  from: string;
  to: string;
  type: RelationKind;
  fk?: Partial<FKForm>;
  link?: Partial<LinkForm>;
};

export default function RelationInspector({
  relation,
  entities,
  onClose,
  onSaveFK,
  onSaveLink,
  onReset,
  fkForm,
  setFkForm,
  linkForm,
  setLinkForm,
  refEl,
}: {
  relation: Relation;
  entities: EntityInfo[];
  onClose: () => void;
  onSaveFK: (patch: Partial<FKForm>) => void;
  onSaveLink: (patch: Partial<LinkForm>) => void;
  onReset: () => void;
  fkForm: FKForm;
  setFkForm: React.Dispatch<React.SetStateAction<FKForm>>;
  linkForm: LinkForm;
  setLinkForm: React.Dispatch<React.SetStateAction<LinkForm>>;
  refEl?: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const from = React.useMemo(() => entities.find((e) => e.id === relation.from), [entities, relation.from]);
  const to = React.useMemo(() => entities.find((e) => e.id === relation.to), [entities, relation.to]);

  // динамические подсказки и дефолты
  const fromSingular = snake(toSingular(from?.name || "from"));
  const toSingularNm = snake(toSingular(to?.name || "to"));
  const fromPK = (from?.attributes || []).find((a: any) => a.isPrimaryKey) || { name: "id", type: "INT" as string };
  const toPK = (to?.attributes || []).find((a: any) => a.isPrimaryKey) || { name: "id", type: "INT" as string };
  const defaultFkName = `${fromSingular}_${snake(fromPK.name)}`;

  const toColumns = new Set((to?.attributes || []).map((a: any) => snake(a.name)));
  const similarInTo = toColumns.has(snake(defaultFkName)) ? defaultFkName : null;
  const typedName = fkForm.column?.trim();
  const typedIsDifferentFromSimilar = Boolean(similarInTo && typedName && snake(typedName) !== snake(similarInTo));

  const warningSimilar =
    relation.type !== "many-to-many" &&
    similarInTo &&
    (typedIsDifferentFromSimilar || (typedName && !toColumns.has(snake(typedName))));

  const typeOptions = ["", "INT", "BIGINT", "UUID", "VARCHAR(255)", "TEXT", "DATE", "TIMESTAMP", "BOOLEAN", "FLOAT", "DECIMAL(10,2)"];

  return (
    <div
      ref={refEl as any}
      data-inspector="true"
      className="absolute right-4 top-4 z-50 w-[360px] max-h-[80vh] overflow-auto rounded-xl border shadow-xl bg-white/95 dark:bg-gray-900/95 backdrop-blur p-3"
      style={{ borderColor: "rgba(99,102,241,0.35)" }}
      onKeyDown={(e) => {
        // блокируем удаление связи Backspace/Delete внутри формы
        if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Настройки связи</h3>
        <button
          className="text-sm px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
          onClick={onClose}
        >
          ✖
        </button>
      </div>

      <div className="text-xs text-gray-700 dark:text-gray-300 mb-2">
        {from?.name} <span className="text-indigo-500">→</span> {to?.name} &nbsp;
        (<b>{relation.type === "one-to-one" ? "1:1" : relation.type === "one-to-many" ? "1:N" : "N:M"}</b>)
      </div>

      {relation.type !== "many-to-many" ? (
        <div className="space-y-2">
          <Field label="Имя FK-колонки">
            <input
              className="w-full px-2 py-1 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              value={fkForm.column}
              onChange={(e) => setFkForm((s) => ({ ...s, column: sanitizeIdentifierInput(e.target.value) }))}
              placeholder={`например, ${defaultFkName}`}
            />
          </Field>

          {warningSimilar && (
            <div className="text-[11px] p-2 rounded border bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-100 border-amber-200 dark:border-amber-800">
              В таблице «{to?.name}» уже есть похожая колонка «{similarInTo}», а вы вводите «{fkForm.column || "…"}».<br />
              Если сохранить так, будет добавлена <b>новая</b> колонка.
            </div>
          )}

          <Field label="Тип FK">
            <div className="flex gap-2">
              <select
                className="w-1/2 px-2 py-1 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={typeOptions.includes(fkForm.type) ? fkForm.type : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setFkForm((s) => ({ ...s, type: v }));
                }}
              >
                {typeOptions.map((opt) => (
                  <option key={opt || "_"} value={opt}>
                    {opt || "— выберите —"}
                  </option>
                ))}
              </select>
              <input
                className="w-1/2 px-2 py-1 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={fkForm.type}
                onChange={(e) => setFkForm((s) => ({ ...s, type: e.target.value.toUpperCase() }))}
                placeholder="или введите вручную"
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Check label="NOT NULL" checked={fkForm.notNull !== false} onChange={(v) => setFkForm((s) => ({ ...s, notNull: v }))} />
            <Check label="UNIQUE" checked={!!fkForm.unique} onChange={(v) => setFkForm((s) => ({ ...s, unique: v }))} />
          </div>

          <Field label="ON DELETE">
            <SelectAction value={fkForm.onDelete ?? "CASCADE"} onChange={(v) => setFkForm((s) => ({ ...s, onDelete: v as Action }))} />
          </Field>
          <Field label="ON UPDATE">
            <SelectAction
              value={(fkForm.onUpdate as any) ?? ""}
              onChange={(v) => setFkForm((s) => ({ ...s, onUpdate: (v || undefined) as Action | undefined }))}
              includeEmpty
            />
          </Field>

          <Check label="Создать индекс" checked={fkForm.index !== false} onChange={(v) => setFkForm((s) => ({ ...s, index: v }))} />

          <div className="flex gap-2 pt-2">
            <button className="flex-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700" onClick={() => onSaveFK(fkForm)}>
              ✅ Сохранить
            </button>
            <button
              className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={() => onReset()}
            >
              ↺ Сбросить
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Field label="Имя линк-таблицы">
            <input
              className="w-full px-2 py-1 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              value={linkForm.tableName}
              onChange={(e) => setLinkForm((s) => ({ ...s, tableName: sanitizeIdentifierInput(e.target.value) }))}
              placeholder={`например, ${snake((from?.name || "a") + "_" + (to?.name || "b"))}_link`}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label={`Левый столбец (→ ${from?.name ?? "from"})`}>
              <input
                className="w-full px-2 py-1 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={linkForm.leftColumn}
                onChange={(e) => setLinkForm((s) => ({ ...s, leftColumn: sanitizeIdentifierInput(e.target.value) }))}
                placeholder={`например, ${fromSingular}_${snake((fromPK as any).name || "id")}`}
              />
            </Field>
            <Field label={`Правый столбец (→ ${to?.name ?? "to"})`}>
              <input
                className="w-full px-2 py-1 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={linkForm.rightColumn}
                onChange={(e) => setLinkForm((s) => ({ ...s, rightColumn: sanitizeIdentifierInput(e.target.value) }))}
                placeholder={`например, ${toSingularNm}_${snake((toPK as any).name || "id")}`}
              />
            </Field>
          </div>

          <Check
            label="Составной PRIMARY KEY"
            checked={linkForm.compositePrimaryKey !== false}
            onChange={(v) => setLinkForm((s) => ({ ...s, compositePrimaryKey: v }))}
          />

          <Field label="ON DELETE">
            <SelectAction value={linkForm.onDelete ?? "CASCADE"} onChange={(v) => setLinkForm((s) => ({ ...s, onDelete: v as Action }))} />
          </Field>
          <Field label="ON UPDATE">
            <SelectAction
              value={(linkForm.onUpdate as any) ?? ""}
              onChange={(v) => setLinkForm((s) => ({ ...s, onUpdate: (v || undefined) as Action | undefined }))}
              includeEmpty
            />
          </Field>

          <Check label="Создать индексы по FK" checked={linkForm.index !== false} onChange={(v) => setLinkForm((s) => ({ ...s, index: v }))} />

          <div className="flex gap-2 pt-2">
            <button className="flex-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700" onClick={() => onSaveLink(linkForm)}>
              ✅ Сохранить
            </button>
            <button
              className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={() => onReset()}
            >
              ↺ Сбросить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="block mb-1 text-gray-800 dark:text-gray-100">{label}</span>
      {children}
    </label>
  );
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-100">
      <input type="checkbox" className="accent-indigo-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
function SelectAction({
  value,
  onChange,
  includeEmpty,
}: {
  value: "" | Action;
  onChange: (v: "" | Action) => void;
  includeEmpty?: boolean;
}) {
  return (
    <select
      className="w-full px-2 py-1 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      value={value}
      onChange={(e) => onChange(e.target.value as any)}
    >
      {includeEmpty && <option value="">(не указывать)</option>}
      <option value="CASCADE">CASCADE</option>
      <option value="SET NULL">SET NULL</option>
      <option value="RESTRICT">RESTRICT</option>
      <option value="NO ACTION">NO ACTION</option>
    </select>
  );
}
