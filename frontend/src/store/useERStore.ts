import { create } from "zustand";

/* ---------- Типы данных для ER-диаграммы ---------- */
export interface Attribute {
  id: string;
  name: string;
  type: string;
}

export interface Entity {
  id: string;
  name: string;
  x: number; // позиция на холсте
  y: number;
  attributes: Attribute[];
}

export interface Relationship {
  id: string;
  from: string; // id первой сущности
  to: string;   // id второй сущности
  type: "one-to-one" | "one-to-many" | "many-to-many";
}

/* ---------- Интерфейс состояния ---------- */
interface ERState {
  entities: Entity[];
  relationships: Relationship[];

  addEntity: (name: string, x: number, y: number) => void;
  removeEntity: (id: string) => void;
  updateEntityPosition: (id: string, x: number, y: number) => void;

  addRelationship: (from: string, to: string, type: Relationship["type"]) => void;

  addAttribute: (entityId: string, name: string, type: string) => void;
  removeAttribute: (entityId: string, attributeId: string) => void;
}

/* ---------- Zustand Store ---------- */
export const useERStore = create<ERState>((set) => ({
  entities: [],
  relationships: [],

  /* --- Добавление новой сущности --- */
  addEntity: (name, x, y) =>
    set((state) => ({
      entities: [
        ...state.entities,
        {
          id: crypto.randomUUID(),
          name,
          x,
          y,
          attributes: [],
        },
      ],
    })),

  /* --- Удаление сущности и связанных связей --- */
  removeEntity: (id) =>
    set((state) => ({
      entities: state.entities.filter((e) => e.id !== id),
      relationships: state.relationships.filter(
        (r) => r.from !== id && r.to !== id
      ),
    })),

  /* --- Обновление позиции сущности (при перетаскивании) --- */
  updateEntityPosition: (id, x, y) =>
    set((state) => ({
      entities: state.entities.map((e) =>
        e.id === id ? { ...e, x, y } : e
      ),
    })),

  /* --- Добавление новой связи --- */
  addRelationship: (from, to, type) =>
    set((state) => ({
      relationships: [
        ...state.relationships,
        { id: crypto.randomUUID(), from, to, type },
      ],
    })),

  /* --- Добавление атрибута в сущность --- */
  addAttribute: (entityId, name, type) =>
    set((state) => ({
      entities: state.entities.map((e) =>
        e.id === entityId
          ? {
              ...e,
              attributes: [
                ...e.attributes,
                { id: crypto.randomUUID(), name, type },
              ],
            }
          : e
      ),
    })),

  /* --- Удаление атрибута из сущности --- */
  removeAttribute: (entityId, attributeId) =>
    set((state) => ({
      entities: state.entities.map((e) =>
        e.id === entityId
          ? {
              ...e,
              attributes: e.attributes.filter((a) => a.id !== attributeId),
            }
          : e
      ),
    })),
}));
