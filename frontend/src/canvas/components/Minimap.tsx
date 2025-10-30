/**
 * Minimap — маленькая карта сцены. Без внешней логики.
 */
import { clamp } from "../utils";

type Dot = { id: string; x: number; y: number };

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
  const W = 200, H = 140;
  const sx = W / world.w;
  const sy = H / world.h;

  const vw = Math.max(8, viewport.w * sx);
  const vh = Math.max(8, viewport.h * sy);
  const vx = clamp(viewport.x * sx, 0, W - vw);
  const vy = clamp(viewport.y * sy, 0, H - vh);

  return (
    <div
      className="rounded-lg border bg-white/80 dark:bg-gray-800/80 backdrop-blur p-2 shadow-md"
      style={{ position: "absolute", right: 16, bottom: 16, width: W + 16, height: H + 16, zIndex: 40 }}
      onPointerDown={(e) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const px = clamp(e.clientX - rect.left - 8, 0, W);
        const py = clamp(e.clientY - rect.top - 8, 0, H);
        const wx = px / sx;
        const wy = py / sy;
        onJump(wx, wy);
      }}
    >
      <div
        className="relative"
        style={{
          width: W,
          height: H,
          background: "repeating-linear-gradient(45deg, rgba(0,0,0,.04) 0 6px, transparent 6px 12px)",
        }}
      >
        {entities.map((e) => (
          <div
            key={e.id}
            className="absolute rounded-full"
            style={{ left: e.x * sx, top: e.y * sy, width: 3, height: 3, background: "#6366f1" }}
          />
        ))}
        <div
          className="absolute border-2"
          style={{
            left: vx,
            top: vy,
            width: vw,
            height: vh,
            borderColor: "#8b5cf6",
            boxShadow: "0 0 0 9999px rgba(139,92,246,0.08) inset",
          }}
        />
      </div>
      <div className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">
        Навигация: колесо; Fit; 1:1; Пан: ПКМ/MMB или Ctrl/Meta+ЛКМ
      </div>
    </div>
  );
}
