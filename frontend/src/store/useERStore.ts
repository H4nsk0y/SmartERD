// src/store/useERStore.ts
import { create } from "zustand";
import { nanoid } from "nanoid";

/* ---------- Типы ---------- */

export interface Attribute {
  id: string;
  name: string;
  type: string;
}

export interface Entity {
  id: string;
  name: string;
  x: number;
  y: number;
  attributes: Attribute[];
}

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
}

interface ERState {
  entities: Entity[];
  relationships: Relationship[];

  addEntity: (name: string, x: number, y: number) => void;
  updateEntityPosition: (id: string, x: number, y: number) => void;

  addAttribute: (entityId: string, name: string, type: string) => void;
  removeAttribute: (entityId: string, attrId: string) => void;

  addRelationship: (from: string, to: string, type: Relationship["type"]) => void;
  removeRelationship: (id: string) => void;


  removeEntity: (id: string) => void;

  
  renameEntity: (id: string, newName: string) => void;
}

/* ---------- Zustand Store ---------- */

export const useERStore = create<ERState>((set) => ({
  entities: [],
  relationships: [],

  addEntity: (name, x, y) =>
    set((s) => ({
      entities: [
        ...s.entities,
        { id: nanoid(), name, x, y, attributes: [] },
      ],
    })),

  updateEntityPosition: (id, x, y) =>
    set((s) => ({
      entities: s.entities.map((e) =>
        e.id === id ? { ...e, x, y } : e
      ),
    })),

  addAttribute: (entityId, name, type) =>
    set((s) => ({
      entities: s.entities.map((e) =>
        e.id === entityId
          ? {
              ...e,
              attributes: [
                ...e.attributes,
                { id: nanoid(), name, type },
              ],
            }
          : e
      ),
    })),

  removeAttribute: (entityId, attrId) =>
    set((s) => ({
      entities: s.entities.map((e) =>
        e.id === entityId
          ? {
              ...e,
              attributes: e.attributes.filter((a) => a.id !== attrId),
            }
          : e
      ),
    })),

  addRelationship: (from, to, type) =>
    set((s) => ({
      relationships: [
        ...s.relationships,
        { id: nanoid(), from, to, type },
      ],
    })),

  removeRelationship: (id) =>
    set((s) => ({
      relationships: s.relationships.filter((r) => r.id !== id),
    })),

  removeEntity: (id) =>
    set((s) => ({
      entities: s.entities.filter((e) => e.id !== id),
      relationships: s.relationships.filter(
        (r) => r.from !== id && r.to !== id
      ),
    })),

  renameEntity: (id, newName) =>
    set((s) => ({
      entities: s.entities.map((e) =>
        e.id === id ? { ...e, name: newName } : e
      ),
    })),
}));
