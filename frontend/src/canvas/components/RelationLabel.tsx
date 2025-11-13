import * as React from "react";
import type { RelationKind } from "../types";

type Props = {
  id: string;
  x: number;    
  y: number;
  kind: RelationKind;
  open?: boolean;
  onToggle: (id: string) => void;
  onPick: (id: string, next: RelationKind) => void;
};

export default function RelationLabel({ id, x, y, kind, open, onToggle, onPick }: Props) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onToggle(id); };
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) onToggle(id);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, id, onToggle]);

  const labelText = kind === "one-to-one" ? "1:1" : kind === "one-to-many" ? "1:N" : "N:M";

  return (
    <div
      ref={wrapRef}
      className="absolute z-40"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -10px)",
        pointerEvents: "auto",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Чип */}
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="text-[11px] rounded px-1.5 py-0.5 shadow-sm border select-none"
        style={{
          background: "rgba(17,24,39,0.75)",     
          color: "#F3F4F6",                       
          borderColor: "rgba(139,92,246,0.55)",   
          backdropFilter: "blur(2px)",
        }}
        title="Тип связи"
      >
        <span className="font-semibold">{labelText}</span>
        <span className="ml-1 opacity-75">▾</span>
      </button>

      {open && (
        <div
          className="absolute left-1/2 -translate-x-1/2 mt-1 rounded text-xs w-24 overflow-hidden shadow-lg border"
          style={{
            background: "rgba(17,24,39,0.95)",
            color: "#F9FAFB",
            borderColor: "rgba(99,102,241,0.6)", // indigo-500/60
            backdropFilter: "blur(2px)",
          }}
        >
          <MenuItem
            active={kind === "one-to-one"}
            onClick={() => onPick(id, "one-to-one")}
            label="1:1"
          />
          <MenuItem
            active={kind === "one-to-many"}
            onClick={() => onPick(id, "one-to-many")}
            label="1:N"
          />
          <MenuItem
            active={kind === "many-to-many"}
            onClick={() => onPick(id, "many-to-many")}
            label="N:M"
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <div
      role="menuitem"
      className={`px-2 py-1 cursor-pointer ${active ? "bg-indigo-600/40" : "hover:bg-indigo-600/30"}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {label}
    </div>
  );
}
