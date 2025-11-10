// frontend/src/canvas/components/RelationsSvg.tsx
/**
 * RelationsSvg — SVG-слой связей: видимая линия + невидимый хит-путь.
 * События обрабатывает ТОЛЬКО хит-путь. Контейнер принимает события.
 */
import React from "react";
import type { Size } from "../types";
import { edgePointRayIntersect } from "../geom";

export type RelationKind = "one-to-one" | "one-to-many" | "many-to-many";

export type RelationsSvgProps = {
  entities: Array<{ id: string; x: number; y: number }>;
  relationships: Array<{ id: string; from: string; to: string; type: RelationKind }>;
  sizes: Record<string, Size>;
  hoveredId?: string | null;
  selectedId?: string | null;
  onHover?: (id: string | null) => void;
  onClick?: (id: string) => void;
  worldSize: { w: number; h: number };
  renderLabel?: (args: { id: string; x: number; y: number; kind: RelationKind }) => React.ReactNode;
};

export default function RelationsSvg({
  entities,
  relationships,
  sizes,
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

  const items = React.useMemo(() => {
    return relationships.flatMap((r) => {
      const from = getEntity(r.from);
      const to = getEntity(r.to);
      if (!from || !to) return [];

      const fw = sizes[from.id]?.w ?? 224;
      const fh = sizes[from.id]?.h ?? 80;
      const tw = sizes[to.id]?.w ?? 224;
      const th = sizes[to.id]?.h ?? 80;

      const fromC = { x: from.x + fw / 2, y: from.y + fh / 2 };
      const toC   = { x: to.x   + tw / 2, y: to.y   + th / 2 };

      const p1 = edgePointRayIntersect(fromC, toC, fw / 2, fh / 2, 8);
      const p2 = edgePointRayIntersect(toC, fromC, tw / 2, th / 2, 8);

      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      return [{ id: r.id, type: r.type as RelationKind, p1, p2, mid }];
    });
  }, [relationships, getEntity, sizes]);

  return (
    <div className="absolute top-0 left-0" style={{ width: worldSize.w, height: worldSize.h, overflow: "visible" }}>
      <svg
        className="absolute top-0 left-0 z-10"
        width={worldSize.w}
        height={worldSize.h}
        style={{ overflow: "visible", pointerEvents: "auto" }} // ← принимаем события
      >
        <style>{`
          @keyframes erd-flow-hover { to { stroke-dashoffset: -240; } }
          .erd-line { vector-effect: non-scaling-stroke; }
          .erd-line-anim { stroke-dasharray: 14 10; stroke-dashoffset: 0; animation: erd-flow-hover 2.2s linear infinite; }
        `}</style>

        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="context-stroke" pointerEvents="none" />
          </marker>
        </defs>

        {items.map((e) => {
          const dx = e.p2.x - e.p1.x;
          const dy = e.p2.y - e.p1.y;
          const L = Math.hypot(dx, dy) || 1;
          const ux = dx / L;
          const uy = dy / L;

          const dVisible = `M ${e.p1.x} ${e.p1.y} L ${e.p2.x} ${e.p2.y}`;
          // удлиняем хит-путь, чтобы накрыть маркер
          const p2ext = { x: e.p2.x + ux * 14, y: e.p2.y + uy * 14 };
          const dHit = `M ${e.p1.x} ${e.p1.y} L ${p2ext.x} ${p2ext.y}`;

          const hovered = hoveredId === e.id;
          const selected = selectedId === e.id;

          const strokeColor = hovered ? "#8b5cf6" : selected ? "#a78bfa" : "#6366f1";
          const strokeWidth = hovered || selected ? 4 : 3;

          return (
            <g key={e.id}>
              {/* видимая линия — только отрисовка */}
              <path
                d={dVisible}
                fill="none"
                stroke={strokeColor}
                strokeLinecap="round"
                strokeWidth={strokeWidth}
                markerEnd="url(#arrow)"
                className={`erd-line ${hovered ? "erd-line-anim" : ""}`}
                pointerEvents="none"
              />

              {/* невидимый широкий хит-путь — ловит hover/click */}
              <path
                d={dHit}
                fill="none"
                stroke="#000"
                strokeOpacity={0}         /* прозрачный, но участвует в hit-testing */
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

      {/* Чипы поверх SVG */}
      {renderLabel &&
        items.map((e) => renderLabel({ id: e.id, x: e.mid.x, y: e.mid.y, kind: e.type }))}
    </div>
  );
}
