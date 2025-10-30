/**
 * canvas/utils/index.ts
 * Общие утилиты, которые раньше жили внутри EditorCanvas.tsx.
 * Никаких зависимостей от React — чистые функции.
 */

export const GRID = 32;

export const snap = (v: number) => Math.round(v / GRID) * GRID;

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * Превращает произвольный ввод в допустимый SQL-идентификатор:
 * латиница/цифры/подчёркивание, без ведущей цифры.
 * Ничего не «додумывает» — если символ запрещён, он просто отбрасывается.
 */
export function sanitizeIdentifierInput(raw: string) {
  // оставляем только [A-Za-z0-9_]
  let s = raw.replace(/[^A-Za-z0-9_]/g, "");
  // убираем повторные подчёркивания по краям
  s = s.replace(/^_+|_+$/g, "");
  // если начинается с цифры — добавим подчёркивание в начало
  if (/^[0-9]/.test(s)) s = "_" + s;
  return s;
}

/** Наивное приведение к единственному числу (users -> user) */
export function toSingular(n: string) {
  const s = n.toLowerCase();
  if (s.endsWith("ies")) return n.slice(0, -3) + "y";
  if (s.endsWith("ses")) return n.slice(0, -2);
  if (s.endsWith("s")) return n.slice(0, -1);
  return n;
}

/** snake_case из произвольной строки */
export function snake(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s\-]+/g, "_")
    .replace(/__+/g, "_")
    .replace(/[^\w]/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
