// frontend/src/utils/sql/sqlite.ts
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

type Action = "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";

function mapTypeToSQLite(t: string): string {
  const raw = (t || "").trim();
  const u = raw.replace(/\s+/g, "").toUpperCase();

  if (!raw) return "TEXT";
  if (u === "SERIAL") return "INTEGER";
  if (u.startsWith("UUID")) return "TEXT";
  if (u.startsWith("VARCHAR") || u.startsWith("CHAR")) return "TEXT";
  if (u === "TEXT") return "TEXT";
  if (u === "BOOLEAN" || u === "BOOL") return "INTEGER";
  if (u === "TIMESTAMP") return "DATETIME";
  if (u === "DATE") return "DATE";
  if (u === "JSON") return "TEXT";
  if (u.startsWith("INT") || u.startsWith("BIGINT") || u.startsWith("SMALLINT")) return "INTEGER";
  if (u.startsWith("DECIMAL") || u.startsWith("NUMERIC") || u.startsWith("REAL") || u.startsWith("FLOAT"))
    return "REAL";
  return raw;
}

type TableDef = {
  sqlName: string;
  cols: Map<string, { type: string; notNull?: boolean; pk?: boolean; autoInc?: boolean }>;
  compositePk?: string[];
  uniques: { cols: string[]; name?: string }[];
  fks: { col: string; refTable: string; refCol: string; onDelete?: Action; onUpdate?: Action; name?: string }[];
  indexes: { col: string; name?: string; unique?: boolean }[];
  isLink: boolean;
};

function q(name: string) {
  return qPg(name);
}

function uqKey(cols: string[]) {
  return cols.map((c) => sanitize(c).toLowerCase()).join("|");
}

function fkKey(col: string, refTable: string, refCol: string) {
  return `${sanitize(col).toLowerCase()}->${sanitize(refTable).toLowerCase()}(${sanitize(refCol).toLowerCase()})`;
}

function ixKey(col: string, unique?: boolean) {
  return `${sanitize(col).toLowerCase()}::${unique ? "u" : "n"}`;
}

