// src/utils/sql/index.ts
export { generatePostgresSQL } from "./postgres";
export { generateMySQLSQL }    from "./mysql";
export type { SqlDialect, GenerateOptions } from "./types";
export { generateSQL } from "../generateSQL";
