// frontend/src/canvas/components/RelationLabel.tsx
/**
 * RelationLabel — позиционирует RelationChip в мировых координатах (поверх SVG).
 * Только UI-обёртка + проброс коллбеков.
 */
import React from "react";
import RelationChip, { type RelationKind } from "./RelationChip";

export type RelationLabelProps = {
  id: string;
  x: number; // world X центра метки
  y: number; // world Y центра метки
  kind: RelationKind;
  open: boolean;
  onToggle: (id: string) => void;
  onPick: (id: string, next: RelationKind) => void;
};

export default function RelationLabel({ id, x, y, kind, open, onToggle, onPick }: RelationLabelProps) {
  return (
    <div
      className="absolute z-50"
      // выравниваем чип по центру сегмента связи
      style={{ left: x, top: y, transform: "translate(-20px, -28px)", width: 60, height: 26, pointerEvents: "auto" }}
      onClick={(e) => e.stopPropagation()} // не даём кликать по линии под нами
    >
      <RelationChip
        kind={kind}
        open={open}
        onToggle={() => onToggle(id)}
        onPick={(next) => onPick(id, next)}
      />
    </div>
  );
}
