import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import Chart from "chart.js/auto";
import { Canvas, Image } from "skia-canvas";

/* ---------- FS ---------- */
function ensureDirForFile(p) {
  mkdirSync(dirname(p), { recursive: true });
}
function findInputPath() {
  const candidates = [
    resolve("frontend/reports/perf/perf_log.jsonl"),
    resolve("reports/perf/perf_log.jsonl"),
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  throw new Error(
    "perf_log.jsonl not found.\n" +
    `Expected at:\n - ${candidates[0]}\n - ${candidates[1]}\n` +
    "Run BDD perf scenarios (npm run bdd)."
  );
}

/* ---------- Parse ---------- */
function parseJsonl(path) {
  const raw = readFileSync(path, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const out = [];
  for (const line of lines) {
    try { out.push(JSON.parse(line)); } catch { /* skip bad */ }
  }
  return out;
}

/* ---------- Helpers ---------- */
function getTypeFromDatasetId(id) {
  const m = /^G_([^_]+)_N/i.exec(id);
  return m ? m[1] : "unknown";
}
function seriesKey(e) {
  const type = getTypeFromDatasetId(e.datasetId);
  const d = typeof e.density === "number" ? e.density.toFixed(3) : "NA";
  return `${type}_d${d}`;
}
/* last write wins по N внутри серии */
function toSeries(entries) {
  const map = {}; // key -> Map<N, point>
  for (const e of entries) {
    const key = seriesKey(e);
    if (!map[key]) map[key] = new Map();
    map[key].set(e.n, {
      n: e.n,
      timeA: e.timeA_ms,
      timeB: e.timeB_ms,
      density: e.density,
      datasetId: e.datasetId,
    });
  }
  const out = {};
  for (const key of Object.keys(map)) {
    out[key] = Array.from(map[key].values()).sort((a, b) => a.n - b.n);
  }
  return out;
}

/* ---------- Plot ---------- */
async function plotTimeVsN(title, points, outPng) {
  const chart = new ChartJSNodeCanvas({
    width: 1000,
    height: 600,
    chartJs: Chart,
    canvas: Canvas,
    image: Image,
  });

  const labels = points.map((p) => String(p.n));
  const dataA  = points.map((p) => p.timeA);
  const dataB  = points.map((p) => p.timeB);

  const cfg = {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "naive (ms)", data: dataA },
        { label: "heap (ms)",  data: dataB },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: title },
        legend: { display: true },
      },
      scales: {
        x: { title: { display: true, text: "N (nodes)" } },
        y: { title: { display: true, text: "Time (ms)" } },
      },
    },
  };

  const image = await chart.renderToBuffer(cfg);
  ensureDirForFile(outPng);
  writeFileSync(outPng, image);
}

/* ---------- CSV ---------- */
function writeCsv(all, outCsv) {
  ensureDirForFile(outCsv);
  const head = [
    "datasetId","type","n","density","algoA","timeA_ms","algoB","timeB_ms","memA_MB","memB_MB","platform","node",
  ];
  const rows = all.map((e) => {
    const type = getTypeFromDatasetId(e.datasetId);
    const memA = typeof e.memA_MB === "number" && e.memA_MB < 0 ? 0 : (e.memA_MB ?? "");
    const memB = typeof e.memB_MB === "number" && e.memB_MB < 0 ? 0 : (e.memB_MB ?? "");
    return [
      e.datasetId, type, e.n, e.density ?? "", e.algoA, e.timeA_ms, e.algoB, e.timeB_ms,
      memA, memB, e.env?.platform ?? "", e.env?.node ?? "",
    ].map(String).join(",");
  });
  const csv = [head.join(","), ...rows].join("\n");
  writeFileSync(outCsv, csv, "utf-8");
}

/* ---------- Main ---------- */
async function main() {
  const INPUT  = findInputPath();
  const OUT_DIR = dirname(INPUT);

  const entries = parseJsonl(INPUT);
  if (entries.length === 0) {
    console.error(`No data in ${INPUT}. Run BDD perf scenarios first.`);
    process.exit(1);
  }

  const groups = toSeries(entries);
  for (const [key, points] of Object.entries(groups)) {
    if (points.length < 2) continue; // нужно >= 2 точки для линии
    const [type, dPart] = key.split("_d");
    const title = `Time vs N — ${type} (density=${dPart})`;
    const file  = resolve(OUT_DIR, `time_vs_n_${key}.png`);
    await plotTimeVsN(title, points, file);
  }

  writeCsv(entries, resolve(OUT_DIR, "summary.csv"));
  console.log("Charts and CSV saved to:", OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});