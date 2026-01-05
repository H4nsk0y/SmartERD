// filepath: frontend/src/utils/tests/generateSQL.test.ts
// @ts-nocheck
/// <reference types="vitest" />
/// <reference types="vite/client" />

import { describe, it, expect } from "vitest";
import { attr, ent, rel } from "./helpers";
import { generateSQL } from "../generateSQL";



function normalizeSql(sql: string) {
  return sql.replace(/\r\n/g, "\n").trim();
}

function expectNoUndefined(sql: string) {
  expect(sql).not.toMatch(/\bundefined\b/i);
  expect(sql).not.toMatch(/\bnull\b/i);
}

describe("generateSQL: postgres", () => {
  it("surrogate PK: если PK не задан — добавляется id UUID PRIMARY KEY", () => {
    const user = ent("User", [attr("email", "VARCHAR(255)")]); // нет PK
    const sql = normalizeSql(generateSQL([user], [], { dialect: "postgres" }));

    expect(sql).toContain('CREATE TABLE "User"');
    expect(sql).toContain('"id" UUID PRIMARY KEY');
    expectNoUndefined(sql);
  });

  it("1:N: FK добавляется в 'to' + FK constraint + index (default)", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const course = ent("Course", [attr("id", "UUID", true), attr("title", "VARCHAR(255)")]);
    const r = rel(user, course, "one-to-many");
    r.fk = { column: "user_id" };

    const sql = normalizeSql(generateSQL([user, course], [r], { dialect: "postgres" }));

    expect(sql).toContain('ALTER TABLE "Course"\n  ADD COLUMN "user_id" UUID NOT NULL;');
    expect(sql).toMatch(/ADD CONSTRAINT "fk_Course_User" FOREIGN KEY \("user_id"\) REFERENCES "User"\("id"\)/);
    expect(sql).toContain('CREATE INDEX ON "Course"("user_id");');
    expectNoUndefined(sql);
  });

  it("1:1: FK + UNIQUE constraint (default), без отдельного CREATE INDEX", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const profile = ent("Profile", [attr("id", "UUID", true)]);
    const r = rel(user, profile, "one-to-one");
    r.fk = { column: "user_id" };

    const sql = normalizeSql(generateSQL([user, profile], [r], { dialect: "postgres" }));

    expect(sql).toContain('ALTER TABLE "Profile"\n  ADD COLUMN "user_id" UUID NOT NULL;');
    expect(sql).toMatch(/ADD CONSTRAINT "fk_Profile_User" FOREIGN KEY \("user_id"\) REFERENCES "User"\("id"\)/);
    expect(sql).toMatch(/ADD CONSTRAINT "uq_Profile_user_id" UNIQUE \("user_id"\);/);

    // Для 1:1 UNIQUE сам создаёт индекс; отдельный index по умолчанию не генерим
    expect(sql).not.toContain('CREATE INDEX ON "Profile"("user_id");');
    expectNoUndefined(sql);
  });

  it("N:M (auto): создаётся link-таблица user_course_link с composite PK + FK + индексы", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const course = ent("Course", [attr("id", "UUID", true)]);
    const r = rel(user, course, "many-to-many");

    const sql = normalizeSql(generateSQL([user, course], [r], { dialect: "postgres" }));

    expect(sql).toContain('CREATE TABLE "user_course_link"');
    expect(sql).toContain('"user_id" UUID NOT NULL');
    expect(sql).toContain('"course_id" UUID NOT NULL');
    expect(sql).toMatch(/PRIMARY KEY \("user_id", "course_id"\)/);
    expect(sql).toMatch(/CONSTRAINT "fk_user_course_link_User" FOREIGN KEY \("user_id"\) REFERENCES "User"\("id"\) ON DELETE CASCADE/);
    expect(sql).toMatch(/CONSTRAINT "fk_user_course_link_Course" FOREIGN KEY \("course_id"\) REFERENCES "Course"\("id"\) ON DELETE CASCADE/);
    expect(sql).toContain('CREATE INDEX ON "user_course_link"("user_id");');
    expect(sql).toContain('CREATE INDEX ON "user_course_link"("course_id");');
    expectNoUndefined(sql);
  });

  it("N:M (explicit пустая link entity): если есть таблица с именем, содержащим обе сущности — создаётся под этим именем", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const course = ent("Course", [attr("id", "UUID", true)]);
    const link = ent("UserCourseLink", []); // пустая — будет deferred
    const r = rel(user, course, "many-to-many");

    const sql = normalizeSql(generateSQL([user, course, link], [r], { dialect: "postgres" }));

    expect(sql).toContain('CREATE TABLE "UserCourseLink"');
    expect(sql).toContain('"user_id" UUID NOT NULL');
    expect(sql).toContain('"course_id" UUID NOT NULL');
    expectNoUndefined(sql);
  });

  it("Self-relation 1:N: FK создаётся в той же таблице (to=from)", () => {
    const node = ent("Category", [attr("id", "UUID", true)]);
    const r = rel(node, node, "one-to-many");
    r.fk = { column: "parent_id", onDelete: "SET NULL", notNull: false };

    const sql = normalizeSql(generateSQL([node], [r], { dialect: "postgres" }));

    expect(sql).toContain('ALTER TABLE "Category"\n  ADD COLUMN "parent_id" UUID;');
    expect(sql).toMatch(/ADD CONSTRAINT "fk_Category_Category" FOREIGN KEY \("parent_id"\) REFERENCES "Category"\("id"\) ON DELETE SET NULL/);
    expectNoUndefined(sql);
  });
});

