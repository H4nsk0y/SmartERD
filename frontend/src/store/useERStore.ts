// src/store/useERStore.ts
import { create } from "zustand";
import { nanoid } from "nanoid";

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
  /** Имя столбца FK в целевой таблице (to). По умолчанию: <from_singular>_<pk> */
  column?: string;
  /** SQL-тип столбца FK. По умолчанию: тип PK исходной таблицы */
  type?: string;
  /** NOT NULL (по умолчанию true) */
  notNull?: boolean;
  /** UNIQUE (по умолчанию для one-to-one будет true, но можно переопределить) */
  unique?: boolean;
  /** ON DELETE действие: CASCADE | SET NULL | RESTRICT | NO ACTION (по умолчанию CASCADE) */
  onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  /** ON UPDATE действие (по умолчанию NO ACTION — в SQL обычно опускается) */
  onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  /** Создавать ли индекс на FK (по умолчанию true) */
  index?: boolean;
}

/** Явные настройки линк-таблицы для N:M */
export interface LinkMeta {
  /** Имя таблицы связи (если не указано — будет сгенерировано: <from>_<to>_link) */
  tableName?: string;
  /** Имя левого столбца (ссылается на from) */
  leftColumn?: string;   // напр. user_id
  /** Имя правого столбца (ссылается на to) */
  rightColumn?: string;  // напр. product_id
  /** Явно ставить составной PK (по умолчанию true) */
  compositePrimaryKey?: boolean;
  /** ON DELETE / ON UPDATE для обоих FK (по умолчанию CASCADE / NO ACTION) */
  onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  /** Создавать индексы по обоим FK (по умолчанию true) */
  index?: boolean;
}

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
  /** Опциональные настройки для 1:1 / 1:N */
  fk?: FKMeta;
  /** Опциональные настройки для N:M */
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

  /** Полное обновление метаданных связи (универсальный метод) */
  updateRelationshipMeta: (id: string, patch: Partial<Pick<Relationship, "fk" | "link">>) => void;
  /** Установить/обновить FK-метаданные */
  setRelationshipFK: (id: string, fk: Partial<FKMeta>) => void;
  /** Установить/обновить Link-метаданные (для N:M) */
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
      set((s) => ({
        entities: [...s.entities, { id: nanoid(), name, x, y, attributes: [] }],
      }));
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
      set((s) => ({
        entities: s.entities.map((e) => (e.id === id ? { ...e, name: newName } : e)),
      }));
    },

    /* ---------- Атрибуты ---------- */
    addAttribute: (entityId, name, type, isPrimaryKey = false) => {
      pushHistory();
      set((s) => ({
        entities: s.entities.map((e) =>
          e.id === entityId
            ? {
                ...e,
                attributes: [
                  ...e.attributes.map((a) => (isPrimaryKey ? { ...a, isPrimaryKey: false } : a)),
                  { id: nanoid(), name, type, isPrimaryKey },
                ],
              }
            : e
        ),
      }));
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
        relationships: s.relationships.map((r) =>
          r.id === id ? { ...r, ...patch } : r
        ),
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
      set(() => ({
        entities: clone(entities),
        relationships: clone(relationships),
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
