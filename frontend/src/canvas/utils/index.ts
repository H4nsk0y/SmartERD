// frontend/src/canvas/utils/index.ts
/**
 * Общие утилиты без зависимостей от React.
 */

export const GRID = 32;
export const snap = (v: number) => Math.round(v / GRID) * GRID;
export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * Нормализация идентификатора:
 * - оставляем только [A-Za-z0-9_]
 * - убираем подчёркивания по краям
 * - если начинается с цифры — добавляем '_' в начало
 */
export function sanitizeIdentifierInput(raw: string) {
  let s = (raw ?? "").replace(/[^A-Za-z0-9_]/g, "");
  s = s.replace(/^_+|_+$/g, "");
  if (/^[0-9]/.test(s)) s = "_" + s;
  return s;
}

/** Наивное приведение к единственному числу (users -> user) */
export function toSingular(n: string) {
  const s = (n ?? "").toLowerCase();
  if (s.endsWith("ies")) return n.slice(0, -3) + "y";
  if (s.endsWith("ses")) return n.slice(0, -2);
  if (s.endsWith("s")) return n.slice(0, -1);
  return n;
}

/** snake_case из произвольной строки */
export function snake(name: string): string {
  return (name ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s\-]+/g, "_")
    .replace(/__+/g, "_")
    .replace(/[^\w]/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

/* ====== Ограничения имён и уникализация ====== */

export const ENTITY_NAME_MAX = 32;
export const ATTR_NAME_MAX   = 32;

/** Делает имя уникальным в рамках множества used (без учёта регистра) */
export function makeUnique(base: string, used: Set<string>) {
  const low = base.toLowerCase();
  if (!used.has(low)) return base;
  let i = 2;
  while (used.has(`${base}_${i}`.toLowerCase())) i += 1;
  return `${base}_${i}`;
}

/** Нормализовать имя сущности и сделать уникальным */
export function normalizeEntityName(raw: string, used: Set<string>) {
  let s = sanitizeIdentifierInput(raw);
  if (!s) s = "Entity";
  s = s.slice(0, ENTITY_NAME_MAX);
  return makeUnique(s, used);
}

/** Нормализовать имя атрибута и сделать уникальным (в рамках сущности) */
export function normalizeAttributeName(raw: string, used: Set<string>) {
  let s = sanitizeIdentifierInput(raw);
  if (!s) s = "field";
  s = s.slice(0, ATTR_NAME_MAX);
  return makeUnique(s, used);
}
