// frontend/src/bench/benchmark.bench.ts
import { describe, it, expect } from "vitest";
import { performance } from "node:perf_hooks";
import * as fs from "node:fs";
import * as path from "node:path";

import { getBenchCases } from "./cases";

import { analyzeNormalization } from "../utils/normalization";

import { generatePostgresSQL } from "../utils/sql/postgres";
import { generateMySQLSQL } from "../utils/sql/mysql";
import { generateMSSQLSQL } from "../utils/sql/mssql";
import { generateSQLiteSQL } from "../utils/sql/sqlite";

function stats(samples: number[]) {
  const s = [...samples].sort((a, b) => a - b);
  const mean = s.reduce((acc, x) => acc + x, 0) / s.length;
  const median =
    s.length % 2
      ? s[(s.length - 1) / 2]
      : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;

  const p95Index = Math.max(0, Math.ceil(s.length * 0.95) - 1);
  const p95 = s[p95Index] ?? s[s.length - 1];

  return { mean, median, p95, min: s[0], max: s[s.length - 1] };
}

async function benchFn(label: string, fn: () => any, warmup = 2, runs = 10) {
  // прогрев
  for (let i = 0; i < warmup; i++) fn();

  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    const t1 = performance.now();
    samples.push(t1 - t0);
  }
  return { label, samples, ...stats(samples) };
}

describe("benchmark: normalization + SQL generation (S/M/L/XL)", () => {
  it("runs and writes results to ./bench-results", async () => {
    if (typeof analyzeNormalization !== "function") {
      throw new Error(
        "Не нашёл analyzeNormalization в src/utils/normalization.ts. " +
          "Проверь, что функция экспортируется как analyzeNormalization."
      );
    }

    const cases = getBenchCases();

    const outDir = path.join(process.cwd(), "bench-results");
    fs.mkdirSync(outDir, { recursive: true });

    const results: any[] = [];

    for (const c of cases) {
      // normalization (у вас это analyzeNormalization)
      const normRes = await benchFn(
        `normalize_${c.name}`,
        () => analyzeNormalization(c.entities as any, c.relationships as any),
        2,
        12
      );

      // SQL generation по всем диалектам
      const pgRes = await benchFn(
        `sql_pg_${c.name}`,
        () => generatePostgresSQL(c.entities as any, c.relationships as any),
        1,
        10
      );
      const myRes = await benchFn(
        `sql_mysql_${c.name}`,
        () => generateMySQLSQL(c.entities as any, c.relationships as any),
        1,
        10
      );
      const msRes = await benchFn(
        `sql_mssql_${c.name}`,
        () => generateMSSQLSQL(c.entities as any, c.relationships as any),
        1,
        10
      );
      const sqRes = await benchFn(
        `sql_sqlite_${c.name}`,
        () => generateSQLiteSQL(c.entities as any, c.relationships as any),
        1,
        10
      );

      results.push({
        case: c.name,
        meta: c.meta,
        normalization: normRes,
        sql: { postgres: pgRes, mysql: myRes, mssql: msRes, sqlite: sqRes },
      });
    }

    // JSON
    const jsonPath = path.join(outDir, `bench.json`);
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({ createdAt: new Date().toISOString(), results }, null, 2),
      "utf-8"
    );

    // CSV (удобно в Excel/Word)
    const csvLines: string[] = [
      "case,entities,relations,task,mean_ms,median_ms,p95_ms,min_ms,max_ms",
    ];

    for (const row of results) {
      const { case: cn, meta } = row;

      const push = (task: string, r: any) => {
        csvLines.push(
          [
            cn,
            meta.entities,
            meta.relations,
            task,
            r.mean.toFixed(3),
            r.median.toFixed(3),
            r.p95.toFixed(3),
            r.min.toFixed(3),
            r.max.toFixed(3),
          ].join(",")
        );
      };

      push("normalize(analyzeNormalization)", row.normalization);
      push("sql_postgres", row.sql.postgres);
      push("sql_mysql", row.sql.mysql);
      push("sql_mssql", row.sql.mssql);
      push("sql_sqlite", row.sql.sqlite);
    }

    const csvPath = path.join(outDir, `bench.csv`);
    fs.writeFileSync(csvPath, csvLines.join("\n"), "utf-8");

    // Лог
    console.log("\n=== BENCHMARK RESULTS (median ms) ===");
    for (const row of results) {
      console.log(
        `${row.case}: normalize=${row.normalization.median.toFixed(2)}ms | ` +
          `pg=${row.sql.postgres.median.toFixed(2)}ms mysql=${row.sql.mysql.median.toFixed(
            2
          )}ms ` +
          `mssql=${row.sql.mssql.median.toFixed(2)}ms sqlite=${row.sql.sqlite.median.toFixed(2)}ms`
      );
    }
    console.log(`\nSaved: ${jsonPath}`);
    console.log(`Saved: ${csvPath}\n`);

    expect(true).toBe(true);
  });
});
