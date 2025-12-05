// filepath: frontend/src/utils/tests/validateModel.test.ts
// @ts-nocheck
/// <reference types="vitest" />
/// <reference types="vite/client" />

import { describe, it, expect, vi } from "vitest";
import { attr, ent, rel } from "./helpers";
import { validateModel } from "../validateModel";

/* ===========================================
   assertion
=========================================== */

/* -------------------------------------------
   Тест 1: Дублирующиеся имена сущностей
   Проверяем DUP_ENTITY_NAME
   Assertion методы: toBe
------------------------------------------- */
describe("validateModel: DUP_ENTITY_NAME", () => {
  it("негатив: повтор User/user → DUP_ENTITY_NAME", () => {
    const e1 = ent("User");
    const e2 = ent("user");
    const res = validateModel([e1, e2], []);
    expect(res.issues.some(i => i.code === "DUP_ENTITY_NAME")).toBe(true);
    expect(res.ok).toBe(false);
  });

  it("позитив: разные имена → без DUP_ENTITY_NAME", () => {
    const e1 = ent("User");
    const e2 = ent("Post");
    const res = validateModel([e1, e2], []);
    expect(res.issues.some(i => i.code === "DUP_ENTITY_NAME")).toBe(false);
    expect(res.ok).toBe(true);
  });
});

/* -------------------------------------------
   Тест 2: Дублирующиеся атрибуты
   Проверяем DUP_ATTR_NAME
   Assertion методы: toBe
------------------------------------------- */
describe("validateModel: DUP_ATTR_NAME", () => {
  it("негатив: два одинаковых атрибута → DUP_ATTR_NAME", () => {
    const user = ent("User", [attr("email"), attr("email")]);
    const res = validateModel([user], []);
    expect(res.issues.some(i => i.code === "DUP_ATTR_NAME")).toBe(true);
    expect(res.ok).toBe(false);
  });

  it("позитив: разные атрибуты → без DUP_ATTR_NAME", () => {
    const user = ent("User", [attr("email"), attr("username")]);
    const res = validateModel([user], []);
    expect(res.issues.some(i => i.code === "DUP_ATTR_NAME")).toBe(false);
    expect(res.ok).toBe(true);
  });
});

/* -------------------------------------------
   Тест 3: Имена сущностей, требующие кавычек
   Проверяем IDENT_NEEDS_QUOTING_ENTITY
   Assertion методы: toEqual, toHaveLength
------------------------------------------- */
describe("validateModel: IDENT_NEEDS_QUOTING_ENTITY", () => {
  it("негатив: 3 «плохих» входа → но только 1 реально невалидный после sanitize", () => {
    const bad1 = ent("User Profile"); // → User_Profile (валидно)
    const bad2 = ent("1User");        // → 1User (НЕвалидно, нач. цифра)
    const bad3 = ent("user-name");    // → user_name (валидно)
    const res = validateModel([bad1, bad2, bad3], []);
    const warnings = res.issues.filter(i => i.code === "IDENT_NEEDS_QUOTING_ENTITY");
    expect(warnings.length).toEqual(1);
    expect(res.ok).toEqual(true);
  });

  it("позитив: корректные имена → 0 warning", () => {
    const a = ent("User");
    const b = ent("OrderItem_1");
    const res = validateModel([a, b], []);
    expect(res.issues.filter(i => i.code === "IDENT_NEEDS_QUOTING_ENTITY")).toHaveLength(0);
    expect(res.ok).toEqual(true);
  });
});

