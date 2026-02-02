// frontend/src/utils/normalization.ts
import type { Entity, Relationship } from "../store/useERStore";
import type { ValidationIssue } from "./validateModel";
import {
  sanitize as sanitizeCommon,
  toSingular,
  findExistingLinkEntity,
  getPrimaryKey,
} from "./sql/common";

const NF_WORDS = {
  repeat: "Похоже на повторяющуюся группу (нарушение 1НФ).",
  json: "Похоже на неатомарное/вложенное значение (часто нарушает 1НФ).",
  multivalue: "Похоже на список значений в одном столбце (риск нарушения 1НФ).",
  partial: "Похоже на частичную зависимость от части составного ключа (2НФ).",
  transitive: "Похоже на транзитивную зависимость (3НФ).",
};

const GENERIC_TRANSITIVE_SUFFIXES = new Set([
  "name",
  "title",
  "email",
  "phone",
  "phone_number",
  "mobile",
  "address",
  "city",
  "country",
  "zip",
  "postal_code",
  "firstname",
  "first_name",
  "lastname",
  "last_name",
  "code",
]);

const MULTIVALUE_NAMES = new Set(["tags", "phones", "emails", "items", "values", "roles"]);

function sanitizeIdentifierStrict(name: string, fallback = "x"): string {
  let s = String(name ?? "")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!s) s = fallback;

  if (/^\d/.test(s)) s = `x_${s}`;
  if (!/^[A-Za-z]/.test(s)) s = `x_${s.replace(/^[^A-Za-z]+/, "") || fallback}`;

  return s;
}

function snakeStrict(name: string, fallback = "x") {
  const base = sanitizeIdentifierStrict(name, fallback);
  const s = base
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s\-]+/g, "_")
    .replace(/__+/g, "_");
  return s.toLowerCase();
}

function sanitizeMsg(name: string) {
  return sanitizeCommon(name);
}

function normName(n: string) {
  return snakeStrict(n);
}

function rootOfEntityName(name: string) {
  return snakeStrict(toSingular(sanitizeMsg(name)));
}

function snakeAttr(name: string) {
  return snakeStrict(name);
}

function baseNoIndex(n: string) {
  const s = normName(n);
  const m = s.match(/^(.*?)(?:_)?(\d+)$/);
  return m ? m[1] : s;
}

function splitFkRoot(col: string): string | null {
  const m = sanitizeMsg(col).match(/^(.+)_id$/i);
  return m ? m[1] : null;
}

function findEntityByRootName(entities: Entity[], rootSnake: string): Entity | null {
  const wanted = (rootSnake || "").toLowerCase();
  if (!wanted) return null;
  return entities.find((en) => rootOfEntityName(en.name) === wanted) || null;
}

function isLikelyJsonType(t: string) {
  const u = (t || "").replace(/\s+/g, "").toUpperCase();
  return (
    u.includes("JSON") ||
    u.includes("JSONB") ||
    u.includes("ARRAY") ||
    u.endsWith("[]") ||
    u.startsWith("ARRAY<") ||
    u.startsWith("SET<")
  );
}

function isProbablyDerivedName(n: string) {
  const s = normName(n);
  return (
    s.endsWith("_count") ||
    s.endsWith("_total") ||
    s.endsWith("_sum") ||
    s.endsWith("_avg") ||
    s.endsWith("_hash") ||
    s.endsWith("_calc") ||
    s.startsWith("is_") ||
    s.startsWith("has_")
  );
}

function fkCol(rootSingular: string, pkName: string) {
  const base = snakeStrict(pkName, "id");
  const root = snakeStrict(rootSingular, "x") + "_";
  return base.startsWith(root) ? base : `${snakeStrict(rootSingular, "x")}_${base}`;
}

export type NormalizationActionKind =
  | "EXTRACT_REPEATING_GROUP"
  | "EXTRACT_MULTIVALUE_FIELD"
  | "MOVE_ATTR_TO_ENTITY"
  | "FIX_TRANSITIVE_DEP"
  | "ADD_MISSING_FK_REL"
  | "CREATE_MM_REL_FROM_LINK_TABLE";

export type NormalizationAction = {
  kind: NormalizationActionKind;
  label: string;
  payload: any;
};

export type NormalizationIssue = ValidationIssue & {
  actions?: NormalizationAction[];
};

function cloneDeep<T>(v: T): T {
  // @ts-ignore
  if (typeof structuredClone === "function") return structuredClone(v);
  return JSON.parse(JSON.stringify(v));
}

