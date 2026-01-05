// frontend/src/utils/sql/mssql.ts
import type { Entity, Relationship, FKMeta, LinkMeta } from "../../store/useERStore";
import {
  sanitize,
  snake,
  toSingular,
  fkColNameFor,
  hasColumn,
  findExistingFKColumn,
  findExistingLinkEntity,
  getPrimaryKey,
  suggestLinkTableName,
  uniqueName,
  limitIdentifier,
} from "./common";

type Action = "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";

function qMs(name: string) {
  return `[${sanitize(name)}]`;
}

function mapTypeToMSSQL(t: string): string {
  const raw = (t || "").trim();
  const u = raw.replace(/\s+/g, "").toUpperCase();

  if (!raw) return "NVARCHAR(255)";
  if (u === "SERIAL") return "INT IDENTITY(1,1)";
  if (u.startsWith("UUID")) return "UNIQUEIDENTIFIER";
  if (u === "TIMESTAMP") return "DATETIME2";
  if (u === "BOOLEAN" || u === "BOOL") return "BIT";
  if (u === "TEXT") return "NVARCHAR(MAX)";
  if (u === "JSON") return "NVARCHAR(MAX)";
  return raw;
}

function idxName(table: string, col: string) {
  return limitIdentifier(`idx_${snake(table)}_${snake(col)}`, 128);
}

