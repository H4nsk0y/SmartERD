// frontend/src/canvas/components/CanvasGrid.tsx
export type CanvasGridProps = {
  world: { w: number; h: number };
  gridSize: number;
};

export default function CanvasGrid({ world, gridSize }: CanvasGridProps) {
  return (
    <div
      className="absolute top-0 left-0 pointer-events-none opacity-20"
      style={{
        width: world.w,
        height: world.h,
        backgroundImage: `
          linear-gradient(to right, var(--tw-prose-bullets) 1px, transparent 1px),
          linear-gradient(to bottom, var(--tw-prose-bullets) 1px, transparent 1px)
        `,
        backgroundSize: `${gridSize}px ${gridSize}px`,
      }}
    />
  );
}
