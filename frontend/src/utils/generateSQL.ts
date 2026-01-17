// frontend/src/utils/generateSQL.ts
import type { Entity, Relationship } from "../store/useERStore";
import { generatePostgresSQL } from "./sql/postgres";
import { generateMySQLSQL } from "./sql/mysql";
import { generateSQLiteSQL } from "./sql/sqlite";
import { generateMSSQLSQL } from "./sql/mssql";
import type { GenerateOptions } from "./sql/types";


export function generateSQL(
  entities: Entity[],
  relationships: Relationship[],
  options: GenerateOptions = {}
): string {
  const dialect = options.dialect ?? "postgres";
  switch (dialect) {
    case "mysql":
      return (generateMySQLSQL as any)(entities, relationships, options);
    case "sqlite":
      return (generateSQLiteSQL as any)(entities, relationships, options);
    case "mssql":
      return (generateMSSQLSQL as any)(entities, relationships, options);
    case "postgres":
    default:
      return (generatePostgresSQL as any)(entities, relationships, options);
  }
}

export type { SqlDialect } from "./sql/types";
export { generatePostgresSQL, generateMySQLSQL, generateSQLiteSQL, generateMSSQLSQL };