export function generateMSSQLSQL(entities: Entity[], relationships: Relationship[]): string {
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

  const deferredLinkTables = new Set<string>();
  const involved = new Set<string>();
  for (const r of relationships) {
    if (entById.has(r.from)) involved.add(r.from);
    if (entById.has(r.to)) involved.add(r.to);
  }

  /* ==== 1) CREATE TABLES ==== */
  for (const e of entities) {
    const isExplicitLink = linkEntityIds.has(e.id);

    const baseTableName = sanitize(e.name);
    const sqlTableName = isExplicitLink ? linkSqlNameByEntityId.get(e.id) ?? baseTableName : baseTableName;

    const T = qMs(sqlTableName);

    if (e.attributes.length === 0 && !involved.has(e.id) && !isExplicitLink) continue;

    if (isExplicitLink && e.attributes.length === 0) {
      deferredLinkTables.add(sqlTableName);
      continue;
    }

    const cols: string[] = [];
    for (const a of e.attributes) {
      const col = sanitize(a.name);
      const isPk = (a as any).isPrimaryKey;
      const C = qMs(col);
      const colType = mapTypeToMSSQL(a.type);
      cols.push(`${C} ${colType}${isPk ? " PRIMARY KEY" : ""}`);
    }

    const hasPK = e.attributes.some((a) => (a as any).isPrimaryKey);
    if (!isExplicitLink && !hasPK) {
      cols.unshift(`${qMs("id")} UNIQUEIDENTIFIER PRIMARY KEY`);
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
    const F = qMs(fromName);
    const T = qMs(toName);

    const fromPK = getPrimaryKey(from);
    const toPK = getPrimaryKey(to);

    const fromPKName = sanitize(fromPK.name);
    const toPKName = sanitize(toPK.name);
    const fromSing = toSingular(fromName);
    const toSing = toSingular(toName);

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

        const computedName = fkColNameFor(fromSing, fromPKName);
        const suggestedExisting = findExistingFKColumn(to, fromName, fromSing, fromPKName);
        const requestedName = (fkMeta.column && fkMeta.column.trim()) || suggestedExisting || computedName;

        const fkCol = sanitize(requestedName);
        const fkColQ = qMs(fkCol);
        const fkType = mapTypeToMSSQL(fkMeta.type ?? fromPK.type);

        const existsExact = hasColumn(to, fkCol);

        if (existsExact) {
          if (fkMeta.notNull !== false) {
            sqlParts.push(`ALTER TABLE ${T}\n  ALTER COLUMN ${fkColQ} ${fkType} NOT NULL;`);
          }
        } else {
          sqlParts.push(
            `ALTER TABLE ${T}\n  ADD ${fkColQ} ${fkType}${fkMeta.notNull === false ? "" : " NOT NULL"};`
          );
        }

        const actions =
          `${fkMeta.onDelete ? ` ON DELETE ${fkMeta.onDelete}` : ""}` +
          `${fkMeta.onUpdate ? ` ON UPDATE ${fkMeta.onUpdate}` : ""}`;

        const fkName = limitIdentifier(`fk_${toName}_${fromName}_${fkCol}`, 128);
        sqlParts.push(
          `ALTER TABLE ${T}\n  ADD CONSTRAINT ${qMs(fkName)} FOREIGN KEY (${fkColQ}) REFERENCES ${F}(${qMs(
            fromPKName
          )})${actions};`
        );

        const wantUnique =
          fkMeta.unique === undefined ? r.type === "one-to-one" : fkMeta.unique === true;

        if (wantUnique) {
          const uqName = limitIdentifier(`uq_${toName}_${fkCol}`, 128);
          sqlParts.push(`ALTER TABLE ${T}\n  ADD CONSTRAINT ${qMs(uqName)} UNIQUE (${fkColQ});`);
        } else if (fkMeta.index !== false) {
          const ix = idxName(toName, fkCol);
          sqlParts.push(`CREATE INDEX ${qMs(ix)} ON ${T}(${fkColQ});`);
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

        const leftCol = sanitize(linkMeta.leftColumn ?? fkColNameFor(fromSing, fromPKName));
        const rightCol = sanitize(linkMeta.rightColumn ?? fkColNameFor(toSing, toPKName));

        const leftQ = qMs(leftCol);
        const rightQ = qMs(rightCol);

        const autoName = suggestLinkTableName(fromName, toName);
        const linkName = linkSqlNameByPair.get(key) ?? sanitize(linkMeta.tableName ?? autoName);
        const L = qMs(linkName);

        const actions =
          `${linkMeta.onDelete ? ` ON DELETE ${linkMeta.onDelete}` : ""}` +
          `${linkMeta.onUpdate ? ` ON UPDATE ${linkMeta.onUpdate}` : ""}`;

        const wasDeferred = deferredLinkTables.has(linkName);
        const explicitHasPK = explicitEntity?.attributes?.some((a) => (a as any).isPrimaryKey) ?? false;

        const fkLName = limitIdentifier(`fk_${linkName}_${fromName}_${leftCol}`, 128);
        const fkRName = limitIdentifier(`fk_${linkName}_${toName}_${rightCol}`, 128);

        if (explicitEntity) {
          if (wasDeferred) {
            const pkLine =
              linkMeta.compositePrimaryKey === false || explicitHasPK
                ? ""
                : `  CONSTRAINT ${qMs(limitIdentifier(`pk_${linkName}_${leftCol}_${rightCol}`, 128))} PRIMARY KEY (${leftQ}, ${rightQ}),\n`;

            const uqLine =
              linkMeta.compositePrimaryKey === false
                ? `  CONSTRAINT ${qMs(
                    limitIdentifier(`uq_${linkName}_${leftCol}_${rightCol}`, 128)
                  )} UNIQUE (${leftQ}, ${rightQ}),\n`
                : "";

            sqlParts.push(
              `CREATE TABLE ${L} (\n` +
                `  ${leftQ} ${mapTypeToMSSQL(fromPK.type)} NOT NULL,\n` +
                `  ${rightQ} ${mapTypeToMSSQL(toPK.type)} NOT NULL,\n` +
                uqLine +
                pkLine +
                `  CONSTRAINT ${qMs(fkLName)} FOREIGN KEY (${leftQ}) REFERENCES ${F}(${qMs(fromPKName)})${actions},\n` +
                `  CONSTRAINT ${qMs(fkRName)} FOREIGN KEY (${rightQ}) REFERENCES ${T}(${qMs(toPKName)})${actions}\n` +
                `);`
            );

            if (linkMeta.index !== false) {
              sqlParts.push(`CREATE INDEX ${qMs(idxName(linkName, leftCol))} ON ${L}(${leftQ});`);
              sqlParts.push(`CREATE INDEX ${qMs(idxName(linkName, rightCol))} ON ${L}(${rightQ});`);
            }
          } else {
            if (!hasColumn(explicitEntity, leftCol)) {
              sqlParts.push(`ALTER TABLE ${L}\n  ADD ${leftQ} ${mapTypeToMSSQL(fromPK.type)} NOT NULL;`);
            } else {
              sqlParts.push(`ALTER TABLE ${L}\n  ALTER COLUMN ${leftQ} ${mapTypeToMSSQL(fromPK.type)} NOT NULL;`);
            }

            if (!hasColumn(explicitEntity, rightCol)) {
              sqlParts.push(`ALTER TABLE ${L}\n  ADD ${rightQ} ${mapTypeToMSSQL(toPK.type)} NOT NULL;`);
            } else {
              sqlParts.push(`ALTER TABLE ${L}\n  ALTER COLUMN ${rightQ} ${mapTypeToMSSQL(toPK.type)} NOT NULL;`);
            }

            if (linkMeta.compositePrimaryKey !== false && !explicitHasPK) {
              const pkName = limitIdentifier(`pk_${linkName}_${leftCol}_${rightCol}`, 128);
              sqlParts.push(`ALTER TABLE ${L}\n  ADD CONSTRAINT ${qMs(pkName)} PRIMARY KEY (${leftQ}, ${rightQ});`);
            }
            if (linkMeta.compositePrimaryKey === false) {
              const uqName = limitIdentifier(`uq_${linkName}_${leftCol}_${rightCol}`, 128);
              sqlParts.push(`ALTER TABLE ${L}\n  ADD CONSTRAINT ${qMs(uqName)} UNIQUE (${leftQ}, ${rightQ});`);
            }

            sqlParts.push(
              `ALTER TABLE ${L}\n  ADD CONSTRAINT ${qMs(fkLName)} FOREIGN KEY (${leftQ}) REFERENCES ${F}(${qMs(
                fromPKName
              )})${actions};`
            );
            sqlParts.push(
              `ALTER TABLE ${L}\n  ADD CONSTRAINT ${qMs(fkRName)} FOREIGN KEY (${rightQ}) REFERENCES ${T}(${qMs(
                toPKName
              )})${actions};`
            );

            if (linkMeta.index !== false) {
              sqlParts.push(`CREATE INDEX ${qMs(idxName(linkName, leftCol))} ON ${L}(${leftQ});`);
              sqlParts.push(`CREATE INDEX ${qMs(idxName(linkName, rightCol))} ON ${L}(${rightQ});`);
            }
          }
        } else {
          const pkOrUq =
            linkMeta.compositePrimaryKey === false
              ? `  CONSTRAINT ${qMs(limitIdentifier(`uq_${linkName}_${leftCol}_${rightCol}`, 128))} UNIQUE (${leftQ}, ${rightQ}),\n`
              : `  CONSTRAINT ${qMs(limitIdentifier(`pk_${linkName}_${leftCol}_${rightCol}`, 128))} PRIMARY KEY (${leftQ}, ${rightQ}),\n`;

          sqlParts.push(
            `CREATE TABLE ${L} (\n` +
              `  ${leftQ} ${mapTypeToMSSQL(fromPK.type)} NOT NULL,\n` +
              `  ${rightQ} ${mapTypeToMSSQL(toPK.type)} NOT NULL,\n` +
              pkOrUq +
              `  CONSTRAINT ${qMs(fkLName)} FOREIGN KEY (${leftQ}) REFERENCES ${F}(${qMs(fromPKName)})${actions},\n` +
              `  CONSTRAINT ${qMs(fkRName)} FOREIGN KEY (${rightQ}) REFERENCES ${T}(${qMs(toPKName)})${actions}\n` +
              `);`
          );

          if (linkMeta.index !== false) {
            sqlParts.push(`CREATE INDEX ${qMs(idxName(linkName, leftCol))} ON ${L}(${leftQ});`);
            sqlParts.push(`CREATE INDEX ${qMs(idxName(linkName, rightCol))} ON ${L}(${rightQ});`);
          }
        }
        break;
      }
    }
  }

  return sqlParts.join("\n\n");
}