describe("generateSQL: mysql", () => {
  it("surrogate PK: если PK не задан — добавляется id CHAR(36) PRIMARY KEY", () => {
    const user = ent("User", [attr("email", "VARCHAR(255)")]); // нет PK
    const sql = normalizeSql(generateSQL([user], [], { dialect: "mysql" }));

    expect(sql).toContain("CREATE TABLE `User`");
    expect(sql).toContain("`id` CHAR(36) PRIMARY KEY");
    expectNoUndefined(sql);
  });

  it("1:N: FK + constraint + index (default)", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const course = ent("Course", [attr("id", "UUID", true)]);
    const r = rel(user, course, "one-to-many");
    r.fk = { column: "user_id" };

    const sql = normalizeSql(generateSQL([user, course], [r], { dialect: "mysql" }));

    expect(sql).toContain("ALTER TABLE `Course`\n  ADD COLUMN `user_id` CHAR(36) NOT NULL;");
    expect(sql).toMatch(/ADD CONSTRAINT `fk_Course_User` FOREIGN KEY \(`user_id`\) REFERENCES `User`\(`id`\) ON DELETE CASCADE/);
    expect(sql).toContain("CREATE INDEX `idx_Course_user_id` ON `Course`(`user_id`);");
    expectNoUndefined(sql);
  });

  it("N:M (auto): создаётся user_course_link с composite PK + FK + индексы", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const course = ent("Course", [attr("id", "UUID", true)]);
    const r = rel(user, course, "many-to-many");

    const sql = normalizeSql(generateSQL([user, course], [r], { dialect: "mysql" }));

    expect(sql).toContain("CREATE TABLE `user_course_link`");
    expect(sql).toContain("`user_id` CHAR(36) NOT NULL");
    expect(sql).toContain("`course_id` CHAR(36) NOT NULL");
    expect(sql).toMatch(/PRIMARY KEY \(`user_id`, `course_id`\)/);
    expect(sql).toContain("CREATE INDEX `idx_user_course_link_user_id` ON `user_course_link`(`user_id`);");
    expect(sql).toContain("CREATE INDEX `idx_user_course_link_course_id` ON `user_course_link`(`course_id`);");
    expectNoUndefined(sql);
  });
});
