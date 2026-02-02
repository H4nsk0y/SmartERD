// frontend/src/utils/tests/normalization.test.ts
// @ts-nocheck
/// <reference types="vitest" />
/// <reference types="vite/client" />

import { describe, it, expect } from "vitest";
import { attr, ent, rel } from "./helpers";
import { analyzeNormalization, applyNormalizationAction } from "../normalization";

function issueByCode(issues: any[], code: string) {
  return issues.find((i) => i.code === code);
}

function issuesByCode(issues: any[], code: string) {
  return issues.filter((i) => i.code === code);
}

function hasAttr(entity: any, name: string) {
  const want = (name || "").toLowerCase();
  return entity.attributes?.some((a: any) => (a.name || "").toLowerCase() === want);
}

function getAttr(entity: any, name: string) {
  const want = (name || "").toLowerCase();
  return entity.attributes?.find((a: any) => (a.name || "").toLowerCase() === want);
}

function findEntityByName(entities: any[], name: string) {
  const want = (name || "").toLowerCase();
  return entities.find((e) => (e.name || "").toLowerCase() === want);
}

function findRel(relationships: any[], fromId: string, toId: string, type: string, fkColumn?: string) {
  const fkWant = fkColumn ? fkColumn.toLowerCase() : null;
  return relationships.find((r) => {
    if (r.type !== type) return false;
    if (r.from !== fromId || r.to !== toId) return false;
    if (!fkWant) return true;
    return ((r.fk?.column || "").toLowerCase() === fkWant);
  });
}

describe("analyzeNormalization: 1NF", () => {
  it("NF1_REPEATING_GROUP: phone1/phone2 => warning + 2 actions", () => {
    const User = ent("User", [
      attr("id", "UUID", true),
      attr("phone1", "TEXT"),
      attr("phone2", "TEXT"),
    ]);

    const issues = analyzeNormalization([User], []);
    const i = issueByCode(issues, "NF1_REPEATING_GROUP");
    expect(i).toBeDefined();
    expect(i.level).toBe("warning");
    expect(i.actions).toBeDefined();
    expect(i.actions).toHaveLength(2);
    expect(i.actions[0].kind).toBe("EXTRACT_REPEATING_GROUP");
    expect(i.actions[1].kind).toBe("EXTRACT_REPEATING_GROUP");
  });

  it("NF1_NON_ATOMIC: JSON/ARRAY => warning + EXTRACT_MULTIVALUE_FIELD action", () => {
    const User = ent("User", [
      attr("id", "UUID", true),
      attr("meta", "JSONB"),
    ]);

    const issues = analyzeNormalization([User], []);
    const i = issueByCode(issues, "NF1_NON_ATOMIC");
    expect(i).toBeDefined();
    expect(i.level).toBe("warning");
    expect(i.actions?.[0]?.kind).toBe("EXTRACT_MULTIVALUE_FIELD");
  });

  it("NF1_MULTIVALUE_FIELD: tags => info + 2 actions", () => {
    const User = ent("User", [
      attr("id", "UUID", true),
      attr("tags", "TEXT"),
    ]);

    const issues = analyzeNormalization([User], []);
    const i = issueByCode(issues, "NF1_MULTIVALUE_FIELD");
    expect(i).toBeDefined();
    expect(i.level).toBe("info");
    expect(i.actions).toHaveLength(2);
    expect(i.actions[0].kind).toBe("EXTRACT_MULTIVALUE_FIELD");
    expect(i.actions[1].kind).toBe("EXTRACT_MULTIVALUE_FIELD");
  });
});

