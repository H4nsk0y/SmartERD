// frontend/src/utils/tests/common.test.ts
import { describe, it, expect } from "vitest";
import { ent, attr } from "./helpers";
import {
  sanitize,
  snake,
  norm,
  toSingular,
  fkColNameFor,
  hasColumn,
  findExistingFKColumn,
  findExistingLinkEntity,
  getPrimaryKey,
  qPg,
  qMy,
  suggestLinkTableName,
  uniqueName,
  limitIdentifier,
} from "../sql/common";

describe("sql/common.ts — identifiers", () => {
  it("sanitize: заменяет мусор на '_' + схлопывает и обрезает '_' по краям", () => {
    expect(sanitize(" User Profile!! ")).toBe("User_Profile");
    expect(sanitize("__A---B__")).toBe("A_B");
    expect(sanitize("")).toBe("");
  });

  it("snake/norm: приводит к snake_case (camelCase, дефисы, пробелы)", () => {
    expect(snake("UserProfile")).toBe("user_profile");
    expect(snake("user-profile")).toBe("user_profile");
    expect(norm("User Profile")).toBe("user_profile");
  });

  it("toSingular: базовые правила (ies/ses/s)", () => {
    expect(toSingular("Companies")).toBe("Company");
    expect(toSingular("classes")).toBe("class");
    expect(toSingular("users")).toBe("user");
    expect(toSingular("bus")).toBe("bu");
  });

  it("fkColNameFor: добавляет root_ только если pk не начинается с root_", () => {
    expect(fkColNameFor("User", "id")).toBe("user_id");
    expect(fkColNameFor("User", "user_id")).toBe("user_id");
    expect(fkColNameFor("OrderItem", "id")).toBe("order_item_id");
  });

  it("qPg/qMy: цитирует и санитайзит", () => {
    expect(qPg('User Name')).toBe('"User_Name"');
    expect(qMy('User Name')).toBe("`User_Name`");
  });

  it("suggestLinkTableName: порядок from/to сохраняется", () => {
    expect(suggestLinkTableName("Users", "Roles")).toBe("user_role_link");
    expect(suggestLinkTableName("Tag", "Post")).toBe("tag_post_link");
  });
});

describe("sql/common.ts — columns & FK helpers", () => {
  it("hasColumn: сравнивает по norm (case/format insensitive)", () => {
    const e = ent("User", [attr("userId", "UUID"), attr("email", "TEXT")]);
    expect(hasColumn(e, "user_id")).toBe(true);
    expect(hasColumn(e, "User Id")).toBe(true);
    expect(hasColumn(e, "missing")).toBe(false);
  });

  it("findExistingFKColumn: находит подходящий FK по наборам кандидатов", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const post = ent("Post", [attr("userId", "UUID")]); 
    const pk = getPrimaryKey(user);

    const col = findExistingFKColumn(post, user.name, toSingular(user.name), pk.name);
    expect(col).toBe("userId"); 
  });

  it("findExistingFKColumn: учитывает singularFrom", () => {
    const categories = ent("Categories", [attr("id", "UUID", true)]);
    const product = ent("Product", [attr("category_id", "UUID")]);

    const pk = getPrimaryKey(categories);
    const col = findExistingFKColumn(product, categories.name, toSingular(categories.name), pk.name);

    expect(col?.toLowerCase()).toBe("category_id");
  });
});

describe("sql/common.ts — PK detection", () => {
  it("getPrimaryKey: явный PK (isPrimaryKey) имеет приоритет", () => {
    const e = ent("User", [attr("uid", "UUID", true), attr("id", "UUID")]);
    expect(getPrimaryKey(e)).toEqual({ name: "uid", type: "UUID" });
  });

  it("getPrimaryKey: implicit PK по id INT/UUID", () => {
    const e = ent("User", [attr("id", "INT")]); 
    expect(getPrimaryKey(e)).toEqual({ name: "id", type: "INT" });
  });

  it("getPrimaryKey: implicit PK по <entity>_id BIGINT", () => {
    const e = ent("Users", [attr("user_id", "BIGINT")]); 
    expect(getPrimaryKey(e)).toEqual({ name: "user_id", type: "BIGINT" });
  });

  it("getPrimaryKey: если id есть, но тип не похож на PK -> дефолт id UUID", () => {
    const e = ent("User", [attr("id", "TEXT")]);
    expect(getPrimaryKey(e)).toEqual({ name: "id", type: "UUID" });
  });
});

describe("sql/common.ts — link entity detection", () => {
  it("findExistingLinkEntity: structural match (наличие двух FK-колонок) приоритетнее имени", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const role = ent("Role", [attr("id", "UUID", true)]);

    const link = ent("WhateverName", [
      attr("user_id", "UUID"),
      attr("role_id", "UUID"),
      attr("note", "TEXT"),
    ]);

    const found = findExistingLinkEntity(user, role, [user, role, link]);
    expect(found?.id).toBe(link.id);
  });

  it("findExistingLinkEntity: fallback по имени (если структура не помогает)", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const role = ent("Role", [attr("id", "UUID", true)]);

    const linkByNameOnly = ent("user_role_link", [attr("note", "TEXT")]); 

    const found = findExistingLinkEntity(user, role, [user, role, linkByNameOnly]);
    expect(found?.id).toBe(linkByNameOnly.id);
  });

  it("findExistingLinkEntity: не должен возвращать сами сущности A/B", () => {
    const user = ent("User", [attr("id", "UUID", true)]);
    const role = ent("Role", [attr("id", "UUID", true)]);
    const found = findExistingLinkEntity(user, role, [user, role]);
    expect(found).toBeNull();
  });
});

describe("sql/common.ts — uniqueName & limitIdentifier", () => {
  it("uniqueName: делает имя уникальным относительно usedLower (case-insensitive)", () => {
    const used = new Set<string>(["user", "user_2"]);
    expect(uniqueName("User", used)).toBe("User_3");
  });

  it("uniqueName: санитайзит base перед проверкой и генерацией", () => {
    const used = new Set<string>(["user_role"]);
    expect(uniqueName("User Role", used)).toBe("User_Role_2");
  });

  it("limitIdentifier: если коротко — возвращает sanitize(name)", () => {
    expect(limitIdentifier("User-Name", 64)).toBe("User_Name");
  });

  it("limitIdentifier: если длинно — режет и добавляет стабильный hash", () => {
    const long = "A".repeat(200) + "___" + "B".repeat(200);
    const a = limitIdentifier(long, 20);
    const b = limitIdentifier(long, 20);

    expect(a).toBe(b); 
    expect(a.length).toBeLessThanOrEqual(20);
    expect(/^[A-Za-z0-9_]+$/.test(a)).toBe(true);
    expect(a.includes("_")).toBe(true); 
  });

  it("limitIdentifier: разные входы -> разные результаты", () => {
    const a = limitIdentifier("X".repeat(200), 20);
    const b = limitIdentifier("Y".repeat(200), 20);
    expect(a).not.toBe(b);
  });
});
