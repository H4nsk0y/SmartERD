// frontend/features/step_definitions/common.steps.ts
/// <reference types="node" />
import { Given, When, Then, type DataTable } from "@cucumber/cucumber";
import * as assert from "assert/strict";

import state from "../support/state.js";
import { ent, attr, rel } from "../../src/utils/tests/helpers.js";
import { validateModel } from "../../src/utils/validateModel.js";

/** Почему: единый поиск с понятной ошибкой */
function findEntityByName(name: string) {
  const e = state.entities.find((x) => x.name === name);
  assert.ok(
    e,
    `Сущность "${name}" не найдена. Добавь её шагом "есть сущность"/"there is an entity"`
  );
  return e!;
}

/* =========================
   Given
   ========================= */

Given(
  /^(?:(?:есть|у меня есть)\s+сущность\s+"([^"]+)"|I have an entity "([^"]+)"|there is an entity "([^"]+)")$/i,
  function (_ru: string, en1: string, en2: string) {
    const name = _ru ?? en1 ?? en2;
    state.entities.push(ent(name));
  }
);

Given(
  /^(?:есть\s+сущность\s+"([^"]+)"\s+с PK\s+"([^"]+)"|there is an entity "([^"]+)" with PK "([^"]+)")$/i,
  function (ruName: string, ruPk: string, enName: string, enPk: string) {
    const name = ruName ?? enName;
    const pkType = ruPk ?? enPk;
    state.entities.push(ent(name, [attr("id", pkType, true)]));
  }
);

Given(
  /^(?:есть\s+сущность\s+"([^"]+)"\s+с атрибутом\s+"([^"]+)"\s+типа\s+"([^"]+)"|there is an entity "([^"]+)" with attribute "([^"]+)" of type "([^"]+)")$/i,
  function (
    rName: string,
    rCol: string,
    rType: string,
    eName: string,
    eCol: string,
    eType: string
  ) {
    const name = rName ?? eName;
    const col = rCol ?? eCol;
    const t = rType ?? eType;
    state.entities.push(ent(name, [attr(col, t)]));
  }
);

Given(
  /^(?:связь\s+"(one-to-one|one-to-many|many-to-many)"\s+между\s+"([^"]+)"\s+и\s+"([^"]+)"|a (one-to-one|one-to-many|many-to-many) relation between "([^"]+)" and "([^"]+)")$/i,
  function (rt: string, rA: string, rB: string, et: string, eA: string, eB: string) {
    const type = (rt ?? et) as any;
    const left = rA ?? eA;
    const right = rB ?? eB;
    const L = findEntityByName(left);
    const R = findEntityByName(right);
    state.relations.push(rel(L, R, type));
  }
);

Given(
  /^(?:в модели у "([^"]+)" отсутствует атрибут "([^"]+)"|in the model, "([^"]+)" has no attribute "([^"]+)")$/i,
  function (rEnt: string, rAttr: string, eEnt: string, eAttr: string) {
    const entityName = rEnt ?? eEnt;
    const attrName = rAttr ?? eAttr;
    const e = state.entities.find((en) => en.name === entityName);
    assert.ok(e, `Сущность "${entityName}" не найдена`);
    const has = (e.attributes ?? []).some(
      (a: any) => String(a.name).toLowerCase() === String(attrName).toLowerCase()
    );
    assert.ok(!has, `Ожидалось, что у "${entityName}" НЕТ атрибута "${attrName}"`);
  }
);

Given(/^(?:есть следующие сущности:|the following entities exist:)$/i, function (table: DataTable) {
  const rows = table.hashes();
  rows.forEach((r) => {
    const name = r.name ?? r.Name ?? r.entity ?? r.Entity;
    if (name && typeof name === "string") state.entities.push(ent(name));
  });
});

/* =========================
   When
   ========================= */

When(/^(?:валидирую модель|I validate the model)$/i, function () {
  state.result = validateModel(state.entities, state.relations);
  assert.ok(state.result, "Ожидался результат валидации");
});

/** УНИКАЛЬНЫЕ императивные шаги (без пересечения с Given) */

