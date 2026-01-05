// frontend/src/utils/validateModel.ts
import type { Entity, Relationship } from "../store/useERStore";
import {
  sanitize,
  snake,
  toSingular,
  hasColumn,
  findExistingFKColumn,
  findExistingLinkEntity,
  getPrimaryKey,
  suggestLinkTableName,
  uniqueName,
} from "./sql/common";

/** Уровень сообщения валидатора */
export type ValidationLevel = "error" | "warning" | "info";

/** Единица результата проверки */
export interface ValidationIssue {
  level: ValidationLevel;
  code: string;
  message: string;
  where?: string[];
  suggestion?: string;
}

/** Результат проверки всей модели */
export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

/** Быстрая нормализация типа для сравнения совместимости (INT == int ==  Int ) */
function normType(t: string) {
  return (t || "").replace(/\s+/g, "").toUpperCase();
}

/** Набор имён сущностей -> для быстрых проверок */
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

/** Похоже ли имя таблицы на «линк-таблицу» двух сущностей (по включению обоих корней в snake_case) */
function looksLikeLinkName(linkName: string, aName: string, bName: string) {
  const en = snake(linkName);
  const an = snake(toSingular(sanitize(aName)));
  const bn = snake(toSingular(sanitize(bName)));
  return en.includes(an) && en.includes(bn);
}

/** Вспомогательные для новых проверок */
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
    .map((a) => sanitize(a.name));
}
function findEntityByRootName(entities: Entity[], rootSnake: string): Entity | null {
  const wanted = rootSnake.toLowerCase();
  return entities.find((en) => snake(en.name) === wanted) || null;
}

/** Базовые правила валидных идентификаторов без кавычек */
const IDENT_OK = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Короткий список зарезервированных слов (пересечение Postgres/MySQL + частые коллизии имён) */
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

