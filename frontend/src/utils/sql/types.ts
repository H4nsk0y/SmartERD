// src/utils/sql/types.ts
export type SqlDialect = "postgres" | "mysql" | "sqlite" | "mssql";

export interface GenerateOptions {
  dialect?: SqlDialect;
}