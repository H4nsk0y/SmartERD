// backend/src/er-generate.js
// Задача файла:
// 1) SYSTEM_PROMPT — просим LLM вернуть JSON-спецификацию ER.
// 2) parseModelJson(text) — достаём JSON из ответа (включая fenced-блоки).
// 3) repairSpec(spec) — авто-правки типичных косяков (направления 1:N, link-таблицы, *_id → связи,
//    перевёрнутые пары вроде Payment–Refund, User–Enrollment, конфликт 1:N и M:M и т.д.).
// 4) specToAppFormat(spec) — превращаем спецификацию в формат фронта (entities/relationships) + авто-раскладка.

//
// ===================== PROMPT =====================
//
export const SYSTEM_PROMPT = `
Ты — помощник, который по краткому описанию проекта генерирует ER-модель.

Верни ТОЛЬКО JSON со структурой:
{
  "entities": [
    {
      "name": "User",
      "attributes": [
        {"name": "id", "type": "UUID", "primaryKey": true},
        {"name": "email", "type": "VARCHAR(255)", "unique": true}
      ]
    }
  ],
  "relationships": [
    { "type": "one-to-many", "from": "Category", "to": "Product",
      "fk": { "column": "category_id", "onDelete": "CASCADE" } },
    { "type": "one-to-one", "from": "User", "to": "Cart",
      "fk": { "column": "user_id", "unique": true, "onDelete": "CASCADE" } },
    { "type": "many-to-many", "from": "Post", "to": "Tag",
      "link": { "tableName": "PostTag", "leftColumn": "post_id", "rightColumn": "tag_id", "compositePrimaryKey": true } }
  ]
}

Правила:
- Имена сущностей — CamelCase, столбцов — snake_case.
- Для 1:N и 1:1 FK должна быть у целевой стороны (to): product.category_id → category.id.
- Для 1:1 FK в целевой стороне часто требует UNIQUE.
- Для N:M — обязательно явная link-таблица с left/right колонками.
- Если чего-то не хватает — добавь разумные поля: id (UUID) как PK, created_at TIMESTAMP и т.п.
- Никаких пояснений вне JSON.
`.trim();

//
// ===================== ВСПОМОГАТЕЛЬНОЕ =====================
//
function snake(s) {
  return String(s || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s\-]+/g, "_")
    .toLowerCase();
}
function sanitizeName(s) {
  return String(s || "").replace(/[^A-Za-z0-9_]/g, "_");
}
function isUUIDType(t) {
  return String(t || "").trim().toUpperCase().includes("UUID");
}
function mkId() {
  return "id_" + Math.random().toString(36).slice(2, 10);
}
function pickPK(attrs) {
  let pk = attrs.find(a => a.primaryKey === true) || attrs.find(a => /^id$/i.test(a.name));
  if (!pk) pk = attrs.find(a => isUUIDType(a.type));
  return pk || null;
}
function fkColName(fromEntityName, fromPkName) {
  const root = snake(fromEntityName).replace(/_+id$/, "");
  const base = snake(fromPkName || "id");
  return base.startsWith(root + "_") ? base : `${root}_${base}`;
}
function pascal(s) {
  return String(s || "").split(/[_\s-]+/).map(w => w ? (w[0].toUpperCase() + w.slice(1).toLowerCase()) : "").join("");
}
function lc(s) { return String(s || "").toLowerCase(); }
function eq(a, b) { return lc(a) === lc(b); }

//
// ===================== ПАРСИНГ JSON =====================
//
export function parseModelJson(text) {
  const raw = String(text || "");
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch {}
  }
  const start = raw.indexOf("{");
  const end   = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
  }
  try { return JSON.parse(raw); } catch {
    throw new Error("Failed to parse JSON from model output");
  }
}

