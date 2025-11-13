import type { Entity, Relationship, FKMeta, LinkMeta } from "../../store/useERStore";
import {
  sanitize, snake, toSingular, fkColNameFor, qMy,
  hasColumn, findExistingFKColumn, findExistingLinkEntity, getPrimaryKey
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
  return `idx_${snake(table)}_${snake(col)}`.slice(0, 63);
}

export function generateMySQLSQL(entities: Entity[], relationships: Relationship[]): string {
  const sqlParts: string[] = [];
  const entById = new Map(entities.map((e) => [e.id, e]));

  /* ==== Подготовка N:M ==== */
  type MMPair = {
    from: Entity; to: Entity;
    fromName: string; toName: string;
    fromSingular: string; toSingular: string;
  };

  const mmPairs: MMPair[] = relationships
    .filter((r) => r.type === "many-to-many")
    .map((r) => {
      const from = entById.get(r.from);
      const to = entById.get(r.to);
      if (!from || !to) return null;
      return {
        from, to,
        fromName: sanitize(from.name),
        toName: sanitize(to.name),
        fromSingular: toSingular(sanitize(from.name)),
        toSingular: toSingular(sanitize(to.name)),
      };
    })
    .filter(Boolean) as MMPair[];

  const linkEntityIds = new Set<string>();
  const linkEntityByPair = new Map<string, Entity | null>();
  for (const pair of mmPairs) {
    const key = `${pair.from.id}__${pair.to.id}`;
    const link = findExistingLinkEntity(pair.from, pair.to, entities);
    if (link) linkEntityIds.add(link.id);
    linkEntityByPair.set(key, link);
  }

  const deferredLinkTables = new Set<string>(); 
  const involved = new Set<string>();
  for (const r of relationships) {
    if (entById.has(r.from)) involved.add(r.from);
    if (entById.has(r.to))   involved.add(r.to);
  }

  /* ==== 1) CREATE TABLES ==== */
  for (const e of entities) {
    const isExplicitLink = linkEntityIds.has(e.id);
    const tableName = sanitize(e.name);
    const T = qMy(tableName);

    if (e.attributes.length === 0 && !involved.has(e.id) && !isExplicitLink) continue;

    if (isExplicitLink && e.attributes.length === 0) {
      deferredLinkTables.add(tableName);
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
    const toPK   = getPrimaryKey(to);

    const fromPKName = sanitize(fromPK.name);
    const toPKName   = sanitize(toPK.name);
    const fromSing   = toSingular(fromName);
    const toSing     = toSingular(toName);

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
        const requestedName = fkMeta.column ?? suggestedExisting ?? computedName;

        const fkCol  = sanitize(requestedName);
        const fkColQ = qMy(fkCol);
        const fkType = mapTypeToMySQL(fkMeta.type ?? fromPK.type);

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

        const fkName = `fk_${fromName}_${toName}`.slice(0, 63);
        sqlParts.push(
          `ALTER TABLE ${T}\n  ADD CONSTRAINT ${qMy(fkName)} FOREIGN KEY (${fkColQ}) REFERENCES ${F}(${qMy(fromPKName)})${actions};`
        );

        const wantUnique = fkMeta.unique === undefined ? (r.type === "one-to-one") : fkMeta.unique === true;

        if (fkMeta.index !== false && !wantUnique) {
          const ix = idxName(toName, fkCol);
          sqlParts.push(`CREATE INDEX ${qMy(ix)} ON ${T}(${fkColQ});`);
        }
        if (wantUnique) {
          const uqName = `uq_${toName}_${fkCol}`.slice(0, 63);
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

        const leftCol  = sanitize(linkMeta.leftColumn  ?? fkColNameFor(fromSing, fromPKName));
        const rightCol = sanitize(linkMeta.rightColumn ?? fkColNameFor(toSing,   toPKName));

        const leftQ  = qMy(leftCol);
        const rightQ = qMy(rightCol);

        const autoName    = `${snake(fromName)}_${snake(toName)}_link`;
        const rawLinkName = linkMeta.tableName ?? (explicitEntity ? explicitEntity.name : autoName);
        const linkName    = sanitize(rawLinkName);
        const L = qMy(linkName);

        const actions = [
          linkMeta.onDelete ? ` ON DELETE ${linkMeta.onDelete}` : "",
          linkMeta.onUpdate ? ` ON UPDATE ${linkMeta.onUpdate}` : "",
        ].join("");

        const wasDeferred   = deferredLinkTables.has(linkName);
        const explicitHasPK = explicitEntity?.attributes?.some((a) => (a as any).isPrimaryKey) ?? false;

        const fkLName = `fk_${linkName}_${fromName}`.slice(0, 63);
        const fkRName = `fk_${linkName}_${toName}`.slice(0, 63);

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
        }
        break;
      }
    }
  }

  return sqlParts.join("\n\n");
}
