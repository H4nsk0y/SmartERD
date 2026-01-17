// backend/src/er-generate.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseModelJson, repairSpec, specToAppFormat } from "./er-generate.js";

/* ----------------- helpers ----------------- */
const A = (name, type = "UUID", extra = {}) => ({ name, type, ...extra });
const E = (name, attributes = []) => ({ name, attributes });
const R = (type, from, to, extra = {}) => ({ type, from, to, ...extra });

const findEntity = (spec, name) =>
  spec.entities.find((e) => String(e.name).toLowerCase() === String(name).toLowerCase());

const findRel = (spec, type, from, to) =>
  spec.relationships.find(
    (r) =>
      r.type === type &&
      String(r.from).toLowerCase() === String(from).toLowerCase() &&
      String(r.to).toLowerCase() === String(to).toLowerCase()
  );

const hasRel = (spec, type, from, to) => !!findRel(spec, type, from, to);

const relsBetween = (spec, a, b) =>
  spec.relationships.filter(
    (r) =>
      (String(r.from).toLowerCase() === String(a).toLowerCase() &&
        String(r.to).toLowerCase() === String(b).toLowerCase()) ||
      (String(r.from).toLowerCase() === String(b).toLowerCase() &&
        String(r.to).toLowerCase() === String(a).toLowerCase())
  );

/* ----------------- parseModelJson ----------------- */
describe("er-generate: parseModelJson", () => {
  it("парсит обычный JSON без обёрток", () => {
    const txt = `{"entities":[],"relationships":[]}`;
    const out = parseModelJson(txt);
    expect(out).toEqual({ entities: [], relationships: [] });
  });

  it("парсит JSON из fenced ```json блока", () => {
    const txt = `
      blah blah
      \`\`\`json
      {"entities":[{"name":"User","attributes":[]}],"relationships":[]}
      \`\`\`
      trailing
    `;
    const out = parseModelJson(txt);
    expect(out.entities[0].name).toBe("User");
  });

  it("парсит JSON по первому '{' и последнему '}' (если есть лишний текст)", () => {
    const txt = `prefix { "entities": [], "relationships": [] } suffix`;
    const out = parseModelJson(txt);
    expect(out.relationships).toEqual([]);
  });

  it("кидает ошибку если JSON не извлечь", () => {
    expect(() => parseModelJson("not a json")).toThrow(/Failed to parse JSON/i);
  });
});