//
// ===================== НОРМАЛИЗАЦИЯ СПЕЦИФИКАЦИИ =====================
//
function normalizeSpec(spec) {
  const s = spec && typeof spec === "object" ? spec : {};
  s.entities = Array.isArray(s.entities) ? s.entities : [];
  s.relationships = Array.isArray(s.relationships) ? s.relationships : [];

  for (const e of s.entities) {
    e.name = String(e.name || "").trim() || "Entity";
    e.attributes = Array.isArray(e.attributes) ? e.attributes : [];
    e.attributes = e.attributes.map(a => ({
      name: sanitizeName(a?.name || ""),
      type: String(a?.type || "").trim() || "UUID",
      primaryKey: !!a?.primaryKey || !!a?.isPrimaryKey, // иногда приходит isPrimaryKey
      unique: !!a?.unique,
      notNull: a?.notNull === undefined ? undefined : !!a.notNull,
    }));
  }

  for (const r of s.relationships) {
    r.type = (r.type || "").toLowerCase(); // "one-to-one" | "one-to-many" | "many-to-many"
    r.from = String(r.from || "").trim();
    r.to   = String(r.to   || "").trim();

    if (r.link) {
      r.link.tableName   = r.link.tableName   ? sanitizeName(r.link.tableName)   : undefined;
      r.link.leftColumn  = r.link.leftColumn  ? sanitizeName(r.link.leftColumn)  : undefined;
      r.link.rightColumn = r.link.rightColumn ? sanitizeName(r.link.rightColumn) : undefined;
      r.link.compositePrimaryKey = r.link.compositePrimaryKey !== false;
      if (r.link.onDelete && !/^(CASCADE|SET NULL|RESTRICT|NO ACTION)$/i.test(r.link.onDelete)) r.link.onDelete = undefined;
      if (r.link.onUpdate && !/^(CASCADE|SET NULL|RESTRICT|NO ACTION)$/i.test(r.link.onUpdate)) r.link.onUpdate = undefined;
      r.link.index = r.link.index !== false;
    }

    if (r.fk) {
      r.fk.column  = r.fk.column ? sanitizeName(r.fk.column) : undefined;
      r.fk.type    = r.fk.type ? String(r.fk.type).trim() : undefined;
      r.fk.notNull = r.fk.notNull !== false;
      r.fk.unique  = r.fk.unique === true;
      if (r.fk.onDelete && !/^(CASCADE|SET NULL|RESTRICT|NO ACTION)$/i.test(r.fk.onDelete)) r.fk.onDelete = undefined;
      if (r.fk.onUpdate && !/^(CASCADE|SET NULL|RESTRICT|NO ACTION)$/i.test(r.fk.onUpdate)) r.fk.onUpdate = undefined;
      r.fk.index   = r.fk.index !== false;
    }
  }
  return s;
}

//
// ===================== ЭВРИСТИКИ РЕМОНТА =====================
//
function buildNameMaps(entities) {
  const byName = new Map(); // оригинальное имя -> entity
  const bySnake = new Map(); // snake(name) -> entity
  for (const e of entities) {
    byName.set(e.name, e);
    const sn = snake(e.name);
    if (!bySnake.has(sn)) bySnake.set(sn, e);
  }
  return { byName, bySnake };
}
function hasAttr(e, name) {
  const n = sanitizeName(name).toLowerCase();
  return (e.attributes || []).some(a => sanitizeName(a.name).toLowerCase() === n);
}
function findEntityByIdColumnName(entities, attrName) {
  const m = String(attrName || "").match(/^(.+?)_id$/i);
  if (!m) return null;
  const root = m[1];
  const wantedSnake = root.toLowerCase();
  const pas = pascal(root);
  const bySnakeHit = entities.find(en => snake(en.name) === wantedSnake);
  if (bySnakeHit) return bySnakeHit;
  const byPascalHit = entities.find(en => eq(en.name, pas));
  return byPascalHit || null;
}

function ensurePKs(entities) {
  for (const e of entities) {
    let pk = pickPK(e.attributes);
    if (!pk) {
      e.attributes.unshift({ name: "id", type: "UUID", primaryKey: true });
    } else if (!pk.type) {
      pk.type = "UUID";
    }
  }
}

