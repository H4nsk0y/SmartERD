// src/utils/sql/index.ts
export { generatePostgresSQL } from "./postgres";
export { generateMySQLSQL }    from "./mysql";
export type { SqlDialect, GenerateOptions } from "./types";

// Удобный ре-экспорт «единой» функции из ../generateSQL
export { generateSQL } from "../generateSQL";
