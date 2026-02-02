// frontend/src/utils/validateModel.ts
import type { Entity, Relationship } from "../store/useERStore";
import {
  sanitize,
  snake,
  toSingular,
  hasColumn,
  findExistingFKColumn,
  findExistingLinkEntity,
  getPrimaryKey as getPrimaryKeyCommon,
  suggestLinkTableName,
  uniqueName,
} from "./sql/common";

export type ValidationLevel = "error" | "warning" | "info";

export interface ValidationIssue {
  level: ValidationLevel;
  code: string;
  message: string;
  where?: string[];
  suggestion?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

function normType(t: string) {
  return (t || "").replace(/\s+/g, "").toUpperCase();
}

function isPkType(t?: string) {
  const u = normType(t || "");
  if (!u) return false;
  if (u === "UUID") return true;
  if (u === "INT" || u === "INTEGER") return true;
  if (u.endsWith("INT")) return true;
  if (u.includes("SERIAL")) return true;
  return false;
}

function rootOfEntityName(name: string) {
  return snake(toSingular(sanitize(name || "")));
}

function inferImplicitPk(entity: Entity): { name: string; type: string } | null {
  const root = rootOfEntityName(entity.name);
  const candidates = ["id", root ? `${root}_id` : ""].filter(Boolean);

  for (const want of candidates) {
    const hit = entity.attributes.find((a) => snake(sanitize(a.name)) === want);
    if (hit && isPkType(hit.type)) {
      return { name: sanitize(hit.name), type: hit.type || "UUID" };
    }
  }
  return null;
}

function getPrimaryKey(entity: Entity): { name: string; type: string } {
  const explicit = entity.attributes.find((a) => (a as any).isPrimaryKey);
  if (explicit) {
    const n = sanitize(explicit.name);
    const t = (explicit.type || "").trim() || "UUID";
    if (n) return { name: n, type: t };
  }

  const implicit = inferImplicitPk(entity);
  if (implicit) {
    return {
      name: sanitize(implicit.name),
      type: (implicit.type || "").trim() || "UUID",
    };
  }

  const pk = getPrimaryKeyCommon(entity);
  return {
    name: sanitize(pk.name),
    type: (pk.type || "").trim() || "UUID",
  };
}

function buildNameMap(entities: Entity[]) {
  const byLower = new Map<string, Entity[]>();
  for (const e of entities) {
    const key = sanitize(e.name).toLowerCase();
    const list = byLower.get(key) ?? [];
    list.push(e);
    byLower.set(key, list);
  }
  return byLower;
}

function looksLikeLinkName(linkName: string, aName: string, bName: string) {
  const en = snake(linkName);
  const an = snake(toSingular(sanitize(aName)));
  const bn = snake(toSingular(sanitize(bName)));
  return en.includes(an) && en.includes(bn);
}

function hasSelfRelation(entityId: string, relationships: Relationship[]) {
  return relationships.some(
    (r) =>
      (r.type === "one-to-many" || r.type === "one-to-one") &&
      r.from === entityId &&
      r.to === entityId
  );
}

function countIdCols(e: Entity) {
  return e.attributes
    .filter((a) => /_id$/i.test(sanitize(a.name)))
    .map((a) => sanitize(a.name))
    .filter(Boolean);
}

function findEntityByRootName(entities: Entity[], rootSnake: string): Entity | null {
  const wanted = (rootSnake || "").toLowerCase();
  return entities.find((en) => rootOfEntityName(en.name) === wanted) || null;
}

function detectLinkTableViaTwoOneToMany(
  link: Entity,
  entities: Entity[],
  relationships: Relationship[]
): { left: Entity; right: Entity; leftCol: string; rightCol: string } | null {
  const idCols = countIdCols(link);
  if (idCols.length !== 2) return null;

  const [c1, c2] = idCols;
  const r1 = snake(c1.replace(/_id$/i, ""));
  const r2 = snake(c2.replace(/_id$/i, ""));

  const e1 = findEntityByRootName(entities, r1);
  const e2 = findEntityByRootName(entities, r2);
  if (!e1 || !e2 || e1.id === e2.id) return null;

  const okRel = (fromId: string) =>
    relationships.some(
      (r) =>
        (r.type === "one-to-many" || r.type === "one-to-one") &&
        r.from === fromId &&
        r.to === link.id
    );

  if (!okRel(e1.id) || !okRel(e2.id)) return null;

  return { left: e1, right: e2, leftCol: c1, rightCol: c2 };
}

const IDENT_OK = /^[A-Za-z_][A-Za-z0-9_]*$/;

const RESERVED = new Set([
  "select",
  "insert",
  "update",
  "delete",
  "table",
  "column",
  "index",
  "primary",
  "foreign",
  "key",
  "unique",
  "constraint",
  "references",
  "check",
  "where",
  "from",
  "to",
  "limit",
  "offset",
  "join",
  "left",
  "right",
  "inner",
  "outer",
  "full",
  "and",
  "or",
  "not",
  "as",
  "values",
  "default",
]);

type DepEdge = {
  from: string;
  to: string;
  relId: string;
};

function sccKey(ids: string[]) {
  return [...ids].sort().join("|");
}

function tarjanScc(nodes: string[], adj: Map<string, DepEdge[]>) {
  let idx = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const out: string[][] = [];

  const strongConnect = (v: string) => {
    index.set(v, idx);
    low.set(v, idx);
    idx++;

    stack.push(v);
    onStack.add(v);

    for (const e of adj.get(v) ?? []) {
      const w = e.to;
      if (!index.has(w)) {
        strongConnect(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }

    if (low.get(v) === index.get(v)) {
      const comp: string[] = [];
      while (true) {
        const w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
        if (w === v) break;
      }
      out.push(comp);
    }
  };

  for (const n of nodes) {
    if (!index.has(n)) strongConnect(n);
  }
  return out;
}

export function validateModel(entities: Entity[], relationships: Relationship[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const entById = new Map(entities.map((e) => [e.id, e]));
  const nameMap = buildNameMap(entities);

  for (const e of entities) {
    const normName = sanitize(e.name || "");
    if (!normName) {
      issues.push({
        level: "error",
        code: "INVALID_ENTITY_NAME",
        message: `Имя сущности «${e.name}» некорректно после нормализации. Введите валидное имя.`,
        where: [e.id],
      });
    }
  }

  const relCountByEntity = new Map<string, number>();
  for (const r of relationships) {
    relCountByEntity.set(r.from, (relCountByEntity.get(r.from) ?? 0) + 1);
    relCountByEntity.set(r.to, (relCountByEntity.get(r.to) ?? 0) + 1);
  }
  const hasAnyRelations = (entityId: string) => (relCountByEntity.get(entityId) ?? 0) > 0;

  for (const [, list] of nameMap) {
    if (list.length > 1) {
      issues.push({
        level: "error",
        code: "DUP_ENTITY_NAME",
        message: `Имя сущности «${list[0].name}» используется для нескольких таблиц (${list.length}).`,
        where: list.map((e) => e.id),
        suggestion: "Переименуйте сущности так, чтобы имена были уникальны.",
      });
    }
  }

  for (const e of entities) {
    const raw = e.name;
    const norm = sanitize(raw);
    if (!IDENT_OK.test(norm)) {
      issues.push({
        level: "warning",
        code: "IDENT_NEEDS_QUOTING_ENTITY",
        message: `Имя таблицы «${raw}» требует экранирования (кавычек) в SQL.`,
        where: [e.id],
        suggestion: "Переименуйте таблицу в буквенно-цифровое имя с подчёркиванием, чтобы избежать кавычек.",
      });
    } else if (RESERVED.has(norm.toLowerCase())) {
      issues.push({
        level: "warning",
        code: "RESERVED_WORD_ENTITY",
        message: `Имя таблицы «${raw}» совпадает с зарезервированным словом SQL.`,
        where: [e.id],
        suggestion: "Переименуйте таблицу или оставьте как есть (генератор процитирует имя).",
      });
    }
  }

  for (const e of entities) {
    const seen = new Map<string, number>();
    for (const a of e.attributes) {
      const k = sanitize(a.name).toLowerCase();
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    const dups = [...seen.entries()].filter(([, n]) => n > 1);
    if (dups.length > 0) {
      issues.push({
        level: "error",
        code: "DUP_ATTR_NAME",
        message: `В сущности «${e.name}» есть повторяющиеся атрибуты: ${dups
          .map(([k]) => k)
          .join(", ")}.`,
        where: [e.id],
        suggestion: "Переименуйте дублирующиеся атрибуты.",
      });
    }
  }

  for (const e of entities) {
    for (const a of e.attributes) {
      const raw = a.name;
      const norm = sanitize(raw);
      if (!IDENT_OK.test(norm)) {
        issues.push({
          level: "warning",
          code: "IDENT_NEEDS_QUOTING_COLUMN",
          message: `Столбец «${e.name}.${raw}» требует экранирования (кавычек) в SQL.`,
          where: [e.id],
          suggestion: "Переименуйте столбец под формат [A-Za-z_][A-Za-z0-9_]*.",
        });
      } else if (RESERVED.has(norm.toLowerCase())) {
        issues.push({
          level: "warning",
          code: "RESERVED_WORD_COLUMN",
          message: `Столбец «${e.name}.${raw}» совпадает с зарезервированным словом SQL.`,
          where: [e.id],
          suggestion: "Переименуйте столбец или оставьте как есть (генератор процитирует имя).",
        });
      }
    }
  }

  type MMPair = { from: Entity; to: Entity; key: string; rel: Relationship };
  const mmPairs: MMPair[] = relationships
    .filter((r) => r.type === "many-to-many")
    .map((r) => {
      const from = entById.get(r.from);
      const to = entById.get(r.to);
      return from && to ? { from, to, key: `${from.id}__${to.id}`, rel: r } : null;
    })
    .filter(Boolean) as MMPair[];

  const linkEntityByPair = new Map<string, Entity | null>();
  const deferredLinkTables = new Set<string>();

  const usedTableNames = new Set(entities.map((e) => sanitize(e.name).toLowerCase()));
  const linkSqlNameByPair = new Map<string, string>();

  for (const p of mmPairs) {
    const link = findExistingLinkEntity(p.from, p.to, entities);
    linkEntityByPair.set(p.key, link ?? null);

    const suggestedBase = suggestLinkTableName(p.from.name, p.to.name);

    let chosen = suggestedBase;

    if (p.rel.link?.tableName) {
      chosen = sanitize(p.rel.link.tableName);
    } else if (link) {
      const fromToken = snake(toSingular(sanitize(p.from.name)));
      const toToken = snake(toSingular(sanitize(p.to.name)));
      const linkSnake = snake(sanitize(link.name));
      const looksOk = linkSnake.includes(fromToken) && linkSnake.includes(toToken);
      chosen = looksOk ? sanitize(link.name) : sanitize(suggestedBase);
    }

    chosen = uniqueName(chosen, usedTableNames);
    usedTableNames.add(chosen.toLowerCase());
    linkSqlNameByPair.set(p.key, chosen);

    if (link && link.attributes.length === 0) {
      deferredLinkTables.add(sanitize(link.name));
      const sqlName = linkSqlNameByPair.get(p.key) ?? sanitize(link.name);
      const note = sqlName !== sanitize(link.name) ? ` (в SQL: «${sqlName}»)` : "";
      issues.push({
        level: "info",
        code: "EMPTY_LINK_ENTITY",
        message: `Линк-таблица «${link.name}»${note} пустая — будет создана целиком на этапе связей с FK и PK.`,
        where: [link.id],
        suggestion: "Можно заранее указать имена столбцов в инспекторе связи (left/right), если нужно.",
      });
    }
  }

  const explicitLinkIds = new Set(
    [...linkEntityByPair.values()].filter((e): e is Entity => !!e).map((e) => e.id)
  );

  for (const e of entities) {
    const isEmpty = e.attributes.length === 0;
    const participates = hasAnyRelations(e.id);
    const isExplicitLink = explicitLinkIds.has(e.id);

    if (isEmpty && !isExplicitLink) {
      if (!participates) {
        issues.push({
          level: "warning",
          code: "EMPTY_ENTITY_SKIPPED",
          message: `Сущность «${e.name}» пустая и не участвует в связях — в SQL она не будет создана.`,
          where: [e.id],
          suggestion: "Добавьте атрибуты или свяжите сущность с другими таблицами.",
        });
        continue;
      } else {
        issues.push({
          level: "info",
          code: "EMPTY_ENTITY_WITH_RELS",
          message: `Сущность «${e.name}» пустая, но участвует в связях — таблица будет создана, FK-колонки добавятся на этапе связей.`,
          where: [e.id],
        });
        continue;
      }
    }

    if (!isExplicitLink) {
      const hasExplicitPk = e.attributes.some((a) => (a as any).isPrimaryKey);

      if (!hasExplicitPk) {
        const implicitPk = inferImplicitPk(e);
        const linkViaTwo = detectLinkTableViaTwoOneToMany(e, entities, relationships);

        if (implicitPk) {
          issues.push({
            level: "info",
            code: "IMPLICIT_PK_INFERRED",
            message:
              `В сущности «${e.name}» PK не отмечен, но найден столбец «${implicitPk.name} ${implicitPk.type}». ` +
              `Он будет использован как PRIMARY KEY (без создания нового id).`,
            where: [e.id],
            suggestion: "Если хотите — отметьте этот столбец как PK вручную, чтобы это было видно на диаграмме.",
          });
        } else if (linkViaTwo) {
          issues.push({
            level: "info",
            code: "LINK_TABLE_COMPOSITE_PK_HINT",
            message:
              `Таблица «${e.name}» выглядит как связочная (2 FK: «${linkViaTwo.leftCol}», «${linkViaTwo.rightCol}») ` +
              `и подключена через две связи 1:N. Для таких таблиц обычно делают составной PRIMARY KEY (${linkViaTwo.leftCol}, ${linkViaTwo.rightCol}) ` +
              `и не добавляют отдельный surrogate id.`,
            where: [e.id],
            suggestion:
              "Если это чистая связочная таблица N:M, обычно не делают отдельный surrogate id. " +
              "Лучше задать уникальность пары (student_id, course_id): либо составной PRIMARY KEY, либо UNIQUE по этим двум колонкам. " +
              "Если по предметной области возможны несколько записей на одну пару — тогда отдельный id оправдан.",
          });
        } else {
          issues.push({
            level: "info",
            code: "MISSING_PK",
            message: `В сущности «${e.name}» явный первичный ключ не задан — будет добавлен surrogate PK (id).`,
            where: [e.id],
            suggestion: "Можно явно отметить PK в карточке сущности, если нужно.",
          });
        }
      }
    }
  }

  for (const e of entities) {
    if (e.attributes.length > 0 && !hasAnyRelations(e.id) && !explicitLinkIds.has(e.id)) {
      issues.push({
        level: "warning",
        code: "LONELY_ENTITY",
        message: `Сущность «${e.name}» не участвует ни в одной связи.`,
        where: [e.id],
        suggestion: "Проверьте модель: возможно, забыта связь с другой сущностью.",
      });
    }
  }

  for (const e of entities) {
    const parentAttr = e.attributes.find((a) => /^parent_.*_id$/i.test(sanitize(a.name)));
    if (parentAttr && !hasSelfRelation(e.id, relationships)) {
      issues.push({
        level: "warning",
        code: "MISSING_SELF_LINK",
        message: `В «${e.name}» есть «${parentAttr.name}», но нет самосвязи 1:N (родитель→ребёнок).`,
        where: [e.id],
        suggestion: `Добавьте связь 1:N ${e.name}→${e.name} и укажите FK «${sanitize(
          parentAttr.name
        )}» (обычно допускается NULL).`,
      });
    }
  }

  for (const e of entities) {
    const idCols = countIdCols(e);
    if (idCols.length !== 2) continue;

    const linkViaTwo = detectLinkTableViaTwoOneToMany(e, entities, relationships);
    if (linkViaTwo) {
      issues.push({
        level: "info",
        code: "LINK_TABLE_VIA_TWO_RELS",
        message:
          `Таблица «${e.name}» используется как связочная между «${linkViaTwo.left.name}» и «${linkViaTwo.right.name}» ` +
          `через две связи 1:N. Это нормальный способ моделирования N:M через отдельную таблицу.`,
        where: [e.id],
        suggestion: "Если хотите — можно дополнительно оформить и как связь N:M в инспекторе, но это необязательно.",
      });
      continue;
    }

    const [l, r] = idCols;
    const lEnt = findEntityByRootName(entities, l.replace(/_id$/i, ""));
    const rEnt = findEntityByRootName(entities, r.replace(/_id$/i, ""));
    if (!lEnt || !rEnt || lEnt.id === rEnt.id) continue;

    const hasMM = relationships.some(
      (rr) =>
        rr.type === "many-to-many" &&
        ((rr.from === lEnt.id && rr.to === rEnt.id) || (rr.from === rEnt.id && rr.to === lEnt.id))
    );
    if (!hasMM) {
      issues.push({
        level: "warning",
        code: "TWO_ID_TABLE_NO_MM",
        message: `Таблица «${e.name}» похожа на link-таблицу (ровно две *_id: «${l}», «${r}»), но связи M:N между сущностями не найдено.`,
        where: [e.id],
        suggestion: "Если это связочная таблица — всё ок. Если вы ожидали N:M — оформите связь N:M в инспекторе.",
      });
    }
  }

  const fkColUsage = new Map<string, Map<string, string[]>>();

  for (const r of relationships) {
    const from = entById.get(r.from);
    const to = entById.get(r.to);
    if (!from || !to) continue;

    const fromPK = getPrimaryKey(from);
    const toPK = getPrimaryKey(to);

    const fromName = sanitize(from.name);
    const toName = sanitize(to.name);
    const fromSing = toSingular(fromName);
    const toSing = toSingular(toName);

    if (r.type === "one-to-one" || r.type === "one-to-many") {
      const expectedFkType = r.fk?.type && r.fk.type.trim() ? r.fk.type : fromPK.type;

      const suggestedExisting = findExistingFKColumn(to, fromName, fromSing, fromPK.name);

      const computedSelf = `parent_${snake(fromPK.name)}`;
      const computedRegular = `${snake(fromSing)}_${snake(fromPK.name)}`;
      const computed = r.from === r.to ? computedSelf : computedRegular;

      const desiredCol =
        (r.fk?.column && sanitize(r.fk.column)) || suggestedExisting || sanitize(computed);

      const toMap = fkColUsage.get(to.id) ?? new Map<string, string[]>();
      const key = desiredCol.toLowerCase();
      const list = toMap.get(key) ?? [];
      list.push(r.id);
      toMap.set(key, list);
      fkColUsage.set(to.id, toMap);

      if (desiredCol && hasColumn(to, desiredCol)) {
        const fkAttr = to.attributes.find((a) => sanitize(a.name).toLowerCase() === desiredCol.toLowerCase());
        const fkType = fkAttr?.type || "";
        if (fkType && normType(fkType) !== normType(expectedFkType)) {
          issues.push({
            level: "error",
            code: "FK_TYPE_MISMATCH",
            message:
              `Связь ${r.type} ${from.name}→${to.name}: тип FK-столбца «${desiredCol}» (${fkType}) ` +
              `не совпадает с ожидаемым типом (${expectedFkType}).`,
            where: [to.id],
            suggestion: `Выравняйте типы (например, смените тип «${desiredCol}» на ${expectedFkType}).`,
          });
        }
      } else {
        const autoCol = desiredCol;
        issues.push({
          level: "info",
          code: "FK_WILL_BE_ADDED",
          message:
            `Связь ${r.type} ${from.name}→${to.name}: будет добавлен столбец «${autoCol} ${expectedFkType}» ` +
            `с FOREIGN KEY на ${from.name}(${fromPK.name}).`,
          where: [to.id],
        });
      }

      if (r.type === "one-to-one" && r.fk?.unique !== false) {
        issues.push({
          level: "info",
          code: "ONE_TO_ONE_UNIQUE",
          message: `Связь 1:1 ${from.name}↔${to.name}: на FK в целевой таблице будет добавлено ограничение UNIQUE.`,
          where: [to.id],
        });
      }

      if (r.from === r.to) {
        const nn = r.fk?.notNull !== false;
        if (nn) {
          issues.push({
            level: "warning",
            code: "SELF_LOOP_NOT_NULL",
            message:
              `Самосвязь ${from.name}→${to.name} помечена как обязательная (FK NOT NULL). ` +
              `Это делает вставку корневых записей проблемной: строку без родителя вставить нельзя.`,
            where: [r.id, from.id],
            suggestion: "Сделайте FK nullable (fk.notNull=false), чтобы получить 0..* вместо 1..*.",
          });
        }
      }
    }

    if (r.type === "many-to-many") {
      const key = `${from.id}__${to.id}`;
      const explicit = linkEntityByPair.get(key);

      const fromPKName = getPrimaryKey(from).name;
      const toPKName = getPrimaryKey(to).name;

      const finalSqlLinkName = linkSqlNameByPair.get(key) ?? suggestLinkTableName(from.name, to.name);

      if (from.id === to.id) {
        const base = fkCol(fromSing, fromPKName);
        const leftCol = sanitize(r.link?.leftColumn || base);
        const rightCol = sanitize(r.link?.rightColumn || base);
        if (leftCol.toLowerCase() === rightCol.toLowerCase()) {
          issues.push({
            level: "error",
            code: "SELF_MM_COLUMNS_COLLIDE",
            message:
              `Связь N:M ${from.name}↔${to.name} является самосвязью. ` +
              `Для неё нужны две разные FK-колонки в линк-таблице, но сейчас leftColumn/rightColumn совпадают («${leftCol}»).`,
            where: [r.id],
            suggestion: `Задайте разные имена: например leftColumn="${base}_a", rightColumn="${base}_b" (или любые разные).`,
          });
        }
      }

      if (!explicit) {
        issues.push({
          level: "info",
          code: "IMPLICIT_LINK_TABLE",
          message:
            `Связь N:M ${from.name}↔${to.name}: будет создана линк-таблица «${finalSqlLinkName}» ` +
            `с колонками ${fkCol(fromSing, fromPKName)} и ${fkCol(toSing, toPKName)} + композитный PK.`,
        });
      } else {
        const originalName = sanitize(explicit.name);

        const fromToken = snake(toSingular(sanitize(from.name)));
        const toToken = snake(toSingular(sanitize(to.name)));
        const explicitSnake = snake(originalName);
        const looksOk = explicitSnake.includes(fromToken) && explicitSnake.includes(toToken);

        if (!r.link?.tableName && !looksOk && finalSqlLinkName !== originalName) {
          issues.push({
            level: "warning",
            code: "LINK_TABLE_RENAME",
            message:
              `Таблица «${originalName}» будет использована как линк-таблица для связи ` +
              `${from.name}↔${to.name}, но её имя выглядит неканонично. ` +
              `В SQL имя будет заменено на «${finalSqlLinkName}».`,
            where: [explicit.id, r.id],
            suggestion:
              "Переименуйте сущность в диаграмме или задайте link.tableName в настройках связи, если хотите другое имя.",
          });
        }

        const linkLabel =
          finalSqlLinkName !== originalName
            ? `«${originalName}» (в SQL: «${finalSqlLinkName}»)`
            : `«${originalName}»`;

        const leftCol = sanitize(r.link?.leftColumn || fkCol(fromSing, fromPKName));
        const rightCol = sanitize(r.link?.rightColumn || fkCol(toSing, toPKName));

        if (explicit.attributes.length > 0) {
          const leftExists = hasColumn(explicit, leftCol);
          const rightExists = hasColumn(explicit, rightCol);

          if (!leftExists || !rightExists) {
            issues.push({
              level: "info",
              code: "LINK_FK_WILL_BE_ADDED",
              message:
                `Линк-таблица ${linkLabel}: будут добавлены столбцы ` +
                `${leftExists ? "" : `"${leftCol} ${getPrimaryKey(from).type}" `}` +
                `${rightExists ? "" : `"${rightCol} ${getPrimaryKey(to).type}" `}`.trim() +
                ` и соответствующие FOREIGN KEY.`,
              where: [explicit.id],
            });
          }

          const hasExplicitPK = explicit.attributes.some((a) => (a as any).isPrimaryKey);
          if (r.link?.compositePrimaryKey !== false && !hasExplicitPK) {
            issues.push({
              level: "info",
              code: "LINK_COMPOSITE_PK",
              message: `Линк-таблица ${linkLabel}: будет добавлен композитный PRIMARY KEY (${leftCol}, ${rightCol}).`,
              where: [explicit.id],
            });
          }
        }
      }
    }
  }

  for (const r of relationships) {
    if (r.from !== r.to) continue;
    const e = entById.get(r.from);
    if (!e) continue;

    const pk = getPrimaryKey(e);
    const fkName = (r.fk?.column && sanitize(r.fk.column)) || `parent_${snake(pk.name)}`;

    const fkAttr = e.attributes.find((a) => sanitize(a.name).toLowerCase() === fkName.toLowerCase());
    if (fkAttr && fkAttr.type && normType(fkAttr.type) !== normType(pk.type)) {
      issues.push({
        level: "error",
        code: "SELF_FK_TYPE_MISMATCH",
        message: `Самосвязь ${e.name}↔${e.name}: тип FK «${fkName}» (${fkAttr.type}) не совпадает с типом PK «${pk.name}» (${pk.type}).`,
        where: [e.id],
        suggestion: `Выравняйте типы (например, смените тип «${fkName}» на ${pk.type}).`,
      });
    }
  }

  for (const e of entities) {
    const isSide = mmPairs.some((p) => p.from.id === e.id || p.to.id === e.id);
    if (isSide) continue;

    const isPartOfAnyPair = mmPairs.some((p) => looksLikeLinkName(e.name, p.from.name, p.to.name));
    if (!isPartOfAnyPair) {
      const candidates = entities.filter((x) => x.id !== e.id);
      const hits = candidates.filter((a: Entity) => snake(e.name).includes(snake(toSingular(a.name))));
      if (hits.length >= 2) {
        issues.push({
          level: "warning",
          code: "POTENTIAL_LINK_WITHOUT_REL",
          message:
            `Таблица «${e.name}» выглядит как линк-таблица (имя содержит корни нескольких сущностей), ` +
            `но связи N:M для неё не найдено. Проверьте модель: это отдельная таблица или нужна связь N:M?`,
          where: [e.id],
        });
      }
    }
  }

  for (const [toId, m] of fkColUsage) {
    const toEnt = entById.get(toId);
    if (!toEnt) continue;

    for (const [colLower, relIds] of m) {
      if (relIds.length <= 1) continue;

      const colName = colLower;
      issues.push({
        level: "error",
        code: "FK_COLUMN_COLLISION",
        message:
          `В таблице «${toEnt.name}» несколько связей пытаются использовать одну и ту же FK-колонку «${colName}». ` +
          `Это приведёт к конфликту имён (невозможно корректно сгенерировать FK/DDL).`,
        where: [toId, ...relIds],
        suggestion: "Задайте разные fk.column для этих связей (в инспекторе связи), либо удалите лишние связи.",
      });
    }
  }

  const nodes = entities.map((e) => e.id);

  const buildAdj = (onlyMandatory: boolean) => {
    const adj = new Map<string, DepEdge[]>();
    for (const n of nodes) adj.set(n, []);

    for (const r of relationships) {
      if (r.type !== "one-to-many" && r.type !== "one-to-one") continue;
      if (!entById.has(r.from) || !entById.has(r.to)) continue;

      const nn = r.fk?.notNull !== false;
      if (onlyMandatory && !nn) continue;

      if (r.from === r.to) continue;

      const child = r.to;
      const parent = r.from;

      adj.get(child)!.push({ from: child, to: parent, relId: r.id });
    }
    return adj;
  };

  const adjMandatory = buildAdj(true);
  const sccsMandatory = tarjanScc(nodes, adjMandatory).filter((c) => c.length > 1);
  const mandatoryKeys = new Set(sccsMandatory.map(sccKey));

  if (sccsMandatory.length > 0) {
    for (const comp of sccsMandatory) {
      const set = new Set(comp);
      const edgesInside: DepEdge[] = [];
      for (const v of comp) {
        for (const e of adjMandatory.get(v) ?? []) {
          if (set.has(e.to)) edgesInside.push(e);
        }
      }
      const relIds = [...new Set(edgesInside.map((x) => x.relId))];

      const names = comp
        .map((id) => entById.get(id)?.name || id)
        .sort()
        .join(", ");

      let suggestion = "Сделайте одну из связей в цикле необязательной: fk.notNull=false (nullable FK).";
      if (relIds.length > 0) {
        const r0 = relationships.find((r) => r.id === relIds[0]);
        if (r0) {
          const a = entById.get(r0.from)?.name ?? "A";
          const b = entById.get(r0.to)?.name ?? "B";
          suggestion = `Разорвите цикл: сделайте связь «${a}→${b}» необязательной (fk.notNull=false).`;
        }
      }

      issues.push({
        level: "error",
        code: "MANDATORY_FK_CYCLE",
        message:
          `Обнаружен цикл обязательных внешних ключей (FK NOT NULL) между таблицами: ${names}. ` +
          `Такая схема крайне трудно заполняется данными (взаимная обязательность).`,
        where: [...comp, ...relIds],
        suggestion,
      });
    }
  }

  const adjAll = buildAdj(false);
  const sccsAll = tarjanScc(nodes, adjAll).filter((c) => c.length > 1);

  for (const comp of sccsAll) {
    const key = sccKey(comp);
    if (mandatoryKeys.has(key)) continue;

    const names = comp
      .map((id) => entById.get(id)?.name || id)
      .sort()
      .join(", ");

    issues.push({
      level: "warning",
      code: "FK_CYCLE_WITH_NULLABLE",
      message:
        `Обнаружен цикл зависимостей по FK (включая nullable FK) между таблицами: ${names}. ` +
        `Он менее критичен, если хотя бы одна связь допускает NULL, но всё равно усложняет заполнение данных.`,
      where: [...comp],
      suggestion:
        "Если цикл мешает логике — разорвите его: сделайте одну связь необязательной (fk.notNull=false) или пересмотрите модель.",
    });
  }

  const ok = !issues.some((i) => i.level === "error");
  return { ok, issues };
}

function fkCol(rootSingular: string, pkName: string) {
  const base = snake(pkName);
  const root = snake(rootSingular) + "_";
  return base.startsWith(root) ? base : `${snake(rootSingular)}_${base}`;
}
