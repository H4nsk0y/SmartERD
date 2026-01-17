// frontend/src/canvas/components/RelationsSvg.tsx
/**
 * RelationsSvg — SVG-слой связей: видимая линия + невидимый хит-путь.
 * Нотация: Crow’s Foot (почти как в учебнике), с optionality для стороны FK:
 *  - 0..1  : o|
 *  - 1..1  : ||
 *  - 0..N  : o<   (по умолчанию для стороны "many")
 *
 * Упрощение: минимальная кратность на стороне "one" (например "обязателен хотя бы один child")
 * не задаётся (нет отдельной настройки), поэтому там показываем только 0..1 или 1..1
 * по fk.notNull.
 *
 * ВАЖНО: для one-to-many и one-to-one считаем:
 *   from = сторона "one"
 *   to   = сторона "many" (для 1:N) или сторона FK (для 1:1)
 *
 * fk.notNull берём из relationship.fk?.notNull (если undefined — считаем true, как у вас по умолчанию).
 */
import React from "react";
import type { Size } from "../types";
import { edgePointRayIntersect } from "../geom";

export type RelationKind = "one-to-one" | "one-to-many" | "many-to-many";

export type RelationsSvgProps = {
  entities: Array<{ id: string; x: number; y: number }>;
  relationships: Array<{
    id: string;
    from: string;
    to: string;
    type: RelationKind;
    fk?: { notNull?: boolean };
  }>;
  sizes: Record<string, Size>;
  pulsedId?: string | null;
  pulseToken?: number;
  hoveredId?: string | null;
  selectedId?: string | null;
  onHover?: (id: string | null) => void;
  onClick?: (id: string) => void;
  worldSize: { w: number; h: number };
  renderLabel?: (args: { id: string; x: number; y: number; kind: RelationKind }) => React.ReactNode;
};

type LineItem = {
  shape: "line";
  id: string;
  type: RelationKind;
  fkNotNull?: boolean;
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  mid: { x: number; y: number };
};

type LoopItem = {
  shape: "loop";
  id: string;
  type: RelationKind;
  fkNotNull?: boolean;
  d: string;
  dHit: string;
  mid: { x: number; y: number };
};

type Item = LineItem | LoopItem;

function markersForKind(kind: RelationKind, fkNotNull?: boolean): { start?: string; end?: string } {
  const nn = fkNotNull !== false; // undefined -> true (как у вас по умолчанию)

  if (kind === "many-to-many") {
    // По смыслу: 0..N с обеих сторон
    return { start: "erd-zero-many", end: "erd-zero-many" };
  }

  if (kind === "one-to-many") {
    // from = one (сколько "one" на один "many") -> 1..1 или 0..1 по fk.notNull
    // to   = many (сколько "many" на один "one") -> 0..N
    return { start: nn ? "erd-one-one" : "erd-zero-one", end: "erd-zero-many" };
  }

  // one-to-one
  // from = one (сколько "one" на один "to") -> 1..1 или 0..1 по fk.notNull (на стороне FK)
  // to   = FK-side (сколько "to" на один "from") -> 0..1 (по умолчанию)
  return { start: nn ? "erd-one-one" : "erd-zero-one", end: "erd-zero-one" };
}

