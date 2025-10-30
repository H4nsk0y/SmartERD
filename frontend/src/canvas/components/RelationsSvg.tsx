/**
 * RelationsSvg — отвечает только за SVG-слой связей: маркеры, линии, клики/hover.
 * Канвас позже будет передавать сюда вычисленную геометрию.
 */
export type Edge = {
  id: string;
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  hovered?: boolean;
  selected?: boolean;
  onClick?: (id: string) => void;
  onHover?: (id: string | null) => void;
};

export default function RelationsSvg({
  edges,
  worldSize,
}: {
  edges: Edge[];
  worldSize: { w: number; h: number };
}) {
  return (
    <svg
      className="absolute top-0 left-0 z-10"
      width={worldSize.w}
      height={worldSize.h}
      style={{ overflow: "visible", pointerEvents: "none" }}
    >
      <defs>
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

      {edges.map((e) => {
        const strokeColor = e.hovered ? "#8b5cf6" : e.selected ? "#a78bfa" : "#6366f1";
        const markerId = e.hovered ? "arrow-hover" : e.selected ? "arrow-selected" : "arrow-base";
        const sw = e.hovered ? 4 : e.selected ? 3.5 : 3; // умеренный hover, как просил

        return (
          <path
            key={e.id}
            d={`M ${e.p1.x} ${e.p1.y} L ${e.p2.x} ${e.p2.y}`}
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={sw}
            markerEnd={`url(#${markerId})`}
            style={{
              pointerEvents: "stroke",
              ...(e.hovered
                ? {
                    strokeDasharray: "12 8",
                    animation: "erd-flow-hover 1.6s linear infinite",
                    filter: "drop-shadow(0 0 1px rgba(139,92,246,.6))",
                  }
                : undefined),
            }}
            onClick={(ev) => {
              ev.stopPropagation();
              e.onClick?.(e.id);
            }}
            onMouseEnter={() => e.onHover?.(e.id)}
            onMouseLeave={() => e.onHover?.(null)}
          />
        );
      })}
    </svg>
  );
}
