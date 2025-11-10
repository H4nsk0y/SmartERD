import type { Entity, Relationship, FKMeta, LinkMeta } from "../../store/useERStore";
import {
  sanitize, snake, toSingular, fkColNameFor,
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

  /* ==== Подготовка: пары many-to-many и явные линк-таблицы по названию ==== */
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

  // Какие явные link-таблицы отложили (у них не было колонок)
  const deferredLinkTables = new Set<string>(); // имена в sanitize-форме

  // Множество сущностей, участвующих в каких-либо связях (от/к)
  const involved = new Set<string>();
  for (const r of relationships) {
    if (entById.has(r.from)) involved.add(r.from);
    if (entById.has(r.to))   involved.add(r.to);
  }

  /* ==== 1) CREATE TABLES (обычные сущности + «полные» link, если есть колонки) ==== */
  for (const e of entities) {
    const isExplicitLink = linkEntityIds.has(e.id);
    const tableName = sanitize(e.name);

    // Если сущность пустая и НИГДЕ не участвует — пропускаем (не рендерим «висящие» пустышки)
    if (e.attributes.length === 0 && !involved.has(e.id) && !isExplicitLink) {
      continue;
    }

    // Если явная link-сущность и вообще НЕТ атрибутов — отложим создание на блок отношений
    if (isExplicitLink && e.attributes.length === 0) {
      deferredLinkTables.add(tableName);
      continue;
    }

    const cols: string[] = [];
    for (const a of e.attributes) {
      const colName = sanitize(a.name);
      const isPk = (a as any).isPrimaryKey;
      // Не дублируем NOT NULL при PRIMARY KEY
      let line = `${colName} ${a.type}${isPk ? " PRIMARY KEY" : ""}`;
      cols.push(line);
    }

    const hasPK = e.attributes.some((a) => (a as any).isPrimaryKey);
    // Для НЕ link-таблиц, у которых нет PK — добавим surrogate PK
    if (!isExplicitLink && !hasPK) {
      // SERIAL — осознанно; можно заменить на IDENTITY в будущем
      cols.unshift(`id SERIAL PRIMARY KEY`);
    }

    // Для явных link-таблиц с уже заданными колонками — создаём, доводим позже
    sqlParts.push(`CREATE TABLE ${tableName} (\n  ${cols.join(",\n  ")}\n);`);
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
        const fkMeta: FKMeta = {
          notNull: true,
          onDelete: "CASCADE",
          onUpdate: undefined, // обычно опускаем
          index: true,
          unique: r.type === "one-to-one" ? true : undefined,
          ...(r.fk ?? {}),
        };

        const computedName = fkColNameFor(fromSingular, fromPKName);
        const suggestedExisting = findExistingFKColumn(to, fromName, fromSingular, fromPKName);
        const requestedName = fkMeta.column ?? suggestedExisting ?? computedName;
        const fkCol = sanitize(requestedName);
        const fkType = fkMeta.type ?? fromPK.type;

        const existsExact = hasColumn(to, fkCol);

        if (existsExact) {
          if (fkMeta.notNull !== false) {
            sqlParts.push(`ALTER TABLE ${toName}\n  ALTER COLUMN ${fkCol} SET NOT NULL;`);
          }
        } else {
          sqlParts.push(
            `ALTER TABLE ${toName}\n  ADD COLUMN ${fkCol} ${fkType}${fkMeta.notNull === false ? "" : " NOT NULL"};`
          );
        }

        const actions = [
          fkMeta.onDelete ? ` ON DELETE ${fkMeta.onDelete}` : "",
          fkMeta.onUpdate ? ` ON UPDATE ${fkMeta.onUpdate}` : "",
        ].join("");
        sqlParts.push(
          `ALTER TABLE ${toName}\n  ADD CONSTRAINT fk_${toName}_${fromName} FOREIGN KEY (${fkCol}) REFERENCES ${fromName}(${fromPKName})${actions};`
        );

        // Индекс/UNIQUE: если 1:1 ⇒ достаточно UNIQUE (не плодим индекс)
        const wantUnique = fkMeta.unique === undefined ? (r.type === "one-to-one") : fkMeta.unique === true;

        if (fkMeta.index !== false && !wantUnique) {
          sqlParts.push(`CREATE INDEX ON ${toName}(${fkCol});`);
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

        const leftCol = sanitize(linkMeta.leftColumn ?? fkColNameFor(fromSingular, fromPKName));
        const rightCol = sanitize(linkMeta.rightColumn ?? fkColNameFor(toSingularName, toPKName));

        const autoName = `${snake(fromName)}_${snake(toName)}_link`;
        const rawLinkName = linkMeta.tableName ?? (explicitEntity ? explicitEntity.name : autoName);
        const linkName = sanitize(rawLinkName);

        const actions = [
          linkMeta.onDelete ? ` ON DELETE ${linkMeta.onDelete}` : "",
          linkMeta.onUpdate ? ` ON UPDATE ${linkMeta.onUpdate}` : "",
        ].join("");

        const wasDeferred = deferredLinkTables.has(linkName);
        const explicitHasPK = explicitEntity?.attributes?.some((a) => (a as any).isPrimaryKey) ?? false;

        if (explicitEntity) {
          if (wasDeferred) {
            // Отложенную таблицу создаём полностью
            sqlParts.push(
              `CREATE TABLE ${linkName} (\n` +
                `  ${leftCol} ${fromPK.type} NOT NULL,\n` +
                `  ${rightCol} ${toPK.type} NOT NULL,\n` +
                (linkMeta.compositePrimaryKey === false || explicitHasPK
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
          } else {
            // Была создана в 1-м проходе — доводим через ALTER
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
              sqlParts.push(`CREATE INDEX ON ${linkName}(${leftCol});`);
              sqlParts.push(`CREATE INDEX ON ${linkName}(${rightCol});`);
            }
          }
        } else {
          // Неявная link-таблица — создаём полностью
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
