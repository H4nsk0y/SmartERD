import type { Entity, Relationship, FKMeta, LinkMeta } from "../../store/useERStore";
import {
  sanitize, snake, toSingular, fkColNameFor,
  hasColumn, findExistingFKColumn, findExistingLinkEntity, getPrimaryKey
} from "./common";

/** Приведение «универсальных» типов к MySQL */
function mapTypeToMySQL(t: string): string {
  const raw = (t || "").trim();
  const u = raw.replace(/\s+/g, "").toUpperCase();

  if (u === "SERIAL") return "INT AUTO_INCREMENT"; // на всякий случай
  if (u.startsWith("UUID")) return "CHAR(36)";      // простой вариант хранения UUID (или можно BINARY(16))
  if (u === "TIMESTAMP") return "DATETIME";         // упростим: DATETIME чаще без сюрпризов
  // остальное оставляем как есть: INT, BIGINT, VARCHAR(...), TEXT, BOOLEAN, DATE, FLOAT, DECIMAL(…)
  return raw;
}

function idxName(table: string, col: string) {
  return `idx_${snake(table)}_${snake(col)}`.slice(0, 63); // ограничим до 64 символов
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

  const deferredLinkTables = new Set<string>(); // имена (sanitize)

  // Множество сущностей, участвующих в связях
  const involved = new Set<string>();
  for (const r of relationships) {
    if (entById.has(r.from)) involved.add(r.from);
    if (entById.has(r.to))   involved.add(r.to);
  }

  /* ==== 1) CREATE TABLES ==== */
  for (const e of entities) {
    const isExplicitLink = linkEntityIds.has(e.id);
    const tableName = sanitize(e.name);

    // пустая и не участвует — пропускаем (не создаём «висящую» пустышку)
    if (e.attributes.length === 0 && !involved.has(e.id) && !isExplicitLink) {
      continue;
    }

    // явная линк-таблица без колонок — отложим
    if (isExplicitLink && e.attributes.length === 0) {
      deferredLinkTables.add(tableName);
      continue;
    }

    const cols: string[] = [];
    for (const a of e.attributes) {
      const col = sanitize(a.name);
      const isPk = (a as any).isPrimaryKey;
      const colType = mapTypeToMySQL(a.type);
      // В MySQL лишний NOT NULL при PRIMARY KEY тоже не нужен
      cols.push(`${col} ${colType}${isPk ? " PRIMARY KEY" : ""}`);
    }

    const hasPK = e.attributes.some((a) => (a as any).isPrimaryKey);
    if (!isExplicitLink && !hasPK) {
      cols.unshift(`id INT AUTO_INCREMENT PRIMARY KEY`);
    }

    sqlParts.push(`CREATE TABLE ${tableName} (\n  ${cols.join(",\n  ")}\n) ENGINE=InnoDB;`);
  }

  /* ==== 2) RELATIONSHIPS ==== */
  for (const r of relationships) {
    const from = entById.get(r.from);
    const to = entById.get(r.to);
    if (!from || !to) continue;

    const fromName = sanitize(from.name);
    const toName = sanitize(to.name);
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
        const fkType = mapTypeToMySQL(fkMeta.type ?? fromPK.type);

        const existsExact = hasColumn(to, fkCol);
        if (existsExact) {
          if (fkMeta.notNull !== false) {
            // В MySQL нет ALTER COLUMN ... SET NOT NULL — нужно MODIFY с типом
            sqlParts.push(`ALTER TABLE ${toName}\n  MODIFY ${fkCol} ${fkType} NOT NULL;`);
          }
        } else {
          sqlParts.push(
            `ALTER TABLE ${toName}\n  ADD ${fkCol} ${fkType}${fkMeta.notNull === false ? "" : " NOT NULL"};`
          );
        }

        const actions = [
          fkMeta.onDelete ? ` ON DELETE ${fkMeta.onDelete}` : "",
          fkMeta.onUpdate ? ` ON UPDATE ${fkMeta.onUpdate}` : "",
        ].join("");

        sqlParts.push(
          `ALTER TABLE ${toName}\n  ADD CONSTRAINT fk_${toName}_${fromName} FOREIGN KEY (${fkCol}) REFERENCES ${fromName}(${fromPKName})${actions};`
        );

        const wantUnique = fkMeta.unique === undefined ? (r.type === "one-to-one") : fkMeta.unique === true;

        if (fkMeta.index !== false && !wantUnique) {
          sqlParts.push(`CREATE INDEX ${idxName(toName, fkCol)} ON ${toName}(${fkCol});`);
        }
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

        const leftCol  = sanitize(linkMeta.leftColumn  ?? fkColNameFor(fromSing, fromPKName));
        const rightCol = sanitize(linkMeta.rightColumn ?? fkColNameFor(toSing,   toPKName));

        const autoName    = `${snake(fromName)}_${snake(toName)}_link`;
        const rawLinkName = linkMeta.tableName ?? (explicitEntity ? explicitEntity.name : autoName);
        const linkName    = sanitize(rawLinkName);

        const actions = [
          linkMeta.onDelete ? ` ON DELETE ${linkMeta.onDelete}` : "",
          linkMeta.onUpdate ? ` ON UPDATE ${linkMeta.onUpdate}` : "",
        ].join("");

        const wasDeferred   = deferredLinkTables.has(linkName);
        const explicitHasPK = explicitEntity?.attributes?.some((a) => (a as any).isPrimaryKey) ?? false;

        if (explicitEntity) {
          if (wasDeferred) {
            sqlParts.push(
              `CREATE TABLE ${linkName} (\n` +
              `  ${leftCol} ${mapTypeToMySQL(fromPK.type)} NOT NULL,\n` +
              `  ${rightCol} ${mapTypeToMySQL(toPK.type)} NOT NULL,\n` +
              (linkMeta.compositePrimaryKey === false || explicitHasPK
                ? ""
                : `  PRIMARY KEY (${leftCol}, ${rightCol}),\n`) +
              `  CONSTRAINT fk_${linkName}_${fromName} FOREIGN KEY (${leftCol}) REFERENCES ${fromName}(${fromPKName})${actions},\n` +
              `  CONSTRAINT fk_${linkName}_${toName} FOREIGN KEY (${rightCol}) REFERENCES ${toName}(${toPKName})${actions}\n` +
              `) ENGINE=InnoDB;`
            );
            if (linkMeta.index !== false) {
              sqlParts.push(`CREATE INDEX ${idxName(linkName, leftCol)} ON ${linkName}(${leftCol});`);
              sqlParts.push(`CREATE INDEX ${idxName(linkName, rightCol)} ON ${linkName}(${rightCol});`);
            }
          } else {
            // уже создана (были колонки) — доводим через ALTER
            if (!hasColumn(explicitEntity, leftCol)) {
              sqlParts.push(`ALTER TABLE ${linkName}\n  ADD ${leftCol} ${mapTypeToMySQL(fromPK.type)} NOT NULL;`);
            } else {
              sqlParts.push(`ALTER TABLE ${linkName}\n  MODIFY ${leftCol} ${mapTypeToMySQL(fromPK.type)} NOT NULL;`);
            }
            if (!hasColumn(explicitEntity, rightCol)) {
              sqlParts.push(`ALTER TABLE ${linkName}\n  ADD ${rightCol} ${mapTypeToMySQL(toPK.type)} NOT NULL;`);
            } else {
              sqlParts.push(`ALTER TABLE ${linkName}\n  MODIFY ${rightCol} ${mapTypeToMySQL(toPK.type)} NOT NULL;`);
            }

            if (linkMeta.compositePrimaryKey !== false && !explicitHasPK) {
              sqlParts.push(`ALTER TABLE ${linkName}\n  ADD PRIMARY KEY (${leftCol}, ${rightCol});`);
            }

            sqlParts.push(
              `ALTER TABLE ${linkName}\n  ADD CONSTRAINT fk_${linkName}_${fromName} FOREIGN KEY (${leftCol}) REFERENCES ${fromName}(${fromPKName})${actions};`
            );
            sqlParts.push(
              `ALTER TABLE ${linkName}\n  ADD CONSTRAINT fk_${linkName}_${toName} FOREIGN KEY (${rightCol}) REFERENCES ${toName}(${toPKName})${actions};`
            );

            if (linkMeta.index !== false) {
              sqlParts.push(`CREATE INDEX ${idxName(linkName, leftCol)} ON ${linkName}(${leftCol});`);
              sqlParts.push(`CREATE INDEX ${idxName(linkName, rightCol)} ON ${linkName}(${rightCol});`);
            }
          }
        } else {
          // неявная линк-таблица
          sqlParts.push(
            `CREATE TABLE ${linkName} (\n` +
            `  ${leftCol} ${mapTypeToMySQL(fromPK.type)} NOT NULL,\n` +
            `  ${rightCol} ${mapTypeToMySQL(toPK.type)} NOT NULL,\n` +
            (linkMeta.compositePrimaryKey === false
              ? ""
              : `  PRIMARY KEY (${leftCol}, ${rightCol}),\n`) +
            `  CONSTRAINT fk_${linkName}_${fromName} FOREIGN KEY (${leftCol}) REFERENCES ${fromName}(${fromPKName})${actions},\n` +
            `  CONSTRAINT fk_${linkName}_${toName} FOREIGN KEY (${rightCol}) REFERENCES ${toName}(${toPKName})${actions}\n` +
            `) ENGINE=InnoDB;`
          );
          if (linkMeta.index !== false) {
            sqlParts.push(`CREATE INDEX ${idxName(linkName, leftCol)} ON ${linkName}(${leftCol});`);
            sqlParts.push(`CREATE INDEX ${idxName(linkName, rightCol)} ON ${linkName}(${rightCol});`);
          }
        }
        break;
      }
    }
  }

  return sqlParts.join("\n\n");
}