describe("applyNormalizationAction: 1NF extraction", () => {
  it("EXTRACT_REPEATING_GROUP: создаёт child-таблицу + 1:N, исходные поля можно оставить", () => {
    const User = ent("User", [
      attr("id", "UUID", true),
      attr("phone1", "TEXT"),
      attr("phone2", "TEXT"),
    ]);

    const issues = analyzeNormalization([User], []);
    const i = issueByCode(issues, "NF1_REPEATING_GROUP");
    const action = i.actions[0]; // dropOriginal: false

    const out = applyNormalizationAction(action, [User], []);
    const child = findEntityByName(out.entities, "User_phone");
    expect(child).toBeDefined();

    // child cols: id (PK), user_id (FK), phone (value), idx
    expect(hasAttr(child, "id")).toBe(true);
    expect(getAttr(child, "id")?.isPrimaryKey).toBe(true);
    expect(hasAttr(child, "user_id")).toBe(true);
    expect(hasAttr(child, "phone")).toBe(true);
    expect(hasAttr(child, "idx")).toBe(true);

    // relation: User -> child one-to-many with fk column user_id
    const r = findRel(out.relationships, User.id, child.id, "one-to-many", "user_id");
    expect(r).toBeDefined();

    // исходные phone1/phone2 остаются
    const src = findEntityByName(out.entities, "User");
    expect(hasAttr(src, "phone1")).toBe(true);
    expect(hasAttr(src, "phone2")).toBe(true);
  });

  it("EXTRACT_MULTIVALUE_FIELD (dropOriginal): создаёт child + удаляет исходный столбец", () => {
    const User = ent("User", [
      attr("id", "UUID", true),
      attr("tags", "TEXT"),
    ]);

    const issues = analyzeNormalization([User], []);
    const i = issueByCode(issues, "NF1_MULTIVALUE_FIELD");
    const actionDrop = i.actions[1]; 

    const out = applyNormalizationAction(actionDrop, [User], []);
    const child = findEntityByName(out.entities, "User_tags");
    expect(child).toBeDefined();

    expect(hasAttr(child, "id")).toBe(true);
    expect(getAttr(child, "id")?.isPrimaryKey).toBe(true);
    expect(hasAttr(child, "user_id")).toBe(true);
    expect(hasAttr(child, "value")).toBe(true);

    const src = findEntityByName(out.entities, "User");
    expect(hasAttr(src, "tags")).toBe(false);
  });
});

describe("analyzeNormalization: 2NF (explicit M:N link table)", () => {
  it("NF2_PARTIAL_DEP: user_email/role_name в линк-таблице => warning + MOVE_ATTR_TO_ENTITY actions", () => {
    const User = ent("User", [attr("id", "UUID", true)]);
    const Role = ent("Role", [attr("id", "UUID", true)]);

    
    const Link = ent("user_role", [
      attr("user_id", "UUID"),
      attr("role_id", "UUID"),
      attr("user_email", "TEXT"),
      attr("role_name", "TEXT"),
      attr("note", "TEXT"),
    ]);

    const mm = rel(User, Role, "many-to-many");

    const issues = analyzeNormalization([User, Role, Link], [mm]);
    const partials = issuesByCode(issues, "NF2_PARTIAL_DEP");
    expect(partials.length).toBeGreaterThanOrEqual(2);

    const hasMoveToUser = partials.some((p) => p.actions?.[0]?.kind === "MOVE_ATTR_TO_ENTITY");
    expect(hasMoveToUser).toBe(true);
  });

  it("MOVE_ATTR_TO_ENTITY: user_email переносится в User как email и удаляется из link", () => {
    const User = ent("User", [attr("id", "UUID", true)]);
    const Role = ent("Role", [attr("id", "UUID", true)]);

    const Link = ent("user_role", [
      attr("user_id", "UUID"),
      attr("role_id", "UUID"),
      attr("user_email", "TEXT"),
    ]);

    const mm = rel(User, Role, "many-to-many");

    const issues = analyzeNormalization([User, Role, Link], [mm]);
    const partial = issuesByCode(issues, "NF2_PARTIAL_DEP").find((x) => /user_email/i.test(x.message));
    expect(partial).toBeDefined();

    const action = partial.actions[0];
    const out = applyNormalizationAction(action, [User, Role, Link], [mm]);

    const outUser = findEntityByName(out.entities, "User");
    const outLink = findEntityByName(out.entities, "user_role");

    expect(hasAttr(outUser, "email")).toBe(true);     
    expect(hasAttr(outLink, "user_email")).toBe(false);
  });
});