/* ----------------- repairSpec (core heuristics) ----------------- */
describe("er-generate: repairSpec", () => {
  it("ensurePKs: добавляет id UUID PK если PK отсутствует", () => {
    const spec = { entities: [E("User", [A("email", "TEXT")])], relationships: [] };
    const out = repairSpec(spec);

    const user = findEntity(out, "User");
    expect(user).toBeTruthy();

    const pk = user.attributes.find((a) => a.primaryKey === true);
    expect(pk?.name.toLowerCase()).toBe("id");
    expect(String(pk?.type).toUpperCase()).toContain("UUID");
  });

  it("autoRelationsFromIdColumns: по user_id создаёт 1:N User -> Order (FK в Order)", () => {
    const spec = {
      entities: [
        E("User", [A("id", "UUID", { primaryKey: true })]),
        E("Order", [A("id", "UUID", { primaryKey: true }), A("user_id", "UUID")]),
      ],
      relationships: [],
    };

    const out = repairSpec(spec);

    const r = findRel(out, "one-to-many", "User", "Order");
    expect(r).toBeTruthy();
    expect(r.fk?.column).toBe("user_id");
    expect(String(r.fk?.type).toUpperCase()).toContain("UUID");
    expect(r.fk?.onDelete).toBe("CASCADE");
    expect(r.fk?.index).toBe(true);
  });

  it("normalizeOneToXDirection: разворачивает неверное направление по имени FK (category_id => Category -> Product)", () => {
    const spec = {
      entities: [
        E("Category", [A("id", "UUID", { primaryKey: true })]),
        E("Product", [A("id", "UUID", { primaryKey: true })]),
      ],
      relationships: [
        // неверно: from Product to Category, но FK "category_id" явно про Category и должен быть в Product (to)
        R("one-to-many", "Product", "Category", { fk: { column: "category_id" } }),
      ],
    };

    const out = repairSpec(spec);

    expect(hasRel(out, "one-to-many", "Category", "Product")).toBe(true);
    const r = findRel(out, "one-to-many", "Category", "Product");
    expect(r.fk?.column).toBe("category_id");
  });

  it("detectAndConvertLinkTables: PostTag(post_id,tag_id,created_at) -> M:N Post<->Tag + очищает атрибуты PostTag и убирает 1:N к ней", () => {
    const spec = {
      entities: [
        E("Post", [A("id", "UUID", { primaryKey: true })]),
        E("Tag", [A("id", "UUID", { primaryKey: true })]),
        E("PostTag", [A("post_id", "UUID"), A("tag_id", "UUID"), A("created_at", "TIMESTAMP")]),
      ],
      relationships: [
        R("one-to-many", "Post", "PostTag", { fk: { column: "post_id" } }),
        R("one-to-many", "Tag", "PostTag", { fk: { column: "tag_id" } }),
      ],
    };

    const out = repairSpec(spec);

    // 1:N к PostTag должны исчезнуть
    expect(hasRel(out, "one-to-many", "Post", "PostTag")).toBe(false);
    expect(hasRel(out, "one-to-many", "Tag", "PostTag")).toBe(false);

    // Должна появиться M:N
    const mm = out.relationships.find(
      (r) =>
        r.type === "many-to-many" &&
        ((r.from === "Post" && r.to === "Tag") || (r.from === "Tag" && r.to === "Post")) &&
        r.link?.tableName === "PostTag"
    );
    expect(mm).toBeTruthy();
    expect(mm.link.leftColumn).toBe("post_id");
    expect(mm.link.rightColumn).toBe("tag_id");
    expect(mm.link.compositePrimaryKey).toBe(true);

    // PostTag должен стать "пустым"
    const postTag = findEntity(out, "PostTag");
    expect(postTag.attributes).toEqual([]);
  });

  it("fixPaymentRefund: убирает refund_id из Payment и создаёт 1:1 Payment -> Refund (FK payment_id UNIQUE, NO ACTION)", () => {
    const spec = {
      entities: [
        E("Payment", [A("id", "UUID", { primaryKey: true }), A("refund_id", "UUID")]),
        E("Refund", [A("id", "UUID", { primaryKey: true })]),
      ],
      relationships: [],
    };

    const out = repairSpec(spec);

    const payment = findEntity(out, "Payment");
    expect(payment.attributes.some((a) => a.name.toLowerCase() === "refund_id")).toBe(false);

    const r = findRel(out, "one-to-one", "Payment", "Refund");
    expect(r).toBeTruthy();
    expect(r.fk?.column).toBe("payment_id");
    expect(r.fk?.unique).toBe(true);
    expect(r.fk?.index).toBe(false);
    expect(r.fk?.onDelete).toBe("NO ACTION");
  });

  it("fixUserEnrollment: гарантирует 1:N User -> Enrollment (не 1:1) и убирает enrollment_id из User; FK student_id если есть", () => {
    const spec = {
      entities: [
        E("User", [A("id", "UUID", { primaryKey: true }), A("enrollment_id", "UUID")]),
        E("Enrollment", [A("id", "UUID", { primaryKey: true }), A("student_id", "UUID")]),
      ],
      relationships: [
        // ошибочная связь (часто LLM делает 1:1)
        R("one-to-one", "Enrollment", "User", { fk: { column: "user_id", unique: true } }),
      ],
    };

    const out = repairSpec(spec);

    const user = findEntity(out, "User");
    expect(user.attributes.some((a) => a.name.toLowerCase() === "enrollment_id")).toBe(false);

    expect(hasRel(out, "one-to-one", "Enrollment", "User")).toBe(false);
    const r = findRel(out, "one-to-many", "User", "Enrollment");
    expect(r).toBeTruthy();
    expect(r.fk?.column).toBe("student_id");
    expect(r.fk?.onDelete).toBe("CASCADE");
    expect(r.fk?.index).toBe(true);
  });

  it("ensureSelfLinkByParentId: parent_category_id добавляет self 1:N Category->Category с notNull=false", () => {
    const spec = {
      entities: [E("Category", [A("id", "UUID", { primaryKey: true }), A("parent_category_id", "UUID")])],
      relationships: [],
    };

    const out = repairSpec(spec);

    const r = findRel(out, "one-to-many", "Category", "Category");
    expect(r).toBeTruthy();
    expect(r.fk?.column).toBe("parent_category_id");
    expect(r.fk?.notNull).toBe(false);
    expect(r.fk?.index).toBe(true);
  });

  it("removeMMIfOneToNExists: если есть Lesson->Comment (1:N), удаляет Lesson<->Comment (M:N)", () => {
    const spec = {
      entities: [
        E("Lesson", [A("id", "UUID", { primaryKey: true })]),
        E("Comment", [A("id", "UUID", { primaryKey: true }), A("lesson_id", "UUID")]),
      ],
      relationships: [
        R("one-to-many", "Lesson", "Comment", { fk: { column: "lesson_id" } }),
        R("many-to-many", "Lesson", "Comment", {
          link: { tableName: "LessonComment", leftColumn: "lesson_id", rightColumn: "comment_id" },
        }),
      ],
    };

    const out = repairSpec(spec);

    expect(hasRel(out, "one-to-many", "Lesson", "Comment")).toBe(true);
    expect(out.relationships.some((r) => r.type === "many-to-many" && relsBetween(out, "Lesson", "Comment").includes(r))).toBe(false);
  });

  it("stripWrongForeignAttrs: если Course->Lesson 1:N существует, удаляет lesson_id из Course", () => {
    const spec = {
      entities: [
        E("Course", [A("id", "UUID", { primaryKey: true }), A("lesson_id", "UUID")]),
        E("Lesson", [A("id", "UUID", { primaryKey: true }), A("course_id", "UUID")]),
      ],
      relationships: [R("one-to-many", "Course", "Lesson", { fk: { column: "course_id" } })],
    };

    const out = repairSpec(spec);

    const course = findEntity(out, "Course");
    expect(course.attributes.some((a) => a.name.toLowerCase() === "lesson_id")).toBe(false);
  });

  it("deduplicateRelationships: убирает дубликаты связей", () => {
    const spec = {
      entities: [
        E("User", [A("id", "UUID", { primaryKey: true })]),
        E("Post", [A("id", "UUID", { primaryKey: true }), A("user_id", "UUID")]),
      ],
      relationships: [
        R("one-to-many", "User", "Post", { fk: { column: "user_id" } }),
        R("one-to-many", "User", "Post", { fk: { column: "user_id" } }), // дубль
      ],
    };

    const out = repairSpec(spec);
    const count = out.relationships.filter((r) => r.type === "one-to-many" && r.from === "User" && r.to === "Post").length;
    expect(count).toBe(1);
  });

  it("markLonelyNonEmptyEntities: непустая сущность без связей получает __hint ENTITY_WITHOUT_RELATION", () => {
    const spec = {
      entities: [
        E("Lonely", [A("id", "UUID", { primaryKey: true }), A("name", "TEXT")]),
        E("User", [A("id", "UUID", { primaryKey: true })]),
      ],
      relationships: [],
    };

    const out = repairSpec(spec);
    const lonely = findEntity(out, "Lonely");
    expect(Array.isArray(lonely.__hint)).toBe(true);
    expect(lonely.__hint).toContain("ENTITY_WITHOUT_RELATION");
  });
});

