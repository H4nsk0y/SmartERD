// frontend/src/utils/sql/postgres.ts
import type { Entity, Relationship, FKMeta, LinkMeta } from "../../store/useERStore";
import {
  sanitize,
  snake,
  toSingular,
  fkColNameFor,
  qPg,
  hasColumn,
  findExistingFKColumn,
  findExistingLinkEntity,
  getPrimaryKey,
  suggestLinkTableName,
  uniqueName,
  limitIdentifier,
} from "./common";

function ensureDistinctCols(left: string, right: string) {
  const L = left;
  let R = right;

  if (L.toLowerCase() !== R.toLowerCase()) return { left: L, right: R };

  // если совпали — делаем правую колонку отличной
  const base = right || left || "ref_id";
  R = `${base}_2`;

  if (L.toLowerCase() === R.toLowerCase()) {
    R = `${base}_r`;
  }

  return { left: L, right: R };
}

/**
 * FK type resolution rule:
 * 1) если fkMeta.type задан и НЕ пустой -> используем его
 * 2) иначе -> используем тип PK у referenced сущности (fromPK.type)
 */
function resolveFkType(fkMeta: FKMeta, referencedPkType: string): string {
  const t = (fkMeta.type ?? "").trim();
  return t || (referencedPkType || "UUID");
}