/* -------------------------------------------
   Тест 4: Имена столбцов, требующие кавычек
   Проверяем IDENT_NEEDS_QUOTING_COLUMN
   Assertion методы: toHaveLength, toBe
------------------------------------------- */
describe("validateModel: IDENT_NEEDS_QUOTING_COLUMN", () => {
  it("негатив: невалидные после sanitize (но уникальные) → только warnings", () => {
    const user = ent("User", [
      attr("1email"), // → "1email"
      attr("2-name"), // → "2_name"
      attr("3 id"),   // → "3_id"
    ]);
    const res = validateModel([user], []);
    const warnings = res.issues.filter(i => i.code === "IDENT_NEEDS_QUOTING_COLUMN");
    expect(warnings).toHaveLength(3);
    expect(res.ok).toBe(true);
  });

  it("позитив: корректные имена → без warnings", () => {
    const user = ent("User", [attr("email"), attr("username")]);
    const res = validateModel([user], []);
    expect(res.issues.filter(i => i.code === "IDENT_NEEDS_QUOTING_COLUMN")).toHaveLength(0);
    expect(res.ok).toBe(true);
  });
});

/* -------------------------------------------
   Тест 5: Зарезервированные слова
   Проверяем RESERVED_WORD_ENTITY / RESERVED_WORD_COLUMN
   Assertion методы: toBe
------------------------------------------- */
describe("validateModel: RESERVED words", () => {
  it("RESERVED_WORD_ENTITY: имя таблицы select", () => {
    const e = ent("select");
    const res = validateModel([e], []);
    expect(res.issues.some(i => i.code === "RESERVED_WORD_ENTITY")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("RESERVED_WORD_COLUMN: имя столбца select", () => {
    const e = ent("User", [attr("select")]);
    const res = validateModel([e], []);
    expect(res.issues.some(i => i.code === "RESERVED_WORD_COLUMN")).toBe(true);
    expect(res.ok).toBe(true);
  });
});

/* -------------------------------------------
   Тест 6: Пустые/одинокие сущности и PK —
   коды ошибок + диагностические поля (после Stryker)
   Проверяем EMPTY_ENTITY_SKIPPED / EMPTY_ENTITY_WITH_RELS /
   MISSING_PK / LONELY_ENTITY
   Assertion методы: toHaveLength, toContain, toBeDefined, toBe
------------------------------------------- */
describe("validateModel: пустые/одинокие/PK", () => {
  it("EMPTY_ENTITY_SKIPPED: пустая и без связей", () => {
    const e = ent("Empty");
    const res = validateModel([e], []);
    expect(res.issues.find(i => i.code === "EMPTY_ENTITY_SKIPPED")).toBeDefined();
    expect(res.issues.filter(i => i.code === "EMPTY_ENTITY_SKIPPED")).toHaveLength(1);
    expect(res.ok).toBe(true);
  });

  it("EMPTY_ENTITY_WITH_RELS: пустая участвует в связи (как to)", () => {
    const a = ent("A"); // пустая
    const b = ent("B", [attr("id", "UUID", true)]);
    const r = rel(b, a, "one-to-many");
    const res = validateModel([a, b], [r]);
    expect(res.issues.some(i => i.code === "EMPTY_ENTITY_WITH_RELS")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("MISSING_PK: нет явного PK → surrogate PK и осмысленная диагностика", () => {
    const u = ent("User", [attr("email", "TEXT")]);
    const res = validateModel([u], []);

    const issue = res.issues.find(i => i.code === "MISSING_PK");
    expect(issue).toBeDefined();

    // текст сообщения не пустой
    expect((issue!.message ?? "").trim()).not.toBe("");

    // есть подсказка, как исправить
    expect(((issue as any).suggestion ?? "").trim()).not.toBe("");

    // where содержит хотя бы один id сущности
    expect(((issue as any).where ?? []).length).toBeGreaterThan(0);

    // это не фатальная ошибка
    expect(res.ok).toBe(true);
  });

  it("LONELY_ENTITY: сущность с атрибутами без связей → warning с подсказкой", () => {
    const user = ent("User", [attr("email")]);
    const res = validateModel([user], []);

    const issue = res.issues.find(i => i.code === "LONELY_ENTITY");
    expect(issue).toBeDefined();

    // текст ошибки есть
    expect(issue!.message).toBeTruthy();

    // подсказка есть
    expect((issue as any).suggestion).toBeTruthy();

    // where ссылается хотя бы на одну сущность
    expect(((issue as any).where ?? []).length).toBeGreaterThan(0);

    expect(res.ok).toBe(true);
  });
});

/* -------------------------------------------
   Тест 7: Self-link подсказки и ошибки —
   коды и текст диагностик (после Stryker)
   Проверяем MISSING_SELF_LINK / SELF_FK_TYPE_MISMATCH
   Assertion методы: toBe, toBeDefined, toMatch
------------------------------------------- */
describe("validateModel: self-link", () => {
  it("MISSING_SELF_LINK: есть parent_*_id, но связи нет → warning с подсказкой", () => {
    const cat = ent("Category", [attr("parent_category_id", "UUID")]);
    const res = validateModel([cat], []);

    const issue = res.issues.find(i => i.code === "MISSING_SELF_LINK");
    expect(issue).toBeDefined();

    // текст ошибки и подсказка есть
    expect(issue!.message).toBeTruthy();
    expect((issue as any).suggestion).toBeTruthy();

    // where содержит id сущности Category
    expect(((issue as any).where ?? []).length).toBeGreaterThan(0);

    expect(res.ok).toBe(true);
  });

  it("SELF_FK_TYPE_MISMATCH: FK self ≠ PK → сообщение упоминает parent_node_id", () => {
    const E = ent("Node", [
      attr("node_id", "UUID", true),
      attr("parent_node_id", "INT"),
    ]);
    const r = rel(E, E, "one-to-many");
    const res = validateModel([E], [r]);

    const issue = res.issues.find(i => i.code === "SELF_FK_TYPE_MISMATCH");
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/parent_node_id/i);

    expect(res.ok).toBe(false);
  });
});

/* -------------------------------------------
   Тест 8: 1:N и 1:1: типы FK, автодобавления
   и текст диагностик (после Stryker)
   Проверяем FK_TYPE_MISMATCH / FK_WILL_BE_ADDED / ONE_TO_ONE_UNIQUE
   Assertion методы: toBe, toBeDefined, toMatch
------------------------------------------- */
describe("validateModel: 1:N / 1:1", () => {
  it("FK_TYPE_MISMATCH: тип FK ≠ тип PK", () => {
    const A = ent("Author", [attr("id", "UUID", true)]);
    const B = ent("Book", [attr("author_id", "INT")]); // неверный тип
    const r = rel(A, B, "one-to-many");
    const res = validateModel([A, B], [r]);
    expect(res.issues.some(i => i.code === "FK_TYPE_MISMATCH")).toBe(true);
    expect(res.ok).toBe(false);
  });

  it("FK_WILL_BE_ADDED: нет FK → добавится author_id (UUID) и будет warning", () => {
    // После Stryker: используем Author/Book чтобы заодно проверить текст сообщения
    const A = ent("Author", [attr("id", "UUID", true)]);
    const B = ent("Book", [attr("title", "TEXT")]); // нет FK
    const r = rel(A, B, "one-to-many");
    const res = validateModel([A, B], [r]);

    // 1) сама issue существует
    const issue = res.issues.find(i => i.code === "FK_WILL_BE_ADDED");
    expect(issue).toBeDefined();

    // 2) в message фигурирует имя авто-FK и тип
    expect(issue!.message).toMatch(/author_id/i);
    expect(issue!.message).toMatch(/UUID/i);

    expect(res.ok).toBe(true);
  });

  it("ONE_TO_ONE_UNIQUE: 1:1 добавит UNIQUE на FK и отражает это в сообщении", () => {
    const L = ent("Left", [attr("id", "UUID", true)]);
    const R = ent("Right", [attr("id", "UUID", true)]);
    const r = rel(L, R, "one-to-one");
    const res = validateModel([L, R], [r]);

    const issue = res.issues.find(i => i.code === "ONE_TO_ONE_UNIQUE");
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/unique/i);

    expect(res.ok).toBe(true);
  });

  it("корректная 1:N FK → нет FK_WILL_BE_ADDED и FK_TYPE_MISMATCH", () => {
    // Позитивный сценарий: всё правильно, лишних диагностик быть не должно
    const A = ent("Author", [attr("id", "UUID", true)]);
    const B = ent("Book", [attr("author_id", "UUID")]); // корректный тип и явный FK
    const r = rel(A, B, "one-to-many");
    const res = validateModel([A, B], [r]);

    expect(res.issues.some(i => i.code === "FK_WILL_BE_ADDED")).toBe(false);
    expect(res.issues.some(i => i.code === "FK_TYPE_MISMATCH")).toBe(false);
    expect(res.ok).toBe(true);
  });
});

/* -------------------------------------------
   Тест 9: 2 *_id без M:N
   Проверяем TWO_ID_TABLE_NO_MM
   Assertion методы: toBe
------------------------------------------- */
describe("validateModel: TWO_ID_TABLE_NO_MM", () => {
  it("таблица с двумя *_id и без связи N:M", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const role = ent("Role", [attr("id", "UUID", true)]);
    const linkLike = ent("UserRole", [attr("user_id", "UUID"), attr("role_id", "UUID")]);
    const res = validateModel([user, role, linkLike], []);
    expect(res.issues.some(i => i.code === "TWO_ID_TABLE_NO_MM")).toBe(true);
    expect(res.ok).toBe(true);
  });
});

/* -------------------------------------------
   Тест 10: N:M — неявная и явная линк таблица
   плюс текст диагностик (после Stryker)
   Проверяем IMPLICIT_LINK_TABLE / EMPTY_LINK_ENTITY /
   LINK_FK_WILL_BE_ADDED / LINK_COMPOSITE_PK
   Assertion методы: toBe, toBeDefined, toMatch
------------------------------------------- */
describe("validateModel: many-to-many", () => {
  it("IMPLICIT_LINK_TABLE: N:M без явной таблицы → auto link user_role_link(user_id, role_id)", () => {
    const U = ent("User", [attr("id", "UUID", true)]);
    const R = ent("Role", [attr("id", "UUID", true)]);
    const r = rel(U, R, "many-to-many");
    const res = validateModel([U, R], [r]);

    const issue = res.issues.find(i => i.code === "IMPLICIT_LINK_TABLE");
    expect(issue).toBeDefined();

    // текст сообщения содержит имя auto link-таблицы и оба FK
    expect(issue!.message).toMatch(/user_role_link/i);
    expect(issue!.message).toMatch(/user_id/i);
    expect(issue!.message).toMatch(/role_id/i);

    // дополнительно страхуемся от ложных 1:N/1:1 ошибок на M:N
    expect(res.issues.some(i => i.code === "FK_TYPE_MISMATCH")).toBe(false);
    expect(res.issues.some(i => i.code === "ONE_TO_ONE_UNIQUE")).toBe(false);
    expect(res.issues.some(i => i.code === "FK_WILL_BE_ADDED")).toBe(false);

    expect(res.ok).toBe(true);
  });

  it("EMPTY_LINK_ENTITY: явная линк-таблица пустая", () => {
    const A = ent("User", [attr("id", "UUID", true)]);
    const B = ent("Role", [attr("id", "UUID", true)]);
    const Link = ent("user_role", []); // пустая
    const r = rel(A, B, "many-to-many");
    const res = validateModel([A, B, Link], [r]);
    expect(res.issues.some(i => i.code === "EMPTY_LINK_ENTITY")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("LINK_FK_WILL_BE_ADDED: явная user_role без FK → в сообщении user_id и role_id", () => {
    const U = ent("User", [attr("id", "UUID", true)]);
    const R = ent("Role", [attr("id", "UUID", true)]);
    const Link = ent("user_role", [attr("note", "TEXT")]); // нет FK
    const r = rel(U, R, "many-to-many");
    const res = validateModel([U, R, Link], [r]);

    const issue = res.issues.find(i => i.code === "LINK_FK_WILL_BE_ADDED");
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/user_id/i);
    expect(issue!.message).toMatch(/role_id/i);

    expect(res.issues.some(i => i.code === "LINK_FK_WILL_BE_ADDED")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("LINK_COMPOSITE_PK: явная линк-таблица без PK → добавят композитный", () => {
    const A = ent("Tag", [attr("id", "UUID", true)]);
    const B = ent("Post", [attr("id", "UUID", true)]);
    const Link = ent("post_tag", [attr("meta", "TEXT")]); // нет PK
    const r = rel(A, B, "many-to-many");
    const res = validateModel([A, B, Link], [r]);
    expect(res.issues.some(i => i.code === "LINK_COMPOSITE_PK")).toBe(true);
    expect(res.ok).toBe(true);
  });
});

/* -------------------------------------------
   Тест 11: Эвристика имён линк-таблицы без связи
   Проверяем POTENTIAL_LINK_WITHOUT_REL
   Assertion методы: toBe
------------------------------------------- */
describe("validateModel: POTENTIAL_LINK_WITHOUT_REL", () => {
  it("имя выглядит как линк, но связи N:M нет", () => {
    const User = ent("User", [attr("id", "UUID", true)]);
    const Role = ent("Role", [attr("id", "UUID", true)]);
    const maybeLink = ent("user_role", [attr("note", "TEXT")]);
    const res = validateModel([User, Role, maybeLink], []);
    expect(res.issues.some(i => i.code === "POTENTIAL_LINK_WITHOUT_REL")).toBe(true);
    expect(res.ok).toBe(true);
  });
});

/* ===========================================
   assumption
=========================================== */

/* -------------------------------------------
   Тест A1: assumption — наличие атрибутов
   Assumption метод: skip()
------------------------------------------- */
describe("assumption: entity attributes", () => {
  it("выполняем тест только если есть атрибут", ({ skip }) => {
    const user = ent("User", [attr("email")]);
    if (user.attributes.length === 0) skip();
    const res = validateModel([user], []);
    expect(res.ok).toBe(true);
  });
});

/* -------------------------------------------
   Тест A2: assumption — тип связи one-to-many
   Assumption метод: skip()
------------------------------------------- */
describe("assumption: relation type one-to-many", () => {
  it("выполняем только для one-to-many", ({ skip }) => {
    const A = ent("A", [attr("id", "UUID", true)]);
    const B = ent("B", [attr("id", "UUID", true)]);
    const relation = rel(A, B, "one-to-many");
    if (relation.type !== "one-to-many") skip();
    const res = validateModel([A, B], [relation]);
    expect(res.ok).toBe(true);
  });
});

/* -------------------------------------------
   Тест A3: assumption — запускаем только если связь 1:1
   Assumption метод: it.runIf()
------------------------------------------- */
describe("assumption: runIf — только для one-to-one", () => {
  const A = ent("AA", [attr("id", "UUID", true)]);
  const B = ent("BB", [attr("id", "UUID", true)]);
  const r = rel(A, B, "one-to-one");
  it.runIf(r.type === "one-to-one")("выполняем только для 1:1", () => {
    const res = validateModel([A, B], [r]);
    expect(res.ok).toBe(true);
  });
});

/* ===========================================
   mocking
=========================================== */

/* -------------------------------------------
   Тест M1: vi.fn — демонстрация вызова
   Мокирование: vi.fn()
------------------------------------------- */
describe("mocking: vi.fn — sanitize demo", () => {
  it("вызывает мок-функцию", () => {
    const mockSanitize = vi.fn(() => "MOCKED");
    const e = {
      id: "1",
      name: "X",
      attributes: [{ id: "a1", name: "!!!", type: "TEXT", sanitize: mockSanitize }],
    };
    e.attributes.forEach(a => a.sanitize(a.name));
    expect(mockSanitize).toHaveBeenCalled();
  });
});

/* -------------------------------------------
   Тест M2: vi.spyOn — validateModel
   Мокирование: vi.spyOn()
------------------------------------------- */
import * as modelModule from "../validateModel";
describe("mocking: vi.spyOn — validateModel", () => {
  it("фиксируем вызов validateModel", () => {
    const spy = vi.spyOn(modelModule, "validateModel");
    const u = ent("User", [attr("email")]);
    modelModule.validateModel([u], []);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

/* -------------------------------------------
   Тест M3: vi.doMock — модульный мок helpers
   Мокирование: vi.doMock() + dynamic import (scoped)
------------------------------------------- */
describe("mocking: vi.doMock — полный мок helpers", () => {
  it("ent/attr/rel замоканы только внутри теста", async () => {
    vi.resetModules();
    vi.doMock("./helpers", () => {
      return {
        ent: vi.fn().mockReturnValue({ id: "X", name: "MockEntity", attributes: [] }),
        attr: vi.fn().mockReturnValue({ id: "A", name: "mock_attr" }),
        rel: vi.fn().mockReturnValue({ id: "R", from: "X", to: "X", type: "one-to-many" }),
      };
    });
    const mocked = await import("./helpers");
    const e = mocked.ent("User");
    const a = mocked.attr("email");
    const r = mocked.rel(e, e, "one-to-many");
    expect(e.name).toBe("MockEntity");
    expect(a.name).toBe("mock_attr");
    expect(r.type).toBe("one-to-many");
    vi.resetModules();
  });
});

/* ===========================================
   parameterized
=========================================== */

/* -------------------------------------------
   Тест P1: DUP_ENTITY_NAME — массив кейсов
   Параметризация: it.each([...])
------------------------------------------- */
describe("parameterized: DUP_ENTITY_NAME (it.each)", () => {
  it.each([
    ["разные имена User-Post", ["User", "Post"], false],
    ["повтор A-a", ["A", "a"], true],
    ["разные имена Alpha-Beta", ["Alpha", "Beta"], false],
  ])("%s", (_label, names, expectedHasError) => {
    const ents = names.map(n => ent(n));
    const res = validateModel(ents, []);
    const hasDup = res.issues.some(i => i.code === "DUP_ENTITY_NAME");
    expect(hasDup).toBe(expectedHasError);
  });
});

/* -------------------------------------------
   Тест P2: EMPTY_ENTITY_SKIPPED — табличная форма
   Параметризация: describe.each`...`
------------------------------------------- */
describe.each`
  label                           | attrs          | expectWarning
  ${"пустая сущность → warning"}  | ${[]}          | ${true}
  ${"с атрибутами → no warning"}  | ${[attr("x")]} | ${false}
`("parameterized: EMPTY_ENTITY_SKIPPED (describe.each) — $label", ({ attrs, expectWarning }) => {
  it("проверка", () => {
    const e = ent("TestEntity", attrs);
    const res = validateModel([e], []);
    const has = res.issues.some(i => i.code === "EMPTY_ENTITY_SKIPPED");
    expect(has).toBe(expectWarning);
  });
});

/* ===========================================
   matchers
=========================================== */

/* -------------------------------------------
   Тест W1: toMatchObject — DUP_ATTR_NAME
   Матчер: toMatchObject
------------------------------------------- */
describe("matcher: toMatchObject — DUP_ATTR_NAME", () => {
  it("issue содержит ожидаемые поля", () => {
    const user = ent("User", [attr("email"), attr("email")]);
    const res = validateModel([user], []);
    const issue = res.issues.find(i => i.code === "DUP_ATTR_NAME");
    expect(issue).toMatchObject({ code: "DUP_ATTR_NAME", level: "error" });
  });
});

/* -------------------------------------------
   Тест W2: toContainEqual — EMPTY_ENTITY_SKIPPED
   Матчер: toContainEqual
------------------------------------------- */
describe("matcher: toContainEqual — EMPTY_ENTITY_SKIPPED", () => {
  it("issues содержат короткий объект {code,level}", () => {
    const e = ent("Empty");
    const res = validateModel([e], []);
    const expectedIssue = { code: "EMPTY_ENTITY_SKIPPED", level: "warning" };
    const issuesShort = res.issues.map(i => ({ code: i.code, level: i.level }));
    expect(issuesShort).toContainEqual(expectedIssue);
  });
});


