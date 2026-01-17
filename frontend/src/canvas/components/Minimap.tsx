/* Minimap — маленькая карта (glassmorphism UI). */
import React from "react";
import { clamp } from "../utils";

type Dot = { id: string; x: number; y: number };

function useIsDarkMode() {
  const [dark, setDark] = React.useState<boolean>(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false
  );

  React.useEffect(() => {
    const mo = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark"))
    );
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  return dark;
}

export default function Minimap({
  entities,
  viewport,
  world,
  onJump,
}: {
  entities: Dot[];
  viewport: { x: number; y: number; w: number; h: number };
  world: { w: number; h: number };
  onJump: (worldX: number, worldY: number) => void;
}) {
  const W = 200;
  const H = 140;

  const sx = W / world.w;
  const sy = H / world.h;

  const vw = Math.max(8, viewport.w * sx);
  const vh = Math.max(8, viewport.h * sy);
  const vx = clamp(viewport.x * sx, 0, W - vw);
  const vy = clamp(viewport.y * sy, 0, H - vh);

  const isDark = useIsDarkMode();

  // UI states
  const [mounted, setMounted] = React.useState(false);
  const [hoveredDot, setHoveredDot] = React.useState<string | null>(null);
  const [viewportHover, setViewportHover] = React.useState(false);

  React.useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";

  const gridBg = [
    // dots
    `radial-gradient(circle at 1px 1px, ${gridColor} 1px, transparent 0)`,
    // subtle diagonal lines (very faint)
    `repeating-linear-gradient(45deg, ${gridColor} 0 1px, transparent 1px 12px)`,
  ].join(", ");

  const handleJumpByPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const px = clamp(e.clientX - rect.left, 0, W);
    const py = clamp(e.clientY - rect.top, 0, H);
    const wx = px / sx;
    const wy = py / sy;
    onJump(wx, wy);
  };

  const viewportGradient = viewportHover
    ? "linear-gradient(90deg, rgba(99,102,241,0.95), rgba(139,92,246,0.95))"
    : "linear-gradient(90deg, rgba(99,102,241,0.75), rgba(139,92,246,0.75))";

  return (
    <div
      className={[
        // container
        "absolute right-4 bottom-4 z-40",
        "rounded-2xl border border-white/10",
        "bg-white/5 dark:bg-white/[0.05] backdrop-blur-xl",
        "shadow-[0_10px_40px_rgba(0,0,0,0.22)]",
        "transition-all duration-300 ease-out",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
      ].join(" ")}
      style={{ width: W + 16, height: H + 16 + 22 }} // + padding + hint row
    >
      {/* Map area */}
      <div
        className="relative mx-2 mt-2 rounded-xl overflow-hidden cursor-pointer"
        style={{
          width: W,
          height: H,
          backgroundImage: gridBg,
          backgroundSize: "14px 14px, 24px 24px",
          backgroundPosition: "0 0, 0 0",
        }}
        onPointerDown={handleJumpByPointer}
        title="Кликните по миникарте, чтобы переместиться"
      >
        {/* subtle vignette/glass tint */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 100% at 20% 0%, rgba(99,102,241,0.18) 0%, transparent 60%), radial-gradient(120% 100% at 80% 100%, rgba(139,92,246,0.12) 0%, transparent 55%)",
          }}
        />

        {/* entity dots */}
        {entities.map((en) => {
          const isHovered = hoveredDot === en.id;
          return (
            <div
              key={en.id}
              className="absolute rounded-full"
              style={{
                left: en.x * sx,
                top: en.y * sy,
                width: isHovered ? 6 : 4,
                height: isHovered ? 6 : 4,
                transform: "translate(-50%, -50%)",
                background: "rgba(99,102,241,0.95)", // indigo-500-ish
                boxShadow: isHovered
                  ? "0 0 14px rgba(99,102,241,0.9)"
                  : "0 0 10px rgba(99,102,241,0.65)",
                transition: "transform 140ms ease, width 140ms ease, height 140ms ease, box-shadow 140ms ease",
              }}
              onPointerEnter={() => setHoveredDot(en.id)}
              onPointerLeave={() => setHoveredDot((cur) => (cur === en.id ? null : cur))}
            />
          );
        })}

        {/* viewport rectangle (gradient border + inset glow) */}
        <div
          className="absolute"
          style={{
            transform: `translate(${vx}px, ${vy}px)`,
            width: vw,
            height: vh,
            transition: "transform 220ms ease, width 220ms ease, height 220ms ease",
            willChange: "transform, width, height",
          }}
          onPointerEnter={(e) => {
            e.stopPropagation();
            setViewportHover(true);
          }}
          onPointerLeave={(e) => {
            e.stopPropagation();
            setViewportHover(false);
          }}
        >
          <div
            className="absolute inset-0 rounded-lg p-[2px]"
            style={{
              background: viewportGradient,
              opacity: viewportHover ? 1 : 0.92,
              transition: "opacity 180ms ease",
              boxShadow: viewportHover
                ? "0 0 18px rgba(99,102,241,0.35)"
                : "0 0 14px rgba(99,102,241,0.22)",
            }}
          >
            <div
              className="w-full h-full rounded-md"
              style={{
                // inset tint / glassy fill
                boxShadow: "inset 0 0 0 9999px rgba(99,102,241,0.10)",
                background: "rgba(0,0,0,0.00)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Hint text */}
      <div className="mx-2 mt-2 mb-2 text-[11px] text-gray-600 dark:text-white/60 select-none">
        Навигация: колесо; Fit; Пан: ПКМ/MMB
      </div>
    </div>
  );
}