function newId(): string {
  const c: any = typeof crypto !== "undefined" ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function uniqueEntityName(base: string, entities: Entity[]) {
  const used = new Set(entities.map((e) => (e.name || "").toLowerCase()));
  const b = sanitizeIdentifierStrict(base || "Entity", "Entity");

  let name = b;
  let i = 2;
  while (used.has(name.toLowerCase())) {
    name = sanitizeIdentifierStrict(`${b}_${i}`, `${b}_${i}`);
    i += 1;
  }
  return name;
}

function findAttrIndex(entity: Entity, col: string) {
  const want = sanitizeMsg(col).toLowerCase();
  return entity.attributes.findIndex((a) => sanitizeMsg(a.name).toLowerCase() === want);
}

function hasAttr(entity: Entity, col: string) {
  return findAttrIndex(entity, col) >= 0;
}

function normalizeAttrNameForTarget(col: string, target: Entity): string {
  const targetRoot = rootOfEntityName(target.name);
  if (!targetRoot) return sanitizeMsg(col);

  const sc = snakeAttr(col);
  if (!sc.startsWith(`${targetRoot}_`)) return sanitizeMsg(col);

  const suffix = sc.slice(targetRoot.length + 1);
  if (!suffix) return sanitizeMsg(col);

  if (!GENERIC_TRANSITIVE_SUFFIXES.has(suffix)) return sanitizeMsg(col);

  return suffix;
}

function ensureAttr(entity: Entity, name: string, type: string, isPrimaryKey?: boolean) {
  const idx = findAttrIndex(entity, name);
  if (idx >= 0) return;

  const safeName = sanitizeIdentifierStrict(name, "col");
  const safeType = (type ?? "").trim();

  if (isPrimaryKey) {
    const alreadyHasPk = entity.attributes.some((a) => (a as any).isPrimaryKey);
    if (!alreadyHasPk) {
      entity.attributes = entity.attributes.map((a) => ({ ...a, isPrimaryKey: false }));
    }
  }

  entity.attributes.push({
    id: newId(),
    name: safeName,
    type: safeType || "",
    isPrimaryKey: !!isPrimaryKey,
  });
}

function removeAttrs(entity: Entity, cols: string[]) {
  const drop = new Set(cols.map((c) => sanitizeMsg(c).toLowerCase()));
  entity.attributes = entity.attributes.filter((a) => !drop.has(sanitizeMsg(a.name).toLowerCase()));
}

function hasRelationship(
  relationships: Relationship[],
  from: string,
  to: string,
  type: Relationship["type"],
  fkColumn?: string
) {
  const fkWant = fkColumn ? sanitizeMsg(fkColumn).toLowerCase() : null;

  return relationships.some((r) => {
    if (r.from !== from || r.to !== to || r.type !== type) return false;
    if (type !== "one-to-many") return true;
    if (!fkWant) return true;
    const col = sanitizeMsg(r.fk?.column || "").toLowerCase();
    return col === fkWant;
  });
}

function ensureOneToManyRel(relationships: Relationship[], fromId: string, toId: string, fkColumn: string) {
  if (fromId === toId) return;

  const fkSafe = sanitizeIdentifierStrict(fkColumn, "fk_id");
  if (hasRelationship(relationships, fromId, toId, "one-to-many", fkSafe)) return;

  relationships.push({
    id: newId(),
    from: fromId,
    to: toId,
    type: "one-to-many",
    fk: {
      column: fkSafe,
      notNull: true,
      onDelete: "CASCADE",
      index: true,
    },
  });
}

function removeOneToManyRel(relationships: Relationship[], fromId: string, toId: string, fkColumn?: string) {
  const fkWant = fkColumn ? sanitizeMsg(fkColumn).toLowerCase() : null;
  return relationships.filter((r) => {
    if (r.type !== "one-to-many") return true;
    if (r.from !== fromId || r.to !== toId) return true;
    if (!fkWant) return false;
    const col = sanitizeMsg(r.fk?.column || "").toLowerCase();
    return col !== fkWant;
  });
}

function isAutoValueTable(e: Entity, relationships: Relationship[]): boolean {
  const colsLower = e.attributes.map((a) => sanitizeIdentifierStrict(a.name, "x").toLowerCase());
  const set = new Set(colsLower);

  if (!set.has("value")) return false;

  const fkCols = colsLower.filter((c) => c.endsWith("_id") && c !== "id");
  if (fkCols.length !== 1) return false;

  const fk = fkCols[0];

  const hasIncoming = relationships.some(
    (r) =>
      r.type === "one-to-many" &&
      r.to === e.id &&
      sanitizeMsg(r.fk?.column || "").toLowerCase() === fk
  );

  return hasIncoming;
}

function findExistingAutoExtractedEntity(opts: {
  entities: Entity[];
  relationships: Relationship[];
  src: Entity;
  childBaseName: string;
  fkName: string;
  mode: "value" | "repeating";
  baseAttrName?: string;
}): Entity | null {
  const { entities, relationships, src, childBaseName, fkName, mode, baseAttrName } = opts;

  const baseLower = sanitizeIdentifierStrict(childBaseName, "x").toLowerCase();

  const candidates = entities.filter((e) => {
    if (e.id === src.id) return false;
    const en = sanitizeIdentifierStrict(e.name, "x").toLowerCase();
    if (en !== baseLower && !en.startsWith(baseLower + "_")) return false;

    const hasFk = e.attributes.some(
      (a) => sanitizeIdentifierStrict(a.name, "x").toLowerCase() === fkName.toLowerCase()
    );
    if (!hasFk) return false;

    if (mode === "value") {
      return e.attributes.some((a) => sanitizeIdentifierStrict(a.name, "x").toLowerCase() === "value");
    }

    const hasIdx = e.attributes.some(
      (a) => sanitizeIdentifierStrict(a.name, "x").toLowerCase() === "idx"
    );

    const baseOk = (baseAttrName || "value")
      ? e.attributes.some(
          (a) =>
            sanitizeIdentifierStrict(a.name, "x").toLowerCase() ===
            sanitizeIdentifierStrict(baseAttrName || "value", "value").toLowerCase()
        )
      : true;

    return hasIdx && baseOk;
  });

  if (candidates.length === 0) return null;

  for (const cand of candidates) {
    const hasRel = relationships.some(
      (r) =>
        r.type === "one-to-many" &&
        r.from === src.id &&
        r.to === cand.id &&
        sanitizeMsg(r.fk?.column || "").toLowerCase() === fkName.toLowerCase()
    );
    if (hasRel) return cand;
  }

  return candidates[0];
}

export function applyNormalizationAction(
  action: NormalizationAction,
  entities: Entity[],
  relationships: Relationship[]
): { entities: Entity[]; relationships: Relationship[] } {
  const es = cloneDeep(entities);
  let rs = cloneDeep(relationships);

  const entById = new Map(es.map((e) => [e.id, e] as const));

  switch (action.kind) {
    case "EXTRACT_REPEATING_GROUP": {
      const { entityId, base, columns, dropOriginal } = action.payload as {
        entityId: string;
        base: string;
        columns: string[];
        dropOriginal?: boolean;
      };

      const src = entById.get(entityId);
      if (!src) return { entities: es, relationships: rs };

      const stillExists = columns.some((c) =>
        src.attributes.some((a) => sanitizeMsg(a.name).toLowerCase() === sanitizeMsg(c).toLowerCase())
      );
      if (!stillExists) return { entities: es, relationships: rs };

      const srcPk = getPrimaryKey(src);
      const srcRoot = rootOfEntityName(src.name);
      const fkName = fkCol(srcRoot, srcPk.name);

      const groupTypes = columns
        .map(
          (c) =>
            src.attributes.find(
              (a) => sanitizeMsg(a.name).toLowerCase() === sanitizeMsg(c).toLowerCase()
            )?.type
        )
        .filter((t) => !!t) as string[];
      const valueType = groupTypes[0] ?? "TEXT";

      const baseAttr = snakeAttr(base || "value");
      const childBaseName = `${sanitizeIdentifierStrict(src.name || "Entity")}_${sanitizeIdentifierStrict(
        base || "group"
      )}`;

      const existing = findExistingAutoExtractedEntity({
        entities: es,
        relationships: rs,
        src,
        childBaseName,
        fkName,
        mode: "repeating",
        baseAttrName: baseAttr,
      });

      if (existing) {
        ensureOneToManyRel(rs, src.id, existing.id, fkName);
        if (dropOriginal) removeAttrs(src, columns);
        return { entities: es, relationships: rs };
      }

      const childName = uniqueEntityName(childBaseName, es);

      const child: Entity = {
        id: newId(),
        name: childName,
        x: (src.x ?? 0) + 320,
        y: (src.y ?? 0),
        attributes: [],
      };

      ensureAttr(child, "id", srcPk.type || "UUID", true);
      ensureAttr(child, fkName, srcPk.type || "UUID");
      ensureAttr(child, baseAttr, valueType);
      ensureAttr(child, "idx", "INT");

      es.push(child);
      ensureOneToManyRel(rs, src.id, child.id, fkName);

      if (dropOriginal) removeAttrs(src, columns);

      return { entities: es, relationships: rs };
    }

    case "EXTRACT_MULTIVALUE_FIELD": {
      const { entityId, column, dropOriginal } = action.payload as {
        entityId: string;
        column: string;
        dropOriginal?: boolean;
      };

      const src = entById.get(entityId);
      if (!src) return { entities: es, relationships: rs };

      if (isAutoValueTable(src, rs)) {
        return { entities: es, relationships: rs };
      }

      const srcAttr = src.attributes.find(
        (a) => sanitizeMsg(a.name).toLowerCase() === sanitizeMsg(column).toLowerCase()
      );
      if (!srcAttr) return { entities: es, relationships: rs };

      const srcPk = getPrimaryKey(src);
      const srcRoot = rootOfEntityName(src.name);
      const fkName = fkCol(srcRoot, srcPk.name);

      const base = baseNoIndex(column) || snakeAttr(column) || "value";
      const childBaseName = `${sanitizeIdentifierStrict(src.name || "Entity")}_${sanitizeIdentifierStrict(
        base || "values"
      )}`;

      const existing = findExistingAutoExtractedEntity({
        entities: es,
        relationships: rs,
        src,
        childBaseName,
        fkName,
        mode: "value",
      });

      if (existing) {
        ensureOneToManyRel(rs, src.id, existing.id, fkName);
        if (dropOriginal) removeAttrs(src, [column]);
        return { entities: es, relationships: rs };
      }

      const childName = uniqueEntityName(childBaseName, es);

      const child: Entity = {
        id: newId(),
        name: childName,
        x: (src.x ?? 0) + 320,
        y: (src.y ?? 0) + 140,
        attributes: [],
      };

      const valueType = srcAttr.type || "TEXT";

      ensureAttr(child, "id", srcPk.type || "UUID", true);
      ensureAttr(child, fkName, srcPk.type || "UUID");
      ensureAttr(child, "value", valueType);

      es.push(child);
      ensureOneToManyRel(rs, src.id, child.id, fkName);

      if (dropOriginal) removeAttrs(src, [column]);

      return { entities: es, relationships: rs };
    }

    case "MOVE_ATTR_TO_ENTITY": {
      const { fromEntityId, toEntityId, column, dropFromSource } = action.payload as {
        fromEntityId: string;
        toEntityId: string;
        column: string;
        dropFromSource?: boolean;
      };

      const from = entById.get(fromEntityId);
      const to = entById.get(toEntityId);
      if (!from || !to) return { entities: es, relationships: rs };

      const a = from.attributes.find(
        (x) => sanitizeMsg(x.name).toLowerCase() === sanitizeMsg(column).toLowerCase()
      );
      if (!a) return { entities: es, relationships: rs };

      const targetNameRaw = normalizeAttrNameForTarget(sanitizeMsg(a.name), to);
      const targetName = sanitizeIdentifierStrict(targetNameRaw, "col");

      if (!hasAttr(to, targetName)) {
        ensureAttr(to, targetName, a.type || "TEXT", false);
      }

      if (dropFromSource !== false) {
        removeAttrs(from, [sanitizeMsg(a.name)]);
      }

      return { entities: es, relationships: rs };
    }

    case "FIX_TRANSITIVE_DEP": {
      const { holderEntityId, fkRoot, fkColumn, moveColumn } = action.payload as {
        holderEntityId: string;
        fkRoot: string;
        fkColumn: string;
        moveColumn: string;
      };

      const holder = entById.get(holderEntityId);
      if (!holder) return { entities: es, relationships: rs };

      let ref = findEntityByRootName(es, fkRoot);
      if (!ref) {
        const cleanRoot = sanitizeIdentifierStrict(fkRoot || "ref", "ref");
        const baseName = cleanRoot ? cleanRoot[0].toUpperCase() + cleanRoot.slice(1) : "Ref";
        const refName = uniqueEntityName(baseName, es);

        ref = {
          id: newId(),
          name: refName,
          x: (holder.x ?? 0) - 340,
          y: (holder.y ?? 0),
          attributes: [],
        };

        const fkAttr = holder.attributes.find(
          (a) => sanitizeMsg(a.name).toLowerCase() === sanitizeMsg(fkColumn).toLowerCase()
        );
        const pkType = fkAttr?.type || "UUID";

        ensureAttr(ref, "id", pkType, true);

        es.push(ref);
        entById.set(ref.id, ref);
      }

      const srcAttr = holder.attributes.find(
        (a) => sanitizeMsg(a.name).toLowerCase() === sanitizeMsg(moveColumn).toLowerCase()
      );

      if (srcAttr) {
        const isSelf = ref.id === holder.id;

        if (!isSelf) {
          const root = snakeAttr(fkRoot);
          const scMove = snakeAttr(moveColumn);

          const suffix = scMove.startsWith(`${root}_`)
            ? scMove.slice(root.length + 1)
            : sanitizeMsg(moveColumn);

          const targetName =
            suffix && GENERIC_TRANSITIVE_SUFFIXES.has(suffix) ? suffix : sanitizeMsg(srcAttr.name);

          ensureAttr(ref, targetName, srcAttr.type || "TEXT", false);
        }

        removeAttrs(holder, [srcAttr.name]);
      }

      if (ref.id !== holder.id) {
        ensureOneToManyRel(rs, ref.id, holder.id, fkColumn);
      }

      const fkIdx = findAttrIndex(holder, fkColumn);
      if (fkIdx < 0) {
        const refPk = getPrimaryKey(ref);
        ensureAttr(holder, fkColumn, refPk.type || "UUID");
      }

      return { entities: es, relationships: rs };
    }

    case "ADD_MISSING_FK_REL": {
      const { holderEntityId, fkRoot } = action.payload as {
        holderEntityId: string;
        fkRoot: string;
      };

      const holder = entById.get(holderEntityId);
      if (!holder) return { entities: es, relationships: rs };

      const holderRoot = rootOfEntityName(holder.name);
      if (snakeAttr(fkRoot) && snakeAttr(fkRoot) === holderRoot) {
        return { entities: es, relationships: rs };
      }

      const rootSnake = snakeAttr(fkRoot);
      const probableFkCol = `${rootSnake}_id`;

      const existingFkAttr = holder.attributes.find(
        (a) => sanitizeMsg(a.name).toLowerCase() === probableFkCol.toLowerCase()
      );
      const inferredPkType = (existingFkAttr?.type || "").trim() || "UUID";

      let ref = findEntityByRootName(es, fkRoot);
      if (!ref) {
        const cleanRoot = sanitizeIdentifierStrict(fkRoot || "ref", "ref");
        const baseName = cleanRoot ? cleanRoot[0].toUpperCase() + cleanRoot.slice(1) : "Ref";
        const refName = uniqueEntityName(baseName, es);

        ref = {
          id: newId(),
          name: refName,
          x: (holder.x ?? 0) - 340,
          y: (holder.y ?? 0),
          attributes: [],
        };

        ensureAttr(ref, "id", inferredPkType, true);
        es.push(ref);
        entById.set(ref.id, ref);
      }

      const refPk = getPrimaryKey(ref);
      const fkColumn = `${rootSnake}_${snakeAttr(refPk.name)}`;
      ensureAttr(holder, fkColumn, refPk.type || inferredPkType || "UUID");

      if (ref.id !== holder.id) {
        ensureOneToManyRel(rs, ref.id, holder.id, fkColumn);
      }

      return { entities: es, relationships: rs };
    }

    case "CREATE_MM_REL_FROM_LINK_TABLE": {
      const { linkEntityId, leftEntityId, rightEntityId, leftFk, rightFk } = action.payload as {
        linkEntityId: string;
        leftEntityId: string;
        rightEntityId: string;
        leftFk: string;
        rightFk: string;
      };

      const link = entById.get(linkEntityId);
      const left = entById.get(leftEntityId);
      const right = entById.get(rightEntityId);
      if (!link || !left || !right) return { entities: es, relationships: rs };

      if (left.id === right.id) return { entities: es, relationships: rs };

      const exists = rs.some(
        (r) =>
          r.type === "many-to-many" &&
          ((r.from === left.id && r.to === right.id) || (r.from === right.id && r.to === left.id))
      );
      if (exists) return { entities: es, relationships: rs };

      rs.push({
        id: newId(),
        from: left.id,
        to: right.id,
        type: "many-to-many",
        link: {
          tableName: sanitizeIdentifierStrict(link.name || "link_table", "link_table"),
          leftColumn: sanitizeIdentifierStrict(leftFk || "left_id", "left_id"),
          rightColumn: sanitizeIdentifierStrict(rightFk || "right_id", "right_id"),
          compositePrimaryKey: true,
          onDelete: "CASCADE",
          index: true,
        },
      });

      rs = removeOneToManyRel(rs, left.id, link.id, leftFk);
      rs = removeOneToManyRel(rs, right.id, link.id, rightFk);

      return { entities: es, relationships: rs };
    }

    default:
      return { entities: es, relationships: rs };
  }
}

export function analyzeNormalization(entities: Entity[], relationships: Relationship[]): ValidationIssue[] {
  const issues: NormalizationIssue[] = [];

  const seen = new Set<string>();
  const push = (i: NormalizationIssue) => {
    const whereKey = (i.where ?? []).join(",");
    const actionKey = (i.actions ?? []).map((a) => a.kind + ":" + (a.payload?.column ?? "")).join(",");
    const k = `${i.code}|${i.level}|${whereKey}|${i.message}|${actionKey}`;
    if (seen.has(k)) return;
    seen.add(k);
    issues.push(i);
  };

  const entById = new Map(entities.map((e) => [e.id, e] as const));

  const entByRoot = new Map<string, Entity>();
  for (const e of entities) {
    const r = rootOfEntityName(e.name);
    if (r && !entByRoot.has(r)) entByRoot.set(r, e);
  }


  type LinkInfo = {
    link: Entity;
    left: Entity;
    right: Entity;
    rel: Relationship;
    leftRoot: string;
    rightRoot: string;
  };

  const mmLinks: LinkInfo[] = [];
  for (const r of relationships) {
    if (r.type !== "many-to-many") continue;
    const left = entById.get(r.from);
    const right = entById.get(r.to);
    if (!left || !right) continue;

    const link = findExistingLinkEntity(left, right, entities);
    if (!link) continue;

    mmLinks.push({
      link,
      left,
      right,
      rel: r,
      leftRoot: rootOfEntityName(left.name),
      rightRoot: rootOfEntityName(right.name),
    });
  }

  const mmLinkById = new Map<string, LinkInfo>();
  for (const li of mmLinks) mmLinkById.set(li.link.id, li);

  const suppress3nfForCol = new Set<string>();


  for (const e of entities) {
    if (!e.attributes || e.attributes.length === 0) continue;

    const autoValue = isAutoValueTable(e, relationships);

 
    if (!autoValue) {
      const groups = new Map<string, string[]>();

      for (const a of e.attributes) {
        const col = sanitizeMsg(a.name);
        if (!col) continue;

        const s = normName(col);
        const m = s.match(/^(.*?)(?:_)?(\d+)$/);
        if (!m) continue;

        const base = sanitizeMsg(m[1] ?? "");
        const n = parseInt(m[2] ?? "0", 10);
        if (!base || !Number.isFinite(n)) continue;

        if (n <= 0 || n > 50) continue;
        if (base.toLowerCase().endsWith("_id")) continue;

        const list = groups.get(base) ?? [];
        list.push(col);
        groups.set(base, list);
      }

      for (const [base, list] of groups) {
        if (list.length < 2) continue;

    
        const pk = getPrimaryKey(e);
        const fkName = fkCol(rootOfEntityName(e.name), pk.name);

        const baseAttr = snakeAttr(base || "value");
        const childBaseName = `${sanitizeIdentifierStrict(e.name || "Entity")}_${sanitizeIdentifierStrict(
          base || "group"
        )}`;

        const existing = findExistingAutoExtractedEntity({
          entities,
          relationships,
          src: e,
          childBaseName,
          fkName,
          mode: "repeating",
          baseAttrName: baseAttr,
        });

        if (existing) {
          push({
            level: "info",
            code: "NF1_REPEATING_GROUP_ALREADY_EXTRACTED",
            message: `«${e.name}»: поля ${list.join(", ")}. ${NF_WORDS.repeat}`,
            where: [e.id],
            suggestion:
              `Таблица «${existing.name}» уже создана. Удалите исходные поля, чтобы избежать дубля данных, либо оставьте их как денормализацию.`,
            actions: [
              {
                kind: "EXTRACT_REPEATING_GROUP",
                label: "Удалить исходные поля (таблица уже создана)",
                payload: { entityId: e.id, base, columns: list, dropOriginal: true },
              },
            ],
          });
          continue;
        }

        push({
          level: "warning",
          code: "NF1_REPEATING_GROUP",
          message: `«${e.name}»: поля ${list.join(", ")}. ${NF_WORDS.repeat}`,
          where: [e.id],
          suggestion:
            "Вынесите повторяющиеся значения в отдельную таблицу (1:N) или сделайте отдельную сущность.",
          actions: [
            {
              kind: "EXTRACT_REPEATING_GROUP",
              label: "Вынести в таблицу",
              payload: { entityId: e.id, base, columns: list, dropOriginal: false },
            },
            {
              kind: "EXTRACT_REPEATING_GROUP",
              label: "Вынести и удалить поля",
              payload: { entityId: e.id, base, columns: list, dropOriginal: true },
            },
          ],
        });
      }
    }

   
    for (const a of e.attributes) {
      if (!a.type) continue;
      if (!isLikelyJsonType(a.type)) continue;

      const colName = sanitizeMsg(a.name);

      if (autoValue && snakeAttr(a.name) === "value") {
        push({
          level: "info",
          code: "NF1_JSON_IN_VALUE_TABLE",
          message: `«${e.name}.value»: тип «${a.type}». ${NF_WORDS.json}`,
          where: [e.id],
          suggestion:
            "Это таблица значений (1:N), но JSON остаётся вложенным типом. Если хотите строгую 1НФ — разверните JSON в колонки/таблицы. Если JSON используется осознанно — можно оставить.",
        });
        continue;
      }

      const pk = getPrimaryKey(e);
      const fkName = fkCol(rootOfEntityName(e.name), pk.name);

      const base = baseNoIndex(colName) || snakeAttr(colName) || "value";
      const childBaseName = `${sanitizeIdentifierStrict(e.name || "Entity")}_${sanitizeIdentifierStrict(
        base || "values"
      )}`;

      const existing = findExistingAutoExtractedEntity({
        entities,
        relationships,
        src: e,
        childBaseName,
        fkName,
        mode: "value",
      });

      if (existing) {
        push({
          level: "info",
          code: "NF1_NON_ATOMIC_ALREADY_EXTRACTED",
          message: `«${e.name}.${colName}»: тип «${a.type}». ${NF_WORDS.json}`,
          where: [e.id],
          suggestion:
            `Таблица значений «${existing.name}» уже создана. Удалите исходное поле, чтобы избежать дубля данных, либо оставьте его как денормализацию.`,
          actions: [
            {
              kind: "EXTRACT_MULTIVALUE_FIELD",
              label: "Удалить исходное поле (таблица уже создана)",
              payload: { entityId: e.id, column: colName, dropOriginal: true },
            },
          ],
        });
        continue;
      }

      push({
        level: "warning",
        code: "NF1_NON_ATOMIC",
        message: `«${e.name}.${colName}»: тип «${a.type}». ${NF_WORDS.json}`,
        where: [e.id],
        suggestion:
          "JSON сам по себе не становится атомарным от выноса. Вынос создаёт таблицу-«каркас» (значения строками), но тип может остаться JSON.",
        actions: [
          {
            kind: "EXTRACT_MULTIVALUE_FIELD",
            label: "Вынести в таблицу",
            payload: { entityId: e.id, column: colName, dropOriginal: false },
          },
          {
            kind: "EXTRACT_MULTIVALUE_FIELD",
            label: "Вынести и удалить поле",
            payload: { entityId: e.id, column: colName, dropOriginal: true },
          },
        ],
      });
    }

 
    if (!autoValue) {
      const pk = getPrimaryKey(e);
      const fkName = fkCol(rootOfEntityName(e.name), pk.name);

      for (const a of e.attributes) {
        if (isLikelyJsonType(a.type || "")) continue;

        const col = snakeAttr(a.name);
        if (!col) continue;
        const parts = col.split("_");
        const last = parts.length ? parts[parts.length - 1] : col;

        const isMulti = MULTIVALUE_NAMES.has(last) || col.endsWith("_list") || col.endsWith("_csv");
        if (!isMulti) continue;

        const colName = sanitizeMsg(a.name);
        const base = baseNoIndex(colName) || snakeAttr(colName) || "value";

        const childBaseName = `${sanitizeIdentifierStrict(e.name || "Entity")}_${sanitizeIdentifierStrict(
          base || "values"
        )}`;

        const existing = findExistingAutoExtractedEntity({
          entities,
          relationships,
          src: e,
          childBaseName,
          fkName,
          mode: "value",
        });

        if (existing) {
          push({
            level: "info",
            code: "NF1_MULTIVALUE_ALREADY_EXTRACTED",
            message: `«${e.name}»: поле «${colName}». ${NF_WORDS.multivalue}`,
            where: [e.id],
            suggestion:
              `Таблица значений «${existing.name}» уже создана. Удалите исходное поле, чтобы избежать дубля данных, либо оставьте его как денормализацию.`,
            actions: [
              {
                kind: "EXTRACT_MULTIVALUE_FIELD",
                label: "Удалить исходное поле (таблица уже создана)",
                payload: { entityId: e.id, column: colName, dropOriginal: true },
              },
            ],
          });
          continue;
        }

        push({
          level: "info",
          code: "NF1_MULTIVALUE_FIELD",
          message: `«${e.name}»: поле «${colName}». ${NF_WORDS.multivalue}`,
          where: [e.id],
          suggestion:
            "Если это действительно список — вынесите в отдельную таблицу (1:N или N:M), иначе оставьте как есть.",
          actions: [
            {
              kind: "EXTRACT_MULTIVALUE_FIELD",
              label: "Вынести в таблицу",
              payload: { entityId: e.id, column: colName, dropOriginal: false },
            },
            {
              kind: "EXTRACT_MULTIVALUE_FIELD",
              label: "Вынести и удалить поле",
              payload: { entityId: e.id, column: colName, dropOriginal: true },
            },
          ],
        });
      }
    }
  }


  for (const li of mmLinks) {
    const e = li.link;
    if (!e.attributes || e.attributes.length === 0) continue;

    const leftPK = getPrimaryKey(li.left);
    const rightPK = getPrimaryKey(li.right);

    const leftFk = sanitizeMsg(li.rel.link?.leftColumn || fkCol(li.leftRoot, leftPK.name));
    const rightFk = sanitizeMsg(li.rel.link?.rightColumn || fkCol(li.rightRoot, rightPK.name));

    const cols = e.attributes.map((a) => sanitizeMsg(a.name)).filter(Boolean);
    const fkColsLower = new Set([leftFk.toLowerCase(), rightFk.toLowerCase()]);

    const nonKey = cols.filter((c) => {
      if (fkColsLower.has(c.toLowerCase())) return false;
      const attr = e.attributes.find((x) => sanitizeMsg(x.name).toLowerCase() === c.toLowerCase());
      if (attr && (attr as any).isPrimaryKey) return false;
      return true;
    });

    if (nonKey.length === 0) continue;

    const leftAttrSet = new Set(li.left.attributes.map((a) => snakeAttr(a.name)));
    const rightAttrSet = new Set(li.right.attributes.map((a) => snakeAttr(a.name)));

    const partialLeft: string[] = [];
    const partialRight: string[] = [];

    for (const c of nonKey) {
      if (isProbablyDerivedName(c)) continue;

      const sc = snakeAttr(c);

      if (li.leftRoot && sc.startsWith(`${li.leftRoot}_`)) {
        const suffix = sc.slice(li.leftRoot.length + 1);
        if (suffix && suffix !== "id" && !suffix.endsWith("_id")) {
          if (leftAttrSet.has(suffix) || GENERIC_TRANSITIVE_SUFFIXES.has(suffix)) {
            partialLeft.push(c);
            suppress3nfForCol.add(`${e.id}:${c.toLowerCase()}`);
          }
        }
      }
      if (li.rightRoot && sc.startsWith(`${li.rightRoot}_`)) {
        const suffix = sc.slice(li.rightRoot.length + 1);
        if (suffix && suffix !== "id" && !suffix.endsWith("_id")) {
          if (rightAttrSet.has(suffix) || GENERIC_TRANSITIVE_SUFFIXES.has(suffix)) {
            partialRight.push(c);
            suppress3nfForCol.add(`${e.id}:${c.toLowerCase()}`);
          }
        }
      }
    }

    for (const c of partialLeft) {
      push({
        level: "warning",
        code: "NF2_PARTIAL_DEP",
        message: `«${e.name}»: поле «${c}» похоже относится только к «${li.left.name}». ${NF_WORDS.partial}`,
        where: [e.id],
        suggestion:
          `Перенесите «${c}» в «${li.left.name}» и оставьте в связочной таблице только внешние ключи + атрибуты, зависящие от пары.`,
        actions: [
          {
            kind: "MOVE_ATTR_TO_ENTITY",
            label: `Перенести в ${li.left.name}`,
            payload: { fromEntityId: e.id, toEntityId: li.left.id, column: c, dropFromSource: true },
          },
        ],
      });
    }

    for (const c of partialRight) {
      push({
        level: "warning",
        code: "NF2_PARTIAL_DEP",
        message: `«${e.name}»: поле «${c}» похоже относится только к «${li.right.name}». ${NF_WORDS.partial}`,
        where: [e.id],
        suggestion:
          `Перенесите «${c}» в «${li.right.name}» и оставьте в связочной таблице только внешние ключи + атрибуты, зависящие от пары.`,
        actions: [
          {
            kind: "MOVE_ATTR_TO_ENTITY",
            label: `Перенести в ${li.right.name}`,
            payload: { fromEntityId: e.id, toEntityId: li.right.id, column: c, dropFromSource: true },
          },
        ],
      });
    }
  }


  // --- 3НФ: транзитивные зависимости (общий проход)
  for (const e of entities) {
    if (!e.attributes || e.attributes.length === 0) continue;

    const eRoot = rootOfEntityName(e.name);

    const cols = e.attributes.map((a) => sanitizeMsg(a.name)).filter(Boolean);
    const colsLower = new Set(cols.map((c) => c.toLowerCase()));

    for (const c of cols) {
      const root = splitFkRoot(c);
      if (!root) continue;

      const rootSnake = snakeAttr(root);
      const fkName = `${rootSnake}_id`;
      if (!colsLower.has(fkName.toLowerCase())) continue;

      for (const c2 of cols) {
        const sc2 = snakeAttr(c2);
        if (!sc2.startsWith(`${rootSnake}_`)) continue;
        if (sc2 === `${rootSnake}_id`) continue;
        if (sc2.endsWith("_id")) continue;

        if (suppress3nfForCol.has(`${e.id}:${c2.toLowerCase()}`)) continue;

        const suffix = sc2.slice(rootSnake.length + 1);
        if (!suffix) continue;

        if (GENERIC_TRANSITIVE_SUFFIXES.has(suffix)) {
          const refEnt = entByRoot.get(rootSnake);

          const refLabel =
            refEnt && refEnt.id === e.id
              ? " (скорее всего это дублирование — значение можно получать через self-JOIN по FK)."
              : refEnt
                ? ` (вынесите в «${refEnt.name}»).`
                : " (создайте отдельную сущность и вынесите туда).";

          push({
            level: "warning",
            code: "NF3_TRANSITIVE",
            message: `«${e.name}»: одновременно есть «${rootSnake}_id» и «${sanitizeMsg(c2)}». ${NF_WORDS.transitive}`,
            where: [e.id],
            suggestion: `Обычно достаточно хранить «${rootSnake}_id», а «${sanitizeMsg(c2)}» получать через JOIN${refLabel}`,
            actions: [
              {
                kind: "FIX_TRANSITIVE_DEP",
                label: "Исправить (вынести)",
                payload: {
                  holderEntityId: e.id,
                  fkRoot: rootSnake,
                  fkColumn: fkName,
                  moveColumn: sanitizeMsg(c2),
                },
              },
            ],
          });
        }
      }
    }

    // (B) missing FK
    {
      const prefixGroups = new Map<string, string[]>();

      for (const c of cols) {
        const sc = snakeAttr(c);
        const parts = sc.split("_");
        if (parts.length < 2) continue;

        const prefix = parts[0];
        const rest = parts.slice(1).join("_");

        if (!entByRoot.has(prefix)) continue;
        if (prefix === eRoot) continue;

        if (rest === "id") continue;
        if (rest.endsWith("_id")) continue;
        if (!GENERIC_TRANSITIVE_SUFFIXES.has(rest)) continue;

        const list = prefixGroups.get(prefix) ?? [];
        list.push(rest);
        prefixGroups.set(prefix, list);
      }

      for (const [root, attrs] of prefixGroups) {
        const fkName = `${root}_id`;
        if (colsLower.has(fkName.toLowerCase())) continue;

        const ref = entByRoot.get(root);
        if (!ref) continue;
        if (ref.id === e.id) continue;

        push({
          level: "info",
          code: "NF3_MISSING_FK",
          message: `«${e.name}»: есть поля вида «${root}_${attrs[0]}» (и похожие), но нет «${fkName}». Возможно, это данные сущности «${ref.name}» внутри таблицы.`,
          where: [e.id],
          suggestion:
            `Если это отдельная сущность — добавьте «${fkName}» и вынесите поля «${root}_…» в «${ref.name}». Если это осознанная денормализация — игнорируйте.`,
          actions: [
            {
              kind: "ADD_MISSING_FK_REL",
              label: "Добавить FK + связь",
              payload: { holderEntityId: e.id, fkRoot: root },
            },
          ],
        });
      }
    }
  }

  // --- link-table smell
  for (const e of entities) {
    if (!e.attributes || e.attributes.length === 0) continue;
    if (mmLinkById.has(e.id)) continue;

    const cols = e.attributes.map((a) => sanitizeMsg(a.name)).filter(Boolean);
    const fkCols = cols.filter((c) => /_id$/i.test(c));
    const roots = new Set(
      fkCols
        .map((c) => splitFkRoot(c))
        .filter(Boolean)
        .map((r) => snakeAttr(r!))
    );

    const existingRoots = [...roots].filter((r) => entByRoot.has(r));
    if (existingRoots.length !== 2) continue;

    const suspicious: string[] = [];
    for (const c of cols) {
      const sc = snakeAttr(c);
      for (const r of existingRoots) {
        if (!sc.startsWith(`${r}_`)) continue;
        if (sc === `${r}_id`) continue;
        if (sc.endsWith("_id")) continue;

        const suffix = sc.slice(r.length + 1);
        if (GENERIC_TRANSITIVE_SUFFIXES.has(suffix)) suspicious.push(c);
      }
    }

    const uniqSuspicious = [...new Set(suspicious.map((x) => sanitizeMsg(x)).filter(Boolean))];
    if (uniqSuspicious.length === 0) continue;

    const [r1, r2] = existingRoots;
    const e1 = entByRoot.get(r1)!;
    const e2 = entByRoot.get(r2)!;

    const leftFk = fkCols.find((c) => snakeAttr(c) === `${r1}_id`) ?? fkCols[0];
    const rightFk = fkCols.find((c) => snakeAttr(c) === `${r2}_id`) ?? fkCols[1] ?? fkCols[0];

    push({
      level: "info",
      code: "NF2_3_LINK_TABLE_SMELL",
      message: `«${e.name}»: таблица похожа на связочную (две *_id), но содержит поля ${uniqSuspicious.join(
        ", "
      )}. Часто это ведёт к нарушениям 2НФ/3НФ.`,
      where: [e.id],
      suggestion:
        "Оставьте в связочной таблице только FK + атрибуты, зависящие от пары; данные сущностей вынесите в соответствующие таблицы.",
      actions: [
        {
          kind: "CREATE_MM_REL_FROM_LINK_TABLE",
          label: "Оформить как M:N",
          payload: {
            linkEntityId: e.id,
            leftEntityId: e1.id,
            rightEntityId: e2.id,
            leftFk,
            rightFk,
          },
        },
      ],
    });
  }

  return issues;
}
