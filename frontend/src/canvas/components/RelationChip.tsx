// frontend/src/canvas/components/RelationChip.tsx
/**
 * RelationChip — компактный чип выбора типа связи с мини-меню (UI + коллбеки).
 * Клик по чипу открывает/закрывает меню (не открывает инспектор).
 */
import React from "react";

export type RelationKind = "one-to-one" | "one-to-many" | "many-to-many";

export type RelationChipProps = {
  kind: RelationKind;
  open: boolean;
  onToggle: () => void;          // открыть/закрыть меню
  onPick: (next: RelationKind) => void; // выбрать тип
};

function kindToLabel(kind: RelationKind): string {
  if (kind === "one-to-one") return "1:1";
  if (kind === "one-to-many") return "1:N";
  return "N:M";
}

export default function RelationChip({ kind, open, onToggle, onPick }: RelationChipProps) {
  return (
    <div
      className="relative z-50 text-[11px] rounded px-1 py-0.5 text-center cursor-pointer select-none shadow-sm"
      style={{
        background: "rgba(17,24,39,0.70)",
        color: "#F3F4F6",
        border: "1px solid rgba(99,102,241,0.5)",
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => {
        // важно: не даём событию долететь до хит-пути линии
        e.stopPropagation();
        onToggle();
      }}
    >
      <span className="font-semibold">{kindToLabel(kind)}</span>

      {open && (
        <div
          className="absolute top-6 left-1/2 -translate-x-1/2 z-[9999] rounded shadow-lg text-xs w-24"
          style={{
            background: "rgba(17,24,39,0.95)",
            color: "#F9FAFB",
            border: "1px solid rgba(99,102,241,0.6)",
            backdropFilter: "blur(2px)",
          }}
          onClick={(e) => e.stopPropagation()} // чтобы меню само не делегировало клик на линию
        >
          <div className="px-2 py-1 hover:bg-indigo-600/30 cursor-pointer" onClick={() => onPick("one-to-one")}>
            1:1
          </div>
          <div className="px-2 py-1 hover:bg-indigo-600/30 cursor-pointer" onClick={() => onPick("one-to-many")}>
            1:N
          </div>
          <div className="px-2 py-1 hover:bg-indigo-600/30 cursor-pointer" onClick={() => onPick("many-to-many")}>
            N:M
          </div>
        </div>
      )}
    </div>
  );
}
