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

function ensureDistinctCols(left: string, right: string) {
  const L = left;
  let R = right;

  if (L.toLowerCase() !== R.toLowerCase()) return { left: L, right: R };

  const base = right || left || "ref_id";
  R = `${base}_2`;

  if (L.toLowerCase() === R.toLowerCase()) {
    R = `${base}_r`;
  }

  return { left: L, right: R };
}

function resolveFkType(fkMeta: FKMeta, referencedPkType: string): string {
  const t = (fkMeta.type ?? "").trim();
  return t || (referencedPkType || "UUID");
}


function mapTypeToMySQL(t: string): string {
  const raw = (t || "").trim();
  if (!raw) return raw;


  const u = raw.replace(/\s+/g, " ").trim().toUpperCase();

  if (/^UUID\b/i.test(raw)) {
    return raw.replace(/^UUID\b/i, "CHAR(36)");
  }


  if (/^SERIAL\b/i.test(raw)) {
    return raw.replace(/^SERIAL\b/i, "BIGINT AUTO_INCREMENT");
  }

  if (/^BOOLEAN\b/i.test(raw)) {
    return raw.replace(/^BOOLEAN\b/i, "TINYINT(1)");
  }

  if (/^TIMESTAMP\b/i.test(raw)) {
    return raw.replace(/^TIMESTAMP\b/i, "DATETIME");
  }

  if (/^JSON\b/i.test(raw)) return raw;

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

  for (const e of entities) {
    const isExplicitLink = linkEntityIds.has(e.id);

    const baseTableName = sanitize(e.name);
    const sqlTableName = isExplicitLink
      ? (linkSqlNameByEntityId.get(e.id) ?? baseTableName)
      : baseTableName;

    const T = qMy(sqlTableName);

    if (e.attributes.length === 0 && !involved.has(e.id) && !isExplicitLink) continue;

    if (isExplicitLink && e.attributes.length === 0) {
      deferredLinkTables.add(sqlTableName.toLowerCase());
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

    const fromSing = toSingular(fromName);
    const toSing = toSingular(toName);

    const F = qMy(fromName);
    const T = qMy(toName);

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

        const computedName = isSelf
          ? sanitize(`parent_${snake(fromPKName)}`)
          : fkColNameFor(fromSing, fromPKName);

        const suggestedExisting = findExistingFKColumn(to, fromName, fromSing, fromPKName);

        const requestedName =
          (fkMeta.column && fkMeta.column.trim()) ||
          suggestedExisting ||
          computedName;

        const fkCol = sanitize(requestedName);
        const fkColQ = qMy(fkCol);
        const fkType = mapTypeToMySQL(resolveFkType(fkMeta, fromPK.type));

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

        const fkName = limitIdentifier(`fk_${toName}_${fkCol}`, 64);

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

        const autoName = suggestLinkTableName(fromName, toName);
        const linkName = linkSqlNameByPair.get(key) ?? sanitize(linkMeta.tableName ?? autoName);
        const L = qMy(linkName);

        const leftBase = sanitize(linkMeta.leftColumn ?? fkColNameFor(fromSing, fromPKName));
        const rightBase = sanitize(linkMeta.rightColumn ?? fkColNameFor(toSing, toPKName));

        const distinct = ensureDistinctCols(leftBase, rightBase);
        const leftCol = sanitize(distinct.left);
        const rightCol = sanitize(distinct.right);

        const leftQ = qMy(leftCol);
        const rightQ = qMy(rightCol);

        const actions = [
          linkMeta.onDelete ? ` ON DELETE ${linkMeta.onDelete}` : "",
          linkMeta.onUpdate ? ` ON UPDATE ${linkMeta.onUpdate}` : "",
        ].join("");

        const wasDeferred = deferredLinkTables.has(linkName.toLowerCase());
        const explicitHasPK =
          explicitEntity?.attributes?.some((a) => (a as any).isPrimaryKey) ?? false;

        const fkLName = limitIdentifier(`fk_${linkName}_${leftCol}`, 64);
        const fkRName = limitIdentifier(`fk_${linkName}_${rightCol}`, 64);

        const leftType = mapTypeToMySQL(fromPK.type);
        const rightType = mapTypeToMySQL(toPK.type);

        if (explicitEntity) {
          if (wasDeferred) {
            sqlParts.push(
              `CREATE TABLE ${L} (\n` +
                `  ${leftQ} ${leftType} NOT NULL,\n` +
                `  ${rightQ} ${rightType} NOT NULL,\n` +
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
              sqlParts.push(`ALTER TABLE ${L}\n  ADD ${leftQ} ${leftType} NOT NULL;`);
            } else {
              sqlParts.push(`ALTER TABLE ${L}\n  MODIFY ${leftQ} ${leftType} NOT NULL;`);
            }
            if (!hasColumn(explicitEntity, rightCol)) {
              sqlParts.push(`ALTER TABLE ${L}\n  ADD ${rightQ} ${rightType} NOT NULL;`);
            } else {
              sqlParts.push(`ALTER TABLE ${L}\n  MODIFY ${rightQ} ${rightType} NOT NULL;`);
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
              `  ${leftQ} ${leftType} NOT NULL,\n` +
              `  ${rightQ} ${rightType} NOT NULL,\n` +
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
