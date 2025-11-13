/**
 canvas/hooks/useMeasureCards
 Измеряет DOM-элементы карточек сущностей через ResizeObserver
 и возвращает их размеры в мировых координатах (делим на текущий scale).
 */

import * as React from "react";
import type { Size } from "../types";

type Ent = { id: string };

export function useMeasureCards(
  entities: Ent[],
  cardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>,
  scaleRef: React.MutableRefObject<number>
) {
  const [sizes, setSizes] = React.useState<Record<string, Size>>({});

  React.useEffect(() => {
    const observers: Record<string, ResizeObserver> = {};

    const observeOne = (id: string, el: HTMLDivElement | null) => {
      if (!el) return;
      const update = () => {
        const r = el.getBoundingClientRect();
        const s = scaleRef.current || 1;
        setSizes((prev) => ({
          ...prev,
          [id]: { w: r.width / s, h: r.height / s },
        }));
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      observers[id] = ro;
    };

    for (const e of entities) {
      const el = cardRefs.current[e.id] || null;
      observeOne(e.id, el);
    }

    return () => {
      for (const ro of Object.values(observers)) ro.disconnect();
    };
  }, [entities, cardRefs, scaleRef]);

  return { sizes };
}
