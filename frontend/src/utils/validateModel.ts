import type { Entity, Relationship } from "../store/useERStore";
import {
  sanitize, snake, toSingular, hasColumn, findExistingFKColumn,
  findExistingLinkEntity, getPrimaryKey
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

/** Набор имён сущностей → для быстрых проверок */
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
  return relationships.some(r =>
    (r.type === "one-to-many" || r.type === "one-to-one") &&
    r.from === entityId && r.to === entityId
  );
}
function countIdCols(e: Entity) {
  return e.attributes.filter(a => /_id$/i.test(sanitize(a.name))).map(a => sanitize(a.name));
}
function findEntityByRootName(entities: Entity[], rootSnake: string): Entity | null {
  const wanted = rootSnake.toLowerCase();
  return entities.find(en => snake(en.name) === wanted) || null;
}

/** Базовые правила валидных идентификаторов без кавычек */
const IDENT_OK = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Короткий список зарезервированных слов (пересечение Postgres/MySQL + частые коллизии имён) */
const RESERVED = new Set([
  "select","insert","update","delete","table","column","index",
  "primary","foreign","key","unique","constraint","references","check","where","from","to",
  "limit","offset","join","left","right","inner","outer","full","and","or","not","as",
  "values","default"
]);

/** Главная функция валидации */
export function validateModel(entities: Entity[], relationships: Relationship[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const entById = new Map(entities.map(e => [e.id, e]));
  const nameMap = buildNameMap(entities);

  // Быстрые счётчики связей по сущности
  const relCountByEntity = new Map<string, number>();
  for (const r of relationships) {
    relCountByEntity.set(r.from, (relCountByEntity.get(r.from) ?? 0) + 1);
    relCountByEntity.set(r.to,   (relCountByEntity.get(r.to)   ?? 0) + 1);
  }
  const hasAnyRelations = (entityId: string) => (relCountByEntity.get(entityId) ?? 0) > 0;

  // --- 1) Дубликаты имён сущностей (без учёта регистра) ---
  for (const [, list] of nameMap) {
    if (list.length > 1) {
      issues.push({
        level: "error",
        code: "DUP_ENTITY_NAME",
        message: `Имя сущности «${list[0].name}» используется для нескольких таблиц (${list.length}).`,
        where: list.map(e => e.id),
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
        suggestion: "Переименуйте таблицу в буквенно-цифровое имя с подчёркиванием, чтобы избежать кавычек."
      });
    } else if (RESERVED.has(norm.toLowerCase())) {
      issues.push({
        level: "warning",
        code: "RESERVED_WORD_ENTITY",
        message: `Имя таблицы «${raw}» совпадает с зарезервированным словом SQL.`,
        where: [e.id],
        suggestion: "Переименуйте таблицу или оставьте как есть (генератор процитирует имя)."
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
        message: `В сущности «${e.name}» есть повторяющиеся атрибуты: ${dups.map(([k]) => k).join(", ")}.`,
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
          suggestion: "Переименуйте столбец под формат [A-Za-z_][A-Za-z0-9_]*."
        });
      } else if (RESERVED.has(norm.toLowerCase())) {
        issues.push({
          level: "warning",
          code: "RESERVED_WORD_COLUMN",
          message: `Столбец «${e.name}.${raw}» совпадает с зарезервированным словом SQL.`,
          where: [e.id],
          suggestion: "Переименуйте столбец или оставьте как есть (генератор процитирует имя)."
        });
      }
    }
  }

  // Подготовка пар N:M и поиск «явных» линк-таблиц
  type MMPair = { from: Entity; to: Entity; key: string };
  const mmPairs: MMPair[] = relationships
    .filter(r => r.type === "many-to-many")
    .map(r => {
      const from = entById.get(r.from);
      const to   = entById.get(r.to);
      return (from && to) ? { from, to, key: `${from.id}__${to.id}` } : null;
    })
    .filter(Boolean) as MMPair[];

  const linkEntityByPair = new Map<string, Entity | null>();
  const deferredLinkTables = new Set<string>();

  // Найти явные link-сущности по имени
  for (const p of mmPairs) {
    const link = findExistingLinkEntity(p.from, p.to, entities);
    linkEntityByPair.set(p.key, link ?? null);
    if (link && link.attributes.length === 0) {
      deferredLinkTables.add(sanitize(link.name));
      issues.push({
        level: "info",
        code: "EMPTY_LINK_ENTITY",
        message: `Линк-таблица «${link.name}» пустая — будет создана целиком на этапе связей с FK и PK.`,
        where: [link.id],
        suggestion: "Можно заранее указать имена столбцов в инспекторе связи (left/right), если нужно.",
      });
    }
  }

  // --- 3) Пустые сущности / отсутствующие PK ---
  for (const e of entities) {
    const isEmpty = e.attributes.length === 0;
    const participates = hasAnyRelations(e.id);

    // Если это не явная link-таблица
    const isExplicitLink = [...linkEntityByPair.values()].some(le => le?.id === e.id);

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
      const hasPk = e.attributes.some(a => (a as any).isPrimaryKey);
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
    if (e.attributes.length > 0 && !hasAnyRelations(e.id)) {
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
    const parentAttr = e.attributes.find(a => /^parent_.*_id$/i.test(sanitize(a.name)));
    if (parentAttr && !hasSelfRelation(e.id, relationships)) {
      issues.push({
        level: "warning",
        code: "MISSING_SELF_LINK",
        message: `В «${e.name}» есть «${parentAttr.name}», но нет самосвязи 1:N (родитель→ребёнок).`,
        where: [e.id],
        suggestion: `Добавьте связь 1:N ${e.name}→${e.name} и укажите FK «${sanitize(parentAttr.name)}» (обычно допускается NULL).`,
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
      rr => rr.type === "many-to-many" &&
        ((rr.from === lEnt.id && rr.to === rEnt.id) || (rr.from === rEnt.id && rr.to === lEnt.id))
    );
    if (!hasMM) {
      issues.push({
        level: "warning",
        code: "TWO_ID_TABLE_NO_MM",
        message: `Таблица «${e.name}» похожа на link-таблицу (ровно две *_id: «${l}», «${r}»), но связи M:N между сущностями не найдено.`,
        where: [e.id],
        suggestion: "Оформите её как связь M:N в инспекторе (укажите link-таблицу и оба FK) либо сделайте 1:N/1:1 явно.",
      });
    }
  }

  // --- 4) Проверки по связям ---
  for (const r of relationships) {
    const from = entById.get(r.from);
    const to   = entById.get(r.to);
    if (!from || !to) continue;

    const fromPK = getPrimaryKey(from);
    const toPK   = getPrimaryKey(to);

    const fromName = sanitize(from.name);
    const toName   = sanitize(to.name);
    const fromSing = toSingular(fromName);
    const toSing   = toSingular(toName);

    // Специально для 1:1: если типы PK по сторонам различаются — считаем это конфликтом типов FK.
    // Это нужно для сценариев, где ожидается жёсткая совместимость типов в паре 1:1.
    if (r.type === "one-to-one") {
      const hasFromType = !!fromPK?.type;
      const hasToType   = !!toPK?.type;
      if (hasFromType && hasToType && normType(fromPK.type) !== normType(toPK.type)) {
        issues.push({
          level: "error",
          code: "FK_TYPE_MISMATCH",
          message: `Связь 1:1 ${from.name}↔${to.name}: типы PK различаются (${fromPK.type} vs ${toPK.type}). FK будет несовместим без приведения типов.`,
          where: [from.id, to.id],
          suggestion: `Выравняйте типы PK у обеих таблиц или задайте согласованные типы, чтобы FK был совместим.`,
        });
        // При конфликте типов в 1:1 не добавляем ONE_TO_ONE_UNIQUE
        continue;
      }
    }

    if (r.type === "one-to-one" || r.type === "one-to-many") {
      // Ищем существующую FK-колонку или ту, что попросил пользователь в инспекторе
      const desiredCol =
        (r.fk?.column && sanitize(r.fk.column)) ||
        findExistingFKColumn(to, fromName, fromSing, fromPK.name) ||
        null;

      // Если колонка существует → проверить совместимость типов
      if (desiredCol && hasColumn(to, desiredCol)) {
        const fkAttr = to.attributes.find(a => sanitize(a.name).toLowerCase() === desiredCol.toLowerCase());
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
        // Колонки нет — генератор добавит
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

      // Для 1:1 генератор добавляет UNIQUE на FK (если не отключено) — только если не было конфликта типов
      if (r.type === "one-to-one" && (r.fk?.unique !== false)) {
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

      if (!explicit) {
        const autoName = `${snake(fromName)}_${snake(toName)}_link`;
        issues.push({
          level: "info",
          code: "IMPLICIT_LINK_TABLE",
          message:
            `Связь N:M ${from.name}↔${to.name}: будет создана линк-таблица «${autoName}» ` +
            `с колонками ${fkCol(fromSing, fromPK.name)} и ${fkCol(toSing, toPK.name)} + композитный PK.`,
        });
      } else {
        const linkName = sanitize(explicit.name);
        const leftCol  = sanitize(r.link?.leftColumn  || fkCol(fromSing, fromPK.name));
        const rightCol = sanitize(r.link?.rightColumn || fkCol(toSing,   toPK.name));

        // Пустая (отложенная) — уже отметили выше как info
        if (explicit.attributes.length > 0) {
          // Если у явной линк-таблицы нет нужных FK-колонок — генератор добавит/доприведёт
          const leftExists  = hasColumn(explicit, leftCol);
          const rightExists = hasColumn(explicit, rightCol);

          if (!leftExists || !rightExists) {
            issues.push({
              level: "info",
              code: "LINK_FK_WILL_BE_ADDED",
              message:
                `Линк-таблица «${linkName}»: будут добавлены столбцы ` +
                `${leftExists ? "" : `"${leftCol} ${fromPK.type}" `}` +
                `${rightExists ? "" : `"${rightCol} ${toPK.type}" `}`.trim() +
                ` и соответствующие FOREIGN KEY.`,
              where: [explicit.id],
            });
          }

          // Композитный PK, если не отключён и ещё не задан вручную
          const hasExplicitPK = explicit.attributes.some(a => (a as any).isPrimaryKey);
          if (r.link?.compositePrimaryKey !== false && !hasExplicitPK) {
            issues.push({
              level: "info",
              code: "LINK_COMPOSITE_PK",
              message: `Линк-таблица «${linkName}»: будет добавлен композитный PRIMARY KEY (${leftCol}, ${rightCol}).`,
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
    const fkName =
      (r.fk?.column && sanitize(r.fk.column)) ||
      `parent_${snake(pk.name)}`;

    const fkAttr = e.attributes.find(a => sanitize(a.name).toLowerCase() === fkName.toLowerCase());
    if (fkAttr && fkAttr.type && normType(fkAttr.type) !== normType(pk.type)) {
      issues.push({
        level: "error",
        code: "SELF_FK_TYPE_MISMATCH",
        message: `Самосвязь ${e.name}↔${e.name}: тип FK «${fkName}» (${fkAttr.type}) не совпадает с типом PK «${pk.name}» (${pk.type}).`,
        where: [e.id],
        suggestion: `Выравняйте типы (например, смените тип «${fkName}» на ${pk.type}).`
      });
    }
  }

  for (const e of entities) {
    // FIX: сущности самой пары M:N не проверяем как link-кандидаты
    const isSide = mmPairs.some(p => p.from.id === e.id || p.to.id === e.id);
    if (isSide) continue;

    const isPartOfAnyPair = mmPairs.some(p => looksLikeLinkName(e.name, p.from.name, p.to.name));
    if (!isPartOfAnyPair) {
      const candidates = entities.filter(x => x.id !== e.id);
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

  const ok = !issues.some(i => i.level === "error");
  return { ok, issues };
}

/* ---------- Вспомогательное ---------- */

function fkCol(rootSingular: string, pkName: string) {
  const base = snake(pkName);
  const root = snake(rootSingular) + "_";
  return base.startsWith(root) ? base : `${snake(rootSingular)}_${base}`;
}
