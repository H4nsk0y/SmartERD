// frontend/src/utils/tests/postgres.test.ts
import { describe, it, expect } from "vitest";
import type { Entity, Relationship } from "../../store/useERStore";
import { generatePostgresSQL } from "../sql/postgres";

type Attr = { id: string; name: string; type?: string; isPrimaryKey?: boolean };
const attr = (name: string, type = "TEXT", isPrimaryKey = false): Attr => ({
  id: `a_${name}`,
  name,
  type,
  isPrimaryKey,
});

const ent = (id: string, name: string, attributes: Attr[] = []): Entity =>
  ({ id, name, attributes: attributes as any, x: 0, y: 0 } as any);

const rel = (
  id: string,
  from: Entity,
  to: Entity,
  type: Relationship["type"],
  extra: Partial<Relationship> = {}
): Relationship =>
  ({
    id,
    from: from.id,
    to: to.id,
    type,
    ...extra,
  } as any);

const norm = (s: string) => s.replace(/\r\n/g, "\n");

describe("sql/postgres: generatePostgresSQL (current behavior)", () => {
  it("добавляет surrogate id UUID PK, если PK не задан (не link-таблица)", () => {
    const user = ent("u", "User", [attr("email", "TEXT")]);
    const sql = norm(generatePostgresSQL([user], []));
    expect(sql).toMatch(/CREATE TABLE "User"/);
    expect(sql).toMatch(/"id" UUID PRIMARY KEY/);
    expect(sql).toMatch(/"email" TEXT/);
  });

  it("пропускает пустую несвязанную сущность", () => {
    const empty = ent("e", "Empty", []);
    const keep = ent("k", "Keep", [attr("name", "TEXT")]);
    const sql = norm(generatePostgresSQL([empty, keep], []));
    expect(sql).not.toMatch(/CREATE TABLE "Empty"/);
    expect(sql).toMatch(/CREATE TABLE "Keep"/);
  });

  it("1:N: если FK нет — добавляет колонку + FK constraint + index", () => {
    const author = ent("a", "Author", [attr("id", "UUID", true)]);
    const book = ent("b", "Book", [attr("title", "TEXT")]);
    const r = rel("r1", author, book, "one-to-many");

    const sql = norm(generatePostgresSQL([author, book], [r]));

    expect(sql).toMatch(/ALTER TABLE "Book"\n  ADD COLUMN "author_id" UUID NOT NULL;/);
    expect(sql).toMatch(
      /FOREIGN KEY \("author_id"\) REFERENCES "Author"\("id"\) ON DELETE CASCADE;/
    );
    expect(sql).toMatch(/CREATE INDEX ON "Book"\("author_id"\);/);
  });

  it("1:N: если FK уже есть (authorId) — не добавляет колонку, а делает SET NOT NULL", () => {
    const author = ent("a", "Author", [attr("id", "UUID", true)]);
    const book = ent("b", "Book", [attr("authorId", "UUID"), attr("title", "TEXT")]);
    const r = rel("r2", author, book, "one-to-many");

    const sql = norm(generatePostgresSQL([author, book], [r]));

    expect(sql).not.toMatch(/ADD COLUMN "author_id"/);
    expect(sql).not.toMatch(/ADD COLUMN "authorId"/);
    expect(sql).toMatch(/ALTER TABLE "Book"\n  ALTER COLUMN "authorId" SET NOT NULL;/);
    expect(sql).toMatch(/FOREIGN KEY \("authorId"\) REFERENCES "Author"\("id"\)/);
    expect(sql).toMatch(/CREATE INDEX ON "Book"\("authorId"\);/);
  });

  it("1:1: добавляет UNIQUE на FK и НЕ создаёт index (по умолчанию)", () => {
    const left = ent("l", "Left", [attr("id", "UUID", true)]);
    const right = ent("r", "Right", [attr("id", "UUID", true)]);
    const rr = rel("r3", left, right, "one-to-one");

    const sql = norm(generatePostgresSQL([left, right], [rr]));

    expect(sql).toMatch(/ALTER TABLE "Right"\n  ADD COLUMN "left_id" UUID NOT NULL;/);
    expect(sql).toMatch(/ADD CONSTRAINT "uq_Right_left_id" UNIQUE \("left_id"\);/);
    expect(sql).not.toMatch(/CREATE INDEX ON "Right"\("left_id"\);/);
  });

  it("M:N (неявная): создаёт link-таблицу с PK(left,right) + 2 FK + индексы", () => {
    const user = ent("u", "User", [attr("id", "UUID", true)]);
    const role = ent("r", "Role", [attr("id", "UUID", true)]);
    const mm = rel("mm1", user, role, "many-to-many");

    const sql = norm(generatePostgresSQL([user, role], [mm]));

    expect(sql).toMatch(/CREATE TABLE "user_role_link"/);
    expect(sql).toMatch(/"user_id" UUID NOT NULL/);
    expect(sql).toMatch(/"role_id" UUID NOT NULL/);
    expect(sql).toMatch(/PRIMARY KEY \("user_id", "role_id"\)/);
    expect(sql).toMatch(/CREATE INDEX ON "user_role_link"\("user_id"\);/);
    expect(sql).toMatch(/CREATE INDEX ON "user_role_link"\("role_id"\);/);
  });

  it("M:N (явная пустая link-таблица): текущая логика переименовывает в *_2 (uniqueName)", () => {
    const user = ent("u", "User", [attr("id", "UUID", true)]);
    const role = ent("r", "Role", [attr("id", "UUID", true)]);
    const link = ent("l", "user_role", []);
    const mm = rel("mm2", user, role, "many-to-many");

    const sql = norm(generatePostgresSQL([user, role, link], [mm]));

    expect(sql).toMatch(/CREATE TABLE "user_role_2" \(\n/);
    expect(sql).toMatch(/"user_id" UUID NOT NULL/);
    expect(sql).toMatch(/"role_id" UUID NOT NULL/);
  });

  it("M:N (явная НЕпустая, compositePrimaryKey=false): текущая логика переименовывает в *_2 и добавляет UNIQUE(left,right)", () => {
    const post = ent("p", "Post", [attr("id", "UUID", true)]);
    const tag = ent("t", "Tag", [attr("id", "UUID", true)]);
    const link = ent("l", "post_tag", [attr("meta", "TEXT")]);

    const mm = rel("mm3", post, tag, "many-to-many", {
      link: { tableName: "post_tag", compositePrimaryKey: false },
    } as any);

    const sql = norm(generatePostgresSQL([post, tag, link], [mm]));

    expect(sql).toMatch(/CREATE TABLE "post_tag_2"/);
    expect(sql).toMatch(/ALTER TABLE "post_tag_2"\n  ADD COLUMN "post_id" UUID NOT NULL;/);
    expect(sql).toMatch(/ALTER TABLE "post_tag_2"\n  ADD COLUMN "tag_id" UUID NOT NULL;/);

    expect(sql).toMatch(
      /ADD CONSTRAINT "uq_post_tag_2_post_id_tag_id" UNIQUE \("post_id", "tag_id"\);/
    );
    expect(sql).not.toMatch(/ALTER TABLE "post_tag_2"\n  ADD PRIMARY KEY/);
  });



  it("SELF 1:N nullable: ADD COLUMN всегда содержит тип (никаких: ADD COLUMN \"parent_id\" ;)", () => {
    const node = ent("n", "Entity", [attr("id", "UUID", true)]);

    const r = rel("sl1", node, node, "one-to-many", {
      fk: { column: "parent_id", notNull: false },
    } as any);

    const sql = norm(generatePostgresSQL([node], [r]));

    expect(sql).toMatch(/ALTER TABLE "Entity"\n  ADD COLUMN "parent_id" UUID;/);
    expect(sql).not.toMatch(/ADD COLUMN "parent_id"\s*;/);
  });

  it("Cycle A→B→C→A with one nullable: ADD COLUMN всегда содержит тип (никаких: ADD COLUMN \"b_id\" ;)", () => {
    const A = ent("a", "A", [attr("id", "UUID", true)]);
    const B = ent("b", "B", [attr("id", "UUID", true)]);
    const C = ent("c", "C", [attr("id", "UUID", true)]);

    const rAB = rel("rAB", A, B, "one-to-many", { fk: { column: "a_id", notNull: true } } as any);
    const rBC = rel("rBC", B, C, "one-to-many", { fk: { column: "b_id", notNull: false } } as any); 
    const rCA = rel("rCA", C, A, "one-to-many", { fk: { column: "c_id", notNull: true } } as any);

    const sql = norm(generatePostgresSQL([A, B, C], [rAB, rBC, rCA]));

    expect(sql).toMatch(/ALTER TABLE "B"\n  ADD COLUMN "a_id" UUID NOT NULL;/);
    expect(sql).toMatch(/ALTER TABLE "C"\n  ADD COLUMN "b_id" UUID;/);
    expect(sql).toMatch(/ALTER TABLE "A"\n  ADD COLUMN "c_id" UUID NOT NULL;/);

    expect(sql).not.toMatch(/ADD COLUMN "a_id"\s*;/);
    expect(sql).not.toMatch(/ADD COLUMN "b_id"\s*;/);
    expect(sql).not.toMatch(/ADD COLUMN "c_id"\s*;/);
  });
});
