import type { Entity } from "../../store/useERStore";

/* Строгий ASCII-санитайзер */
export function sanitize(name: string): string {
  return (name || "")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function snake(name: string): string {
  const s = sanitize(name)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s\-]+/g, "_")
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s.toLowerCase();
}

export function norm(name: string): string {
  return snake(name);
}

export function toSingular(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith("ies")) return name.slice(0, -3) + "y";
  if (n.endsWith("ses")) return name.slice(0, -2);
  if (n.endsWith("s")) return name.slice(0, -1);
  return name;
}

/*Имя FK-колонки*/
export function fkColNameFor(rootSingular: string, pkName: string) {
  const base = snake(pkName);
  const root = snake(rootSingular) + "_";
  return base.startsWith(root) ? base : `${snake(rootSingular)}_${base}`;
}

export function hasColumn(e: Entity, col: string): boolean {
  const target = norm(col);
  return e.attributes.some((a) => norm(a.name) === target);
}

export function findExistingFKColumn(
  to: Entity,
  fromName: string,
  singularFrom: string,
  fromPKName: string
): string | null {
  const roots = [snake(fromName), snake(singularFrom)];
  const pkNorm = snake(fromPKName);
  const candidates = new Set<string>();
  for (const root of roots) {
    candidates.add(`${root}_id`);
    candidates.add(`${root}id`);
    candidates.add(`${root}_${pkNorm}`);
    candidates.add(`${root}${pkNorm}`);
  }

  const attrs = to.attributes.map((a) => sanitize(a.name));
  for (const a of attrs) {
    const n = norm(a);
    for (const c of candidates) {
      if (n === norm(c)) return a;
    }
  }
  return null;
}

export function findExistingLinkEntity(a: Entity, b: Entity, all: Entity[]): Entity | null {
  const anSing = toSingular(sanitize(a.name));
  const bnSing = toSingular(sanitize(b.name));
  const apk = getPrimaryKey(a).name;
  const bpk = getPrimaryKey(b).name;

  const aCol = sanitize(fkColNameFor(anSing, apk));
  const bCol = sanitize(fkColNameFor(bnSing, bpk));

  // 1) Структурный матч: таблица содержит оба FK-столбца (user_id + order_id и т.п.)
  for (const e of all) {
    if (e.id === a.id || e.id === b.id) continue;
    if (hasColumn(e, aCol) && hasColumn(e, bCol)) return e;
  }

  // 2) Матч по имени (старое поведение)
  const an = snake(toSingular(sanitize(a.name)));
  const bn = snake(toSingular(sanitize(b.name)));

  for (const e of all) {
    if (e.id === a.id || e.id === b.id) continue;
    const en = snake(sanitize(e.name));
    if (en.includes(an) && en.includes(bn)) return e;
  }

  return null;
}

/** Нормализация типа для сравнения */
function normType(t: string) {
  return (t || "").replace(/\s+/g, "").toUpperCase();
}

/** Является ли тип “похожим на PK” по твоему ТЗ: UUID или INT (и близкие варианты) */
function isPkType(t?: string) {
  const u = normType(t || "");
  if (!u) return false;
  if (u === "UUID") return true;
  if (u === "INT" || u === "INTEGER") return true;
  if (u.endsWith("INT")) return true; // BIGINT, SMALLINT
  if (u.includes("SERIAL")) return true; // SERIAL/BIGSERIAL
  return false;
}

/** Пытаемся угадать PK, если пользователь не поставил 🔑 */
function inferImplicitPk(entity: Entity): { name: string; type: string } | null {
  const root = snake(toSingular(sanitize(entity.name || "")));

  // Приоритет: id -> <entity>_id
  const candidates = ["id", root ? `${root}_id` : ""].filter(Boolean);

  for (const want of candidates) {
    const hit = entity.attributes.find((a) => snake(sanitize(a.name)) === want);
    if (hit && isPkType(hit.type)) {
      return { name: sanitize(hit.name), type: (hit.type || "").trim() || "UUID" };
    }
  }

  return null;
}

export function getPrimaryKey(entity: Entity) {
  const explicit = entity.attributes.find((a) => (a as any).isPrimaryKey);
 if (explicit) return { name: sanitize(explicit.name), type: (explicit.type || "").trim() || "UUID" };

  // если есть id / <entity>_id с типом INT/UUID — используем это как PK
  const implicit = inferImplicitPk(entity);
  if (implicit) return implicit;

  // дефолтный тип PK — UUID
  return { name: "id", type: "UUID" };
}

/*Кавычки для идентификаторов*/
export function qPg(name: string) {
  return `"${sanitize(name)}"`;
}
export function qMy(name: string) {
  return `\`${sanitize(name)}\``;
}

/**
 * Предлагаем каноническое имя линк-таблицы для N:M.
 * Важно: порядок from/to сохраняем (не сортируем), чтобы не менять существующее поведение.
 */
export function suggestLinkTableName(fromEntityName: string, toEntityName: string): string {
  const left = snake(toSingular(sanitize(fromEntityName)));
  const right = snake(toSingular(sanitize(toEntityName)));
  return `${left}_${right}_link`;
}

/**
 * Возвращает уникальное имя (добавляя _2, _3, ...) относительно набора уже занятых имён.
 * Сравнение case-insensitive, т.к. для SQL имена зачастую приводятся.
 */
export function uniqueName(base: string, usedLower: Set<string>): string {
  const b = sanitize(base);
  const norm = b.toLowerCase();
  if (!usedLower.has(norm)) return b;

  let i = 2;
  while (true) {
    const cand = sanitize(`${b}_${i}`);
    const n = cand.toLowerCase();
    if (!usedLower.has(n)) return cand;
    i += 1;
  }
}

/**
 * Ограничивает длину идентификатора (например, MySQL limit 64) с добавлением стабильного hash-суффикса.
 * Возвращает безопасную ASCII-строку.
 */
export function limitIdentifier(name: string, maxLen: number): string {
  const s = sanitize(name);
  if (s.length <= maxLen) return s;

  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  const keep = Math.max(1, maxLen - 1 - hex.length);
  return `${s.slice(0, keep)}_${hex}`;
}