/** RU/EN: я добавляю сущность / I add an entity */
When(
  /^(?:я добавляю сущность\s+"([^"]+)"|I add an entity "([^"]+)")$/i,
  function (ruName: string, enName: string) {
    const name = ruName ?? enName;
    state.entities.push(ent(name));
  }
);

/** RU/EN: я добавляю сущность с PK / I add an entity with PK */
When(
  /^(?:я добавляю сущность\s+"([^"]+)"\s+с PK\s+"([^"]+)"|I add an entity "([^"]+)" with PK "([^"]+)")$/i,
  function (ruName: string, ruPk: string, enName: string, enPk: string) {
    const name = ruName ?? enName;
    const pkType = ruPk ?? enPk;
    state.entities.push(ent(name, [attr("id", pkType, true)]));
  }
);

/** RU/EN: я добавляю сущность с атрибутом / I add an entity with attribute */
When(
  /^(?:я добавляю сущность\s+"([^"]+)"\s+с атрибутом\s+"([^"]+)"\s+типа\s+"([^"]+)"|I add an entity "([^"]+)" with attribute "([^"]+)" of type "([^"]+)")$/i,
  function (
    rName: string,
    rCol: string,
    rType: string,
    eName: string,
    eCol: string,
    eType: string
  ) {
    const name = rName ?? eName;
    const col = rCol ?? eCol;
    const t = rType ?? eType;
    state.entities.push(ent(name, [attr(col, t)]));
  }
);

/** RU/EN: я создаю связь / I create a relation */
When(
  /^(?:я создаю связь\s+"(one-to-one|one-to-many|many-to-many)"\s+между\s+"([^"]+)"\s+и\s+"([^"]+)"|I create a (one-to-one|one-to-many|many-to-many) relation between "([^"]+)" and "([^"]+)")$/i,
  function (rt: string, rA: string, rB: string, et: string, eA: string, eB: string) {
    const type = (rt ?? et) as any;
    const left = rA ?? eA;
    const right = rB ?? eB;
    const L = findEntityByName(left);
    const R = findEntityByName(right);
    state.relations.push(rel(L, R, type));
  }
);

/* =========================
   Then
   ========================= */

Then(
  /^(?:присутствует issue\s+"([^"]+)"|issue "([^"]+)" is present)$/i,
  function (rCode: string, eCode: string) {
    const code = rCode ?? eCode;
    assert.ok(state.result, "Результат не вычислен");
    const has = state.result!.issues.some(
      (i: { code: string; message?: string }) => i.code === code
    );
    assert.ok(has, `Ожидалась issue ${code}`);
  }
);

Then(
  /^(?:issue\s+"([^"]+)" отсутствует|issue "([^"]+)" is absent)$/i,
  function (rCode: string, eCode: string) {
    const code = rCode ?? eCode;
    assert.ok(state.result, "Результат не вычислен");
    const has = state.result!.issues.some(
      (i: { code: string; message?: string }) => i.code === code
    );
    assert.ok(!has, `Issue ${code} не должна присутствовать`);
  }
);

Then(
  /^(?:ok\s+равно\s+(true|false)|ok equals (true|false))$/i,
  function (rWord: string, eWord: string) {
    assert.ok(state.result, "Результат не вычислен");
    const word = (rWord ?? eWord).toLowerCase();
    const expected = word === "true";
    assert.equal(state.result!.ok, expected);
  }
);

Then(
  /^(?:сообщение issue\s+"([^"]+)"\s+содержит\s+"([^"]+)"|the issue "([^"]+)" message contains "([^"]+)")$/i,
  function (rCode: string, rFrag: string, eCode: string, eFrag: string) {
    const code = rCode ?? eCode;
    const fragment = (rFrag ?? eFrag).toLowerCase();
    assert.ok(state.result, "Результат не вычислен");
    const issue = state.result!.issues.find(
      (i: { code: string; message?: string }) => i.code === code
    );
    assert.ok(issue, `Не найдена issue ${code}`);
    assert.ok(
      (issue!.message ?? "").toLowerCase().includes(fragment),
      `В сообщении issue ${code} нет подстроки "${fragment}"`
    );
  }
);
