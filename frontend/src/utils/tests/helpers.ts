import type { Entity, Relationship, Attribute } from "../../store/useERStore";
import { nanoid } from "nanoid";

// Быстрое создание атрибута
export function attr(
  name: string,
  type: string = "UUID",
  isPK: boolean = false
): Attribute {
  return {
    id: nanoid(),
    name,
    type,
    isPrimaryKey: isPK
  };
}

// Быстрое создание сущности
export function ent(
  name: string,
  attributes: Attribute[] = []
): Entity {
  return {
    id: nanoid(),
    name,
    x: 0,
    y: 0,
    attributes
  };
}

// Быстрое создание связи
export function rel(
  from: Entity,
  to: Entity,
  type: Relationship["type"]
): Relationship {
  return {
    id: nanoid(),
    from: from.id,
    to: to.id,
    type
  };
}
