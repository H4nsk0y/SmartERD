// frontend/src/store/useERStore.ts
import { create } from "zustand";
import { nanoid } from "nanoid";
import {
  normalizeEntityName,
  normalizeAttributeName,
} from "../canvas/utils";

/* ---------- Типы ---------- */

export interface Attribute {
  id: string;
  name: string;
  type: string;
  isPrimaryKey?: boolean;
}

export interface Entity {
  id: string;
  name: string;
  x: number;
  y: number;
  attributes: Attribute[];
}

/** Явные настройки FK для 1:1 / 1:N */
export interface FKMeta {
  column?: string;
  type?: string;
  notNull?: boolean;
  unique?: boolean;
  onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  index?: boolean;
}

/** Явные настройки линк-таблицы для N:M */
export interface LinkMeta {
  tableName?: string;
  leftColumn?: string;
  rightColumn?: string;
  compositePrimaryKey?: boolean;
  onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  index?: boolean;
}

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
  fk?: FKMeta;
  link?: LinkMeta;
}

type Snapshot = {
  entities: Entity[];
  relationships: Relationship[];
};

const clone = <T,>(v: T): T => {
  // @ts-ignore
  return typeof structuredClone === "function"
    ? structuredClone(v)
    : JSON.parse(JSON.stringify(v));
};

interface ERState {
  entities: Entity[];
  relationships: Relationship[];

  // --- сущности ---
  addEntity: (name: string, x: number, y: number) => void;
  updateEntityPosition: (id: string, x: number, y: number) => void;
  removeEntity: (id: string) => void;
  renameEntity: (id: string, newName: string) => void;

  // --- атрибуты ---
  addAttribute: (entityId: string, name: string, type: string, isPrimaryKey?: boolean) => void;
  removeAttribute: (entityId: string, attrId: string) => void;

  // --- связи ---
  addRelationship: (from: string, to: string, type: Relationship["type"]) => void;
  removeRelationship: (id: string) => void;
  updateRelationshipType: (id: string, type: Relationship["type"]) => void;

  updateRelationshipMeta: (id: string, patch: Partial<Pick<Relationship, "fk" | "link">>) => void;
  setRelationshipFK: (id: string, fk: Partial<FKMeta>) => void;
  setRelationshipLink: (id: string, link: Partial<LinkMeta>) => void;

  // --- взаимодействие с линиями ---
  selectedRelationshipId: string | null;
  setSelectedRelationship: (id: string | null) => void;

  // --- импорт / сброс данных ---
  setDiagramData: (entities: Entity[], relationships: Relationship[]) => void;
  clearAll: () => void;

  // --- история (undo/redo) ---
  undo: () => void;
  redo: () => void;
  _past: Snapshot[];
  _future: Snapshot[];
  _isRestoring: boolean;
}

/* ---------- Zustand Store ---------- */