function normalizeOneToXDirection(spec, maps) {
  // Для каждой 1:N или 1:1: FK должен быть у целевой стороны (to) и называться <from>_<pk>.
  for (const r of spec.relationships) {
    if (r.type !== "one-to-many" && r.type !== "one-to-one") continue;
    const fromE = maps.byName.get(r.from);
    const toE   = maps.byName.get(r.to);
    if (!fromE || !toE) continue;

    const fromPk = pickPK(fromE.attributes) || { name: "id", type: "UUID" };
    const expected = fkColName(fromE.name, fromPk.name); // ожидаем в to
    const col = r.fk?.column;

    const fromRoot = snake(fromE.name);
    const toRoot   = snake(toE.name);

    if (!r.fk) {
      r.fk = { column: expected, type: fromPk.type || "UUID", notNull: true, onDelete: "CASCADE", index: r.type === "one-to-many", unique: r.type === "one-to-one" ? true : undefined };
      continue;
    }

    const colRoot = (col || "").toLowerCase().replace(/_id$/, "");
    const looksLikeFrom = colRoot === fromRoot;
    const looksLikeTo   = colRoot === toRoot;

    if (looksLikeTo && !looksLikeFrom) {
      [r.from, r.to] = [r.to, r.from];
      const newFromE = maps.byName.get(r.from);
      const newPk = pickPK(newFromE.attributes) || { name: "id", type: "UUID" };
      const exp2 = fkColName(newFromE.name, newPk.name);
      r.fk.column = exp2;
      r.fk.type = newPk.type || r.fk.type || "UUID";
      r.fk.unique = r.type === "one-to-one" ? true : undefined;
      r.fk.notNull = r.fk.notNull !== false;
      if (!r.fk.onDelete) r.fk.onDelete = "CASCADE";
      if (r.type === "one-to-one") r.fk.index = false;
      else r.fk.index = r.fk.index !== false;
      continue;
    }

    if (!looksLikeFrom) {
      r.fk.column = expected;
      r.fk.type = r.fk.type || fromPk.type || "UUID";
    }

    r.fk.unique = r.type === "one-to-one" ? true : (r.fk.unique ? undefined : undefined);
    if (!r.fk.onDelete) r.fk.onDelete = "CASCADE";
    if (r.type === "one-to-one") r.fk.index = false;
    else r.fk.index = r.fk.index !== false;
  }
}

function removeMMIfOneToNExists(spec, aName, bName) {
  const hasOneToN = spec.relationships.some(r =>
    (r.type === "one-to-many") &&
    ((eq(r.from, aName) && eq(r.to, bName)) || (eq(r.from, bName) && eq(r.to, aName)))
  );
  if (!hasOneToN) return;
  spec.relationships = spec.relationships.filter(r =>
    !(r.type === "many-to-many" && ((eq(r.from, aName) && eq(r.to, bName)) || (eq(r.from, bName) && eq(r.to, aName))))
  );
}

function autoRelationsFromIdColumns(spec, maps) {
  for (const e of spec.entities) {
    for (const a of e.attributes) {
      if (!/_id$/i.test(a.name)) continue;
      if (eq(a.name, "id")) continue;

      const ref = findEntityByIdColumnName(spec.entities, a.name);
      if (!ref || eq(ref.name, e.name)) continue;

      const exists = spec.relationships.some(r =>
        r.type === "one-to-many" && eq(r.from, ref.name) && eq(r.to, e.name) && r?.fk?.column === a.name
      );
      if (!exists) {
        const pk = pickPK(ref.attributes) || { name: "id", type: a.type || "UUID" };
        spec.relationships.push({
          type: "one-to-many",
          from: ref.name,
          to: e.name,
          fk: { column: a.name, type: pk.type || "UUID", notNull: a.notNull !== false, onDelete: "CASCADE", index: true }
        });
      }
    }
  }
}

