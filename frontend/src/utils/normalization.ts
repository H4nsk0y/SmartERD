// frontend/src/utils/normalization.ts
import type { Entity, Relationship } from "../store/useERStore";
import type { ValidationIssue } from "./validateModel";
import {
  sanitize,
  snake,
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

function normName(n: string) {
  return snake(sanitize(n));
}

function rootOfEntityName(name: string) {
  return snake(toSingular(sanitize(name)));
}

function snakeAttr(name: string) {
  return snake(sanitize(name));
}

function baseNoIndex(n: string) {
  // phone1, phone_1, phone-1 -> phone
  const s = normName(n);
  const m = s.match(/^(.*?)(?:_)?(\d+)$/);
  return m ? m[1] : s;
}

function splitFkRoot(col: string): string | null {
  const m = sanitize(col).match(/^(.+)_id$/i);
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
  // повторяем логику валидатора/генератора по умолчанию
  const base = snake(pkName);
  const root = snake(rootSingular) + "_";
  return base.startsWith(root) ? base : `${snake(rootSingular)}_${base}`;
}

/* =========================
   Actions
   ========================= */

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
  return JSON.parse(JSON.stringify(v));
}

function newId(): string {
  const c: any = typeof crypto !== "undefined" ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function uniqueEntityName(base: string, entities: Entity[]) {
  const used = new Set(entities.map((e) => (e.name || "").toLowerCase()));
  let name = base || "Entity";
  let i = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base}_${i}`;
    i += 1;
  }
  return name;
}

function findAttrIndex(entity: Entity, col: string) {
  const want = sanitize(col).toLowerCase();
  return entity.attributes.findIndex((a) => sanitize(a.name).toLowerCase() === want);
}

function hasAttr(entity: Entity, col: string) {
  return findAttrIndex(entity, col) >= 0;
}

/**
 * Небольшой “умный” rename при переносе:
 * если переносим course_title в Course — делаем title (а не course_title),
 * если переносим student_email в Student — делаем email и т.п.
 */
function normalizeAttrNameForTarget(col: string, target: Entity): string {
  const targetRoot = rootOfEntityName(target.name);
  if (!targetRoot) return sanitize(col);

  const sc = snakeAttr(col);
  if (!sc.startsWith(`${targetRoot}_`)) return sanitize(col);

  const suffix = sc.slice(targetRoot.length + 1);
  if (!suffix) return sanitize(col);

  // Только “безопасные” суффиксы (title/email/name/...)
  if (!GENERIC_TRANSITIVE_SUFFIXES.has(suffix)) return sanitize(col);

  // Ставим suffix (title/email/...)
  return suffix;
}

function ensureAttr(entity: Entity, name: string, type: string, isPrimaryKey?: boolean) {
  const idx = findAttrIndex(entity, name);
  if (idx >= 0) return;

  // если добавляем PK — снимаем PK у остальных
  if (isPrimaryKey) {
    entity.attributes = entity.attributes.map((a) => ({ ...a, isPrimaryKey: false }));
  }

  entity.attributes.push({
    id: newId(),
    name: sanitize(name),
    type: type ?? "",
    isPrimaryKey: !!isPrimaryKey,
  });
}

function removeAttrs(entity: Entity, cols: string[]) {
  const drop = new Set(cols.map((c) => sanitize(c).toLowerCase()));
  entity.attributes = entity.attributes.filter((a) => !drop.has(sanitize(a.name).toLowerCase()));
}

function hasRelationship(
  relationships: Relationship[],
  from: string,
  to: string,
  type: Relationship["type"]
) {
  return relationships.some((r) => r.from === from && r.to === to && r.type === type);
}

function ensureOneToManyRel(relationships: Relationship[], fromId: string, toId: string, fkColumn: string) {
  //   защитимся от “самоссылки”
  if (fromId === toId) return;
  if (hasRelationship(relationships, fromId, toId, "one-to-many")) return;

  relationships.push({
    id: newId(),
    from: fromId,
    to: toId,
    type: "one-to-many",
    fk: {
      column: sanitize(fkColumn),
      notNull: true,
      onDelete: "CASCADE",
      index: true,
    },
  });
}

function removeOneToManyRel(relationships: Relationship[], fromId: string, toId: string, fkColumn?: string) {
  const fkWant = fkColumn ? sanitize(fkColumn).toLowerCase() : null;
  return relationships.filter((r) => {
    if (r.type !== "one-to-many") return true;
    if (r.from !== fromId || r.to !== toId) return true;
    if (!fkWant) return false; // удалить все matching from->to
    const col = sanitize(r.fk?.column || "").toLowerCase();
    return col !== fkWant; // удалить только если совпал fk
  });
}

/**
 * Применение одного action к модели (immutably).
 * Возвращает { entities, relationships } готовое для setDiagramData(...)
 */
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

      const srcPk = getPrimaryKey(src);
      const srcRoot = rootOfEntityName(src.name);
      const fkName = fkCol(srcRoot, srcPk.name);

      const groupTypes = columns
        .map((c) => src.attributes.find((a) => sanitize(a.name).toLowerCase() === sanitize(c).toLowerCase())?.type)
        .filter((t) => !!t) as string[];
      const valueType = groupTypes[0] ?? "TEXT";

      const childBaseName = `${sanitize(src.name)}_${sanitize(base)}` || "Child";
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
      ensureAttr(child, snakeAttr(base || "value"), valueType);
      ensureAttr(child, "idx", "INT");

      es.push(child);
      ensureOneToManyRel(rs, src.id, child.id, fkName);

      if (dropOriginal) {
        removeAttrs(src, columns);
      }

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

      const srcPk = getPrimaryKey(src);
      const srcRoot = rootOfEntityName(src.name);
      const fkName = fkCol(srcRoot, srcPk.name);

      const base = baseNoIndex(column) || snakeAttr(column) || "value";
      const childBaseName = `${sanitize(src.name)}_${sanitize(base)}` || "Child";
      const childName = uniqueEntityName(childBaseName, es);

      const child: Entity = {
        id: newId(),
        name: childName,
        x: (src.x ?? 0) + 320,
        y: (src.y ?? 0) + 140,
        attributes: [],
      };

      const srcAttr = src.attributes.find(
        (a) => sanitize(a.name).toLowerCase() === sanitize(column).toLowerCase()
      );
      const valueType = srcAttr?.type || "TEXT";

      ensureAttr(child, "id", srcPk.type || "UUID", true);
      ensureAttr(child, fkName, srcPk.type || "UUID");
      ensureAttr(child, "value", valueType);

      es.push(child);
      ensureOneToManyRel(rs, src.id, child.id, fkName);

      if (dropOriginal) {
        removeAttrs(src, [column]);
      }

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
        (x) => sanitize(x.name).toLowerCase() === sanitize(column).toLowerCase()
      );
      if (!a) return { entities: es, relationships: rs };

      const targetName = normalizeAttrNameForTarget(sanitize(a.name), to);

      // Если атрибут уже есть — просто удалим из источника (чтобы не плодить дубли)
      if (!hasAttr(to, targetName)) {
        ensureAttr(to, targetName, a.type || "TEXT", false);
      }

      if (dropFromSource !== false) {
        removeAttrs(from, [sanitize(a.name)]);
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

      const holderRoot = rootOfEntityName(holder.name);

      // найти/создать ref entity
      let ref = findEntityByRootName(es, fkRoot);
      if (!ref) {
        const baseName = sanitize(fkRoot)
          ? sanitize(fkRoot)[0].toUpperCase() + sanitize(fkRoot).slice(1)
          : "Ref";
        const refName = uniqueEntityName(baseName, es);

        ref = {
          id: newId(),
          name: refName,
          x: (holder.x ?? 0) - 340,
          y: (holder.y ?? 0),
          attributes: [],
        };

        const fkAttr = holder.attributes.find(
          (a) => sanitize(a.name).toLowerCase() === sanitize(fkColumn).toLowerCase()
        );
        const pkType = fkAttr?.type || "UUID";

        ensureAttr(ref, "id", pkType, true);

        es.push(ref);
        entById.set(ref.id, ref);
      }

      // перенести поле (или в self-case просто удалить)
      const srcAttr = holder.attributes.find(
        (a) => sanitize(a.name).toLowerCase() === sanitize(moveColumn).toLowerCase()
      );

      if (srcAttr) {
        // Если ref == holder (self), то не переносим “в себя”, просто удаляем дубль
        const isSelf = ref.id === holder.id;

        if (!isSelf) {
          const suffix = snakeAttr(moveColumn).startsWith(`${fkRoot}_`)
            ? snakeAttr(moveColumn).slice(fkRoot.length + 1)
            : sanitize(moveColumn);

          const targetName =
            suffix && GENERIC_TRANSITIVE_SUFFIXES.has(suffix) ? suffix : sanitize(srcAttr.name);

          ensureAttr(ref, targetName, srcAttr.type || "TEXT", false);
        }

        removeAttrs(holder, [srcAttr.name]);
      }

      // убедиться в связи ref 1:N holder по fkColumn
      //   если это self-case — связь не добавляем
      if (ref.id !== holder.id) {
        ensureOneToManyRel(rs, ref.id, holder.id, fkColumn);
      }

      // убедиться, что FK-атрибут есть (если вдруг отсутствует)
      const fkIdx = findAttrIndex(holder, fkColumn);
      if (fkIdx < 0) {
        const refPk = getPrimaryKey(ref);
        ensureAttr(holder, fkColumn, refPk.type || "UUID");
      }

      // маленький хак: если “fkRoot == holderRoot” (например course_id в Course),
      // мы НЕ создаём self-link, но удаление дубля всё равно полезно.
      void holderRoot;

      return { entities: es, relationships: rs };
    }

    case "ADD_MISSING_FK_REL": {
      const { holderEntityId, fkRoot } = action.payload as {
        holderEntityId: string;
        fkRoot: string;
      };

      const holder = entById.get(holderEntityId);
      if (!holder) return { entities: es, relationships: rs };

      //   не делаем self FK по одной лишь эвристике
      const holderRoot = rootOfEntityName(holder.name);
      if (snakeAttr(fkRoot) && snakeAttr(fkRoot) === holderRoot) {
        return { entities: es, relationships: rs };
      }

      let ref = findEntityByRootName(es, fkRoot);
      if (!ref) {
        const baseName = sanitize(fkRoot)
          ? sanitize(fkRoot)[0].toUpperCase() + sanitize(fkRoot).slice(1)
          : "Ref";
        const refName = uniqueEntityName(baseName, es);

        ref = {
          id: newId(),
          name: refName,
          x: (holder.x ?? 0) - 340,
          y: (holder.y ?? 0),
          attributes: [],
        };
        ensureAttr(ref, "id", "UUID", true);
        es.push(ref);
        entById.set(ref.id, ref);
      }

      const refPk = getPrimaryKey(ref);
      const fkColumn = `${snakeAttr(fkRoot)}_${snakeAttr(refPk.name)}`;
      ensureAttr(holder, fkColumn, refPk.type || "UUID");

      //   не создаём self-link
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

      //   бессмысленно делать M:N самой с собой
      if (left.id === right.id) return { entities: es, relationships: rs };

      // уже есть M:N?
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
          tableName: sanitize(link.name),
          leftColumn: sanitize(leftFk),
          rightColumn: sanitize(rightFk),
          compositePrimaryKey: true,
          onDelete: "CASCADE",
          index: true,
        },
      });

      //чистим лишние 1:N, если они появились от других авто-фиксов
      rs = removeOneToManyRel(rs, left.id, link.id, leftFk);
      rs = removeOneToManyRel(rs, right.id, link.id, rightFk);

      return { entities: es, relationships: rs };
    }

    default:
      return { entities: es, relationships: rs };
  }
}

/**
 * Нормализационные подсказки (эвристики).
 * Возвращает ValidationIssue[], чтобы можно было показывать тем же UI-виджетом.
 */
export function analyzeNormalization(entities: Entity[], relationships: Relationship[]): ValidationIssue[] {
  const issues: NormalizationIssue[] = [];

  const seen = new Set<string>();
  const push = (i: NormalizationIssue) => {
    const k = `${i.code}|${i.level}|${(i.where ?? []).join(",")}|${i.message}|${i.suggestion ?? ""}`;
    if (seen.has(k)) return;
    seen.add(k);
    issues.push(i);
  };

  const entById = new Map(entities.map((e) => [e.id, e] as const));

  // root -> entity (первое совпадение)
  const entByRoot = new Map<string, Entity>();
  for (const e of entities) {
    const r = rootOfEntityName(e.name);
    if (r && !entByRoot.has(r)) entByRoot.set(r, e);
  }

  // ---------- Подготовка: явные M:N связки (link-таблицы) ----------
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

  // =========================
  // 1НФ: повторяющиеся группы / мульти-значные поля / JSON
  // =========================
  for (const e of entities) {
    if (!e.attributes || e.attributes.length === 0) continue;

    // 1НФ: повторяющиеся группы phone_1, phone_2, ...
    {
      const groups = new Map<string, string[]>();

      for (const a of e.attributes) {
        const col = sanitize(a.name);
        if (!col) continue;

        const s = normName(col);
        const m = s.match(/^(.*?)(?:_)?(\d+)$/);
        if (!m) continue;

        const base = sanitize(m[1] ?? "");
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

    // 1НФ: JSON/ARRAY/мультизначные типы
    {
      for (const a of e.attributes) {
        if (!a.type) continue;
        if (!isLikelyJsonType(a.type)) continue;

        push({
          level: "warning",
          code: "NF1_NON_ATOMIC",
          message: `«${e.name}.${sanitize(a.name)}»: тип «${a.type}». ${NF_WORDS.json}`,
          where: [e.id],
          suggestion:
            "Если это список/словарь — рассмотрите вынос в отдельную сущность/таблицу. Если намеренно JSON — можно оставить как денормализацию.",
          actions: [
            {
              kind: "EXTRACT_MULTIVALUE_FIELD",
              label: "Скелет таблицы значений",
              payload: { entityId: e.id, column: sanitize(a.name), dropOriginal: false },
            },
          ],
        });
      }
    }

    // 1НФ: “tags/phones/emails/…”, “*_list”, “*_csv”
    {
      for (const a of e.attributes) {
        const col = snakeAttr(a.name);
        if (!col) continue;
        const parts = col.split("_");
        const last = parts.length ? parts[parts.length - 1] : col;

        if (MULTIVALUE_NAMES.has(last) || col.endsWith("_list") || col.endsWith("_csv")) {
          push({
            level: "info",
            code: "NF1_MULTIVALUE_FIELD",
            message: `«${e.name}»: поле «${sanitize(a.name)}». ${NF_WORDS.multivalue}`,
            where: [e.id],
            suggestion:
              "Если это действительно список — вынесите в отдельную таблицу (1:N или N:M), иначе оставьте как есть.",
            actions: [
              {
                kind: "EXTRACT_MULTIVALUE_FIELD",
                label: "Вынести в таблицу",
                payload: { entityId: e.id, column: sanitize(a.name), dropOriginal: false },
              },
              {
                kind: "EXTRACT_MULTIVALUE_FIELD",
                label: "Вынести и удалить поле",
                payload: { entityId: e.id, column: sanitize(a.name), dropOriginal: true },
              },
            ],
          });
        }
      }
    }
  }

  // =========================
  // 2НФ: частичные зависимости (в явных link-таблицах M:N)
  // =========================
  for (const li of mmLinks) {
    const e = li.link;
    if (!e.attributes || e.attributes.length === 0) continue;

    const leftPK = getPrimaryKey(li.left);
    const rightPK = getPrimaryKey(li.right);

    const leftFk = sanitize(li.rel.link?.leftColumn || fkCol(li.leftRoot, leftPK.name));
    const rightFk = sanitize(li.rel.link?.rightColumn || fkCol(li.rightRoot, rightPK.name));

    const cols = e.attributes.map((a) => sanitize(a.name)).filter(Boolean);
    const fkColsLower = new Set([leftFk.toLowerCase(), rightFk.toLowerCase()]);

    const nonKey = cols.filter((c) => {
      if (fkColsLower.has(c.toLowerCase())) return false;
      const attr = e.attributes.find((x) => sanitize(x.name).toLowerCase() === c.toLowerCase());
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

  // =========================
  // 3НФ: транзитивные зависимости (общий проход)
  // =========================
  for (const e of entities) {
    if (!e.attributes || e.attributes.length === 0) continue;

    const eRoot = rootOfEntityName(e.name);

    const cols = e.attributes.map((a) => sanitize(a.name)).filter(Boolean);
    const colsLower = new Set(cols.map((c) => c.toLowerCase()));

    // (A) есть root_id и root_name/title/email/etc
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

          // если это self-root (например Course.course_id + Course.course_title)
          const refLabel =
            refEnt && refEnt.id === e.id
              ? " (скорее всего это дублирование — значение можно получать через self-JOIN по FK)."
              : refEnt
                ? ` (вынесите в «${refEnt.name}»).`
                : " (создайте отдельную сущность и вынесите туда).";

          push({
            level: "warning",
            code: "NF3_TRANSITIVE",
            message: `«${e.name}»: одновременно есть «${rootSnake}_id» и «${sanitize(c2)}». ${NF_WORDS.transitive}`,
            where: [e.id],
            suggestion: `Обычно достаточно хранить «${rootSnake}_id», а «${sanitize(c2)}» получать через JOIN${refLabel}`,
            actions: [
              {
                kind: "FIX_TRANSITIVE_DEP",
                label: "Исправить (вынести)",
                payload: {
                  holderEntityId: e.id,
                  fkRoot: rootSnake,
                  fkColumn: fkName,
                  moveColumn: sanitize(c2),
                },
              },
            ],
          });
        }
      }
    }

    // (B) есть root_title/email/etc, но нет root_id => возможно пропущен FK
    {
      const prefixGroups = new Map<string, string[]>();

      for (const c of cols) {
        const sc = snakeAttr(c);
        const parts = sc.split("_");
        if (parts.length < 2) continue;

        const prefix = parts[0];
        const rest = parts.slice(1).join("_");

        if (!entByRoot.has(prefix)) continue;

        //   если prefix совпадает с текущей сущностью — НЕ считаем это “missing FK”
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

        // не предлагаем self
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

  // =========================
  // Link-table smell: 2 FK, но не оформлена как M:N и содержит “чужие” атрибуты
  // =========================
  for (const e of entities) {
    if (!e.attributes || e.attributes.length === 0) continue;

    // если уже явная link-таблица по M:N — пропускаем
    if (mmLinkById.has(e.id)) continue;

    const cols = e.attributes.map((a) => sanitize(a.name)).filter(Boolean);
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

    const uniq = [...new Set(suspicious.map((x) => sanitize(x)).filter(Boolean))];
    if (uniq.length === 0) continue;

    const [r1, r2] = existingRoots;
    const e1 = entByRoot.get(r1)!;
    const e2 = entByRoot.get(r2)!;

    const leftFk = fkCols.find((c) => snakeAttr(c) === `${r1}_id`) ?? fkCols[0];
    const rightFk = fkCols.find((c) => snakeAttr(c) === `${r2}_id`) ?? fkCols[1] ?? fkCols[0];

    push({
      level: "info",
      code: "NF2_3_LINK_TABLE_SMELL",
      message: `«${e.name}»: таблица похожа на связочную (две *_id), но содержит поля ${uniq.join(
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
