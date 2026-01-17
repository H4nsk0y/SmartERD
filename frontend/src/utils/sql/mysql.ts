import type { Entity, Relationship, FKMeta, LinkMeta } from "../../store/useERStore";
import {
  sanitize,
  snake,
  toSingular,
  fkColNameFor,
  qMy,
  hasColumn,
  findExistingFKColumn,
  findExistingLinkEntity,
  getPrimaryKey,
  suggestLinkTableName,
  uniqueName,
  limitIdentifier,
} from "./common";

/** Приведение «универсальных» типов к MySQL */
function mapTypeToMySQL(t: string): string {
  const raw = (t || "").trim();
  const u = raw.replace(/\s+/g, "").toUpperCase();

  if (u === "SERIAL") return "INT AUTO_INCREMENT";
  if (u.startsWith("UUID")) return "CHAR(36)";
  if (u === "TIMESTAMP") return "DATETIME";
  return raw;
}

function idxName(table: string, col: string) {
  return limitIdentifier(`idx_${snake(table)}_${snake(col)}`, 64);
}

export function generateMySQLSQL(entities: Entity[], relationships: Relationship[]): string {
  const sqlParts: string[] = [];
  const entById = new Map(entities.map((e) => [e.id, e]));

  const usedTableNames = new Set(entities.map((e) => sanitize(e.name).toLowerCase()));
  const linkSqlNameByEntityId = new Map<string, string>();
  const linkSqlNameByPair = new Map<string, string>();

  /* ==== Подготовка N:M ==== */
  // type MMPair = {
  //   from: Entity;
  //   to: Entity;
  //   fromName: string;
  //   toName: string;
  //   fromSingular: string;
  //   toSingular: string;
  // };

  // const mmPairs: MMPair[] = relationships
  //   .filter((r) => r.type === "many-to-many")
  //   .map((r) => {
  //     const from = entById.get(r.from);
  //     const to = entById.get(r.to);
  //     if (!from || !to) return null;
  //     return {
  //       from,
  //       to,
  //       fromName: sanitize(from.name),
  //       toName: sanitize(to.name),
  //       fromSingular: toSingular(sanitize(from.name)),
  //       toSingular: toSingular(sanitize(to.name)),
  //     };
  //   })
  //   .filter(Boolean) as MMPair[];

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

    if (explicit) {
      linkEntityIds.add(explicit.id);
    }
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
    const sqlTableName = isExplicitLink
      ? (linkSqlNameByEntityId.get(e.id) ?? baseTableName)
      : baseTableName;

    const T = qMy(sqlTableName);

    if (e.attributes.length === 0 && !involved.has(e.id) && !isExplicitLink) continue;

    if (isExplicitLink && e.attributes.length === 0) {
      deferredLinkTables.add(sqlTableName);
      continue;
    }

    const cols: string[] = [];
    for (const a of e.attributes) {
      const col = sanitize(a.name);
      const isPk = (a as any).isPrimaryKey;
      const C = qMy(col);
      const colType = mapTypeToMySQL(a.type);
      cols.push(`${C} ${colType}${isPk ? " PRIMARY KEY" : ""}`);
    }

    const hasPK = e.attributes.some((a) => (a as any).isPrimaryKey);
    if (!isExplicitLink && !hasPK) {
      cols.unshift(`${qMy("id")} CHAR(36) PRIMARY KEY`);
    }

    sqlParts.push(`CREATE TABLE ${T} (\n  ${cols.join(",\n  ")}\n) ENGINE=InnoDB;`);
  }

  /* ==== 2) RELATIONSHIPS ==== */
  for (const r of relationships) {
    const from = entById.get(r.from);
    const to = entById.get(r.to);
    if (!from || !to) continue;

    const fromName = sanitize(from.name);
    const toName = sanitize(to.name);
    const F = qMy(fromName);
    const T = qMy(toName);

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
        const requestedName =
          (fkMeta.column && fkMeta.column.trim()) ||
          suggestedExisting ||
          computedName;

        const fkCol = sanitize(requestedName);
        const fkColQ = qMy(fkCol);
        const fkTypeRaw = (fkMeta.type ?? "").trim() || fromPK.type;
        const fkType = mapTypeToMySQL(fkTypeRaw);

        const existsExact = hasColumn(to, fkCol);
        if (existsExact) {
          if (fkMeta.notNull !== false) {
            sqlParts.push(`ALTER TABLE ${T}\n  MODIFY ${fkColQ} ${fkType} NOT NULL;`);
          }
        } else {
          sqlParts.push(
            `ALTER TABLE ${T}\n  ADD ${fkColQ} ${fkType}${fkMeta.notNull === false ? "" : " NOT NULL"};`
          );
        }

        const actions = [
          fkMeta.onDelete ? ` ON DELETE ${fkMeta.onDelete}` : "",
          fkMeta.onUpdate ? ` ON UPDATE ${fkMeta.onUpdate}` : "",
        ].join("");

        const fkName = limitIdentifier(`fk_${fromName}_${toName}`, 64);
        sqlParts.push(
          `ALTER TABLE ${T}\n  ADD CONSTRAINT ${qMy(fkName)} FOREIGN KEY (${fkColQ}) REFERENCES ${F}(${qMy(fromPKName)})${actions};`
        );

        const wantUnique =
          fkMeta.unique === undefined ? (r.type === "one-to-one") : fkMeta.unique === true;

        if (fkMeta.index !== false && !wantUnique) {
          const ix = idxName(toName, fkCol);
          sqlParts.push(`CREATE INDEX ${qMy(ix)} ON ${T}(${fkColQ});`);
        }
        if (wantUnique) {
          const uqName = limitIdentifier(`uq_${toName}_${fkCol}`, 64);
          sqlParts.push(`ALTER TABLE ${T}\n  ADD CONSTRAINT ${qMy(uqName)} UNIQUE (${fkColQ});`);
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

        const leftQ = qMy(leftCol);
        const rightQ = qMy(rightCol);

        const autoName = suggestLinkTableName(fromName, toName);
        const linkName = linkSqlNameByPair.get(key) ?? sanitize(linkMeta.tableName ?? autoName);
        const L = qMy(linkName);

        const actions = [
          linkMeta.onDelete ? ` ON DELETE ${linkMeta.onDelete}` : "",
          linkMeta.onUpdate ? ` ON UPDATE ${linkMeta.onUpdate}` : "",
        ].join("");

        const wasDeferred = deferredLinkTables.has(linkName);
        const explicitHasPK =
          explicitEntity?.attributes?.some((a) => (a as any).isPrimaryKey) ?? false;

        const fkLName = limitIdentifier(`fk_${linkName}_${fromName}`, 64);
        const fkRName = limitIdentifier(`fk_${linkName}_${toName}`, 64);

        if (explicitEntity) {
          if (wasDeferred) {
            sqlParts.push(
              `CREATE TABLE ${L} (\n` +
                `  ${leftQ} ${mapTypeToMySQL(fromPK.type)} NOT NULL,\n` +
                `  ${rightQ} ${mapTypeToMySQL(toPK.type)} NOT NULL,\n` +
                (linkMeta.compositePrimaryKey === false || explicitHasPK
                  ? ""
                  : `  PRIMARY KEY (${leftQ}, ${rightQ}),\n`) +
                `  CONSTRAINT ${qMy(fkLName)} FOREIGN KEY (${leftQ}) REFERENCES ${F}(${qMy(fromPKName)})${actions},\n` +
                `  CONSTRAINT ${qMy(fkRName)} FOREIGN KEY (${rightQ}) REFERENCES ${T}(${qMy(toPKName)})${actions}\n` +
                `) ENGINE=InnoDB;`
            );
            if (linkMeta.index !== false) {
              sqlParts.push(`CREATE INDEX ${qMy(idxName(linkName, leftCol))} ON ${L}(${leftQ});`);
              sqlParts.push(`CREATE INDEX ${qMy(idxName(linkName, rightCol))} ON ${L}(${rightQ});`);
            }
          } else {
            if (!hasColumn(explicitEntity, leftCol)) {
              sqlParts.push(`ALTER TABLE ${L}\n  ADD ${leftQ} ${mapTypeToMySQL(fromPK.type)} NOT NULL;`);
            } else {
              sqlParts.push(`ALTER TABLE ${L}\n  MODIFY ${leftQ} ${mapTypeToMySQL(fromPK.type)} NOT NULL;`);
            }
            if (!hasColumn(explicitEntity, rightCol)) {
              sqlParts.push(`ALTER TABLE ${L}\n  ADD ${rightQ} ${mapTypeToMySQL(toPK.type)} NOT NULL;`);
            } else {
              sqlParts.push(`ALTER TABLE ${L}\n  MODIFY ${rightQ} ${mapTypeToMySQL(toPK.type)} NOT NULL;`);
            }

            if (linkMeta.compositePrimaryKey !== false && !explicitHasPK) {
              sqlParts.push(`ALTER TABLE ${L}\n  ADD PRIMARY KEY (${leftQ}, ${rightQ});`);
            }
            if (linkMeta.compositePrimaryKey === false) {
              const uq = qMy(limitIdentifier(`uq_${linkName}_${leftCol}_${rightCol}`, 64));
              sqlParts.push(`ALTER TABLE ${L}\n  ADD CONSTRAINT ${uq} UNIQUE (${leftQ}, ${rightQ});`);
            }

            sqlParts.push(
              `ALTER TABLE ${L}\n  ADD CONSTRAINT ${qMy(fkLName)} FOREIGN KEY (${leftQ}) REFERENCES ${F}(${qMy(fromPKName)})${actions};`
            );
            sqlParts.push(
              `ALTER TABLE ${L}\n  ADD CONSTRAINT ${qMy(fkRName)} FOREIGN KEY (${rightQ}) REFERENCES ${T}(${qMy(toPKName)})${actions};`
            );

            if (linkMeta.index !== false) {
              sqlParts.push(`CREATE INDEX ${qMy(idxName(linkName, leftCol))} ON ${L}(${leftQ});`);
              sqlParts.push(`CREATE INDEX ${qMy(idxName(linkName, rightCol))} ON ${L}(${rightQ});`);
            }
          }
        } else {
          sqlParts.push(
            `CREATE TABLE ${L} (\n` +
              `  ${leftQ} ${mapTypeToMySQL(fromPK.type)} NOT NULL,\n` +
              `  ${rightQ} ${mapTypeToMySQL(toPK.type)} NOT NULL,\n` +
              (linkMeta.compositePrimaryKey === false
                ? `  CONSTRAINT ${qMy(limitIdentifier(`uq_${linkName}_${leftCol}_${rightCol}`, 64))} UNIQUE (${leftQ}, ${rightQ}),\n`
                : `  PRIMARY KEY (${leftQ}, ${rightQ}),\n`) +
              `  CONSTRAINT ${qMy(fkLName)} FOREIGN KEY (${leftQ}) REFERENCES ${F}(${qMy(fromPKName)})${actions},\n` +
              `  CONSTRAINT ${qMy(fkRName)} FOREIGN KEY (${rightQ}) REFERENCES ${T}(${qMy(toPKName)})${actions}\n` +
              `) ENGINE=InnoDB;`
          );
          if (linkMeta.index !== false) {
            sqlParts.push(`CREATE INDEX ${qMy(idxName(linkName, leftCol))} ON ${L}(${leftQ});`);
            sqlParts.push(`CREATE INDEX ${qMy(idxName(linkName, rightCol))} ON ${L}(${rightQ});`);
          }
        }
        break;
      }
    }
  }

  return sqlParts.join("\n\n");
}
