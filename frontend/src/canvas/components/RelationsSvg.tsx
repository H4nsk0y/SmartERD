// frontend/src/canvas/components/RelationsSvg.tsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  const nn = fkNotNull !== false;

  if (kind === "many-to-many") {
    return { start: "erd-zero-many", end: "erd-zero-many" };
  }

  if (kind === "one-to-many") {
    return { start: nn ? "erd-one-one" : "erd-zero-one", end: "erd-zero-many" };
  }

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
  const getEntity = useCallback(
    (id: string) => entities.find((e) => e.id === id),
    [entities]
  );

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [forceClearHover, setForceClearHover] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
        onHover?.(null);
        setForceClearHover(true);
        setTimeout(() => setForceClearHover(false), 100);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onHover]);

  
  useEffect(() => {
    if (pulseToken) {
      setForceClearHover(true);
      setTimeout(() => setForceClearHover(false), 300);
    }
  }, [pulseToken]);

  const makeSelfLoop = useCallback((box: { x: number; y: number; w: number; h: number }) => {
    const { x, y, w, h } = box;
    const start = { x: x + w, y: y + h / 2 };

    const rx = Math.max(56, Math.min(120, w * 0.6));
    const ry = Math.max(40, Math.min(96, h * 0.5));

    const c1 = { x: start.x + rx, y: start.y };
    const c2 = { x: start.x + rx, y: y - ry };
    const end = { x: x + w * 0.65, y: y - 10 };

    const tailDir = { x: end.x - c2.x, y: end.y - c2.y };
    const tailLen = Math.hypot(tailDir.x, tailDir.y) || 1;
    const ux = tailDir.x / tailLen;
    const uy = tailDir.y / tailLen;
    const endExt = { x: end.x + ux * 22, y: end.y + uy * 22 };

    const d = `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
    const dHit = `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${endExt.x} ${endExt.y}`;

    const mid = { x: (c2.x + end.x) / 2, y: (c2.y + end.y) / 2 - 8 };

    return { d, dHit, mid };
  }, []);

 
  const items = useMemo<Item[]>(() => {
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

      
      const p1 = edgePointRayIntersect(fromC, toC, fw / 2, fh / 2, 10);
      const p2 = edgePointRayIntersect(toC, fromC, tw / 2, th / 2, 10);
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      out.push({ shape: "line", id: r.id, type: r.type, fkNotNull, p1, p2, mid });
    }

    return out;
  }, [relationships, getEntity, sizes, makeSelfLoop]);

  const getConnectionStyle = useCallback((isHovered: boolean, isSelected: boolean, isPulsed: boolean) => {
    let baseStyle = {
      stroke: "#6366f1",
      strokeWidth: 2.5,
      dashArray: "none",
      opacity: 1,
    };

    if (isPulsed) {
      return {
        ...baseStyle,
        stroke: "#8b5cf6",
        strokeWidth: 3.5,
        dashArray: "8,4",
        opacity: 0.9,
      };
    }

    if (isSelected) {
      return {
        ...baseStyle,
        stroke: "#a78bfa",
        strokeWidth: 3,
        dashArray: "6,3",
        opacity: 1,
      };
    }

    if (isHovered) {
      return {
        ...baseStyle,
        stroke: "#8b5cf6",
        strokeWidth: 3.5,
        dashArray: "8,4",
        opacity: 1,
      };
    }

    return baseStyle;
  }, []);

  const renderConnection = useCallback((item: Item, isHovered: boolean, isSelected: boolean, isPulsed: boolean) => {
    const { start, end } = markersForKind(item.type, item.fkNotNull);
    const markerStart = start ? `url(#${start})` : undefined;
    const markerEnd = end ? `url(#${end})` : undefined;

    const style = getConnectionStyle(isHovered, isSelected, isPulsed);
    const gradientId = isHovered ? "connection-gradient-hover" : 
                      isSelected ? "connection-gradient-selected" : 
                      "connection-gradient";

    let connectionClasses = "animated-connection";
    if (isHovered) connectionClasses += " connection-hover";
    if (isSelected) connectionClasses += " connection-selected";
    if (isPulsed) connectionClasses += " connection-pulsed";

    if (item.shape === "line") {
      const dx = item.p2.x - item.p1.x;
      const dy = item.p2.y - item.p1.y;
      const L = Math.hypot(dx, dy) || 1;
      const ux = dx / L;
      const uy = dy / L;

      const dVisible = `M ${item.p1.x} ${item.p1.y} L ${item.p2.x} ${item.p2.y}`;
      const p2ext = { x: item.p2.x + ux * 20, y: item.p2.y + uy * 20 };
      const dHit = `M ${item.p1.x} ${item.p1.y} L ${p2ext.x} ${p2ext.y}`;

      return (
        <g key={item.id}>
          
          <path
            d={dVisible}
            fill="none"
            stroke="rgba(99, 102, 241, 0.15)"
            strokeLinecap="round"
            strokeWidth={style.strokeWidth + 8}
            markerStart={markerStart}
            markerEnd={markerEnd}
            className={connectionClasses}
            pointerEvents="none"
          />

          
          <path
            d={dVisible}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeLinecap="round"
            strokeWidth={style.strokeWidth}
            strokeDasharray={style.dashArray}
            markerStart={markerStart}
            markerEnd={markerEnd}
            className={connectionClasses}
            pointerEvents="none"
            style={{ filter: isHovered || isSelected ? 'url(#glow)' : 'none' }}
          />

          
          <path
            d={dHit}
            fill="none"
            stroke="transparent"
            strokeWidth={24}
            strokeLinecap="round"
            className="animated-connection"
            style={{ 
              pointerEvents: "stroke", 
              cursor: "pointer",
            }}
            onMouseEnter={() => {
              onHover?.(item.id);
            }}
            onMouseLeave={() => {
              onHover?.(null);
            }}
            onClick={(ev) => {
              ev.stopPropagation();
              setForceClearHover(true);
              setTimeout(() => setForceClearHover(false), 50);
              onClick?.(item.id);
            }}
          />
        </g>
      );
    }

    
    return (
      <g key={item.id}>
       
        <path
          d={item.d}
          fill="none"
          stroke="rgba(99, 102, 241, 0.15)"
          strokeLinecap="round"
          strokeWidth={style.strokeWidth + 8}
          markerStart={markerStart}
          markerEnd={markerEnd}
          className={connectionClasses}
          pointerEvents="none"
        />

        
        <path
          d={item.d}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeLinecap="round"
          strokeWidth={style.strokeWidth}
          strokeDasharray={style.dashArray}
          markerStart={markerStart}
          markerEnd={markerEnd}
          className={connectionClasses}
          pointerEvents="none"
          style={{ filter: isHovered || isSelected ? 'url(#glow)' : 'none' }}
        />

        
        <path
          d={item.dHit}
          fill="none"
          stroke="transparent"
          strokeWidth={28}
          strokeLinecap="round"
          className="animated-connection"
          style={{ 
            pointerEvents: "stroke", 
            cursor: "pointer",
          }}
          onMouseEnter={() => onHover?.(item.id)}
          onMouseLeave={() => onHover?.(null)}
          onClick={(ev) => {
            ev.stopPropagation();
            setForceClearHover(true);
            setTimeout(() => setForceClearHover(false), 50);
            onClick?.(item.id);
          }}
        />
      </g>
    );
  }, [getConnectionStyle, onHover, onClick]);

  return (
    <div className="absolute top-0 left-0" style={{ width: worldSize.w, height: worldSize.h, overflow: "visible" }}>
      <svg
        className="absolute top-0 left-0 z-10"
        width={worldSize.w}
        height={worldSize.h}
        style={{ overflow: "visible", pointerEvents: "auto" }}
        onClick={() => {
          setForceClearHover(true);
          setTimeout(() => setForceClearHover(false), 50);
        }}
      >
        <style>{`
          @keyframes pulse-glow {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          @keyframes dash-flow {
            to { stroke-dashoffset: -20; }
          }
          @keyframes connection-pulse {
            0% { stroke-width: 3; opacity: 0.8; }
            50% { stroke-width: 5; opacity: 0.4; }
            100% { stroke-width: 3; opacity: 0.8; }
          }
          @keyframes connection-reset {
            0% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          .animated-connection {
            transition: opacity 0.15s ease, filter 0.15s ease;
          }
          .connection-hover {
            animation: dash-flow 1s linear infinite, pulse-glow 2s ease-in-out infinite;
          }
          .connection-selected {
            animation: pulse-glow 3s ease-in-out infinite;
          }
          .connection-pulsed {
            animation: connection-pulse 0.8s ease-in-out;
          }
          .connection-reset {
            animation: connection-reset 0.3s ease-out;
          }
        `}</style>

        <defs>
          <linearGradient id="connection-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          
          <linearGradient id="connection-gradient-hover" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          
          <linearGradient id="connection-gradient-selected" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>

         
          <marker
            id="erd-zero-one"
            markerWidth="24"
            markerHeight="16"
            refX="22"
            refY="8"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <circle cx="7" cy="8" r="3.5" stroke="context-stroke" strokeWidth="2" fill="none" />
            <path d="M22,2 L22,14" stroke="context-stroke" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </marker>

          <marker
            id="erd-one-one"
            markerWidth="22"
            markerHeight="16"
            refX="20"
            refY="8"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path
              d="M16,2 L16,14 M20,2 L20,14"
              stroke="context-stroke"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          </marker>

          
          <marker
            id="erd-zero-many"
            markerWidth="28"
            markerHeight="18"
            refX="26"
            refY="9"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <circle cx="7" cy="9" r="3.5" stroke="context-stroke" strokeWidth="2" fill="none" />
            <path
              d="M14,9 L26,2 M14,9 L26,9 M14,9 L26,16"
              stroke="context-stroke"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
          </marker>

          <marker
            id="erd-one-many"
            markerWidth="28"
            markerHeight="18"
            refX="26"
            refY="9"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path d="M12,2 L12,16" stroke="context-stroke" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path
              d="M14,9 L26,2 M14,9 L26,9 M14,9 L26,16"
              stroke="context-stroke"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
          </marker>

          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {items.map((item) => {
          const isHovered = !forceClearHover && hoveredId === item.id;
          const isSelected = selectedId === item.id;
          const isPulsed = pulsedId === item.id;

          return renderConnection(item, isHovered, isSelected, isPulsed);
        })}
      </svg>

      {renderLabel &&
        items.map((e: Item) => {
          return renderLabel({
            id: e.id,
            x: e.mid.x,
            y: e.mid.y,
            kind: e.type,
          });
        })}
    </div>
  );
}