/* ----------------- specToAppFormat ----------------- */
describe("er-generate: specToAppFormat", () => {
  const randomSeq = [0.111, 0.222, 0.333, 0.444, 0.555, 0.666];

  beforeEach(() => {
    let i = 0;
    vi.spyOn(Math, "random").mockImplementation(() => {
      const v = randomSeq[i % randomSeq.length];
      i += 1;
      return v;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("возвращает entities/relationships в формате фронта + autoLayout выставляет x/y если их нет", () => {
    const input = {
      entities: [
        { name: "User", attributes: [{ name: "id", type: "UUID", primaryKey: true }] },
        { name: "Post", attributes: [{ name: "id", type: "UUID", primaryKey: true }, { name: "user_id", type: "UUID" }] },
      ],
      relationships: [{ type: "one-to-many", from: "User", to: "Post", fk: { column: "user_id" } }],
    };

    const out = specToAppFormat(input);

    expect(Array.isArray(out.entities)).toBe(true);
    expect(Array.isArray(out.relationships)).toBe(true);
    expect(out.entities).toHaveLength(2);
    expect(out.relationships).toHaveLength(1);

    // autoLayout: для первых двух сущностей (i=0,1) — (40,40) и (360,40)
    expect(typeof out.entities[0].x).toBe("number");
    expect(typeof out.entities[0].y).toBe("number");
    expect(out.entities[0].x).toBe(40);
    expect(out.entities[0].y).toBe(40);

    expect(out.entities[1].x).toBe(360);
    expect(out.entities[1].y).toBe(40);

    // связи должны ссылаться на id сущностей, а не имена
    const rel = out.relationships[0];
    expect(typeof rel.from).toBe("string");
    expect(typeof rel.to).toBe("string");
    expect(rel.from).not.toBe("User");
    expect(rel.to).not.toBe("Post");
    expect(rel.fk?.column).toBe("user_id");

    // атрибуты должны иметь id и isPrimaryKey
    const user = out.entities.find((e) => e.name === "User");
    expect(user.attributes[0]).toHaveProperty("id");
    expect(user.attributes[0]).toHaveProperty("isPrimaryKey");
  });
});