export function generatePostgresSQL(entities: Entity[], relationships: Relationship[]): string {
  const sqlParts: string[] = [];
  const entById = new Map(entities.map((e) => [e.id, e]));

  const usedTableNames = new Set(entities.map((e) => sanitize(e.name).toLowerCase()));
  const linkSqlNameByEntityId = new Map<string, string>();
  const linkSqlNameByPair = new Map<string, string>();

  const linkEntityIds = new Set<string>();
  const linkEntityByPair = new Map<string, Entity | null>();

  for (const r of relationships.filter((x) => x.type === "many-to-many")) {
    const from = entById.get(r.from);
    const to = entById.get(r.to);
    if (!from || !to) continue;

    const key = `${from.id}__${to.id}`;

    const fromToken = snake(toSingular(sanitize(from.name)));
    const toToken = snake(toSingular(sanitize(to.name)));

    const suggestedBase = suggestLinkTableName(from.name, to.name);
    const explicit = findExistingLinkEntity(from, to, entities);

    if (explicit) linkEntityIds.add(explicit.id);
    linkEntityByPair.set(key, explicit);

    let chosen = suggestedBase;

    if (r.link?.tableName) {
      chosen = sanitize(r.link.tableName);
    } else if (explicit) {
      const explicitSnake = snake(sanitize(explicit.name));
      const looksOk = explicitSnake.includes(fromToken) && explicitSnake.includes(toToken);
      chosen = looksOk ? sanitize(explicit.name) : sanitize(suggestedBase);
    }

    chosen = uniqueName(chosen, usedTableNames);
    usedTableNames.add(chosen.toLowerCase());

    linkSqlNameByPair.set(key, chosen);
    if (explicit) linkSqlNameByEntityId.set(explicit.id, chosen);
  }

  const deferredLinkTables = new Set<string>(); // lower-case sql name
  const involved = new Set<string>();
  for (const r of relationships) {
    if (entById.has(r.from)) involved.add(r.from);
    if (entById.has(r.to)) involved.add(r.to);
  }

  /* ==== 1) CREATE TABLES ==== */
  for (const e of entities) {
    const isExplicitLink = linkEntityIds.has(e.id);

    const baseTableName = sanitize(e.name);
    const sqlTableName = isExplicitLink
      ? (linkSqlNameByEntityId.get(e.id) ?? baseTableName)
      : baseTableName;

    const T = qPg(sqlTableName);

    if (e.attributes.length === 0 && !involved.has(e.id) && !isExplicitLink) continue;

    if (isExplicitLink && e.attributes.length === 0) {
      deferredLinkTables.add(sqlTableName.toLowerCase());
      continue;
    }

    const cols: string[] = [];
    for (const a of e.attributes) {
      const colName = sanitize(a.name);
      const isPk = (a as any).isPrimaryKey;
      const C = qPg(colName);
      const line = `${C} ${a.type}${isPk ? " PRIMARY KEY" : ""}`;
      cols.push(line);
    }

    const hasPK = e.attributes.some((a) => (a as any).isPrimaryKey);
    if (!isExplicitLink && !hasPK) {
      cols.unshift(`${qPg("id")} UUID PRIMARY KEY`);
    }

    sqlParts.push(`CREATE TABLE ${T} (\n  ${cols.join(",\n  ")}\n);`);
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

    // ВАЖНО: таблицы в SQL (для обычных сущностей совпадают с sanitize(name))
    const F = qPg(fromName);
    const T = qPg(toName);

    switch (r.type) {
      case "one-to-one":
      case "one-to-many": {
        const fkMeta: FKMeta = {
          notNull: true,
          onDelete: "CASCADE",
          onUpdate: undefined,
          index: true,
          unique: r.type === "one-to-one" ? true : undefined,
          ...(r.fk ?? {}),
        };

        const isSelf = r.from === r.to;

        // self-loop: parent_<pk> (например parent_id)
        const computedName = isSelf
          ? sanitize(`parent_${snake(fromPKName)}`)
          : fkColNameFor(fromSingular, fromPKName);

        const suggestedExisting = findExistingFKColumn(to, fromName, fromSingular, fromPKName);

        const requestedName =
          (fkMeta.column && fkMeta.column.trim()) ||
          suggestedExisting ||
          computedName;

        const fkColName = sanitize(requestedName);
        const fkColQ = qPg(fkColName);

        // ✅ FIX: тип FK вычисляем ВСЕГДА, независимо от notNull
        const fkType = resolveFkType(fkMeta, fromPK.type);

        const existsExact = hasColumn(to, fkColName);

        if (existsExact) {
          if (fkMeta.notNull !== false) {
            sqlParts.push(`ALTER TABLE ${T}\n  ALTER COLUMN ${fkColQ} SET NOT NULL;`);
          }
        } else {
          // ✅ FIX: ADD COLUMN всегда с типом; NOT NULL только если notNull=true
          sqlParts.push(
            `ALTER TABLE ${T}\n  ADD COLUMN ${fkColQ} ${fkType}${fkMeta.notNull === false ? "" : " NOT NULL"};`
          );
        }

        const actions = [
          fkMeta.onDelete ? ` ON DELETE ${fkMeta.onDelete}` : "",
          fkMeta.onUpdate ? ` ON UPDATE ${fkMeta.onUpdate}` : "",
        ].join("");

        // ✅ имя FK-констрейнта привязано к FK-колонке (лучше для self-loop и потенциальных коллизий)
        const fkName = qPg(limitIdentifier(`fk_${toName}_${fkColName}`, 63));
        const pkQ = qPg(fromPKName);

        sqlParts.push(
          `ALTER TABLE ${T}\n  ADD CONSTRAINT ${fkName} FOREIGN KEY (${fkColQ}) REFERENCES ${F}(${pkQ})${actions};`
        );

        const wantUnique =
          fkMeta.unique === undefined ? (r.type === "one-to-one") : fkMeta.unique === true;

        if (fkMeta.index !== false && !wantUnique) {
          sqlParts.push(`CREATE INDEX ON ${T}(${fkColQ});`);
        }
        if (wantUnique) {
          const uqName = qPg(limitIdentifier(`uq_${toName}_${fkColName}`, 63));
          sqlParts.push(`ALTER TABLE ${T}\n  ADD CONSTRAINT ${uqName} UNIQUE (${fkColQ});`);
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

        const autoName = suggestLinkTableName(fromName, toName);
        const linkName = linkSqlNameByPair.get(key) ?? sanitize(linkMeta.tableName ?? autoName);
        const L = qPg(linkName);

        // колонки
        const leftBase = sanitize(linkMeta.leftColumn ?? fkColNameFor(fromSingular, fromPKName));
        const rightBase = sanitize(linkMeta.rightColumn ?? fkColNameFor(toSingularName, toPKName));

        // ✅ self N:M: если совпали — разруливаем автоматически
        const distinct = ensureDistinctCols(leftBase, rightBase);
        const leftCol = sanitize(distinct.left);
        const rightCol = sanitize(distinct.right);

        const leftQ = qPg(leftCol);
        const rightQ = qPg(rightCol);

        const actions = [
          linkMeta.onDelete ? ` ON DELETE ${linkMeta.onDelete}` : "",
          linkMeta.onUpdate ? ` ON UPDATE ${linkMeta.onUpdate}` : "",
        ].join("");

        const wasDeferred = deferredLinkTables.has(linkName.toLowerCase());
        const explicitHasPK =
          explicitEntity?.attributes?.some((a) => (a as any).isPrimaryKey) ?? false;

        // ✅ FK-констрейнты привязываем к именам колонок — так self N:M не коллизится
        const fkLName = qPg(limitIdentifier(`fk_${linkName}_${leftCol}`, 63));
        const fkRName = qPg(limitIdentifier(`fk_${linkName}_${rightCol}`, 63));

        const pkFromQ = qPg(fromPKName);
        const pkToQ = qPg(toPKName);

        if (explicitEntity) {
          if (wasDeferred) {
            sqlParts.push(
              `CREATE TABLE ${L} (\n` +
                `  ${leftQ} ${fromPK.type} NOT NULL,\n` +
                `  ${rightQ} ${toPK.type} NOT NULL,\n` +
                (linkMeta.compositePrimaryKey === false || explicitHasPK
                  ? ""
                  : `  PRIMARY KEY (${leftQ}, ${rightQ}),\n`) +
                `  CONSTRAINT ${fkLName} FOREIGN KEY (${leftQ}) REFERENCES ${F}(${pkFromQ})${actions},\n` +
                `  CONSTRAINT ${fkRName} FOREIGN KEY (${rightQ}) REFERENCES ${T}(${pkToQ})${actions}\n` +
                `);`
            );
            if (linkMeta.index !== false) {
              sqlParts.push(`CREATE INDEX ON ${L}(${leftQ});`);
              sqlParts.push(`CREATE INDEX ON ${L}(${rightQ});`);
            }
          } else {
            if (!hasColumn(explicitEntity, leftCol)) {
              sqlParts.push(`ALTER TABLE ${L}\n  ADD COLUMN ${leftQ} ${fromPK.type} NOT NULL;`);
            } else {
              sqlParts.push(`ALTER TABLE ${L}\n  ALTER COLUMN ${leftQ} SET NOT NULL;`);
            }
            if (!hasColumn(explicitEntity, rightCol)) {
              sqlParts.push(`ALTER TABLE ${L}\n  ADD COLUMN ${rightQ} ${toPK.type} NOT NULL;`);
            } else {
              sqlParts.push(`ALTER TABLE ${L}\n  ALTER COLUMN ${rightQ} SET NOT NULL;`);
            }

            if (linkMeta.compositePrimaryKey !== false && !explicitHasPK) {
              sqlParts.push(`ALTER TABLE ${L}\n  ADD PRIMARY KEY (${leftQ}, ${rightQ});`);
            }
            if (linkMeta.compositePrimaryKey === false) {
              const uq = qPg(limitIdentifier(`uq_${linkName}_${leftCol}_${rightCol}`, 63));
              sqlParts.push(`ALTER TABLE ${L}\n  ADD CONSTRAINT ${uq} UNIQUE (${leftQ}, ${rightQ});`);
            }

            sqlParts.push(
              `ALTER TABLE ${L}\n  ADD CONSTRAINT ${fkLName} FOREIGN KEY (${leftQ}) REFERENCES ${F}(${pkFromQ})${actions};`
            );
            sqlParts.push(
              `ALTER TABLE ${L}\n  ADD CONSTRAINT ${fkRName} FOREIGN KEY (${rightQ}) REFERENCES ${T}(${pkToQ})${actions};`
            );

            if (linkMeta.index !== false) {
              sqlParts.push(`CREATE INDEX ON ${L}(${leftQ});`);
              sqlParts.push(`CREATE INDEX ON ${L}(${rightQ});`);
            }
          }
        } else {
          sqlParts.push(
            `CREATE TABLE ${L} (\n` +
              `  ${leftQ} ${fromPK.type} NOT NULL,\n` +
              `  ${rightQ} ${toPK.type} NOT NULL,\n` +
              (linkMeta.compositePrimaryKey === false
                ? `  CONSTRAINT ${qPg(limitIdentifier(`uq_${linkName}_${leftCol}_${rightCol}`, 63))} UNIQUE (${leftQ}, ${rightQ}),\n`
                : `  PRIMARY KEY (${leftQ}, ${rightQ}),\n`) +
              `  CONSTRAINT ${fkLName} FOREIGN KEY (${leftQ}) REFERENCES ${F}(${pkFromQ})${actions},\n` +
              `  CONSTRAINT ${fkRName} FOREIGN KEY (${rightQ}) REFERENCES ${T}(${pkToQ})${actions}\n` +
              `);`
          );
          if (linkMeta.index !== false) {
            sqlParts.push(`CREATE INDEX ON ${L}(${leftQ});`);
            sqlParts.push(`CREATE INDEX ON ${L}(${rightQ});`);
          }
        }

        break;
      }
    }
  }

  return sqlParts.join("\n\n");
}
