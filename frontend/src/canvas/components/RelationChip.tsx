/**
 * RelationChip — плашка "1:1 / 1:N / N:M" с мини-меню.
 * UI только через пропсы/колбэки.
 */
import { useState } from "react";
import type { RelationKind } from "../../canvas/types";

export default function RelationChip({
  kind,
  onChange,
  highlighted = false,
}: {
  kind: RelationKind;
  onChange: (next: RelationKind) => void;
  highlighted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = kind === "one-to-one" ? "1:1" : kind === "one-to-many" ? "1:N" : "N:M";

  return (
    <div style={{ position: "relative", pointerEvents: "auto" }}>
      <div
        className="text-[11px] rounded px-1 py-0.5 text-center cursor-pointer select-none shadow-sm"
        style={{
          background: "rgba(17,24,39,0.70)",
          color: "#F3F4F6",
          border: highlighted ? "1px solid rgba(139,92,246,0.9)" : "1px solid rgba(139,92,246,0.5)",
          backdropFilter: "blur(2px)",
          minWidth: 32,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="font-semibold">{label}</span>
      </div>

      {open && (
        <div
          className="absolute top-6 left-1/2 -translate-x-1/2 z-[9999] rounded shadow-lg text-xs w-24"
          style={{
            background: "rgba(17,24,39,0.95)",
            color: "#F9FAFB",
            border: "1px solid rgba(99,102,241,0.6)",
            backdropFilter: "blur(2px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem text="1:1" onClick={() => { onChange("one-to-one"); setOpen(false); }} />
          <MenuItem text="1:N" onClick={() => { onChange("one-to-many"); setOpen(false); }} />
          <MenuItem text="N:M" onClick={() => { onChange("many-to-many"); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

function MenuItem({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <div className="px-2 py-1 hover:bg-indigo-600/30 cursor-pointer" onClick={onClick}>
      {text}
    </div>
  );
}
