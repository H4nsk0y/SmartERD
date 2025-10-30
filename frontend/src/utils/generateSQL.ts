// src/utils/generateSQL.ts
import type { Entity, Relationship, FKMeta, LinkMeta } from "../store/useERStore";

/**
 * Генератор SQL-кода из ER-диаграммы с приоритетом на явные настройки в relationship.fk / relationship.link.
 * Если явных настроек нет — применяются умные дефолты (как раньше).
 */
export function generateSQL(entities: Entity[], relationships: Relationship[]): string {
  const sqlParts: string[] = [];
  const entById = new Map(entities.map((e) => [e.id, e]));

  /* ==== Подготовка: пары many-to-many и явные линк-таблицы по названию ==== */
  type MMPair = {
    from: Entity;
    to: Entity;
    fromName: string;
    toName: string;
    fromSingular: string;
    toSingular: string;
  };

  const mmPairs: MMPair[] = relationships
    .filter((r) => r.type === "many-to-many")
    .map((r) => {
      const from = entById.get(r.from);
      const to = entById.get(r.to);
      if (!from || !to) return null;
      return {
        from,
        to,
        fromName: sanitize(from.name),
        toName: sanitize(to.name),
        fromSingular: toSingular(sanitize(from.name)),
        toSingular: toSingular(sanitize(to.name)),
      };
    })
    .filter(Boolean) as MMPair[];

  // Найти линк-таблицы по названию (если уже созданы пользователем как сущности)
  const linkEntityIds = new Set<string>();
  const linkEntityByPair = new Map<string, Entity | null>();
  for (const pair of mmPairs) {
    const key = `${pair.from.id}__${pair.to.id}`;
    const link = findExistingLinkEntity(pair.from, pair.to, entities);
    if (link) linkEntityIds.add(link.id);
    linkEntityByPair.set(key, link);
  }

  /* ==== 1) CREATE TABLES ==== */
  for (const e of entities) {
    const isExplicitLink = linkEntityIds.has(e.id);
    const cols: string[] = [];

    for (const a of e.attributes) {
      const colName = sanitize(a.name);
      let line = `${colName} ${a.type}`;
      if ((a as any).isPrimaryKey) line += " PRIMARY KEY NOT NULL";
      cols.push(line);
    }

    const hasPK = e.attributes.some((a) => (a as any).isPrimaryKey);
    if (!isExplicitLink && !hasPK) {
      cols.unshift(`id SERIAL PRIMARY KEY`);
    }

    // Если явная линк-таблица без PK — попробуем составной PK по уже существующим FK
    if (isExplicitLink && !hasPK) {
      const pair = findPairForEntity(e, mmPairs);
      if (pair) {
        const fromPK = getPrimaryKey(pair.from);
        const toPK = getPrimaryKey(pair.to);
        const leftCol =
          findExistingFKColumn(e, sanitize(pair.from.name), toSingular(sanitize(pair.from.name)), fromPK.name) ||
          `${snake(toSingular(sanitize(pair.from.name)))}_${snake(fromPK.name)}`;
        const rightCol =
          findExistingFKColumn(e, sanitize(pair.to.name), toSingular(sanitize(pair.to.name)), toPK.name) ||
          `${snake(toSingular(sanitize(pair.to.name)))}_${snake(toPK.name)}`;

        if (hasColumn(e, leftCol) && hasColumn(e, rightCol)) {
          cols.push(`PRIMARY KEY (${sanitize(leftCol)}, ${sanitize(rightCol)})`);
        }
      }
    }

    sqlParts.push(`CREATE TABLE ${sanitize(e.name)} (\n  ${cols.join(",\n  ")}\n);`);
  }

  /* ==== 2) RELATIONSHIPS ==== */
  for (const r of relationships) {
    const from = entById.get(r.from);
    const to = entById.get(r.to);
    if (!from || !to) continue;

    const fromName = sanitize(from.name);
    const toName = sanitize(to.name);
    const fromPK = getPrimaryKey(from);
    const toPK = getPrimaryKey(to);
    const fromPKName = sanitize(fromPK.name);
    const toPKName = sanitize(toPK.name);
    const fromSingular = toSingular(fromName);
    const toSingularName = toSingular(toName);

    switch (r.type) {
      case "one-to-one":
      case "one-to-many": {
        // 1) Прочитать явные настройки FK (если заданы)
        const fkMeta: FKMeta = {
          notNull: true,
          onDelete: "CASCADE",
          onUpdate: undefined, // как правило, опускаем
          index: true,
          unique: r.type === "one-to-one" ? true : undefined,
          ...(r.fk ?? {}),
        };

        const computedName = `${snake(fromSingular)}_${snake(fromPKName)}`;
        const suggestedExisting = findExistingFKColumn(to, fromName, fromSingular, fromPKName);
        const requestedName = fkMeta.column ?? suggestedExisting ?? computedName;
        const fkCol = sanitize(requestedName);
        const fkType = fkMeta.type ?? fromPK.type;

        // 2) Проверяем, существует ли ИМЕННО ЭТО имя в целевой таблице
        const existsExact = hasColumn(to, fkCol);

        // 3) Добавить/изменить столбец
        if (existsExact) {
          if (fkMeta.notNull !== false) {
            sqlParts.push(`ALTER TABLE ${toName}\n  ALTER COLUMN ${fkCol} SET NOT NULL;`);
          }
        } else {
          sqlParts.push(
            `ALTER TABLE ${toName}\n  ADD COLUMN ${fkCol} ${fkType}${fkMeta.notNull === false ? "" : " NOT NULL"};`
          );
        }

        // 4) FK constraint
        const actions = [
          fkMeta.onDelete ? ` ON DELETE ${fkMeta.onDelete}` : "",
          fkMeta.onUpdate ? ` ON UPDATE ${fkMeta.onUpdate}` : "",
        ].join("");
        sqlParts.push(
          `ALTER TABLE ${toName}\n  ADD CONSTRAINT fk_${toName}_${fromName} FOREIGN KEY (${fkCol}) REFERENCES ${fromName}(${fromPKName})${actions};`
        );

        // 5) Индекс
        if (fkMeta.index !== false) {
          sqlParts.push(`CREATE INDEX ON ${toName}(${fkCol});`);
        }

        // 6) UNIQUE (для 1:1 по умолчанию; уважаем явное выключение)
        const wantUnique =
          fkMeta.unique === undefined ? (r.type === "one-to-one") : fkMeta.unique === true;
        if (wantUnique) {
          sqlParts.push(`ALTER TABLE ${toName}\n  ADD CONSTRAINT uq_${toName}_${fkCol} UNIQUE (${fkCol});`);
        }
        break;
      }

      case "many-to-many": {
        const linkMeta: LinkMeta = {
          compositePrimaryKey: true,
          onDelete: "CASCADE",
          onUpdate: undefined,
          index: true,
          ...(r.link ?? {}),
        };

        const key = `${from.id}__${to.id}`;
        const explicitEntity = linkEntityByPair.get(key);
        const leftCol = sanitize(
          linkMeta.leftColumn ?? `${snake(fromSingular)}_${snake(fromPKName)}`
        );
        const rightCol = sanitize(
          linkMeta.rightColumn ?? `${snake(toSingularName)}_${snake(toPKName)}`
        );

        // Если пользователь указал имя таблицы — используем его,
        // иначе: пытаемся найти существующую (по названию), иначе создаём <from>_<to>_link
        const autoName = `${snake(fromName)}_${snake(toName)}_link`;
        const linkName = sanitize(linkMeta.tableName ?? (explicitEntity ? explicitEntity.name : autoName));

        if (explicitEntity) {
          // ALTER существующей сущности
          if (!hasColumn(explicitEntity, leftCol)) {
            sqlParts.push(`ALTER TABLE ${linkName}\n  ADD COLUMN ${leftCol} ${fromPK.type} NOT NULL;`);
          } else {
            sqlParts.push(`ALTER TABLE ${linkName}\n  ALTER COLUMN ${leftCol} SET NOT NULL;`);
          }
          if (!hasColumn(explicitEntity, rightCol)) {
            sqlParts.push(`ALTER TABLE ${linkName}\n  ADD COLUMN ${rightCol} ${toPK.type} NOT NULL;`);
          } else {
            sqlParts.push(`ALTER TABLE ${linkName}\n  ALTER COLUMN ${rightCol} SET NOT NULL;`);
          }

          if (linkMeta.compositePrimaryKey !== false) {
            sqlParts.push(`ALTER TABLE ${linkName}\n  ADD PRIMARY KEY (${leftCol}, ${rightCol});`);
          }

          const actions = [
            linkMeta.onDelete ? ` ON DELETE ${linkMeta.onDelete}` : "",
            linkMeta.onUpdate ? ` ON UPDATE ${linkMeta.onUpdate}` : "",
          ].join("");

          sqlParts.push(
            `ALTER TABLE ${linkName}\n  ADD CONSTRAINT fk_${linkName}_${fromName} FOREIGN KEY (${leftCol}) REFERENCES ${fromName}(${fromPKName})${actions};`
          );
          sqlParts.push(
            `ALTER TABLE ${linkName}\n  ADD CONSTRAINT fk_${linkName}_${toName} FOREIGN KEY (${rightCol}) REFERENCES ${toName}(${toPKName})${actions};`
          );

          if (linkMeta.index !== false) {
            sqlParts.push(`CREATE INDEX ON ${linkName}(${leftCol});`);
            sqlParts.push(`CREATE INDEX ON ${linkName}(${rightCol});`);
          }
        } else {
          // CREATE новой таблицы
          const actions = [
            linkMeta.onDelete ? ` ON DELETE ${linkMeta.onDelete}` : "",
            linkMeta.onUpdate ? ` ON UPDATE ${linkMeta.onUpdate}` : "",
          ].join("");

          sqlParts.push(
            `CREATE TABLE ${linkName} (\n` +
              `  ${leftCol} ${fromPK.type} NOT NULL,\n` +
              `  ${rightCol} ${toPK.type} NOT NULL,\n` +
              (linkMeta.compositePrimaryKey === false
                ? ""
                : `  PRIMARY KEY (${leftCol}, ${rightCol}),\n`) +
              `  CONSTRAINT fk_${linkName}_${fromName} FOREIGN KEY (${leftCol}) REFERENCES ${fromName}(${fromPKName})${actions},\n` +
              `  CONSTRAINT fk_${linkName}_${toName} FOREIGN KEY (${rightCol}) REFERENCES ${toName}(${toPKName})${actions}\n` +
              `);`
          );

          if (linkMeta.index !== false) {
            sqlParts.push(`CREATE INDEX ON ${linkName}(${leftCol});`);
            sqlParts.push(`CREATE INDEX ON ${linkName}(${rightCol});`);
          }
        }

        break;
      }
    }
  }

  return sqlParts.join("\n\n");
}