/** Главная функция валидации */
export function validateModel(entities: Entity[], relationships: Relationship[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const entById = new Map(entities.map((e) => [e.id, e]));
  const nameMap = buildNameMap(entities);

  // Если после нормализации имя пустое — ошибка
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

  // Быстрые счётчики связей по сущности
  const relCountByEntity = new Map<string, number>();
  for (const r of relationships) {
    relCountByEntity.set(r.from, (relCountByEntity.get(r.from) ?? 0) + 1);
    relCountByEntity.set(r.to, (relCountByEntity.get(r.to) ?? 0) + 1);
  }
  const hasAnyRelations = (entityId: string) => (relCountByEntity.get(entityId) ?? 0) > 0;

  // --- 1) Дубликаты имён сущностей (без учёта регистра) ---
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

  // --- 1a) Резерв/кавычки для имён сущностей ---
  for (const e of entities) {
    const raw = e.name;
    const norm = sanitize(raw);
    if (!IDENT_OK.test(norm)) {
      issues.push({
        level: "warning",
        code: "IDENT_NEEDS_QUOTING_ENTITY",
        message: `Имя таблицы «${raw}» требует экранирования (кавычек) в SQL.`,
        where: [e.id],
        suggestion:
          "Переименуйте таблицу в буквенно-цифровое имя с подчёркиванием, чтобы избежать кавычек.",
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

  // --- 2) Повторяющиеся атрибуты в одной сущности ---
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

  // --- 2a) Резерв/кавычки для атрибутов ---
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

  // Подготовка пар N:M и поиск «явных» линк-таблиц
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

  // "финальное" имя link-таблицы так же, как в генераторе (чтобы тексты валидатора совпадали с SQL)
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

  // --- 3) Пустые сущности / отсутствующие PK ---
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

    // Нет PK у сущности (не link) → генератор добавит surrogate PK
    if (!isExplicitLink) {
      const hasPk = e.attributes.some((a) => (a as any).isPrimaryKey);
      if (!hasPk) {
        issues.push({
          level: "info",
          code: "MISSING_PK",
          message: `В сущности «${e.name}» явный первичный ключ не задан — будет добавлен surrogate PK (id).`,
          where: [e.id],
          suggestion: "Можно явно отметить PK в карточке сущности (🔑), если нужно.",
        });
      }
    }
  }

  // --- 3a) Несвязанная, но непустая сущность ---
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

  // --- 3b) Self-link по parent_*_id (если связи нет) ---
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

  // --- 3c) Таблица с двумя *_id без связи M:N ---
  for (const e of entities) {
    const idCols = countIdCols(e);
    if (idCols.length !== 2) continue;

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
        suggestion:
          "Оформите её как связь M:N в инспекторе (укажите link-таблицу и оба FK) либо сделайте 1:N/1:1 явно.",
      });
    }
  }

  // --- 4) Проверки по связям ---
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

    if (r.type === "one-to-one") {
      const hasFromType = !!fromPK?.type;
      const hasToType = !!toPK?.type;
      if (hasFromType && hasToType && normType(fromPK.type) !== normType(toPK.type)) {
        issues.push({
          level: "error",
          code: "FK_TYPE_MISMATCH",
          message: `Связь 1:1 ${from.name}↔${to.name}: типы PK различаются (${fromPK.type} vs ${toPK.type}). FK будет несовместим без приведения типов.`,
          where: [from.id, to.id],
          suggestion:
            "Выравняйте типы PK у обеих таблиц или задайте согласованные типы, чтобы FK был совместим.",
        });
        continue;
      }
    }

    if (r.type === "one-to-one" || r.type === "one-to-many") {
      const desiredCol =
        (r.fk?.column && sanitize(r.fk.column)) ||
        findExistingFKColumn(to, fromName, fromSing, fromPK.name) ||
        null;

      if (desiredCol && hasColumn(to, desiredCol)) {
        const fkAttr = to.attributes.find(
          (a) => sanitize(a.name).toLowerCase() === desiredCol.toLowerCase()
        );
        const fkType = fkAttr?.type || "";
        if (fkType && normType(fkType) !== normType(fromPK.type)) {
          issues.push({
            level: "error",
            code: "FK_TYPE_MISMATCH",
            message:
              `Связь ${r.type} ${from.name}→${to.name}: тип FK-столбца «${desiredCol}» (${fkType}) ` +
              `не совпадает с типом PK «${from.name}.${fromPK.name}» (${fromPK.type}).`,
            where: [to.id],
            suggestion: `Выравняйте типы (например, смените тип «${desiredCol}» на ${fromPK.type}).`,
          });
        }
      } else {
        const autoCol = sanitize((r.fk?.column) || `${snake(fromSing)}_${snake(fromPK.name)}`);
        issues.push({
          level: "info",
          code: "FK_WILL_BE_ADDED",
          message:
            `Связь ${r.type} ${from.name}→${to.name}: будет добавлен столбец «${autoCol} ${fromPK.type}» ` +
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
    }

    if (r.type === "many-to-many") {
      const key = `${from.id}__${to.id}`;
      const explicit = linkEntityByPair.get(key);

      const fromPKName = fromPK.name;
      const toPKName = toPK.name;

      const finalSqlLinkName = linkSqlNameByPair.get(key) ?? suggestLinkTableName(from.name, to.name);

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
                `${leftExists ? "" : `"${leftCol} ${fromPK.type}" `}` +
                `${rightExists ? "" : `"${rightCol} ${toPK.type}" `}`.trim() +
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

    const fkAttr = e.attributes.find(
      (a) => sanitize(a.name).toLowerCase() === fkName.toLowerCase()
    );
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
      const hits = candidates.filter((a: Entity) =>
        snake(e.name).includes(snake(toSingular(a.name)))
      );
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

  const ok = !issues.some((i) => i.level === "error");
  return { ok, issues };
}

/* ---------- Вспомогательное ---------- */
function fkCol(rootSingular: string, pkName: string) {
  const base = snake(pkName);
  const root = snake(rootSingular) + "_";
  return base.startsWith(root) ? base : `${snake(rootSingular)}_${base}`;
}
