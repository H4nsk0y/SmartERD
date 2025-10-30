/**
 * canvas/types/index.ts
 * Общие типы UI-слоя канваса.
 * Здесь ничего «умного» — просто типы, чтобы разгрузить EditorCanvas.tsx.
 */
export type RelationKind = "one-to-one" | "one-to-many" | "many-to-many";


export type Size = { w: number; h: number };

export type Action = "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";

export type FKForm = {
  column: string;
  type: string;
  notNull?: boolean;
  unique?: boolean;
  onDelete?: Action;
  onUpdate?: Action;
  index?: boolean;
};

export type LinkForm = {
  tableName: string;
  leftColumn: string;
  rightColumn: string;
  compositePrimaryKey?: boolean;
  onDelete?: Action;
  onUpdate?: Action;
  index?: boolean;
};