describe("analyzeNormalization: 3NF", () => {
  it("NF3_TRANSITIVE: customer_id + customer_email => warning + FIX_TRANSITIVE_DEP action", () => {
    const Customer = ent("Customer", [attr("id", "UUID", true)]);
    const Order = ent("Order", [
      attr("id", "UUID", true),
      attr("customer_id", "UUID"),
      attr("customer_email", "TEXT"),
    ]);

    const issues = analyzeNormalization([Customer, Order], []);
    const i = issueByCode(issues, "NF3_TRANSITIVE");
    expect(i).toBeDefined();
    expect(i.level).toBe("warning");
    expect(i.actions?.[0]?.kind).toBe("FIX_TRANSITIVE_DEP");
  });

  it("FIX_TRANSITIVE_DEP: переносит customer_email в Customer(email), удаляет из Order, создаёт 1:N Customer->Order", () => {
    const Customer = ent("Customer", [attr("id", "UUID", true)]);
    const Order = ent("Order", [
      attr("id", "UUID", true),
      attr("customer_id", "UUID"),
      attr("customer_email", "TEXT"),
    ]);

    const issues = analyzeNormalization([Customer, Order], []);
    const i = issueByCode(issues, "NF3_TRANSITIVE");
    const action = i.actions[0];

    const out = applyNormalizationAction(action, [Customer, Order], []);
    const outCustomer = findEntityByName(out.entities, "Customer");
    const outOrder = findEntityByName(out.entities, "Order");

    expect(hasAttr(outOrder, "customer_email")).toBe(false);
    expect(hasAttr(outCustomer, "email")).toBe(true);

    const r = findRel(out.relationships, outCustomer.id, outOrder.id, "one-to-many", "customer_id");
    expect(r).toBeDefined();
  });

  it("NF3_MISSING_FK: student_name без student_id => info + ADD_MISSING_FK_REL action", () => {
    const Student = ent("Student", [attr("id", "UUID", true)]);
    const Enrollment = ent("Enrollment", [attr("id", "UUID", true), attr("student_name", "TEXT")]);

    const issues = analyzeNormalization([Student, Enrollment], []);
    const i = issueByCode(issues, "NF3_MISSING_FK");
    expect(i).toBeDefined();
    expect(i.level).toBe("info");
    expect(i.actions?.[0]?.kind).toBe("ADD_MISSING_FK_REL");
  });

  it("ADD_MISSING_FK_REL: добавляет student_id и связь Student->Enrollment 1:N", () => {
    const Student = ent("Student", [attr("id", "UUID", true)]);
    const Enrollment = ent("Enrollment", [attr("id", "UUID", true), attr("student_name", "TEXT")]);

    const issues = analyzeNormalization([Student, Enrollment], []);
    const i = issueByCode(issues, "NF3_MISSING_FK");
    const action = i.actions[0];

    const out = applyNormalizationAction(action, [Student, Enrollment], []);
    const outEnrollment = findEntityByName(out.entities, "Enrollment");
    const outStudent = findEntityByName(out.entities, "Student");

    expect(hasAttr(outEnrollment, "student_id")).toBe(true);
    const r = findRel(out.relationships, outStudent.id, outEnrollment.id, "one-to-many", "student_id");
    expect(r).toBeDefined();
  });
});

describe("link-table smell => CREATE_MM_REL_FROM_LINK_TABLE", () => {
  it("NF2_3_LINK_TABLE_SMELL: 2 FK + 'чужие' поля => action CREATE_MM_REL_FROM_LINK_TABLE", () => {
    const User = ent("User", [attr("id", "UUID", true)]);
    const Role = ent("Role", [attr("id", "UUID", true)]);

    const Link = ent("user_role", [
      attr("id", "UUID", true),      
      attr("user_id", "UUID"),
      attr("role_id", "UUID"),
      attr("user_email", "TEXT"),
    ]);

    const issues = analyzeNormalization([User, Role, Link], []);
    const i = issueByCode(issues, "NF2_3_LINK_TABLE_SMELL");
    expect(i).toBeDefined();
    expect(i.level).toBe("info");
    expect(i.actions?.[0]?.kind).toBe("CREATE_MM_REL_FROM_LINK_TABLE");
  });

  it("CREATE_MM_REL_FROM_LINK_TABLE: создаёт M:N и удаляет лишние 1:N (User->Link, Role->Link)", () => {
    const User = ent("User", [attr("id", "UUID", true)]);
    const Role = ent("Role", [attr("id", "UUID", true)]);
    const Link = ent("user_role", [
      attr("user_id", "UUID"),
      attr("role_id", "UUID"),
      attr("user_email", "TEXT"),
    ]);

    
    const r1 = rel(User, Link, "one-to-many");
    r1.fk = { column: "user_id", notNull: true, onDelete: "CASCADE", index: true };

    const r2 = rel(Role, Link, "one-to-many");
    r2.fk = { column: "role_id", notNull: true, onDelete: "CASCADE", index: true };

    const issues = analyzeNormalization([User, Role, Link], [r1, r2]);
    const i = issueByCode(issues, "NF2_3_LINK_TABLE_SMELL");
    const action = i.actions[0];

    const out = applyNormalizationAction(action, [User, Role, Link], [r1, r2]);

    
    const mm = out.relationships.find(
      (r) =>
        r.type === "many-to-many" &&
        ((r.from === User.id && r.to === Role.id) || (r.from === Role.id && r.to === User.id))
    );
    expect(mm).toBeDefined();
    expect((mm.link?.tableName || "").toLowerCase()).toBe("user_role");
    expect((mm.link?.leftColumn || "").toLowerCase()).toBe("user_id");
    expect((mm.link?.rightColumn || "").toLowerCase()).toBe("role_id");

   
    expect(findRel(out.relationships, User.id, Link.id, "one-to-many", "user_id")).toBeUndefined();
    expect(findRel(out.relationships, Role.id, Link.id, "one-to-many", "role_id")).toBeUndefined();
  });
});