/* ================== Вспомогательные ================== */

function getPrimaryKey(entity: Entity) {
  const explicit = entity.attributes.find((a) => (a as any).isPrimaryKey);
  if (explicit) return { name: sanitize(explicit.name), type: explicit.type || "INT" };
  return { name: "id", type: "INT" };
}

function findExistingFKColumn(
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

function hasColumn(e: Entity, col: string): boolean {
  const target = norm(col);
  return e.attributes.some((a) => norm(a.name) === target);
}

function findExistingLinkEntity(a: Entity, b: Entity, all: Entity[]): Entity | null {
  const an = snake(toSingular(sanitize(a.name)));
  const bn = snake(toSingular(sanitize(b.name)));
  for (const e of all) {
    const en = snake(sanitize(e.name));
    if (en.includes(an) && en.includes(bn)) return e;
  }
  return null;
}

function findPairForEntity(e: Entity, pairs: { from: Entity; to: Entity }[]): { from: Entity; to: Entity } | null {
  const en = snake(sanitize(e.name));
  for (const p of pairs) {
    const an = snake(toSingular(sanitize(p.from.name)));
    const bn = snake(toSingular(sanitize(p.to.name)));
    if (en.includes(an) && en.includes(bn)) return p;
  }
  return null;
}

function snake(name: string): string {
  const s = sanitize(name)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s\-]+/g, "_")
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s.toLowerCase();
}
function norm(name: string): string {
  return snake(name);
}

function toSingular(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith("ies")) return name.slice(0, -3) + "y";
  if (n.endsWith("ses")) return name.slice(0, -2);
  if (n.endsWith("s")) return name.slice(0, -1);
  return name;
}
function sanitize(name: string): string {
  return name.replace(/\s+/g, "_").replace(/[^\wа-яА-Я_]/gi, "");
}
