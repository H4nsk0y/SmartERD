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
  const an = snake(toSingular(sanitize(a.name)));
  const bn = snake(toSingular(sanitize(b.name)));
  for (const e of all) {
    const en = snake(sanitize(e.name));
    if (en.includes(an) && en.includes(bn)) return e;
  }
  return null;
}

export function getPrimaryKey(entity: Entity) {
  const explicit = entity.attributes.find((a) => (a as any).isPrimaryKey);
  if (explicit) return { name: sanitize(explicit.name), type: explicit.type || "UUID" };
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
