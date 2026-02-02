/**
 * canvas/components/RelationInspector
 * Панель настроек связи (FK / Link). Без стора — только UI + коллбеки.
 */

import * as React from "react";
import type { FKForm, LinkForm, Action, RelationKind } from "../types";
import { snake, toSingular } from "../utils";

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

function useIsDarkMode() {
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return isDark;
}

/**
 *    Правило идентификатора:
 * - только латиница, цифры, _
 * - не начинаться с цифры
 */
function sanitizeStrictIdent(v: string) {
  let s = (v ?? "").replace(/[^A-Za-z0-9_]/g, "");
  s = s.replace(/^[0-9]+/, "");
  return s;
}

/**
 * Базовые типы — компактно (новичкам не страшно).
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
 * Расширенные типы — только в Advanced input (datalist), чтобы не делать “простыню”.
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
const DL_ID = "smarted_fk_type_suggestions_v1";

function sanitizeTypeInput(v: string) {
  return (v ?? "")
    .replace(/[^A-Za-z0-9_(),\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-black/5 text-gray-900 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white">
      {children}
    </span>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <div className="min-w-0">
        <div className="font-semibold text-gray-900 dark:text-white">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-gray-600 dark:text-white/60">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 bg-black/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/[0.04] cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors">
      <div className="min-w-0">
        <div className="font-semibold text-gray-900 dark:text-white">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-gray-600 dark:text-white/60">{hint}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "relative h-8 w-14 rounded-full border transition",
        checked
          ? "border-indigo-400/40 bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/25"
          : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/10",
      ].join(" ")}
      aria-pressed={checked}
    >
      <span
        className={[
          "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition",
          checked ? "left-7" : "left-1",
        ].join(" ")}
      />
      {checked && (
        <span className="pointer-events-none absolute -right-1 -top-1">
          <span className="absolute inline-flex h-3 w-3 rounded-full bg-indigo-400 opacity-70 motion-safe:animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-500" />
        </span>
      )}
    </button>
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
      className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/60 text-gray-900 dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-indigo-400/30"
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
  const isDark = useIsDarkMode();

  const from = React.useMemo(() => entities.find((e) => e.id === relation.from), [entities, relation.from]);
  const to = React.useMemo(() => entities.find((e) => e.id === relation.to), [entities, relation.to]);

  const [flash, setFlash] = React.useState<null | "saved" | "reset">(null);
  React.useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1500);
    return () => clearTimeout(t);
  }, [flash]);

  const [advTypeOpen, setAdvTypeOpen] = React.useState(false);

  const fromSingular = snake(toSingular(from?.name || "from"));
  const toSingularNm = snake(toSingular(to?.name || "to"));

  const fromPK =
    (from?.attributes || []).find((a: any) => a.isPrimaryKey) ||
    ({ name: "id", type: "INT" as string } as any);

  const toPK =
    (to?.attributes || []).find((a: any) => a.isPrimaryKey) ||
    ({ name: "id", type: "INT" as string } as any);

  const defaultFkName = `${fromSingular}_${snake(fromPK.name)}`;

  const toColumns = new Set((to?.attributes || []).map((a: any) => snake(a.name)));
  const similarInTo = toColumns.has(snake(defaultFkName)) ? defaultFkName : null;

  const typedName = fkForm.column?.trim();
  const typedIsDifferentFromSimilar = Boolean(similarInTo && typedName && snake(typedName) !== snake(similarInTo));

  const warningSimilar =
    relation.type !== "many-to-many" &&
    similarInTo &&
    (typedIsDifferentFromSimilar || (typedName && !toColumns.has(snake(typedName))));

  const relationTypeLabel =
    relation.type === "one-to-one" ? "1:1" : relation.type === "one-to-many" ? "1:N" : "N:M";

  const fkTypeValue = sanitizeTypeInput(fkForm.type ?? "");
  const fkTypeIsCustom = !!fkTypeValue && !BASE_TYPE_SET.has(fkTypeValue);

  return (
    <div
      ref={refEl as any}
      className="absolute right-6 top-6 z-50 w-[420px] max-h-[85vh] overflow-auto rounded-[28px] border border-black/10 shadow-[0_20px_60px_-18px_rgba(0,0,0,0.35)] bg-white/90 dark:border-white/10 dark:bg-white/[0.08] backdrop-blur-xl p-6"
      onKeyDown={(e) => {
        if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {/* datalist для Advanced типов */}
      <datalist id={DL_ID}>
        {ADVANCED_TYPE_SUGGESTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <IconWrap>{"🔗"}</IconWrap>
          <div className="min-w-0">
            <div className="text-lg font-extrabold text-gray-900 dark:text-white">
              Настройки связи
            </div>
            <div className="mt-0.5 text-sm text-gray-600 dark:text-white/60">
              {from?.name} <span className="text-indigo-500 font-bold">→</span> {to?.name} •{" "}
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{relationTypeLabel}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-2xl border border-black/5 bg-black/[0.03] p-2 text-gray-700 hover:bg-black/5 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/10 transition-colors"
          onClick={onClose}
          title="Закрыть"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {flash && (
        <div
          className={`mb-4 inline-flex items-center gap-2 text-sm px-4 py-2 rounded-2xl transition-all ${
            flash === "saved"
              ? "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200 border border-green-200 dark:border-green-800"
              : "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800"
          }`}
        >
          <span className={`inline-block w-2 h-2 rounded-full ${flash === "saved" ? "bg-green-500" : "bg-yellow-500"}`}></span>
          {flash === "saved" ? "Настройки сохранены" : "Настройки сброшены"}
        </div>
      )}

      <div className="space-y-5">
        {relation.type !== "many-to-many" ? (
          <>
            <Field label="Имя FK-колонки" hint={`например, ${defaultFkName}`}>
              <input
                className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/60 text-gray-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white placeholder-gray-500 dark:placeholder-white/40 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-indigo-400/30"
                value={fkForm.column}
                onChange={(e) => setFkForm((s) => ({ ...s, column: sanitizeStrictIdent(e.target.value) }))}
                placeholder={defaultFkName}
              />
            </Field>

            {warningSimilar && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
                <div className="font-semibold mb-1">⚠️ Внимание</div>
                В таблице «{to?.name}» уже есть колонка «{similarInTo}».<br />
                Если сохранить «{fkForm.column || "…"}», будет создана <b>новая колонка</b>.
              </div>
            )}

            {/* Тип FK: компактный select + Advanced (исправлен белый dropdown) */}
            <Field label="Тип данных FK" hint="Базовые типы — в списке. Сложные — через Advanced.">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/60 text-gray-900 dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-indigo-400/30"
                    style={{ colorScheme: isDark ? "dark" : "light" }}
                    value={fkTypeValue}
                    onChange={(e) => {
                      const v = sanitizeTypeInput(e.target.value);
                      setFkForm((s) => ({ ...s, type: v }));
                    }}
                  >
                    {fkTypeIsCustom && (
                      <option value={fkTypeValue}>{fkTypeValue} (custom)</option>
                    )}
                    {BASE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt || "__empty__"} value={opt}>
                        {opt || "— выбрать тип —"}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className={`px-3 py-3 rounded-2xl border transition-colors text-sm font-semibold ${
                    advTypeOpen
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-500/40"
                      : "border-black/10 bg-white/70 text-gray-700 hover:bg-white/90 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.10]"
                  }`}
                  onClick={() => setAdvTypeOpen((v) => !v)}
                  title="Advanced: ввод/поиск типа"
                >
                  Advanced
                </button>
              </div>

              {advTypeOpen && (
                <div className="mt-2 space-y-1">
                  <input
                    className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/60 text-gray-900 dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-indigo-400/30"
                    style={{ colorScheme: isDark ? "dark" : "light" }}
                    value={fkTypeValue}
                    onChange={(e) => setFkForm((s) => ({ ...s, type: sanitizeTypeInput(e.target.value) }))}
                    placeholder="Напр: JSON, VARCHAR(50), NUMERIC(10,2)..."
                    list={DL_ID}
                  />
                  <div className="text-xs text-gray-600 dark:text-white/60">
                    Подсказки появляются при вводе. Тип нормализуется (UPPERCASE).
                  </div>
                </div>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Check
                label="NOT NULL"
                hint="Обязательное поле"
                checked={fkForm.notNull !== false}
                onChange={(v) => setFkForm((s) => ({ ...s, notNull: v }))}
              />
              <Check
                label="UNIQUE"
                hint="Уникальное значение"
                checked={!!fkForm.unique}
                onChange={(v) => setFkForm((s) => ({ ...s, unique: v }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="ON DELETE" hint="При удалении">
                <SelectAction
                  value={fkForm.onDelete ?? "CASCADE"}
                  onChange={(v) => setFkForm((s) => ({ ...s, onDelete: v as Action }))}
                />
              </Field>
              <Field label="ON UPDATE" hint="При обновлении">
                <SelectAction
                  value={(fkForm.onUpdate as any) ?? ""}
                  onChange={(v) => setFkForm((s) => ({ ...s, onUpdate: (v || undefined) as Action | undefined }))}
                  includeEmpty
                />
              </Field>
            </div>

            <Check
              label="Создать индекс"
              hint="Ускоряет поиск по внешнему ключу"
              checked={fkForm.index !== false}
              onChange={(v) => setFkForm((s) => ({ ...s, index: v }))}
            />
          </>
        ) : (
          <>
            <Field label="Имя линк-таблицы" hint={`например, ${snake((from?.name || "a") + "_" + (to?.name || "b"))}_link`}>
              <input
                className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/60 text-gray-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white placeholder-gray-500 dark:placeholder-white/40 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-indigo-400/30"
                value={linkForm.tableName}
                onChange={(e) => setLinkForm((s) => ({ ...s, tableName: sanitizeStrictIdent(e.target.value) }))}
                placeholder={`${snake((from?.name || "a") + "_" + (to?.name || "b"))}_link`}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Колонка → ${from?.name ?? "from"}`} hint={`например, ${fromSingular}_${snake((fromPK as any).name || "id")}`}>
                <input
                  className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/60 text-gray-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white placeholder-gray-500 dark:placeholder-white/40 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-indigo-400/30"
                  value={linkForm.leftColumn}
                  onChange={(e) => setLinkForm((s) => ({ ...s, leftColumn: sanitizeStrictIdent(e.target.value) }))}
                  placeholder={`${fromSingular}_${snake((fromPK as any).name || "id")}`}
                />
              </Field>

              <Field label={`Колонка → ${to?.name ?? "to"}`} hint={`например, ${toSingularNm}_${snake((toPK as any).name || "id")}`}>
                <input
                  className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white/60 text-gray-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white placeholder-gray-500 dark:placeholder-white/40 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-indigo-400/30"
                  value={linkForm.rightColumn}
                  onChange={(e) => setLinkForm((s) => ({ ...s, rightColumn: sanitizeStrictIdent(e.target.value) }))}
                  placeholder={`${toSingularNm}_${snake((toPK as any).name || "id")}`}
                />
              </Field>
            </div>

            <Check
              label="Составной PRIMARY KEY"
              hint="Использовать обе колонки как первичный ключ"
              checked={linkForm.compositePrimaryKey !== false}
              onChange={(v) => setLinkForm((s) => ({ ...s, compositePrimaryKey: v }))}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label="ON DELETE" hint="При удалении">
                <SelectAction
                  value={linkForm.onDelete ?? "CASCADE"}
                  onChange={(v) => setLinkForm((s) => ({ ...s, onDelete: v as Action }))}
                />
              </Field>
              <Field label="ON UPDATE" hint="При обновлении">
                <SelectAction
                  value={(linkForm.onUpdate as any) ?? ""}
                  onChange={(v) => setLinkForm((s) => ({ ...s, onUpdate: (v || undefined) as Action | undefined }))}
                  includeEmpty
                />
              </Field>
            </div>

            <Check
              label="Создать индексы по FK"
              hint="Ускоряет поиск по внешним ключам"
              checked={linkForm.index !== false}
              onChange={(v) => setLinkForm((s) => ({ ...s, index: v }))}
            />
          </>
        )}
      </div>

      <div className="flex gap-3 pt-6 mt-6 border-t border-black/10 dark:border-white/10">
        <button
          type="button"
          className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:scale-[0.98]"
          onClick={() => {
            if (relation.type !== "many-to-many") onSaveFK(fkForm);
            else onSaveLink(linkForm);
            setFlash("saved");
          }}
        >
          Сохранить настройки
        </button>
        <button
          type="button"
          className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 font-bold text-gray-700 shadow-sm transition hover:bg-white/90 active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.10]"
          onClick={() => {
            onReset();
            setFlash("reset");
          }}
        >
          ↺ Сбросить
        </button>
      </div>

      <div className="mt-4 text-xs text-gray-500 dark:text-white/50 text-center">
        Изменения применяются мгновенно • Нажмите ESC для закрытия
      </div>
    </div>
  );
}
