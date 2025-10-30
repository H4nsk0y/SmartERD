/**
 * RelationsLayer.tsx
 * Слой со связями: линии/стрелки + компактный чип "1:1 / 1:N / N:M".
 * Улучшения:
 * - Невидимый хитбокс (широкий прозрачный stroke) для лёгкого наведения/клика
 * - Более плавная и медленная hover-анимация
 */

import React from "react";
import type { RelationKind } from "../types";
import { edgePointRayIntersect } from "../geom";

type Attr = { name: string; type: string; isPrimaryKey?: boolean };
type Ent = { id: string; name: string; x: number; y: number; attributes?: Attr[] };
type Rel = { id: string; from: string; to: string; type: RelationKind };
type Size = { w: number; h: number };

export function RelationsLayer({
  entities,
  relationships,
  sizes,
  hoveredRelId,
  selectedRelId,
  onHover,
  onSelect,
}: {
  entities: Ent[];
  relationships: Rel[];
  sizes: Record<string, Size>;
  hoveredRelId: string | null;
  selectedRelId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const byId = React.useMemo(() => {
    const m = new Map<string, Ent>();
    for (const e of entities) m.set(e.id, e);
    return m;
  }, [entities]);

  return (
    <svg
      className="absolute top-0 left-0 z-10"
      width={50000}
      height={50000}
      style={{ overflow: "visible", pointerEvents: "none" }}
    >
      <defs>
        {/* маркеры под состояния, чтобы цвет стрелки совпадал с линией */}
        <marker id="arrow-base" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L9,3 z" fill="#6366f1" />
        </marker>
        <marker id="arrow-hover" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L9,3 z" fill="#8b5cf6" />
        </marker>
        <marker id="arrow-selected" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L9,3 z" fill="#a78bfa" />
        </marker>
      </defs>

      {/* более плавная анимация потока */}
      <style>{`@keyframes erd-flow-hover { to { stroke-dashoffset: -220; } }`}</style>

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

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        const hovered = hoveredRelId === r.id;
        const selected = selectedRelId === r.id;

        const strokeColor = hovered ? "#8b5cf6" : selected ? "#a78bfa" : "#6366f1";
        const markerId = hovered ? "arrow-hover" : selected ? "arrow-selected" : "arrow-base";
        const strokeWidth = hovered ? 4 : selected ? 4 : 3; // hover <= 4

        const lineD = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;

        return (
          <g key={r.id} style={{ pointerEvents: "auto" }}>
            {/* 1) Невидимый хитбокс — шире и кликабелен по stroke */}
            <path
              d={lineD}
              fill="none"
              stroke="#000"
              strokeOpacity={0}               // полностью прозрачный
              strokeWidth={14}                // широкий хитбокс
              style={{ pointerEvents: "stroke" }}
              onPointerEnter={() => onHover(r.id)}
              onPointerLeave={() => onHover(null)}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelect(r.id);
              }}
            />

            {/* 2) Видимая линия */}
            <path
              d={lineD}
              fill="none"
              stroke={strokeColor}
              strokeLinecap="round"
              strokeWidth={strokeWidth}
              markerEnd={`url(#${markerId})`}
              className="cursor-pointer"
              style={{
                pointerEvents: "none", // события ловит хитбокс сверху
                ...(hovered
                  ? {
                      strokeDasharray: "12 9",
                      animation: "erd-flow-hover 2.2s linear infinite", // медленнее
                      filter: "drop-shadow(0 0 1px rgba(139,92,246,.5))",
                    }
                  : undefined),
              }}
            />

            {/* Чип типа связи */}
            <foreignObject
              x={midX - 20}
              y={midY - 28}
              width={60}
              height={26}
              style={{ pointerEvents: "auto", overflow: "visible" }}
            >
              <div
                className="relative z-50 text-[11px] rounded px-1 py-0.5 text-center cursor-pointer select-none shadow-sm"
                style={{
                  background: "rgba(17,24,39,0.70)",
                  color: "#F3F4F6",
                  border: "1px solid rgba(139,92,246,0.5)",
                  backdropFilter: "blur(2px)",
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelect(r.id);
                }}
              >
                <span className="font-semibold">
                  {r.type === "one-to-one" ? "1:1" : r.type === "one-to-many" ? "1:N" : "N:M"}
                </span>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}

export default RelationsLayer;
