// src/canvas/components/RelationsLayer.tsx
/**
 * RelationsLayer — стабильный hover.
 * этот файл отвечает за отрисовку связей между сущностями на канвасе.
*/

import React from "react";
import type { RelationKind, Size } from "../types";
import { edgePointRayIntersect } from "../geom";

type Attr = { name: string; type: string; isPrimaryKey?: boolean };
type Ent = { id: string; name: string; x: number; y: number; attributes?: Attr[] };
type Rel = { id: string; from: string; to: string; type: RelationKind };

export default function RelationsLayer({
  entities,
  relationships,
  sizes,
  hoveredRelId,
  selectedRelId,
  onHover,
  onSelect,
  onChangeType,
}: {
  entities: Ent[];
  relationships: Rel[];
  sizes: Record<string, Size>;
  hoveredRelId: string | null;
  selectedRelId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onChangeType?: (id: string, next: RelationKind) => void;
}) {
  
  const byId = React.useMemo(() => {
    const m = new Map<string, Ent>();
    for (const e of entities) m.set(e.id, e);
    return m;
  }, [entities]);

  
  const sticky = React.useRef<Record<string, number>>({});
  const [, force] = React.useState(0);
  const now = () => performance.now();

  const setSticky = (id: string) => {
    sticky.current[id] = now() + 140; 
    force((x) => x ^ 1); 
  };
  const clearExpired = () => {
    const t = now();
    let changed = false;
    for (const k of Object.keys(sticky.current)) {
      if (sticky.current[k] < t) {
        delete sticky.current[k];
        changed = true;
      }
    }
    if (changed) force((x) => x ^ 1);
  };

  React.useEffect(() => {
    const id = requestAnimationFrame(function loop() {
      clearExpired();
      requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <svg
      className="absolute top-0 left-0 z-10"
      width={50000}
      height={50000}
      style={{ overflow: "visible", pointerEvents: "none" }}
      shapeRendering="geometricPrecision"
    >
      <style>{`
        @keyframes erd-flow { to { stroke-dashoffset: -180; } }
        .erd-anim { stroke-dasharray: 12 8; stroke-dashoffset: 0; animation: erd-flow 1.6s linear infinite; }
      `}</style>

      <defs>
        <marker id="arrow-base" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L9,3 z" fill="#6366f1" pointerEvents="none" />
        </marker>
        <marker id="arrow-hover" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L9,3 z" fill="#8b5cf6" pointerEvents="none" />
        </marker>
        <marker id="arrow-selected" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L9,3 z" fill="#a78bfa" pointerEvents="none" />
        </marker>
      </defs>

      {relationships.map((r) => {
        const from = byId.get(r.from);
        const to = byId.get(r.to);
        if (!from || !to) return null;

        const fw = sizes[from.id]?.w ?? 224;
        const fh = sizes[from.id]?.h ?? 80;
        const tw = sizes[to.id]?.w ?? 224;
        const th = sizes[to.id]?.h ?? 80;

        const fromC = { x: from.x + fw / 2, y: from.y + fh / 2 };
        const toC = { x: to.x + tw / 2, y: to.y + th / 2 };

        const p1 = edgePointRayIntersect(fromC, toC, fw / 2, fh / 2, 8);
        const p2 = edgePointRayIntersect(toC, fromC, tw / 2, th / 2, 8);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const L = Math.hypot(dx, dy) || 1;
        const ux = dx / L;
        const uy = dy / L;
        const p2ext = { x: p2.x + ux * 14, y: p2.y + uy * 14 };

        const d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
        const dHit = `M ${p1.x} ${p1.y} L ${p2ext.x} ${p2ext.y}`;

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        const hoveredRaw = hoveredRelId === r.id;
        const hovered = hoveredRaw || sticky.current[r.id] > now();
        const selected = selectedRelId === r.id;

        const strokeColor = hovered ? "#8b5cf6" : selected ? "#a78bfa" : "#6366f1";
        const markerId = hovered ? "arrow-hover" : selected ? "arrow-selected" : "arrow-base";
        const strokeWidth = hovered || selected ? 4 : 3;

        return (
          <g key={r.id} style={{ pointerEvents: "none" }}>
            <path
              d={d}
              fill="none"
              stroke={strokeColor}
              strokeLinecap="round"
              strokeWidth={strokeWidth}
              markerEnd={`url(#${markerId})`}
              vectorEffect="non-scaling-stroke"
              className={hovered ? "erd-anim" : undefined}
              pointerEvents="none"
            />

            <path
              d={dHit}
              fill="none"
              stroke="transparent"
              strokeWidth={18}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onMouseEnter={() => {
                setSticky(r.id);
                onHover(r.id);
              }}
              onMouseLeave={() => {
                setSticky(r.id);
                onHover(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(r.id);
              }}
            />

            <foreignObject
              x={midX - 20}
              y={midY - 28}
              width={64}
              height={26}
              style={{ pointerEvents: "auto", overflow: "visible" }}
            >
              <div
                className="relative z-50 text-[11px] rounded px-1 py-0.5 text-center select-none shadow-sm"
                style={{
                  background: "rgba(17,24,39,0.70)",
                  color: "#F3F4F6",
                  border: "1px solid rgba(139,92,246,0.5)",
                  backdropFilter: "blur(2px)",
                  cursor: "pointer",
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <span className="font-semibold">
                  {r.type === "one-to-one" ? "1:1" : r.type === "one-to-many" ? "1:N" : "N:M"}
                </span>

                {onChangeType && (
                  <div
                    className="absolute top-6 left-1/2 -translate-x-1/2 rounded text-xs w-24"
                    style={{
                      background: "rgba(17,24,39,0.95)",
                      color: "#F9FAFB",
                      border: "1px solid rgba(99,102,241,0.6)",
                      backdropFilter: "blur(2px)",
                    }}
                  >
                    <div className="px-2 py-1 hover:bg-indigo-600/30 cursor-pointer" onClick={(e) => { e.stopPropagation(); onChangeType(r.id, "one-to-one"); }}>
                      1:1
                    </div>
                    <div className="px-2 py-1 hover:bg-indigo-600/30 cursor-pointer" onClick={(e) => { e.stopPropagation(); onChangeType(r.id, "one-to-many"); }}>
                      1:N
                    </div>
                    <div className="px-2 py-1 hover:bg-indigo-600/30 cursor-pointer" onClick={(e) => { e.stopPropagation(); onChangeType(r.id, "many-to-many"); }}>
                      N:M
                    </div>
                  </div>
                )}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}
