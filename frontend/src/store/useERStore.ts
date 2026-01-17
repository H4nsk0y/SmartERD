// frontend/src/store/useERStore.ts
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
  color?: string; // ✅ цвет карточки
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
  return typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v));
};

/* ---------- Мягкие нормалайзеры имен (разрешаем _ и -) ---------- */

const ENTITY_NAME_MAX = 64;
const ATTR_NAME_MAX = 64;

/** Пропускаем буквы/цифры/подчёркивание/дефис и одинарные пробелы по краям обрезаем */
function filterIdentifier(input: string, maxLen: number): string {
  const onlyAllowed = (input ?? "")
    .replace(/[^\p{L}\p{N}_\- ]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return onlyAllowed.slice(0, maxLen);
}

/** Уникализатор: если занято — добавляем _2/_3/... (case-insensitive) */
function uniquify(base: string, usedLower: Set<string>): string {
  let name = base || "Entity";
  let i = 2;
  while (usedLower.has(name.toLowerCase())) {
    name = `${base || "Entity"}_${i}`;
    i += 1;
  }
  return name;
}

function normalizeEntityNameLoose(raw: string, usedLower: Set<string>) {
  const filtered = filterIdentifier(raw, ENTITY_NAME_MAX);
  return uniquify(filtered || "Entity", usedLower);
}

function normalizeAttributeNameLoose(raw: string, usedLower: Set<string>) {
  const filtered = filterIdentifier(raw, ATTR_NAME_MAX);
  return uniquify(filtered || "attr", usedLower);
}

/** ✅ Проверка: есть ли уже связь между этими сущностями (в любом направлении) */
function hasRelationshipBetween(rels: Relationship[], a: string, b: string): boolean {
  return rels.some((r) => (r.from === a && r.to === b) || (r.from === b && r.to === a));
}

interface ERState {
  entities: Entity[];
  relationships: Relationship[];

  //NEW: batch для групповых операций (drag / delete group)
  beginBatch: () => void;
  endBatch: () => void;

  //NEW: удобный атомарный delete группы
  removeEntities: (ids: string[]) => void;

  // сущности
  addEntity: (name: string, x: number, y: number) => void;
  updateEntityPosition: (id: string, x: number, y: number) => void;
  updateEntitiesPositions: (updates: Array<{ id: string; x: number; y: number }>) => void;
  removeEntity: (id: string) => void;
  renameEntity: (id: string, newName: string) => void;

  // цвет сущности
  setEntityColor: (id: string, color: string) => void;

  // атрибуты
  addAttribute: (entityId: string, name: string, type: string, isPrimaryKey?: boolean) => void;
  removeAttribute: (entityId: string, attrId: string) => void;

  // правки существующих атрибутов
  updateAttributeName: (entityId: string, attrId: string, newName: string) => void;
  updateAttributeType: (entityId: string, attrId: string, newType: string) => void;
  setAttributePrimaryKey: (entityId: string, attrId: string, isPrimary: boolean) => void;

  // связи
  addRelationship: (from: string, to: string, type: Relationship["type"]) => void;
  removeRelationship: (id: string) => void;
  updateRelationshipType: (id: string, type: Relationship["type"]) => void;

  updateRelationshipMeta: (id: string, patch: Partial<Pick<Relationship, "fk" | "link">>) => void;
  setRelationshipFK: (id: string, fk: Partial<FKMeta>) => void;
  setRelationshipLink: (id: string, link: Partial<LinkMeta>) => void;

  // взаимодействие с линиями
  selectedRelationshipId: string | null;
  setSelectedRelationship: (id: string | null) => void;

  // импорт / сброс данных
  setDiagramData: (entities: Entity[], relationships: Relationship[]) => void;
  clearAll: () => void;

  // история (undo/redo)
  undo: () => void;
  redo: () => void;
  _past: Snapshot[];
  _future: Snapshot[];
  _isRestoring: boolean;

  // ✅ NEW: depth батча (можно nested)
  _batchDepth: number;
}

/* ---------- Zustand Store ---------- */

export const useERStore = create<ERState>((set, get) => {
  const pushHistory = () => {
    const s = get();
    if (s._isRestoring) return;

    // ✅ NEW: если мы внутри batch — не пишем историю на каждый action
    if (s._batchDepth > 0) return;

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

    // ✅ NEW
    _batchDepth: 0,

    /* ---------- ✅ Batch API ---------- */
    beginBatch: () => {
      set((s) => {
        if (s._isRestoring) return {};
        const nextDepth = (s._batchDepth ?? 0) + 1;

        // первая “входная” точка батча — пишем snapshot
        if ((s._batchDepth ?? 0) === 0) {
          const snap: Snapshot = {
            entities: clone(s.entities),
            relationships: clone(s.relationships),
          };
          return {
            _batchDepth: nextDepth,
            _past: [...s._past, snap],
            _future: [],
          };
        }

        return { _batchDepth: nextDepth };
      });
    },

    endBatch: () => {
      set((s) => ({
        _batchDepth: Math.max(0, (s._batchDepth ?? 0) - 1),
      }));
    },

    removeEntities: (ids) => {
      const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
      if (list.length === 0) return;

      pushHistory();
      const kill = new Set(list);

      set((s) => ({
        entities: s.entities.filter((e) => !kill.has(e.id)),
        relationships: s.relationships.filter((r) => !kill.has(r.from) && !kill.has(r.to)),
      }));
    },

    /* ---------- Сущности ---------- */
    addEntity: (name, x, y) => {
      pushHistory();
      set((s) => {
        const used = new Set(s.entities.map((e) => e.name.toLowerCase()));
        const final = normalizeEntityNameLoose(name, used);
        return {
          entities: [...s.entities, { id: nanoid(), name: final, x, y, attributes: [], color: undefined }],
        };
      });
    },

    updateEntityPosition: (id, x, y) => {
      pushHistory();
      set((s) => ({
        entities: s.entities.map((e) => (e.id === id ? { ...e, x, y } : e)),
      }));
    },

     updateEntitiesPositions: (updates) => {
      const list = Array.isArray(updates) ? updates : [];
      if (list.length === 0) return;

      pushHistory();

      const map = new Map<string, { x: number; y: number }>();
      for (const u of list) map.set(u.id, { x: u.x, y: u.y });

      set((s) => ({
        entities: s.entities.map((e) => {
          const p = map.get(e.id);
          return p ? { ...e, x: p.x, y: p.y } : e;
        }),
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
        const final = normalizeEntityNameLoose(newName, used);
        return {
          entities: s.entities.map((e) => (e.id === id ? { ...e, name: final } : e)),
        };
      });
    },

    // ✅ Установка цвета карточки
    setEntityColor: (id, color) => {
      pushHistory();
      set((s) => ({
        entities: s.entities.map((e) => (e.id === id ? { ...e, color } : e)),
      }));
    },

    /* ---------- Атрибуты ---------- */
    addAttribute: (entityId, name, type, isPrimaryKey = false) => {
      pushHistory();
      set((s) => ({
        entities: s.entities.map((e) => {
          if (e.id !== entityId) return e;
          const usedLower = new Set(e.attributes.map((a) => a.name.toLowerCase()));
          const finalName = normalizeAttributeNameLoose(name, usedLower);
          return {
            ...e,
            attributes: [
              ...e.attributes.map((a) => (isPrimaryKey ? { ...a, isPrimaryKey: false } : a)),
              { id: nanoid(), name: finalName, type, isPrimaryKey },
            ],
          };
        }),
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

    updateAttributeName: (entityId, attrId, newName) => {
      pushHistory();
      set((s) => ({
        entities: s.entities.map((e) => {
          if (e.id !== entityId) return e;
          const used = new Set(
            e.attributes
              .filter((a) => a.id !== attrId)
              .map((a) => a.name.toLowerCase())
          );
          const final = normalizeAttributeNameLoose(newName, used);
          return {
            ...e,
            attributes: e.attributes.map((a) => (a.id === attrId ? { ...a, name: final } : a)),
          };
        }),
      }));
    },

    updateAttributeType: (entityId, attrId, newType) => {
      pushHistory();
      set((s) => ({
        entities: s.entities.map((e) =>
          e.id === entityId
            ? {
                ...e,
                attributes: e.attributes.map((a) => (a.id === attrId ? { ...a, type: newType } : a)),
              }
            : e
        ),
      }));
    },

    setAttributePrimaryKey: (entityId, attrId, isPrimary) => {
      pushHistory();
      set((s) => ({
        entities: s.entities.map((e) => {
          if (e.id !== entityId) return e;
          return {
            ...e,
            attributes: e.attributes.map((a) =>
              a.id === attrId
                ? { ...a, isPrimaryKey: isPrimary }
                : isPrimary
                ? { ...a, isPrimaryKey: false }
                : a
            ),
          };
        }),
      }));
    },

    /* ---------- Связи ---------- */
    addRelationship: (from, to, type) => {
      const s = get();

      // ✅ НОВОЕ ПРАВИЛО: без ролей/уточнений — одна связь на пару сущностей (в любом направлении)
      if (hasRelationshipBetween(s.relationships, from, to)) {
        return; // ничего не делаем, историю не пишем
      }

      pushHistory();
      set((st) => ({
        relationships: [...st.relationships, { id: nanoid(), from, to, type }],
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
      const clean: Partial<FKMeta> = { ...fk };
      if (typeof clean.column === "string" && clean.column.trim() === "") {
        delete clean.column;
      }
      set((s) => ({
        relationships: s.relationships.map((r) =>
          r.id === id ? { ...r, fk: { ...(r.fk ?? {}), ...clean } } : r
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

      const result: Entity[] = [];
      for (const e of entities || []) {
        const usedEnt = new Set(result.map((x) => x.name.toLowerCase()));
        const finalEntName = normalizeEntityNameLoose(e.name ?? "", usedEnt);

        const usedAttr = new Set<string>();
        const attrs = (e.attributes ?? []).map((a) => {
          const finalAttr = normalizeAttributeNameLoose(a.name ?? "", usedAttr);
          usedAttr.add(finalAttr.toLowerCase());
          return { ...a, name: finalAttr };
        });

        result.push({
          ...clone(e),
          name: finalEntName,
          attributes: attrs,
          color: e.color, // ✅ сохраняем цвет при импорте
        });
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
        _batchDepth: 0, // NEW: сброс batch
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
        _batchDepth: 0, //NEW: сброс batch
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