export const useERStore = create<ERState>((set, get) => {
  const pushHistory = () => {
    const s = get();
    if (s._isRestoring) return;
    const snap: Snapshot = {
      entities: clone(s.entities),
      relationships: clone(s.relationships),
    };
    set({ _past: [...s._past, snap], _future: [] });
  };

  return {
    entities: [],
    relationships: [],

    _past: [],
    _future: [],
    _isRestoring: false,

    /* ---------- Сущности ---------- */
    addEntity: (name, x, y) => {
      pushHistory();
      set((s) => {
        const used = new Set(s.entities.map((e) => e.name.toLowerCase()));
        const final = normalizeEntityName(name, used);
        return {
          entities: [...s.entities, { id: nanoid(), name: final, x, y, attributes: [] }],
        };
      });
    },

    updateEntityPosition: (id, x, y) => {
      pushHistory();
      set((s) => ({
        entities: s.entities.map((e) => (e.id === id ? { ...e, x, y } : e)),
      }));
    },

    removeEntity: (id) => {
      pushHistory();
      set((s) => ({
        entities: s.entities.filter((e) => e.id !== id),
        relationships: s.relationships.filter((r) => r.from !== id && r.to !== id),
      }));
    },

    renameEntity: (id, newName) => {
      pushHistory();
      set((s) => {
        const used = new Set(
          s.entities
            .filter((e) => e.id !== id)
            .map((e) => e.name.toLowerCase())
        );
        const final = normalizeEntityName(newName, used);
        return {
          entities: s.entities.map((e) => (e.id === id ? { ...e, name: final } : e)),
        };
      });
    },

    /* ---------- Атрибуты ---------- */
    addAttribute: (entityId, name, type, isPrimaryKey = false) => {
      pushHistory();
      set((s) => {
        return {
          entities: s.entities.map((e) => {
            if (e.id !== entityId) return e;
            const usedAttr = new Set(e.attributes.map((a) => a.name.toLowerCase()));
            const finalName = normalizeAttributeName(name, usedAttr);
            return {
              ...e,
              attributes: [
                ...e.attributes.map((a) =>
                  isPrimaryKey ? { ...a, isPrimaryKey: false } : a
                ),
                { id: nanoid(), name: finalName, type, isPrimaryKey },
              ],
            };
          }),
        };
      });
    },

    removeAttribute: (entityId, attrId) => {
      pushHistory();
      set((s) => ({
        entities: s.entities.map((e) =>
          e.id === entityId ? { ...e, attributes: e.attributes.filter((a) => a.id !== attrId) } : e
        ),
      }));
    },

    /* ---------- Связи ---------- */
    addRelationship: (from, to, type) => {
      pushHistory();
      set((s) => ({
        relationships: [...s.relationships, { id: nanoid(), from, to, type }],
      }));
    },

    removeRelationship: (id) => {
      pushHistory();
      set((s) => ({
        relationships: s.relationships.filter((r) => r.id !== id),
      }));
    },

    updateRelationshipType: (id, type) => {
      pushHistory();
      set((s) => ({
        relationships: s.relationships.map((r) => (r.id === id ? { ...r, type } : r)),
      }));
    },

    updateRelationshipMeta: (id, patch) => {
      pushHistory();
      set((s) => ({
        relationships: s.relationships.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }));
    },

    setRelationshipFK: (id, fk) => {
      pushHistory();
      set((s) => ({
        relationships: s.relationships.map((r) =>
          r.id === id ? { ...r, fk: { ...(r.fk ?? {}), ...fk } } : r
        ),
      }));
    },

    setRelationshipLink: (id, link) => {
      pushHistory();
      set((s) => ({
        relationships: s.relationships.map((r) =>
          r.id === id ? { ...r, link: { ...(r.link ?? {}), ...link } } : r
        ),
      }));
    },

    /* ---------- Наведение и выбор связей ---------- */
    selectedRelationshipId: null,
    setSelectedRelationship: (id) => set({ selectedRelationshipId: id }),

    /* ---------- Импорт / Сброс ---------- */
    setDiagramData: (entities, relationships) => {
      pushHistory();
      // Нормализуем и уникализируем имена при импорте
      const result: Entity[] = [];
      for (const e of entities || []) {
        const usedEnt = new Set(result.map((x) => x.name.toLowerCase()));
        const finalEntName = normalizeEntityName(e.name ?? "", usedEnt);
        const usedAttr = new Set<string>();
        const attrs =
          (e.attributes ?? []).map((a) => {
            const finalAttr = normalizeAttributeName(a.name ?? "", usedAttr);
            usedAttr.add(finalAttr.toLowerCase());
            return { ...a, name: finalAttr };
          });
        result.push({ ...clone(e), name: finalEntName, attributes: attrs });
      }
      set(() => ({
        entities: result,
        relationships: clone(relationships || []),
        selectedRelationshipId: null,
      }));
    },

    clearAll: () => {
      pushHistory();
      set(() => ({
        entities: [],
        relationships: [],
        selectedRelationshipId: null,
      }));
    },

    /* ---------- Undo / Redo ---------- */
    undo: () => {
      const s = get();
      if (s._past.length === 0) return;
      const prev = s._past[s._past.length - 1];
      const current: Snapshot = {
        entities: clone(s.entities),
        relationships: clone(s.relationships),
      };
      set({
        _isRestoring: true,
        entities: clone(prev.entities),
        relationships: clone(prev.relationships),
        _past: s._past.slice(0, -1),
        _future: [current, ...s._future],
        selectedRelationshipId: null,
      });
      set({ _isRestoring: false });
    },

    redo: () => {
      const s = get();
      if (s._future.length === 0) return;
      const next = s._future[0];
      const current: Snapshot = {
        entities: clone(s.entities),
        relationships: clone(s.relationships),
      };
      set({
        _isRestoring: true,
        entities: clone(next.entities),
        relationships: clone(next.relationships),
        _past: [...s._past, current],
        _future: s._future.slice(1),
        selectedRelationshipId: null,
      });
      set({ _isRestoring: false });
    },
  };
});
