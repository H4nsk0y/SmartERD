// frontend/src/utils/sql/common.ts
import type { Entity } from "../../store/useERStore";

export const IDENT_OK = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function sanitize(name: string): string {
  let s = (name || "")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!s) return "";

  if (/^\d/.test(s)) {
    s = `x_${s}`
      .replace(/__+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!s) return "x";
  }

  return s;
}


export function sanitizeNonEmpty(name: string, fallback = "x"): string {
  const s = sanitize(name);
  if (s) return s;
  return sanitize(fallback) || "x";
}

export function isValidIdentifier(name: string): boolean {
  const s = sanitize(name);
  return !!s && IDENT_OK.test(s);
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

 
  for (const e of all) {
    if (e.id === a.id || e.id === b.id) continue;
    if (hasColumn(e, aCol) && hasColumn(e, bCol)) return e;
  }

  
  const an = snake(toSingular(sanitize(a.name)));
  const bn = snake(toSingular(sanitize(b.name)));

  for (const e of all) {
    if (e.id === a.id || e.id === b.id) continue;
    const en = snake(sanitize(e.name));
    if (en.includes(an) && en.includes(bn)) return e;
  }

  return null;
}


function normType(t: string) {
  return (t || "").replace(/\s+/g, "").toUpperCase();
}


function isPkType(t?: string) {
  const u = normType(t || "");
  if (!u) return false;
  if (u === "UUID") return true;
  if (u === "INT" || u === "INTEGER") return true;
  if (u.endsWith("INT")) return true; 
  if (u.includes("SERIAL")) return true; 
  return false;
}


function inferImplicitPk(entity: Entity): { name: string; type: string } | null {
  const root = snake(toSingular(sanitize(entity.name || "")));


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
  if (explicit) {
    return {
      name: sanitizeNonEmpty(explicit.name, "id"),
      type: (explicit.type || "").trim() || "UUID",
    };
  }

  const implicit = inferImplicitPk(entity);
  if (implicit) return { name: sanitizeNonEmpty(implicit.name, "id"), type: implicit.type };

  return { name: "id", type: "UUID" };
}


export function qPg(name: string) {
  return `"${sanitizeNonEmpty(name, "x")}"`;
}
export function qMy(name: string) {
  return `\`${sanitizeNonEmpty(name, "x")}\``;
}


export function suggestLinkTableName(fromEntityName: string, toEntityName: string): string {
  const left = snake(toSingular(sanitize(fromEntityName)));
  const right = snake(toSingular(sanitize(toEntityName)));
  return `${left}_${right}_link`;
}


export function uniqueName(base: string, usedLower: Set<string>): string {
  const b = sanitizeNonEmpty(base, "x");
  const normLower = b.toLowerCase();
  if (!usedLower.has(normLower)) return b;

  let i = 2;
  while (true) {
    const cand = sanitizeNonEmpty(`${b}_${i}`, `${b}_${i}`);
    const n = cand.toLowerCase();
    if (!usedLower.has(n)) return cand;
    i += 1;
  }
}

export function limitIdentifier(name: string, maxLen: number): string {
  const s = sanitizeNonEmpty(name, "x");
  if (s.length <= maxLen) return s;

  
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  const keep = Math.max(1, maxLen - 1 - hex.length);
  return `${s.slice(0, keep)}_${hex}`;
}