export default function RelationsSvg({
  entities,
  relationships,
  sizes,
  pulsedId,
  pulseToken,
  hoveredId,
  selectedId,
  onHover,
  onClick,
  worldSize,
  renderLabel,
}: RelationsSvgProps) {
  const getEntity = React.useCallback(
    (id: string) => entities.find((e) => e.id === id),
    [entities]
  );

  const makeSelfLoop = React.useCallback((box: { x: number; y: number; w: number; h: number }) => {
    const { x, y, w, h } = box;
    const start = { x: x + w, y: y + h / 2 };

    const rx = Math.max(56, Math.min(120, w * 0.6));
    const ry = Math.max(40, Math.min(96, h * 0.5));

    const c1 = { x: start.x + rx, y: start.y };
    const c2 = { x: start.x + rx, y: y - ry };
    const end = { x: x + w * 0.65, y: y - 10 };

    // Чтобы хит-путь захватывал «хвост» под маркеры
    const tailDir = { x: end.x - c2.x, y: end.y - c2.y };
    const tailLen = Math.hypot(tailDir.x, tailDir.y) || 1;
    const ux = tailDir.x / tailLen;
    const uy = tailDir.y / tailLen;
    const endExt = { x: end.x + ux * 18, y: end.y + uy * 18 };

    const d = `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
    const dHit = `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${endExt.x} ${endExt.y}`;

    const mid = { x: (c2.x + end.x) / 2, y: (c2.y + end.y) / 2 - 8 };

    return { d, dHit, mid };
  }, []);

  const items = React.useMemo<Item[]>(() => {
    const out: Item[] = [];

    for (const r of relationships) {
      const from = getEntity(r.from);
      const to = getEntity(r.to);
      if (!from || !to) continue;

      const fw = sizes[from.id]?.w ?? 224;
      const fh = sizes[from.id]?.h ?? 80;
      const tw = sizes[to.id]?.w ?? 224;
      const th = sizes[to.id]?.h ?? 80;

      const fkNotNull = r.fk?.notNull;

      // self-loop
      if (r.from === r.to) {
        const loop = makeSelfLoop({ x: from.x, y: from.y, w: fw, h: fh });
        out.push({
          shape: "loop",
          id: r.id,
          type: r.type,
          fkNotNull,
          d: loop.d,
          dHit: loop.dHit,
          mid: loop.mid,
        });
        continue;
      }

      const fromC = { x: from.x + fw / 2, y: from.y + fh / 2 };
      const toC = { x: to.x + tw / 2, y: to.y + th / 2 };

      const p1 = edgePointRayIntersect(fromC, toC, fw / 2, fh / 2, 8);
      const p2 = edgePointRayIntersect(toC, fromC, tw / 2, th / 2, 8);
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      out.push({ shape: "line", id: r.id, type: r.type, fkNotNull, p1, p2, mid });
    }

    return out;
  }, [relationships, getEntity, sizes, makeSelfLoop]);

  return (
    <div className="absolute top-0 left-0" style={{ width: worldSize.w, height: worldSize.h, overflow: "visible" }}>
      <svg
        className="absolute top-0 left-0 z-10"
        width={worldSize.w}
        height={worldSize.h}
        style={{ overflow: "visible", pointerEvents: "auto" }}
      >
        <style>{`
          @keyframes erd-flow-hover { to { stroke-dashoffset: -240; } }
          .erd-line { vector-effect: non-scaling-stroke; }
          .erd-line-anim { stroke-dasharray: 14 10; stroke-dashoffset: 0; animation: erd-flow-hover 2.2s linear infinite; }
           @keyframes erd-pulse {
            0%   { stroke-opacity: 0.75; stroke-width: 10; }
            100% { stroke-opacity: 0;    stroke-width: 26; }
          }
          .erd-line-pulse { animation: erd-pulse 1.1s ease-out 0s 1; }
        `}</style>

        <defs>
          {/* Crow’s Foot markers (комбинированные). orient="auto-start-reverse" позволяет одинаково
              выглядеть на markerStart и markerEnd. */}

          {/* 0..1 : o| */}
          <marker
            id="erd-zero-one"
            markerWidth="22"
            markerHeight="14"
            refX="20"
            refY="7"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <circle cx="6" cy="7" r="3.2" stroke="context-stroke" strokeWidth="2" fill="none" />
            <path d="M20,1 L20,13" stroke="context-stroke" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </marker>

          {/* 1..1 : || */}
          <marker
            id="erd-one-one"
            markerWidth="22"
            markerHeight="14"
            refX="20"
            refY="7"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path
              d="M16,1 L16,13 M20,1 L20,13"
              stroke="context-stroke"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
            />
          </marker>

          {/* 0..N : o< */}
          <marker
            id="erd-zero-many"
            markerWidth="26"
            markerHeight="14"
            refX="24"
            refY="7"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <circle cx="6" cy="7" r="3.2" stroke="context-stroke" strokeWidth="2" fill="none" />
            <path
              d="M24,7 L12,1 M24,7 L12,7 M24,7 L12,13"
              stroke="context-stroke"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
          </marker>

          {/* 1..N : |< (оставлено на будущее, если появится настройка обязательности со стороны "one") */}
          <marker
            id="erd-one-many"
            markerWidth="26"
            markerHeight="14"
            refX="24"
            refY="7"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path d="M10,1 L10,13" stroke="context-stroke" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            <path
              d="M24,7 L12,1 M24,7 L12,7 M24,7 L12,13"
              stroke="context-stroke"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
          </marker>
        </defs>

        {items.map((e: Item) => {
          const hovered = hoveredId === e.id;
          const pulsed = pulsedId === e.id;
          const selected = selectedId === e.id;
          const strokeColor = hovered ? "#8b5cf6" : selected ? "#a78bfa" : "#6366f1";
          const strokeWidth = hovered || selected ? 4 : 3;

          const { start, end } = markersForKind(e.type, e.fkNotNull);
          const markerStart = start ? `url(#${start})` : undefined;
          const markerEnd = end ? `url(#${end})` : undefined;

          if (e.shape === "line") {
            const dx = e.p2.x - e.p1.x;
            const dy = e.p2.y - e.p1.y;
            const L = Math.hypot(dx, dy) || 1;
            const ux = dx / L;
            const uy = dy / L;

            const dVisible = `M ${e.p1.x} ${e.p1.y} L ${e.p2.x} ${e.p2.y}`;

            // чуть удлиняем хит-путь, чтобы удобно кликать возле конца
            const p2ext = { x: e.p2.x + ux * 18, y: e.p2.y + uy * 18 };
            const dHit = `M ${e.p1.x} ${e.p1.y} L ${p2ext.x} ${p2ext.y}`;

            return (
              <g key={e.id}>
                <path
                  d={dVisible}
                  fill="none"
                  stroke={strokeColor}
                  strokeLinecap="round"
                  strokeWidth={strokeWidth}
                  markerStart={markerStart}
                  markerEnd={markerEnd}
                  className={`erd-line ${hovered ? "erd-line-anim" : ""}`}
                  pointerEvents="none"
                />
                <path
                  d={dHit}
                  fill="none"
                  stroke="#000"
                  strokeOpacity={0}
                  strokeWidth={22}
                  strokeLinecap="round"
                  className="erd-line"
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onMouseEnter={() => onHover?.(e.id)}
                  onMouseLeave={() => onHover?.(null)}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onClick?.(e.id);
                  }}
                />
              </g>
            );
          }

          // loop
          return (
            <g key={e.id}>
              <path
                d={e.d}
                fill="none"
                stroke={strokeColor}
                strokeLinecap="round"
                strokeWidth={strokeWidth}
                markerStart={markerStart}
                markerEnd={markerEnd}
                className={`erd-line ${hovered ? "erd-line-anim" : ""}`}
                pointerEvents="none"
              />
              <path
                d={e.dHit}
                fill="none"
                stroke="#000"
                strokeOpacity={0}
                strokeWidth={22}
                strokeLinecap="round"
                className="erd-line"
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onMouseEnter={() => onHover?.(e.id)}
                onMouseLeave={() => onHover?.(null)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onClick?.(e.id);
                }}
              />
            </g>
          );
        })}
      </svg>

      {renderLabel &&
        items.map((e: Item) =>
          renderLabel({
            id: e.id,
            x: e.mid.x,
            y: e.mid.y,
            kind: e.type,
          })
        )}
    </div>
  );
}
