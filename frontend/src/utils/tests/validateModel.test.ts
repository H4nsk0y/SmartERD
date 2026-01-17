// frontend/src/utils/tests/validateModel.test.ts
// @ts-nocheck
/// <reference types="vitest" />
/// <reference types="vite/client" />

import { describe, it, expect } from "vitest";
import { attr, ent, rel } from "./helpers";
import { validateModel } from "../validateModel";

function hasIssue(res: any, code: string) {
  return res.issues.some((i: any) => i.code === code);
}
function getIssue(res: any, code: string) {
  return res.issues.find((i: any) => i.code === code);
}

describe("validateModel — core rules", () => {
  it("INVALID_ENTITY_NAME: имя после sanitize пустое -> error, ok=false", () => {
    const bad = ent("!!!");
    const res = validateModel([bad], []);
    expect(hasIssue(res, "INVALID_ENTITY_NAME")).toBe(true);
    expect(res.ok).toBe(false);
  });

  it("DUP_ENTITY_NAME: дубликаты имён сущностей без учёта регистра -> error", () => {
    const a = ent("User");
    const b = ent("user");
    const res = validateModel([a, b], []);
    expect(hasIssue(res, "DUP_ENTITY_NAME")).toBe(true);
    expect(res.ok).toBe(false);
  });

  it("DUP_ATTR_NAME: дубликаты атрибутов в сущности -> error", () => {
    const u = ent("User", [attr("email"), attr("Email")]);
    const res = validateModel([u], []);
    expect(hasIssue(res, "DUP_ATTR_NAME")).toBe(true);
    expect(res.ok).toBe(false);
  });

  it("IDENT_NEEDS_QUOTING_ENTITY: имя таблицы требует кавычек (начинается с цифры) -> warning", () => {
    const e = ent("1User");
    const res = validateModel([e], []);
    expect(hasIssue(res, "IDENT_NEEDS_QUOTING_ENTITY")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("IDENT_NEEDS_QUOTING_COLUMN: имя столбца требует кавычек -> warning", () => {
    const e = ent("User", [attr("1email"), attr("2-name"), attr("3 id")]);
    const res = validateModel([e], []);
    expect(res.issues.filter((i: any) => i.code === "IDENT_NEEDS_QUOTING_COLUMN")).toHaveLength(
      3
    );
    expect(res.ok).toBe(true);
  });

  it("RESERVED_WORD_ENTITY / RESERVED_WORD_COLUMN: зарезервированные слова -> warning", () => {
    const t = ent("select");
    const c = ent("User", [attr("select")]);
    const res = validateModel([t, c], []);
    expect(hasIssue(res, "RESERVED_WORD_ENTITY")).toBe(true);
    expect(hasIssue(res, "RESERVED_WORD_COLUMN")).toBe(true);
    expect(res.ok).toBe(true);
  });
});

describe("validateModel — empties / lonely / PK heuristics", () => {
  it("EMPTY_ENTITY_SKIPPED: пустая сущность без связей -> warning", () => {
    const e = ent("Empty");
    const res = validateModel([e], []);
    expect(hasIssue(res, "EMPTY_ENTITY_SKIPPED")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("EMPTY_ENTITY_WITH_RELS: пустая сущность участвует в связи -> info", () => {
    const empty = ent("A"); // без атрибутов
    const b = ent("B", [attr("id", "UUID", true)]);
    const r = rel(b, empty, "one-to-many");
    const res = validateModel([empty, b], [r]);
    expect(hasIssue(res, "EMPTY_ENTITY_WITH_RELS")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("LONELY_ENTITY: непустая сущность без связей -> warning", () => {
    const u = ent("User", [attr("email", "TEXT")]);
    const res = validateModel([u], []);
    expect(hasIssue(res, "LONELY_ENTITY")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("MISSING_PK: нет явного PK и нет эвристического PK -> info", () => {
    const u = ent("User", [attr("email", "TEXT")]);
    const res = validateModel([u], []);
    expect(hasIssue(res, "MISSING_PK")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("IMPLICIT_PK_INFERRED: есть id UUID/INT, но не отмечен 🔑 -> info (PK будет использован)", () => {
    const u = ent("User", [attr("id", "UUID"), attr("email", "TEXT")]); // id НЕ помечен как PK
    const res = validateModel([u], []);
    expect(hasIssue(res, "IMPLICIT_PK_INFERRED")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("LINK_TABLE_COMPOSITE_PK_HINT + LINK_TABLE_VIA_TWO_RELS: таблица с двумя *_id и двумя 1:N -> info", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const role = ent("Role", [attr("id", "UUID", true)]);
    const link = ent("UserRole", [attr("user_id", "UUID"), attr("role_id", "UUID")]); // без PK

    const r1 = rel(user, link, "one-to-many");
    const r2 = rel(role, link, "one-to-many");

    const res = validateModel([user, role, link], [r1, r2]);

    expect(hasIssue(res, "LINK_TABLE_COMPOSITE_PK_HINT")).toBe(true);
    expect(hasIssue(res, "LINK_TABLE_VIA_TWO_RELS")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("TWO_ID_TABLE_NO_MM: таблица с двумя *_id, но нет N:M и нет двух 1:N -> warning", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const role = ent("Role", [attr("id", "UUID", true)]);
    const linkLike = ent("UserRole", [attr("user_id", "UUID"), attr("role_id", "UUID")]);
    const res = validateModel([user, role, linkLike], []); // без связей
    expect(hasIssue(res, "TWO_ID_TABLE_NO_MM")).toBe(true);
    expect(res.ok).toBe(true);
  });
});

describe("validateModel — self-link", () => {
  it("MISSING_SELF_LINK: есть parent_*_id, но нет self-отношения -> warning", () => {
    const cat = ent("Category", [attr("parent_category_id", "UUID")]);
    const res = validateModel([cat], []);
    expect(hasIssue(res, "MISSING_SELF_LINK")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("SELF_FK_TYPE_MISMATCH: self FK type != PK type -> error, ok=false", () => {
    const node = ent("Node", [
      attr("node_id", "UUID", true),
      attr("parent_node_id", "INT"), // неверный тип
    ]);
    const r = rel(node, node, "one-to-many");
    const res = validateModel([node], [r]);
    expect(hasIssue(res, "SELF_FK_TYPE_MISMATCH")).toBe(true);
    expect(res.ok).toBe(false);
  });

  it("SELF_LOOP_NOT_NULL: self 1:N с FK NOT NULL -> warning (вставка корней проблемна)", () => {
    const cat = ent("Category", [attr("id", "UUID", true)]);
    const r = rel(cat, cat, "one-to-many");
    const res = validateModel([cat], [r]);

    expect(hasIssue(res, "SELF_LOOP_NOT_NULL")).toBe(true);
    expect(res.ok).toBe(true);
  });
});

describe("validateModel — 1:N / 1:1", () => {
  it("FK_WILL_BE_ADDED: FK-столбца нет в to -> info", () => {
    const author = ent("Author", [attr("id", "UUID", true)]);
    const book = ent("Book", [attr("title", "TEXT")]); // нет author_id
    const r = rel(author, book, "one-to-many");
    const res = validateModel([author, book], [r]);

    expect(hasIssue(res, "FK_WILL_BE_ADDED")).toBe(true);

    const issue = getIssue(res, "FK_WILL_BE_ADDED");
    expect((issue?.message ?? "").trim()).not.toBe("");

    expect(res.ok).toBe(true);
  });

  it("FK_TYPE_MISMATCH: FK-столбец существует, но тип не совпадает с PK -> error, ok=false", () => {
    const author = ent("Author", [attr("id", "UUID", true)]);
    const book = ent("Book", [attr("author_id", "INT")]); // конфликт: INT vs UUID
    const r = rel(author, book, "one-to-many");
    const res = validateModel([author, book], [r]);

    expect(hasIssue(res, "FK_TYPE_MISMATCH")).toBe(true);
    expect(res.ok).toBe(false);
  });

  it("ONE_TO_ONE_UNIQUE: для 1:1 добавится UNIQUE на FK -> info", () => {
    const a = ent("A", [attr("id", "UUID", true)]);
    const b = ent("B", [attr("id", "UUID", true)]);
    const r = rel(a, b, "one-to-one");

    const res = validateModel([a, b], [r]);
    expect(hasIssue(res, "ONE_TO_ONE_UNIQUE")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("FK_TYPE_MISMATCH: 1:1 — разные типы PK у сущностей -> error, ok=false", () => {
    const a = ent("A", [attr("id", "UUID", true)]);
    const b = ent("B", [attr("id", "INT", true)]);
    const r = rel(a, b, "one-to-one");

    const res = validateModel([a, b], [r]);
    expect(hasIssue(res, "FK_TYPE_MISMATCH")).toBe(true);
    expect(res.ok).toBe(false);
  });

  it("FK_COLUMN_COLLISION: две связи пытаются использовать одну и ту же fk.column в одной таблице -> error, ok=false", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const account = ent("Account", [attr("id", "UUID", true)]);
    const order = ent("Order", [attr("id", "UUID", true)]);

    // ВАЖНО: тут создаём relationship вручную, чтобы точно положить fk.column
    const r1: any = {
      id: "r1",
      from: user.id,
      to: order.id,
      type: "one-to-many",
      fk: { column: "owner_id" },
    };
    const r2: any = {
      id: "r2",
      from: account.id,
      to: order.id,
      type: "one-to-many",
      fk: { column: "owner_id" },
    };

    const res = validateModel([user, account, order], [r1, r2]);
    expect(hasIssue(res, "FK_COLUMN_COLLISION")).toBe(true);
    expect(res.ok).toBe(false);
  });
});

describe("validateModel — many-to-many", () => {
  it("IMPLICIT_LINK_TABLE: N:M без явной таблицы -> info", () => {
    const u = ent("User", [attr("id", "UUID", true)]);
    const r = ent("Role", [attr("id", "UUID", true)]);
    const mm = rel(u, r, "many-to-many");

    const res = validateModel([u, r], [mm]);

    expect(hasIssue(res, "IMPLICIT_LINK_TABLE")).toBe(true);

    const issue = getIssue(res, "IMPLICIT_LINK_TABLE");
    expect(issue?.message?.toLowerCase()).toContain("link");
    expect(issue?.message?.toLowerCase()).toContain("user");
    expect(issue?.message?.toLowerCase()).toContain("role");

    expect(res.ok).toBe(true);
  });

  it("EMPTY_LINK_ENTITY: явная линк-таблица пустая -> info", () => {
    const u = ent("User", [attr("id", "UUID", true)]);
    const r = ent("Role", [attr("id", "UUID", true)]);
    const link = ent("user_role", []); // пустая
    const mm = rel(u, r, "many-to-many");

    const res = validateModel([u, r, link], [mm]);
    expect(hasIssue(res, "EMPTY_LINK_ENTITY")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("LINK_FK_WILL_BE_ADDED: явная link-таблица без user_id/role_id -> info", () => {
    const u = ent("User", [attr("id", "UUID", true)]);
    const r = ent("Role", [attr("id", "UUID", true)]);
    const link = ent("user_role", [attr("note", "TEXT")]); // нет FK-колонок
    const mm = rel(u, r, "many-to-many");

    const res = validateModel([u, r, link], [mm]);
    expect(hasIssue(res, "LINK_FK_WILL_BE_ADDED")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("LINK_COMPOSITE_PK: явная link-таблица без PK -> info", () => {
    const post = ent("Post", [attr("id", "UUID", true)]);
    const tag = ent("Tag", [attr("id", "UUID", true)]);
    const link = ent("post_tag", [attr("meta", "TEXT")]); // нет PK
    const mm = rel(post, tag, "many-to-many");

    const res = validateModel([post, tag, link], [mm]);
    expect(hasIssue(res, "LINK_COMPOSITE_PK")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("POTENTIAL_LINK_WITHOUT_REL: имя похоже на link-таблицу, но связей N:M нет -> warning", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const role = ent("Role", [attr("id", "UUID", true)]);
    const maybeLink = ent("user_role", [attr("note", "TEXT")]);

    const res = validateModel([user, role, maybeLink], []);
    expect(hasIssue(res, "POTENTIAL_LINK_WITHOUT_REL")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("LINK_TABLE_RENAME: явная линк-таблица найдена, но имя неканонично -> warning", () => {
    const u = ent("User", [attr("id", "UUID", true)]);
    const r = ent("Role", [attr("id", "UUID", true)]);
    const link = ent("Assignments", [attr("user_id", "UUID"), attr("role_id", "UUID")]);
    const mm: any = { id: "mm1", from: u.id, to: r.id, type: "many-to-many" };

    const res = validateModel([u, r, link], [mm]);

    expect(hasIssue(res, "LINK_TABLE_RENAME")).toBe(true);
    expect(res.ok).toBe(true);
  });

  it("SELF_MM_COLUMNS_COLLIDE: самосвязь N:M требует разных left/right колонок -> error, ok=false", () => {
    const u = ent("User", [attr("id", "UUID", true)]);
    const mmSelf: any = { id: "mm_self", from: u.id, to: u.id, type: "many-to-many" };

    const res = validateModel([u], [mmSelf]);

    expect(hasIssue(res, "SELF_MM_COLUMNS_COLLIDE")).toBe(true);
    expect(res.ok).toBe(false);
  });
});

describe("validateModel — FK cycles (graph/SCC)", () => {
  it("MANDATORY_FK_CYCLE: цикл обязательных FK (NOT NULL) -> error, ok=false", () => {
    const A = ent("A", [attr("id", "UUID", true)]);
    const B = ent("B", [attr("id", "UUID", true)]);
    const C = ent("C", [attr("id", "UUID", true)]);

    const rAB: any = { id: "rAB", from: A.id, to: B.id, type: "one-to-many", fk: { notNull: true } };
    const rBC: any = { id: "rBC", from: B.id, to: C.id, type: "one-to-many", fk: { notNull: true } };
    const rCA: any = { id: "rCA", from: C.id, to: A.id, type: "one-to-many", fk: { notNull: true } };

    const res = validateModel([A, B, C], [rAB, rBC, rCA]);

    expect(hasIssue(res, "MANDATORY_FK_CYCLE")).toBe(true);
    expect(res.ok).toBe(false);
  });

  it("FK_CYCLE_WITH_NULLABLE: цикл по FK, но разорван nullable (не error) -> warning, ok=true", () => {
    const A = ent("A", [attr("id", "UUID", true)]);
    const B = ent("B", [attr("id", "UUID", true)]);
    const C = ent("C", [attr("id", "UUID", true)]);

    // ВАЖНО: rBC nullable, чтобы mandatory-cycle не сработал
    const rAB: any = { id: "rAB2", from: A.id, to: B.id, type: "one-to-many", fk: { notNull: true } };
    const rBC: any = { id: "rBC2", from: B.id, to: C.id, type: "one-to-many", fk: { notNull: false } };
    const rCA: any = { id: "rCA2", from: C.id, to: A.id, type: "one-to-many", fk: { notNull: true } };

    const res = validateModel([A, B, C], [rAB, rBC, rCA]);

    expect(hasIssue(res, "FK_CYCLE_WITH_NULLABLE")).toBe(true);
    expect(hasIssue(res, "MANDATORY_FK_CYCLE")).toBe(false);
    expect(res.ok).toBe(true);
  });
});
