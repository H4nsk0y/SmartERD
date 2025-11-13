import type { Entity, Relationship, FKMeta, LinkMeta } from "../../store/useERStore";
import {
  sanitize, snake, toSingular, fkColNameFor, qPg,
  hasColumn, findExistingFKColumn, findExistingLinkEntity, getPrimaryKey
} from "./common";

type MMPair = {
  from: Entity;
  to: Entity;
  fromName: string;
  toName: string;
  fromSingular: string;
  toSingular: string;
};

export function generatePostgresSQL(entities: Entity[], relationships: Relationship[]): string {
  const sqlParts: string[] = [];
  const entById = new Map(entities.map((e) => [e.id, e]));

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
    const T = qPg(tableName);

    // если пустая и не участвует — пропускаем
    if (e.attributes.length === 0 && !involved.has(e.id) && !isExplicitLink) continue;

    // явная link-таблица без колонок — отложим, реализуем позже полностью - таким образом избегаем дублирования 
    if (isExplicitLink && e.attributes.length === 0) {
      deferredLinkTables.add(tableName);
      continue;
    }

    const cols: string[] = [];
    for (const a of e.attributes) {
      const colName = sanitize(a.name);
      const isPk = (a as any).isPrimaryKey;
      const C = qPg(colName);
      let line = `${C} ${a.type}${isPk ? " PRIMARY KEY" : ""}`;
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
    const F = qPg(fromName);
    const T = qPg(toName);

    const fromPK = getPrimaryKey(from);
    const toPK = getPrimaryKey(to);
    const fromPKName = sanitize(fromPK.name);
    const toPKName = sanitize(toPK.name);
    const fromSingular = toSingular(fromName);
    const toSingularName = toSingular(toName);

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

        const computedName = fkColNameFor(fromSingular, fromPKName);
        const suggestedExisting = findExistingFKColumn(to, fromName, fromSingular, fromPKName);
        const requestedName = fkMeta.column ?? suggestedExisting ?? computedName;

        const fkColName = sanitize(requestedName);
        const fkColQ = qPg(fkColName);
        const fkType = fkMeta.type ?? fromPK.type;

        const existsExact = hasColumn(to, fkColName);

        if (existsExact) {
          if (fkMeta.notNull !== false) {
            sqlParts.push(`ALTER TABLE ${T}\n  ALTER COLUMN ${fkColQ} SET NOT NULL;`);
          }
        } else {
          sqlParts.push(
            `ALTER TABLE ${T}\n  ADD COLUMN ${fkColQ} ${fkType}${fkMeta.notNull === false ? "" : " NOT NULL"};`
          );
        }

        const actions = [
          fkMeta.onDelete ? ` ON DELETE ${fkMeta.onDelete}` : "",
          fkMeta.onUpdate ? ` ON UPDATE ${fkMeta.onUpdate}` : "",
        ].join("");

        const fkName = qPg(`fk_${toName}_${fromName}`);
        const pkQ = qPg(fromPKName);
        sqlParts.push(
          `ALTER TABLE ${T}\n  ADD CONSTRAINT ${fkName} FOREIGN KEY (${fkColQ}) REFERENCES ${F}(${pkQ})${actions};`
        );

        const wantUnique = fkMeta.unique === undefined ? (r.type === "one-to-one") : fkMeta.unique === true;

        if (fkMeta.index !== false && !wantUnique) {
          sqlParts.push(`CREATE INDEX ON ${T}(${fkColQ});`);
        }
        if (wantUnique) {
          const uqName = qPg(`uq_${toName}_${fkColName}`);
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

        const leftCol  = sanitize(linkMeta.leftColumn  ?? fkColNameFor(fromSingular, fromPKName));
        const rightCol = sanitize(linkMeta.rightColumn ?? fkColNameFor(toSingularName, toPKName));

        const leftQ  = qPg(leftCol);
        const rightQ = qPg(rightCol);

        const autoName    = `${snake(fromName)}_${snake(toName)}_link`;
        const rawLinkName = linkMeta.tableName ?? (explicitEntity ? explicitEntity.name : autoName);
        const linkName    = sanitize(rawLinkName);
        const L = qPg(linkName);

        const actions = [
          linkMeta.onDelete ? ` ON DELETE ${linkMeta.onDelete}` : "",
          linkMeta.onUpdate ? ` ON UPDATE ${linkMeta.onUpdate}` : "",
        ].join("");

        const wasDeferred   = deferredLinkTables.has(linkName);
        const explicitHasPK = explicitEntity?.attributes?.some((a) => (a as any).isPrimaryKey) ?? false;

        const fkLName = qPg(`fk_${linkName}_${fromName}`);
        const fkRName = qPg(`fk_${linkName}_${toName}`);
        const pkFromQ = qPg(fromPKName);
        const pkToQ   = qPg(toPKName);

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
        }

        break;
      }
    }
  }

  return sqlParts.join("\n\n");
}