function detectAndConvertLinkTables(spec, maps) {
  const isIdCol = (n) => /_id$/i.test(n) && !eq(n, "id");
  const linkCandidates = [];

  for (const e of spec.entities) {
    const ids = e.attributes.filter(a => isIdCol(a.name));
    if (ids.length !== 2) continue;

    const others = e.attributes.filter(a => !isIdCol(a.name));
    const othersBusiness = others.filter(a => !a.primaryKey && !/^created_at|updated_at|deleted_at$/i.test(a.name));
    if (othersBusiness.length > 0 && !(othersBusiness.length === 1 && eq(othersBusiness[0].name, "id"))) continue;

    const [left, right] = ids;
    const leftRef  = findEntityByIdColumnName(spec.entities, left.name);
    const rightRef = findEntityByIdColumnName(spec.entities, right.name);
    if (!leftRef || !rightRef || eq(leftRef.name, rightRef.name)) continue;

    linkCandidates.push({ e, left, right, leftRef, rightRef });
  }

  for (const c of linkCandidates) {
    // делаем явную link-таблицу "пустой" — создадим её в блоке связей
    c.e.attributes = [];

    // удалим любые 1:N к/от этой таблицы
    spec.relationships = spec.relationships.filter(r =>
      !(r.type !== "many-to-many" && (eq(r.from, c.e.name) || eq(r.to, c.e.name)))
    );

    // добавим M:M
    const exists = spec.relationships.some(r =>
      r.type === "many-to-many" &&
      ((eq(r.from, c.leftRef.name) && eq(r.to, c.rightRef.name)) || (eq(r.from, c.rightRef.name) && eq(r.to, c.leftRef.name))) &&
      r.link?.tableName && eq(r.link.tableName, c.e.name)
    );
    if (!exists) {
      spec.relationships.push({
        type: "many-to-many",
        from: c.leftRef.name,
        to: c.rightRef.name,
        link: {
          tableName: c.e.name,
          leftColumn: c.left.name,
          rightColumn: c.right.name,
          compositePrimaryKey: true,
          onDelete: "CASCADE",
          index: true
        }
      });
    }
  }
}

function fixPaymentRefund(spec, maps) {
  const payment = spec.entities.find(e => /payment/i.test(e.name));
  const refund  = spec.entities.find(e => /refund/i.test(e.name));
  if (!payment || !refund) return;

  // Нужна 1:1 Payment -> Refund (FK в Refund: payment_id UNIQUE)
  spec.relationships = spec.relationships.filter(r => {
    if (r.type === "one-to-one" && eq(r.from, refund.name) && eq(r.to, payment.name)) return false;
    return true;
  });
  payment.attributes = payment.attributes.filter(a => !eq(a.name, "refund_id"));

  const has = spec.relationships.some(r => r.type === "one-to-one" && eq(r.from, payment.name) && eq(r.to, refund.name));
  if (!has) {
    const pk = pickPK(payment.attributes) || { name: "id", type: "UUID" };
    spec.relationships.push({
      type: "one-to-one",
      from: payment.name,
      to: refund.name,
      fk: { column: fkColName(payment.name, pk.name), type: pk.type || "UUID", unique: true, notNull: true, onDelete: "NO ACTION", index: false }
    });
  } else {
    for (const r of spec.relationships) {
      if (r.type === "one-to-one" && eq(r.from, payment.name) && eq(r.to, refund.name)) {
        const pk = pickPK(payment.attributes) || { name: "id", type: "UUID" };
        r.fk = r.fk || {};
        r.fk.column = fkColName(payment.name, pk.name);
        r.fk.type   = r.fk.type || pk.type || "UUID";
        r.fk.unique = true;
        r.fk.notNull = r.fk.notNull !== false;
        if (!r.fk.onDelete) r.fk.onDelete = "NO ACTION";
        r.fk.index = false;
      }
    }
  }
}

function fixUserEnrollment(spec, maps) {
  const user = spec.entities.find(e => /user$/i.test(e.name));
  const enroll = spec.entities.find(e => /enroll/i.test(e.name));
  if (!user || !enroll) return;

  spec.relationships = spec.relationships.filter(r => {
    if (r.type === "one-to-one" && (eq(r.from, enroll.name) && eq(r.to, user.name))) return false;
    return true;
  });
  user.attributes = user.attributes.filter(a => !eq(a.name, "enrollment_id"));

  const fkName = hasAttr(enroll, "student_id") ? "student_id" : "user_id";
  const exists = spec.relationships.some(r =>
    r.type === "one-to-many" && eq(r.from, user.name) && eq(r.to, enroll.name)
  );
  const userPk = pickPK(user.attributes) || { name: "id", type: "UUID" };
  if (!exists) {
    spec.relationships.push({
      type: "one-to-many",
      from: user.name,
      to: enroll.name,
      fk: { column: fkName, type: userPk.type || "UUID", notNull: true, onDelete: "CASCADE", index: true }
    });
  } else {
    for (const r of spec.relationships) {
      if (r.type === "one-to-many" && eq(r.from, user.name) && eq(r.to, enroll.name)) {
        r.fk = r.fk || {};
        r.fk.column = r.fk.column || fkName;
        r.fk.type   = r.fk.type || userPk.type || "UUID";
        r.fk.notNull = r.fk.notNull !== false;
        if (!r.fk.onDelete) r.fk.onDelete = "CASCADE";
        r.fk.index = r.fk.index !== false;
      }
    }
  }
}

