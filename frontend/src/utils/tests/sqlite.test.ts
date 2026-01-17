// frontend/src/utils/tests/sqlite.test.ts
import { describe, it, expect } from "vitest";
import type { Entity, Relationship } from "../../store/useERStore";
import { generateSQLiteSQL } from "../sql/sqlite";

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

describe("sql/sqlite: generateSQLiteSQL (current behavior)", () => {
  it("добавляет surrogate id (TEXT) PK, если PK не задан (не link-таблица)", () => {
    const user = ent("u", "User", [attr("email", "TEXT")]);
    const sql = norm(generateSQLiteSQL([user], []));
    expect(sql).toMatch(/PRAGMA foreign_keys = ON;/);
    expect(sql).toMatch(/CREATE TABLE "User"/);
    expect(sql).toMatch(/"id" TEXT PRIMARY KEY/);
    expect(sql).toMatch(/"email" TEXT/);
  });

  it("пропускает пустую несвязанную сущность", () => {
    const empty = ent("e", "Empty", []);
    const keep = ent("k", "Keep", [attr("name", "TEXT")]);
    const sql = norm(generateSQLiteSQL([empty, keep], []));
    expect(sql).not.toMatch(/CREATE TABLE "Empty"/);
    expect(sql).toMatch(/CREATE TABLE "Keep"/);
  });

  it("1:N: если FK нет — добавляет FK-колонку + FK constraint + index (в CREATE TABLE)", () => {
    const author = ent("a", "Author", [attr("id", "UUID", true)]);
    const book = ent("b", "Book", [attr("title", "TEXT")]);
    const r = rel("r1", author, book, "one-to-many");

    const sql = norm(generateSQLiteSQL([author, book], [r]));

    expect(sql).toMatch(/CREATE TABLE "Book"[\s\S]*"author_id" TEXT NOT NULL/);
    expect(sql).toMatch(
      /FOREIGN KEY \("author_id"\) REFERENCES "Author"\("id"\) ON DELETE CASCADE/
    );
    expect(sql).toMatch(/CREATE INDEX "idx_Book_author_id" ON "Book"\("author_id"\);/);
  });

  it("1:N: если FK уже есть (authorId) — использует существующее имя и делает NOT NULL (в CREATE TABLE)", () => {
    const author = ent("a", "Author", [attr("id", "UUID", true)]);
    const book = ent("b", "Book", [attr("authorId", "UUID"), attr("title", "TEXT")]);
    const r = rel("r2", author, book, "one-to-many");

    const sql = norm(generateSQLiteSQL([author, book], [r]));

    expect(sql).not.toMatch(/"author_id"/); // не должно “переехать” в snake_case
    expect(sql).toMatch(/CREATE TABLE "Book"[\s\S]*"authorId" TEXT NOT NULL/);
    expect(sql).toMatch(/FOREIGN KEY \("authorId"\) REFERENCES "Author"\("id"\) ON DELETE CASCADE/);
    expect(sql).toMatch(/CREATE INDEX "idx_Book_authorId" ON "Book"\("authorId"\);/);
  });

  it("1:1: добавляет UNIQUE на FK и НЕ создаёт index (по умолчанию)", () => {
    const left = ent("l", "Left", [attr("id", "UUID", true)]);
    const right = ent("r", "Right", [attr("id", "UUID", true)]);
    const rr = rel("r3", left, right, "one-to-one");

    const sql = norm(generateSQLiteSQL([left, right], [rr]));

    expect(sql).toMatch(/CREATE TABLE "Right"[\s\S]*"left_id" TEXT NOT NULL/);
    expect(sql).toMatch(/CONSTRAINT "uq_Right_left_id" UNIQUE \("left_id"\)/);
    expect(sql).not.toMatch(/CREATE INDEX[\s\S]*left_id/i);
  });

  it("M:N (неявная): создаёт link-таблицу с PK(left,right) + 2 FK + индексы", () => {
    const user = ent("u", "User", [attr("id", "UUID", true)]);
    const role = ent("r", "Role", [attr("id", "UUID", true)]);
    const mm = rel("mm1", user, role, "many-to-many");

    const sql = norm(generateSQLiteSQL([user, role], [mm]));

    expect(sql).toMatch(/CREATE TABLE "user_role_link"/i);
    expect(sql).toMatch(/"user_id" TEXT NOT NULL/);
    expect(sql).toMatch(/"role_id" TEXT NOT NULL/);
    expect(sql).toMatch(/PRIMARY KEY \("user_id", "role_id"\)/);
    expect(sql).toMatch(/CREATE INDEX "idx_user_role_link_user_id" ON "user_role_link"\("user_id"\);/i);
    expect(sql).toMatch(/CREATE INDEX "idx_user_role_link_role_id" ON "user_role_link"\("role_id"\);/i);
  });

  it("M:N (явная пустая link-таблица): текущая логика переименовывает в *_2 (uniqueName)", () => {
    const user = ent("u", "User", [attr("id", "UUID", true)]);
    const role = ent("r", "Role", [attr("id", "UUID", true)]);
    const link = ent("l", "user_role", []); // пустая явная link-таблица
    const mm = rel("mm2", user, role, "many-to-many");

    const sql = norm(generateSQLiteSQL([user, role, link], [mm]));

    expect(sql).toMatch(/CREATE TABLE "user_role_2"/i);
    expect(sql).toMatch(/"user_id" TEXT NOT NULL/);
    expect(sql).toMatch(/"role_id" TEXT NOT NULL/);
    expect(sql).toMatch(/PRIMARY KEY \("user_id", "role_id"\)/);
  });

  it("M:N (явная НЕпустая, compositePrimaryKey=false): текущая логика переименовывает в *_2 и добавляет UNIQUE(left,right) вместо PK", () => {
    const post = ent("p", "Post", [attr("id", "UUID", true)]);
    const tag = ent("t", "Tag", [attr("id", "UUID", true)]);
    const link = ent("l", "post_tag", [attr("meta", "TEXT")]);

    const mm = rel("mm3", post, tag, "many-to-many", {
      link: { tableName: "post_tag", compositePrimaryKey: false, onDelete: "CASCADE", index: true },
    } as any);

    const sql = norm(generateSQLiteSQL([post, tag, link], [mm]));

    expect(sql).toMatch(/CREATE TABLE "post_tag_2"/i);
    expect(sql).toMatch(/"meta" TEXT/);
    expect(sql).toMatch(/"post_id" TEXT NOT NULL/);
    expect(sql).toMatch(/"tag_id" TEXT NOT NULL/);

    expect(sql).toMatch(/CONSTRAINT "uq_post_tag_2_post_id_tag_id" UNIQUE \("post_id", "tag_id"\)/i);
    expect(sql).not.toMatch(/PRIMARY KEY \("post_id", "tag_id"\)/i);
  });
});
