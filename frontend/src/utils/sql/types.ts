// src/utils/sql/types.ts
export type SqlDialect = "postgres" | "mysql";

export interface GenerateOptions {
  dialect?: SqlDialect;
}