function preferOneToNOverMMForLessonComment(spec) {
  const lesson = spec.entities.find(e => /lesson/i.test(e.name));
  const comment = spec.entities.find(e => /comment/i.test(e.name));
  if (!lesson || !comment) return;

  const hasOneToN = spec.relationships.some(r =>
    r.type === "one-to-many" && eq(r.from, lesson.name) && eq(r.to, comment.name)
  );
  if (!hasOneToN) return;

  spec.relationships = spec.relationships.filter(r =>
    !(r.type === "many-to-many" && ((eq(r.from, lesson.name) && eq(r.to, comment.name)) || (eq(r.from, comment.name) && eq(r.to, lesson.name))))
  );

  const wrongs = new Set(["lesson_material_id", "comment_id"]);
  lesson.attributes = lesson.attributes.filter(a => !wrongs.has(a.name.toLowerCase()));
}

function stripWrongForeignAttrs(spec) {
  const pairFix = (parentName, childName, wrongFkOnParent) => {
    const hasCorrectRel = spec.relationships.some(r =>
      r.type === "one-to-many" && eq(r.from, parentName) && eq(r.to, childName)
    );
    const parent = spec.entities.find(e => eq(e.name, parentName));
    if (hasCorrectRel && parent && hasAttr(parent, wrongFkOnParent)) {
      parent.attributes = parent.attributes.filter(a => !eq(a.name, wrongFkOnParent));
    }
  };

  pairFix("Course", "Lesson", "lesson_id");
  pairFix("Lesson", "LessonMaterial", "lesson_material_id");

  const payment = spec.entities.find(e => /payment/i.test(e.name));
  if (payment) payment.attributes = payment.attributes.filter(a => !eq(a.name, "refund_id"));
}

