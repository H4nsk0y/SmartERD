// frontend/src/bench/cases.ts
type Attr = { id: string; name: string; type: string; isPrimaryKey?: boolean };
type Entity = { id: string; name: string; attributes: Attr[]; x?: number; y?: number };
type Relationship =
  | { id: string; from: string; to: string; type: "one-to-many"; fk?: any }
  | { id: string; from: string; to: string; type: "one-to-one"; fk?: any }
  | { id: string; from: string; to: string; type: "many-to-many"; link?: any };

// простой детерминированный PRNG (чтобы кейсы были воспроизводимы в отчёте)
function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

function mkAttr(ei: number, ai: number, type: string, isPk = false): Attr {
  return { id: `a_${ei}_${ai}`, name: isPk ? "id" : `field_${ai}`, type, isPrimaryKey: isPk };
}

function mkEntity(i: number, types: string[]): Entity {
  const attrs: Attr[] = [
    mkAttr(i, 0, "UUID", true),
    mkAttr(i, 1, pick(rng(i + 10), types)),
    mkAttr(i, 2, pick(rng(i + 20), types)),
    mkAttr(i, 3, pick(rng(i + 30), types)),
  ];
  return { id: `e_${i}`, name: `Entity_${i}`, attributes: attrs, x: i * 10, y: i * 5 };
}

export type BenchCase = {
  name: string;
  entities: Entity[];
  relationships: Relationship[];
  meta: { entities: number; relations: number; seed: number };
};

// Генерация связей: смесь 1:N, 1:1, M:N
function mkRelationships(entities: Entity[], relCount: number, seed: number): Relationship[] {
  const r = rng(seed);
  const rels: Relationship[] = [];
  const n = entities.length;

  for (let i = 0; i < relCount; i++) {
    const a = Math.floor(r() * n);
    let b = Math.floor(r() * n);
    if (b === a) b = (b + 1) % n;

    const type = pick(r, ["one-to-many", "one-to-one", "many-to-many"] as const);

    if (type === "one-to-many") {
      rels.push({ id: `r_${i}`, from: entities[a].id, to: entities[b].id, type });
    } else if (type === "one-to-one") {
      rels.push({ id: `r_${i}`, from: entities[a].id, to: entities[b].id, type });
    } else {
      // иногда задаём compositePrimaryKey=false чтобы кейс был “богаче”
      const compositePrimaryKey = r() < 0.3 ? false : true;
      rels.push({
        id: `r_${i}`,
        from: entities[a].id,
        to: entities[b].id,
        type,
        link: { compositePrimaryKey },
      });
    }
  }

  return rels;
}

function buildCase(name: string, entityCount: number, relCount: number, seed: number): BenchCase {
  const types = ["TEXT", "INT", "BOOLEAN", "TIMESTAMP", "JSON"];
  const entities: Entity[] = [];
  for (let i = 0; i < entityCount; i++) entities.push(mkEntity(i, types));

  const relationships = mkRelationships(entities, relCount, seed);

  return {
    name,
    entities,
    relationships,
    meta: { entities: entityCount, relations: relCount, seed },
  };
}

export function getBenchCases(): BenchCase[] {
  return [
    buildCase("S", 10, 15, 101),
    buildCase("M", 40, 80, 202),
    buildCase("L", 120, 260, 303),
    buildCase("XL", 300, 700, 404), // “визуально солидно” для отчёта
  ];
}
