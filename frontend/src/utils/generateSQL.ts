// src/utils/generateSQL.ts
import type { Entity, Relationship } from "../store/useERStore";

/**
 * Генератор SQL-кода из ER-диаграммы.
 * Теперь поддерживает распознавание единственного числа (Users → user).
 */
export function generateSQL(entities: Entity[], relationships: Relationship[]): string {
  const sqlParts: string[] = [];

  /* === 1. CREATE TABLE === */
  for (const e of entities) {
    const cols: string[] = [];

    for (const a of e.attributes) {
      let line = `${sanitize(a.name)} ${a.type}`;
      if ((a as any).isPrimaryKey) line += " PRIMARY KEY NOT NULL";
      cols.push(line);
    }

    if (!e.attributes.some((a) => (a as any).isPrimaryKey)) {
      cols.unshift(`id SERIAL PRIMARY KEY`);
    }

    sqlParts.push(`CREATE TABLE ${sanitize(e.name)} (\n  ${cols.join(",\n  ")}\n);`);
  }

  /* === 2. Связи === */
  for (const r of relationships) {
    const from = entities.find((x) => x.id === r.from);
    const to = entities.find((x) => x.id === r.to);
    if (!from || !to) continue;

    const fromName = sanitize(from.name);
    const singularFrom = toSingular(fromName);
    const toName = sanitize(to.name);

    const fromPK = getPrimaryKey(from);
    const toPK = getPrimaryKey(to);
    if (!fromPK || !toPK) continue;

    const fkColumn =
      findExistingFKColumn(to, fromName, singularFrom) ||
      `${singularFrom.toLowerCase()}_${fromPK.name}`;

    switch (r.type) {
      case "one-to-many":
      case "one-to-one":
        sqlParts.push(
          `ALTER TABLE ${toName}\n` +
            `  ADD CONSTRAINT fk_${toName}_${fromName}\n` +
            `  FOREIGN KEY (${fkColumn}) REFERENCES ${fromName}(${fromPK.name}) ON DELETE CASCADE;`
        );
        break;

      case "many-to-many":
        const link = `${fromName}_${toName}_link`;
        sqlParts.push(
          `CREATE TABLE ${link} (\n` +
            `  ${singularFrom}_${fromPK.name} ${fromPK.type},\n` +
            `  ${toSingular(toName)}_${toPK.name} ${toPK.type},\n` +
            `  PRIMARY KEY (${singularFrom}_${fromPK.name}, ${toSingular(toName)}_${toPK.name}),\n` +
            `  CONSTRAINT fk_${link}_${fromName} FOREIGN KEY (${singularFrom}_${fromPK.name}) REFERENCES ${fromName}(${fromPK.name}) ON DELETE CASCADE,\n` +
            `  CONSTRAINT fk_${link}_${toName} FOREIGN KEY (${toSingular(toName)}_${toPK.name}) REFERENCES ${toName}(${toPK.name}) ON DELETE CASCADE\n` +
            `);`
        );
        break;
    }
  }

  return sqlParts.join("\n\n");
}

/* === Вспомогательные функции === */

function getPrimaryKey(entity: Entity) {
  return entity.attributes.find((a) => (a as any).isPrimaryKey) || { name: "id", type: "INT" };
}

/**
 * Пытается найти FK-поле в целевой таблице (user_id, users_id, userid и т.п.)
 */
function findExistingFKColumn(to: Entity, fromName: string, singular: string): string | null {
  const lowerFrom = fromName.toLowerCase();
  const lowerSingular = singular.toLowerCase();

  const candidates = [
    `${lowerFrom}_id`,
    `${lowerSingular}_id`,
    `${lowerFrom}id`,
    `${lowerSingular}id`,
    `${lowerFrom}s_id`,
    `${lowerSingular}s_id`,
  ];

  const found = to.attributes.find((a) => {
    const n = a.name.toLowerCase();
    return candidates.some((c) => n.includes(c));
  });

  return found ? sanitize(found.name) : null;
}

/** Упрощённый “лемматизатор” */
function toSingular(name: string): string {
  if (name.toLowerCase().endsWith("ies")) return name.slice(0, -3) + "y";
  if (name.toLowerCase().endsWith("ses")) return name.slice(0, -2);
  if (name.toLowerCase().endsWith("s")) return name.slice(0, -1);
  return name;
}

function sanitize(name: string): string {
  return name.replace(/\s+/g, "_").replace(/[^\wа-яА-Я_]/gi, "");
}
