/**
 * RelationLabel — простая обёртка с абсолютным позиционированием
 * для RelationChip. Никакой бизнес-логики.
 */
import RelationChip from "./RelationChip";
import type { RelationKind } from "../../canvas/types";

export default function RelationLabel({
  x,
  y,
  kind,
  highlighted = false,
  onChange,
}: {
  x: number;
  y: number;
  kind: RelationKind;
  highlighted?: boolean;
  onChange: (next: RelationKind) => void;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: x - 20,   // лёгкий сдвиг, чтобы центрировать
        top: y - 28,    // приподнять над линией
        pointerEvents: "auto",
      }}
    >
      <RelationChip kind={kind} highlighted={highlighted} onChange={onChange} />
    </div>
  );
}