function deduplicateRelationships(spec) {
  const seen = new Set();
  const out = [];
  for (const r of spec.relationships) {
    const key =
      r.type === "many-to-many"
        ? `mm|${lc(r.from)}|${lc(r.to)}|${r.link?.tableName || ""}|${r.link?.leftColumn || ""}|${r.link?.rightColumn || ""}`
        : `o2x|${lc(r.type)}|${lc(r.from)}|${lc(r.to)}|${r.fk?.column || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  spec.relationships = out;
}

/** NEW: self-link по parent_*_id (если LLM не добавила связь) */
function ensureSelfLinkByParentId(spec) {
  for (const e of spec.entities) {
    const parentAttr = (e.attributes || []).find(a => /^parent_.*_id$/i.test(a.name));
    if (!parentAttr) continue;
    const hasSelf = spec.relationships.some(r => (r.type === "one-to-many" || r.type === "one-to-one") && eq(r.from, e.name) && eq(r.to, e.name));
    if (hasSelf) continue;

    const pk = pickPK(e.attributes) || { name: "id", type: "UUID" };
    spec.relationships.push({
      type: "one-to-many",
      from: e.name,
      to: e.name,
      fk: {
        column: parentAttr.name,
        type: pk.type || "UUID",
        notNull: false,        // корневые записи допускают NULL
        unique: undefined,
        onDelete: "CASCADE",
        onUpdate: undefined,
        index: true
      }
    });
  }
}

/** NEW: пометка несвязанных, но непустых сущностей (диагностический хинт; не влияет на SQL) */
function markLonelyNonEmptyEntities(spec) {
  const involved = new Set();
  for (const r of spec.relationships) { involved.add(r.from); involved.add(r.to); }
  for (const e of spec.entities) {
    if ((e.attributes || []).length > 0 && !involved.has(e.name)) {
      e.__hint = e.__hint || [];
      e.__hint.push("ENTITY_WITHOUT_RELATION");
    }
  }
}

export function repairSpec(inputSpec) {
  const spec = normalizeSpec(inputSpec);
  const maps = buildNameMaps(spec.entities);

  // 0) PK для всех
  ensurePKs(spec.entities);

  // 1) Авто-связи по *_id (если модель забыла указать связь)
  autoRelationsFromIdColumns(spec, maps);

  // 2) Нормализация направления 1:N / 1:1 по названию FK
  normalizeOneToXDirection(spec, maps);

  // 3) Выявить и конвертировать явные link-таблицы (две *_id ⇒ M:M)
  detectAndConvertLinkTables(spec, maps);

  // 4) Спец-фиксы
  fixPaymentRefund(spec, maps);             // Refund должен ссылаться на Payment (1:1), FK в Refund
  fixUserEnrollment(spec, maps);            // User → Enrollment (1:N), не 1:1
  preferOneToNOverMMForLessonComment(spec); // Lesson–Comment: держим 1:N

  // 4.1) NEW — добавить self-link по parent_*_id
  ensureSelfLinkByParentId(spec);

  // 5) Если есть и 1:N и M:M между одной парой — оставляем 1:N
  removeMMIfOneToNExists(spec, "Lesson", "Comment");

  // 6) Удаление заведомо неверных *_id на «родителях»
  stripWrongForeignAttrs(spec);

  // 7) Дедупликация
  deduplicateRelationships(spec);

  // 8) NEW — диагностическая пометка «несвязанная, но непустая»
  markLonelyNonEmptyEntities(spec);

  return spec;
}

//
// ===================== РАЗВОРОТ в формат приложения + АВТО-РАСКЛАДКА =====================
//
function ensureAttrIds(attrs) {
  return (attrs || []).map(a => ({
    id: mkId(),
    name: sanitizeName(a.name || "column"),
    type: a.type || "UUID",
    isPrimaryKey: !!a.primaryKey,
    unique: !!a.unique,
    notNull: a.notNull === undefined ? undefined : !!a.notNull,
  }));
}
function autoLayout(entities) {
  // простая сетка 4 колонки, шаг ~320x220
  const COLS = 4;
  const STEP_X = 320;
  const STEP_Y = 220;
  entities.forEach((e, i) => {
    if (typeof e.x === "number" && typeof e.y === "number") return;
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    e.x = col * STEP_X + 40;
    e.y = row * STEP_Y + 40;
  });
}

export function specToAppFormat(specInput) {
  const spec = repairSpec(specInput);

  // 1) Сущности
  const nameToId = new Map();
  const entities = spec.entities.map((e) => {
    const id = mkId();
    nameToId.set(e.name, id);
    return {
      id,
      name: e.name,
      x: typeof e.x === "number" ? e.x : undefined,
      y: typeof e.y === "number" ? e.y : undefined,
      attributes: ensureAttrIds(e.attributes || []),
    };
  });

  // 2) Связи
  const relationships = [];
  for (const r of spec.relationships) {
    const fromId = nameToId.get(r.from);
    const toId   = nameToId.get(r.to);
    if (!fromId || !toId) continue;

    const rel = {
      id: mkId(),
      from: fromId,
      to: toId,
      type: r.type,
    };

    if (r.type === "one-to-one" || r.type === "one-to-many") {
      if (r.fk) {
        rel.fk = {
          column: r.fk.column,
          type: r.fk.type,
          notNull: r.fk.notNull !== false,
          unique: r.fk.unique === true,
          onDelete: r.fk.onDelete || "CASCADE",
          onUpdate: r.fk.onUpdate,
          index: r.fk.index !== false,
        };
      }
    } else if (r.type === "many-to-many") {
      if (r.link) {
        rel.link = {
          tableName: r.link.tableName,
          leftColumn: r.link.leftColumn,
          rightColumn: r.link.rightColumn,
          compositePrimaryKey: r.link.compositePrimaryKey !== false,
          onDelete: r.link.onDelete || "CASCADE",
          onUpdate: r.link.onUpdate,
          index: r.link.index !== false,
        };
      }
    }

    relationships.push(rel);
  }

  // 3) Авто-раскладка (если нет x/y)
  autoLayout(entities);

  return { entities, relationships };
}