export function generateSQLiteSQL(entities: Entity[], relationships: Relationship[]): string {
  const sqlParts: string[] = [];
  const entById = new Map(entities.map((e) => [e.id, e]));

  const usedTableNames = new Set(entities.map((e) => sanitize(e.name).toLowerCase()));
  const linkSqlNameByEntityId = new Map<string, string>();
  const linkSqlNameByPair = new Map<string, string>();
  const linkEntityIds = new Set<string>();
  const linkEntityByPair = new Map<string, Entity | null>();

  // involved ids (used for empty-but-related tables)
  const involved = new Set<string>();
  for (const r of relationships) {
    if (entById.has(r.from)) involved.add(r.from);
    if (entById.has(r.to)) involved.add(r.to);
  }

  // Prepare M:N mapping (same rules as Postgres/MySQL generators)
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

  const defs = new Map<string, TableDef>();
  const order: string[] = [];

  const ensureDef = (sqlName: string, isLink: boolean): TableDef => {
    const key = sanitize(sqlName);
    const existing = defs.get(key);
    if (existing) {
      existing.isLink = existing.isLink || isLink;
      return existing;
    }
    const def: TableDef = {
      sqlName: key,
      cols: new Map(),
      compositePk: undefined,
      uniques: [],
      fks: [],
      indexes: [],
      isLink,
    };
    defs.set(key, def);
    order.push(key);
    return def;
  };

  const ensureCol = (
    def: TableDef,
    col: string,
    type: string,
    opts: { notNull?: boolean; pk?: boolean; autoInc?: boolean } = {}
  ) => {
    const name = sanitize(col);
    const existing = def.cols.get(name);
    if (!existing) {
      def.cols.set(name, {
        type,
        notNull: opts.notNull,
        pk: opts.pk,
        autoInc: opts.autoInc,
      });
      return;
    }
    // Merge "stronger" constraints
    existing.type = existing.type || type;
    if (opts.notNull === true) existing.notNull = true;
    if (opts.pk === true) existing.pk = true;
    if (opts.autoInc === true) existing.autoInc = true;
  };

  const addUnique = (def: TableDef, cols: string[], nameBase: string) => {
    const normalized = cols.map((c) => sanitize(c));
    const key = uqKey(normalized);
    if (def.uniques.some((u) => uqKey(u.cols) === key)) return;
    def.uniques.push({
      cols: normalized,
      name: limitIdentifier(nameBase, 63),
    });
  };

  const addFk = (
    def: TableDef,
    col: string,
    refTable: string,
    refCol: string,
    meta: { onDelete?: Action; onUpdate?: Action },
    nameBase: string
  ) => {
    const c = sanitize(col);
    const rt = sanitize(refTable);
    const rc = sanitize(refCol);
    const key = fkKey(c, rt, rc);
    if (def.fks.some((f) => fkKey(f.col, f.refTable, f.refCol) === key)) return;
    def.fks.push({
      col: c,
      refTable: rt,
      refCol: rc,
      onDelete: meta.onDelete,
      onUpdate: meta.onUpdate,
      name: limitIdentifier(nameBase, 63),
    });
  };

  const addIndex = (def: TableDef, col: string, nameBase: string, unique = false) => {
    const c = sanitize(col);
    const k = ixKey(c, unique);
    if (def.indexes.some((i) => ixKey(i.col, i.unique) === k)) return;
    def.indexes.push({
      col: c,
      unique,
      name: limitIdentifier(nameBase, 63),
    });
  };

  // CREATE TABLE defs from entities (except deferred link entities)
  for (const e of entities) {
    const isExplicitLink = linkEntityIds.has(e.id);
    const baseName = sanitize(e.name);
    const sqlName = isExplicitLink ? linkSqlNameByEntityId.get(e.id) ?? baseName : baseName;

    if (e.attributes.length === 0 && !involved.has(e.id) && !isExplicitLink) continue;

    // deferred link-table (empty entity) => will be created in relationship processing
    if (isExplicitLink && e.attributes.length === 0) continue;

    const def = ensureDef(sqlName, isExplicitLink);
    for (const a of e.attributes) {
      const col = sanitize(a.name);
      const isPk = (a as any).isPrimaryKey === true;
      const mapped = mapTypeToSQLite(a.type);

      if (isPk) {
        // SQLite: AUTOINCREMENT only with INTEGER PRIMARY KEY AUTOINCREMENT
        const autoInc = mapped.toUpperCase() === "INTEGER" && snake(a.type || "") === "serial";
        ensureCol(def, col, mapped, { pk: true, autoInc });
      } else {
        ensureCol(def, col, mapped, {});
      }
    }

    const hasPK = e.attributes.some((a) => (a as any).isPrimaryKey);
    if (!isExplicitLink && !hasPK) {
      ensureCol(def, "id", "TEXT", { pk: true });
    }
    if (!hasPK && isExplicitLink) {
      // link PK decided later (composite) if needed
    }
    if (e.attributes.length === 0 && involved.has(e.id) && !isExplicitLink) {
      // empty but involved => ensure id PK exists
      if (!def.cols.has("id")) ensureCol(def, "id", "TEXT", { pk: true });
    }
  }

  // RELATIONSHIPS => enrich defs
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

    if (r.type === "one-to-one" || r.type === "one-to-many") {
      const fkMeta: FKMeta = {
        notNull: true,
        onDelete: "CASCADE",
        onUpdate: undefined,
        index: true,
        unique: r.type === "one-to-one" ? true : undefined,
        ...(r.fk ?? {}),
      };

      const toDef = ensureDef(toName, false);

      const computedName = fkColNameFor(fromSing, fromPKName);
      const suggestedExisting = findExistingFKColumn(to, fromName, fromSing, fromPKName);
      const requestedName =
        (fkMeta.column && fkMeta.column.trim()) || suggestedExisting || computedName;

      const fkCol = sanitize(requestedName);
      const fkType = mapTypeToSQLite(fkMeta.type ?? fromPK.type);

      if (!hasColumn(to, fkCol)) {
        ensureCol(toDef, fkCol, fkType, { notNull: fkMeta.notNull !== false });
      } else {
        ensureCol(toDef, fkCol, fkType, { notNull: fkMeta.notNull !== false });
      }

      const wantUnique =
        fkMeta.unique === undefined ? r.type === "one-to-one" : fkMeta.unique === true;

      if (wantUnique) {
        addUnique(toDef, [fkCol], `uq_${toName}_${fkCol}`);
      } else if (fkMeta.index !== false) {
        addIndex(toDef, fkCol, `idx_${toName}_${fkCol}`, false);
      }

      addFk(
        toDef,
        fkCol,
        fromName,
        fromPKName,
        { onDelete: fkMeta.onDelete, onUpdate: fkMeta.onUpdate },
        `fk_${toName}_${fromName}_${fkCol}`
      );
    }

    if (r.type === "many-to-many") {
      const linkMeta: LinkMeta = {
        compositePrimaryKey: true,
        onDelete: "CASCADE",
        onUpdate: undefined,
        index: true,
        ...(r.link ?? {}),
      };

      const key = `${from.id}__${to.id}`;
      const explicit = linkEntityByPair.get(key);

      const linkName = linkSqlNameByPair.get(key) ?? sanitize(linkMeta.tableName ?? suggestLinkTableName(fromName, toName));
      const linkDef = ensureDef(linkName, true);

      const leftCol = sanitize(linkMeta.leftColumn ?? fkColNameFor(fromSing, fromPKName));
      const rightCol = sanitize(linkMeta.rightColumn ?? fkColNameFor(toSing, toPKName));

      // Ensure link columns exist (even if explicit table had attributes under old name)
      ensureCol(linkDef, leftCol, mapTypeToSQLite(fromPK.type), { notNull: true });
      ensureCol(linkDef, rightCol, mapTypeToSQLite(toPK.type), { notNull: true });

      // Composite PK vs UNIQUE pair
      const explicitHasPK = explicit?.attributes?.some((a) => (a as any).isPrimaryKey) ?? false;
      if (linkMeta.compositePrimaryKey !== false && !explicitHasPK) {
        linkDef.compositePk = [leftCol, rightCol];
      } else if (linkMeta.compositePrimaryKey === false) {
        addUnique(linkDef, [leftCol, rightCol], `uq_${linkName}_${leftCol}_${rightCol}`);
      }

      // FKs
      addFk(
        linkDef,
        leftCol,
        fromName,
        fromPKName,
        { onDelete: linkMeta.onDelete, onUpdate: linkMeta.onUpdate },
        `fk_${linkName}_${fromName}_${leftCol}`
      );
      addFk(
        linkDef,
        rightCol,
        toName,
        toPKName,
        { onDelete: linkMeta.onDelete, onUpdate: linkMeta.onUpdate },
        `fk_${linkName}_${toName}_${rightCol}`
      );

      // Indexes
      if (linkMeta.index !== false) {
        addIndex(linkDef, leftCol, `idx_${linkName}_${leftCol}`, false);
        addIndex(linkDef, rightCol, `idx_${linkName}_${rightCol}`, false);
      }
    }
  }

  // Output
  sqlParts.push(`PRAGMA foreign_keys = ON;`);

  // Reorder: non-link first, link last (better readability)
  const nonLink = order.filter((t) => !defs.get(t)?.isLink);
  const link = order.filter((t) => defs.get(t)?.isLink);
  const outOrder = [...nonLink, ...link];

  for (const t of outOrder) {
    const def = defs.get(t);
    if (!def) continue;

    const colLines: string[] = [];
    const inlinePkCols: string[] = [];

    for (const [col, meta] of def.cols.entries()) {
      const C = q(col);
      const type = meta.type || "TEXT";

      if (meta.pk && !def.compositePk) {
        // Single-column PK
        if (meta.autoInc && type.toUpperCase() === "INTEGER") {
          colLines.push(`${C} INTEGER PRIMARY KEY AUTOINCREMENT`);
        } else {
          colLines.push(`${C} ${type} PRIMARY KEY${meta.notNull ? " NOT NULL" : ""}`);
        }
      } else {
        colLines.push(`${C} ${type}${meta.notNull ? " NOT NULL" : ""}`);
        if (meta.pk) inlinePkCols.push(col);
      }
    }

    const constraints: string[] = [];

    if (def.compositePk && def.compositePk.length >= 2) {
      constraints.push(`PRIMARY KEY (${def.compositePk.map((c) => q(c)).join(", ")})`);
    } else if (!def.compositePk && inlinePkCols.length >= 2) {
      constraints.push(`PRIMARY KEY (${inlinePkCols.map((c) => q(c)).join(", ")})`);
    }

    for (const u of def.uniques) {
      // SQLite allows named constraints but naming is optional
      const name = u.name ? `CONSTRAINT ${q(u.name)} ` : "";
      constraints.push(`${name}UNIQUE (${u.cols.map((c) => q(c)).join(", ")})`);
    }

    for (const f of def.fks) {
      const name = f.name ? `CONSTRAINT ${q(f.name)} ` : "";
      const actions =
        `${f.onDelete ? ` ON DELETE ${f.onDelete}` : ""}` +
        `${f.onUpdate ? ` ON UPDATE ${f.onUpdate}` : ""}`;
      constraints.push(
        `${name}FOREIGN KEY (${q(f.col)}) REFERENCES ${q(f.refTable)}(${q(f.refCol)})${actions}`
      );
    }

    const allLines = [...colLines, ...constraints].join(",\n  ");
    sqlParts.push(`CREATE TABLE ${q(def.sqlName)} (\n  ${allLines}\n);`);

    for (const ix of def.indexes) {
      const name = ix.name ? q(ix.name) : q(limitIdentifier(`idx_${def.sqlName}_${ix.col}`, 63));
      const unique = ix.unique ? "UNIQUE " : "";
      sqlParts.push(`CREATE ${unique}INDEX ${name} ON ${q(def.sqlName)}(${q(ix.col)});`);
    }
  }

  return sqlParts.join("\n\n");
}
