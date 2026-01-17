// frontend/src/utils/tests/mssql.test.ts
import { describe, it, expect } from "vitest";
import type { Entity, Relationship } from "../../store/useERStore";
import { generateMSSQLSQL } from "../sql/mssql";

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

describe("sql/mssql: generateMSSQLSQL (current behavior)", () => {
  it("добавляет surrogate id (UNIQUEIDENTIFIER) PK, если PK не задан (не link-таблица)", () => {
    const e = ent("u", "User", [attr("email", "TEXT")]);
    const sql = norm(generateMSSQLSQL([e], []));
    expect(sql).toMatch(/CREATE TABLE \[User\]/);
    expect(sql).toMatch(/\[id\] UNIQUEIDENTIFIER PRIMARY KEY/);
  });

  it("пропускает пустую несвязанную сущность", () => {
    const e = ent("e", "Empty", []);
    const sql = norm(generateMSSQLSQL([e], []));
    expect(sql).not.toMatch(/CREATE TABLE \[Empty\]/);
  });

  it("1:N: если FK нет — добавляет колонку + FK constraint + index", () => {
    const A = ent("a", "Author", [attr("id", "UUID", true)]);
    const B = ent("b", "Book", [attr("title", "TEXT")]);
    const r = rel("r1", A, B, "one-to-many");

    const sql = norm(generateMSSQLSQL([A, B], [r]));

    expect(sql).toMatch(/ALTER TABLE \[Book\]\n  ADD \[author_id\] UNIQUEIDENTIFIER NOT NULL;/);
    expect(sql).toMatch(/FOREIGN KEY \(\[author_id\]\) REFERENCES \[Author\]\(\[id\]\) ON DELETE CASCADE;/);
    expect(sql).toMatch(/CREATE INDEX \[idx_book_author_id\] ON \[Book\]\(\[author_id\]\);/);
  });

  it("1:N: если FK уже есть (authorId) — не добавляет колонку, а делает ALTER COLUMN NOT NULL", () => {
    const A = ent("a", "Author", [attr("id", "UUID", true)]);
    const B = ent("b", "Book", [attr("authorId", "UUID"), attr("title", "TEXT")]);
    const r = rel("r2", A, B, "one-to-many");

    const sql = norm(generateMSSQLSQL([A, B], [r]));

    expect(sql).not.toMatch(/ADD \[author_id\]/);
    expect(sql).not.toMatch(/ADD \[authorId\]/);
    expect(sql).toMatch(/ALTER TABLE \[Book\]\n  ALTER COLUMN \[authorId\] UNIQUEIDENTIFIER NOT NULL;/);
    expect(sql).toMatch(/FOREIGN KEY \(\[authorId\]\) REFERENCES \[Author\]\(\[id\]\) ON DELETE CASCADE;/);
    expect(sql).toMatch(/CREATE INDEX \[idx_book_author_id\] ON \[Book\]\(\[authorId\]\);/);
  });

  it("1:1: добавляет UNIQUE на FK и НЕ создаёт index (по умолчанию)", () => {
    const L = ent("l", "Left", [attr("id", "UUID", true)]);
    const R = ent("r", "Right", [attr("id", "UUID", true)]);
    const rr = rel("r3", L, R, "one-to-one");

    const sql = norm(generateMSSQLSQL([L, R], [rr]));

    expect(sql).toMatch(/ALTER TABLE \[Right\]\n  ADD \[left_id\] UNIQUEIDENTIFIER NOT NULL;/);
    expect(sql).toMatch(/ADD CONSTRAINT \[uq_Right_left_id\] UNIQUE \(\[left_id\]\);/i);
    expect(sql).not.toMatch(/CREATE INDEX/i);
  });

  it("M:N (неявная): создаёт link-таблицу с PK(left,right) + 2 FK + индексы", () => {
    const U = ent("u", "User", [attr("id", "UUID", true)]);
    const R = ent("r", "Role", [attr("id", "UUID", true)]);
    const mm = rel("mm1", U, R, "many-to-many");

    const sql = norm(generateMSSQLSQL([U, R], [mm]));

    expect(sql).toMatch(/CREATE TABLE \[user_role_link\]/i);
    expect(sql).toMatch(/\[user_id\] UNIQUEIDENTIFIER NOT NULL/);
    expect(sql).toMatch(/\[role_id\] UNIQUEIDENTIFIER NOT NULL/);
    expect(sql).toMatch(/PRIMARY KEY \(\[user_id\], \[role_id\]\)/i);
    expect(sql).toMatch(/CREATE INDEX \[idx_user_role_link_user_id\]/i);
    expect(sql).toMatch(/CREATE INDEX \[idx_user_role_link_role_id\]/i);
  });

  it("M:N (явная пустая link-таблица): текущая логика переименовывает в *_2 (uniqueName)", () => {
    const U = ent("u", "User", [attr("id", "UUID", true)]);
    const R = ent("r", "Role", [attr("id", "UUID", true)]);
    const Link = ent("l", "user_role", []); // пустая
    const mm = rel("mm2", U, R, "many-to-many");

    const sql = norm(generateMSSQLSQL([U, R, Link], [mm]));

    expect(sql).toMatch(/CREATE TABLE \[user_role_2\]/i);
    expect(sql).toMatch(/\[user_id\] UNIQUEIDENTIFIER NOT NULL/);
    expect(sql).toMatch(/\[role_id\] UNIQUEIDENTIFIER NOT NULL/);
  });

  it("M:N (явная НЕпустая, compositePrimaryKey=false): текущая логика переименовывает в *_2 и добавляет UNIQUE(left,right)", () => {
    const P = ent("p", "Post", [attr("id", "UUID", true)]);
    const T = ent("t", "Tag", [attr("id", "UUID", true)]);
    const Link = ent("l", "post_tag", [attr("meta", "TEXT")]);

    const mm = rel("mm3", P, T, "many-to-many", {
      link: { tableName: "post_tag", compositePrimaryKey: false, onDelete: "CASCADE", index: true },
    } as any);

    const sql = norm(generateMSSQLSQL([P, T, Link], [mm]));

    expect(sql).toMatch(/CREATE TABLE \[post_tag_2\]/i);
    expect(sql).toMatch(/ALTER TABLE \[post_tag_2\]\n  ADD \[post_id\] UNIQUEIDENTIFIER NOT NULL;/);
    expect(sql).toMatch(/ALTER TABLE \[post_tag_2\]\n  ADD \[tag_id\] UNIQUEIDENTIFIER NOT NULL;/);
    expect(sql).toMatch(/UNIQUE \(\[post_id\], \[tag_id\]\)/i);
    expect(sql).not.toMatch(/PRIMARY KEY \(\[post_id\], \[tag_id\]\)/i);
  });
});
