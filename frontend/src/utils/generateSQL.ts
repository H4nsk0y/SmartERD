// src/utils/generateSQL.ts
import type { Entity, Relationship } from "../store/useERStore";
import { generatePostgresSQL } from "./sql/postgres";
import { generateMySQLSQL }    from "./sql/mysql";
import type { SqlDialect, GenerateOptions } from "./sql/types";

export function generateSQL(
  entities: Entity[],
  relationships: Relationship[],
  options: GenerateOptions = {}
): string {
  const dialect = options.dialect ?? "postgres";
  switch (dialect) {
    case "mysql":    return generateMySQLSQL(entities, relationships);
    case "postgres":
    default:         return generatePostgresSQL(entities, relationships);
  }
}

export type { SqlDialect } from "./sql/types";
export { generatePostgresSQL, generateMySQLSQL };
