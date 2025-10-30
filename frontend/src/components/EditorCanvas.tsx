// src/components/EditorCanvas.tsx
import { useEffect, useRef, useState, useMemo } from "react";
import { useERStore } from "../store/useERStore";
import type { Relationship } from "../store/useERStore";
import { generateSQL } from "../utils/generateSQL";

import CanvasGrid from "../canvas/components/CanvasGrid";
import Minimap from "../canvas/components/Minimap";
import LinkHintToast from "../canvas/components/LinkHintToast";
import RelationInspector from "../canvas/components/RelationInspector";

import { GRID, clamp, snap } from "../canvas/utils";

type Size = { w: number; h: number };

const WORLD_W = 50000;
const WORLD_H = 50000;
const DEBUG = false;

type Action = "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
type FKForm = {
  column: string;
  type: string;
  notNull?: boolean;
  unique?: boolean;
  onDelete?: Action;
  onUpdate?: Action;
  index?: boolean;
};
type LinkForm = {
  tableName: string;
  leftColumn: string;
  rightColumn: string;
  compositePrimaryKey?: boolean;
  onDelete?: Action;
  onUpdate?: Action;
  index?: boolean;
};

export default function EditorCanvas() {
  const {
    entities,
    relationships,
    addEntity,
    updateEntityPosition,
    addAttribute,
    removeAttribute,
    addRelationship,
    removeRelationship,
    removeEntity,
    renameEntity,
    selectedRelationshipId,
    setSelectedRelationship,
    updateRelationshipType,
    updateRelationshipMeta,
    setRelationshipFK,
    setRelationshipLink,
    setDiagramData,
    clearAll,
    undo,
    redo,
  } = useERStore();

  // UI
  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedForLink, setSelectedForLink] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [_hoveredRel, _setHoveredRel] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);

  // сглаживание дребезга ховера
  const hoverTimers = useRef<{ enter: number; leave: number }>({ enter: 0, leave: 0 });
  const setHoveredRel = (id: string | null) => {
    clearTimeout(hoverTimers.current.enter);
    clearTimeout(hoverTimers.current.leave);
    if (id) {
      hoverTimers.current.enter = window.setTimeout(() => _setHoveredRel(id), 40);
    } else {
      hoverTimers.current.leave = window.setTimeout(() => _setHoveredRel(null), 40);
    }
  };
  const hoveredRel = _hoveredRel;

  // локальные инпуты добавления атрибутов
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrType, setNewAttrType] = useState("");
  const [isPrimaryKey, setIsPrimaryKey] = useState(false);

  // Инспектор
  const selectedRel = relationships.find((r) => r.id === selectedRelationshipId) || null;
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const inspectorRef = useRef<HTMLDivElement | null>(null);

  // формы связи
  const [fkForm, setFkForm] = useState<FKForm>({
    column: "",
    type: "",
    notNull: true,
    onDelete: "CASCADE",
    index: true,
  });
  const [linkForm, setLinkForm] = useState<LinkForm>({
    tableName: "",
    leftColumn: "",
    rightColumn: "",
    compositePrimaryKey: true,
    onDelete: "CASCADE",
    index: true,
  });

  const [justSaved, setJustSaved] = useState<"fk" | "link" | null>(null);
  const [justReset, setJustReset] = useState(false);
  const [linkToastPulse, setLinkToastPulse] = useState(0);

  // drag
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartWorld = useRef<{ x: number; y: number } | null>(null);
  const entityStartPos = useRef<{ x: number; y: number } | null>(null);

  // preview
  const [mouseWorld, setMouseWorld] = useState<{ x: number; y: number } | null>(null);

  // refs & sizes
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [sizes, setSizes] = useState<Record<string, Size>>({});

  // camera
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const isPanning = useRef(false);
  const panStartScreen = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // чтобы клики по линии не «долетали» до канваса
  const ignoreCanvasClickUntil = useRef<number>(0);

  // move RAF
  const moveRaf = useRef<number>(0);
  const movePayload = useRef<{ type: "pan" | "move" | "drag"; e: React.MouseEvent<HTMLDivElement> } | null>(null);

  const toWorld = (cx: number, cy: number, rect: DOMRect) => ({
    x: (cx - rect.left - offsetRef.current.x) / scaleRef.current,
    y: (cy - rect.top - offsetRef.current.y) / scaleRef.current,
  });

  /* размеры карточек */
  useEffect(() => {
    const observers: Record<string, ResizeObserver> = {};
    entities.forEach((e) => {
      const el = cardRefs.current[e.id];
      if (!el) return;
      const update = () => {
        const r = el.getBoundingClientRect();
        setSizes((p) => ({
          ...p,
          [e.id]: { w: r.width / scaleRef.current, h: r.height / scaleRef.current },
        }));
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      observers[e.id] = ro;
    });
    return () => Object.values(observers).forEach((ro) => ro.disconnect());
  }, [entities, editingId, scale]);

  /* Esc отменяет режим «+ Сущность» */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAddingEntity) {
        setIsAddingEntity(false);
        setMouseWorld(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAddingEntity]);

  /* Delete/Backspace: удаляем hovered/selected, если инспектор закрыт */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;

      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-inspector="true"]')) return; // внутри инспектора — не трогаем
      if (target?.closest("input, textarea, select, [contenteditable]")) return;

      const toDelete = hoveredRel || selectedRelationshipId;
      if (toDelete) {
        e.preventDefault();
        removeRelationship(toDelete);
        if (selectedRelationshipId === toDelete) {
          setSelectedRelationship(null);
          setInspectorOpen(false);
        }
        _setHoveredRel(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hoveredRel, selectedRelationshipId, removeRelationship, setSelectedRelationship]);

  /* Undo/Redo */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const z = e.key.toLowerCase() === "z";
      const y = e.key.toLowerCase() === "y";
      const meta = e.ctrlKey || e.metaKey;
      const inInput = (e.target as HTMLElement)?.closest(
        "input, textarea, select, [contenteditable]"
      );
      if (!meta || inInput) return;

      if (z && !e.shiftKey) {
        e.preventDefault();
        undo?.();
      } else if (y || (z && e.shiftKey)) {
        e.preventDefault();
        redo?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  /* колесо масштаб */
  useEffect(() => {
    const root = canvasRef.current;
    if (!root) return;
    let raf = 0;
    let last: WheelEvent | null = null;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      last = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!last) return;
        const rect = root.getBoundingClientRect();
        const pre = toWorld(last!.clientX, last!.clientY, rect);
        const sPrev = scaleRef.current;
        const factor = Math.exp(-last!.deltaY * 0.0015);
        const sNext = clamp(sPrev * factor, 0.3, 3);
        const offNext = {
          x: last!.clientX - rect.left - pre.x * sNext,
          y: last!.clientY - rect.top - pre.y * sNext,
        };
        scaleRef.current = sNext;
        offsetRef.current = offNext;
        setScale(sNext);
        setOffset(offNext);
      });
    };
    const preventGesture = (e: Event) => e.preventDefault();
    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("gesturestart", preventGesture as EventListener, {
      passive: false,
    } as any);
    root.addEventListener("gesturechange", preventGesture as EventListener, {
      passive: false,
    } as any);
    return () => {
      root.removeEventListener("wheel", onWheel as EventListener);
      root.removeEventListener("gesturestart", preventGesture as EventListener);
      root.removeEventListener("gesturechange", preventGesture as EventListener);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* панорамирование */
  const handleMouseDownPan = (e: React.MouseEvent) => {
    if (e.button === 2 || e.button === 1 || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      isPanning.current = true;
      panStartScreen.current = {
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y,
      };
    }
  };

  /* клик по канвасу */
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // защита от клика, пришедшего из линии/чипа
    if (performance.now() < ignoreCanvasClickUntil.current) return;
    if ((e.target as HTMLElement)?.closest('[data-inspector="true"]')) return;
    if ((e.target as HTMLElement)?.closest('[data-chip="true"]')) return;

    if (isAddingEntity) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const w = toWorld(e.clientX, e.clientY, rect);
      addEntity("Новая сущность", snap(w.x - 112), snap(w.y - 40));
      setIsAddingEntity(false);
      setMouseWorld(null);
      return;
    }
    // по пустому месту — снять выделение/меню (инспектор не принудительно)
    if (!isLinking) {
      setSelectedRelationship(null);
      setActiveMenu(null);
      setHoveredRel(null);
    }
  };

  /* drag карточки */
  const handleMouseDownEntity = (
    e: React.MouseEvent<HTMLDivElement>,
    id: string
  ) => {
    e.stopPropagation();
    const rect = canvasRef.current!.getBoundingClientRect();
    const w = toWorld(e.clientX, e.clientY, rect);
    dragStartWorld.current = w;
    const ent = entities.find((x) => x.id === id);
    entityStartPos.current = ent ? { x: ent.x, y: ent.y } : null;
    setDraggingId(id);
  };

  /* RAF move */
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    movePayload.current = {
      type: isPanning.current ? "pan" : draggingId ? "drag" : "move",
      e,
    };
    if (moveRaf.current) return;
    moveRaf.current = requestAnimationFrame(() => {
      const payload = movePayload.current;
      moveRaf.current = 0;
      if (!payload) return;

      const rect = canvasRef.current!.getBoundingClientRect();

      if (payload.type === "pan") {
        const off = {
          x: payload.e.clientX - panStartScreen.current.x,
          y: payload.e.clientY - panStartScreen.current.y,
        };
        offsetRef.current = off;
        setOffset(off);
        return;
      }

      const wNow = toWorld(payload.e.clientX, payload.e.clientY, rect);
      if (isAddingEntity) setMouseWorld(wNow);

      if (
        payload.type === "drag" &&
        draggingId &&
        dragStartWorld.current &&
        entityStartPos.current
      ) {
        const dx = wNow.x - dragStartWorld.current.x;
        const dy = wNow.y - dragStartWorld.current.y;
        updateEntityPosition(
          draggingId,
          snap(entityStartPos.current.x + dx),
          snap(entityStartPos.current.y + dy)
        );
      }
    });
  };

  const handleMouseUp = () => {
    setDraggingId(null);
    dragStartWorld.current = null;
    entityStartPos.current = null;
    isPanning.current = false;
  };

  /* linking */
  const handleEntityClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLinking) return;
    if (!selectedForLink) setSelectedForLink(id);
    else if (selectedForLink !== id) {
      addRelationship(selectedForLink, id, "one-to-many");
      setSelectedForLink(null);
      setIsLinking(false);
    }
  };

  /* геометрия */
  function edgePointRayIntersect(
    rectCenter: { x: number; y: number },
    targetCenter: { x: number; y: number },
    halfW: number,
    halfH: number,
    pad = 8
  ) {
    const dx = targetCenter.x - rectCenter.x;
    const dy = targetCenter.y - rectCenter.y;
    if (dx === 0 && dy === 0) return rectCenter;
    const t = Math.min(halfW / Math.abs(dx), halfH / Math.abs(dy));
    let ex = rectCenter.x + dx * t;
    let ey = rectCenter.y + dy * t;
    const len = Math.hypot(dx, dy) || 1;
    ex += (dx / len) * pad;
    ey += (dy / len) * pad;
    return { x: ex, y: ey };
  }

  /* экспорт/импорт/SQL */
  const handleExportJSON = () => {
    if (entities.length === 0 && relationships.length === 0) {
      alert("ER-модель пустая — экспортировать нечего.");
      return;
    }
    const data = { entities, relationships };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json, "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagram.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size === 0) {
      alert("Файл пустой.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string) || "";
        const data = JSON.parse(text);
        if (data.entities?.length || data.relationships?.length) {
          setDiagramData(data.entities || [], data.relationships || []);
        } else {
          alert("Импортировать нечего — файл не содержит данных ER-модели.");
        }
      } catch {
        alert("Ошибка при чтении файла: невалидный JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };
  const handleGenerateSQL = () => {
    if (entities.length === 0) {
      alert("ER-модель пустая — нечего преобразовывать в SQL.");
      return;
    }
    const sql = generateSQL(entities, relationships);
    console.log(sql);
    alert("SQL сгенерирован! Проверь консоль (F12)");
  };

  /* viewport для миникарты */
  const viewportWorldRect = useMemo(() => {
    const root = canvasRef.current?.getBoundingClientRect();
    if (!root) return { x: 0, y: 0, w: 0, h: 0 };
    return {
      x: -offset.x / scale,
      y: -offset.y / scale,
      w: root.width / scale,
      h: root.height / scale,
    };
  }, [scale, offset]);

  /* Fit / 1:1 */
  const fitAll = () => {
    if (entities.length === 0) {
      scaleRef.current = 1;
      offsetRef.current = { x: 0, y: 0 };
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const root = canvasRef.current!.getBoundingClientRect();
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const e of entities) {
      const w = sizes[e.id]?.w ?? 224;
      const h = sizes[e.id]?.h ?? 80;
      minX = Math.min(minX, e.x);
      minY = Math.min(minY, e.y);
      maxX = Math.max(maxX, e.x + w);
      maxY = Math.max(maxY, e.y + h);
    }
    const pad = 64;
    const worldW = maxX - minX + pad * 2;
    const worldH = maxY - minY + pad * 2;
    const sX = root.width / worldW;
    const sY = root.height / worldH;
    const sNext = clamp(Math.min(sX, sY), 0.05, 3);
    const offNext = {
      x: (root.width - worldW * sNext) / 2 - (minX - pad) * sNext,
      y: (root.height - worldH * sNext) / 2 - (minY - pad) * sNext,
    };
    scaleRef.current = sNext;
    offsetRef.current = offNext;
    setScale(sNext);
    setOffset(offNext);
  };
  const reset1x = () => {
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // выбор связи → инициализация форм (инспектор открываем сейчас только по клику на линию)
  useEffect(() => {
    if (!selectedRel) return;
    if (selectedRel.type === "many-to-many") {
      setLinkForm({
        tableName: (selectedRel as any)?.link?.tableName ?? "",
        leftColumn: (selectedRel as any)?.link?.leftColumn ?? "",
        rightColumn: (selectedRel as any)?.link?.rightColumn ?? "",
        compositePrimaryKey: (selectedRel as any)?.link?.compositePrimaryKey ?? true,
        onDelete: (selectedRel as any)?.link?.onDelete ?? "CASCADE",
        onUpdate: (selectedRel as any)?.link?.onUpdate ?? undefined,
        index: (selectedRel as any)?.link?.index ?? true,
      });
    } else {
      setFkForm({
        column: (selectedRel as any)?.fk?.column ?? "",
        type: (selectedRel as any)?.fk?.type ?? "",
        notNull: (selectedRel as any)?.fk?.notNull ?? true,
        unique:
          (selectedRel as any)?.fk?.unique ??
          (selectedRel.type === "one-to-one" ? true : undefined),
        onDelete: (selectedRel as any)?.fk?.onDelete ?? "CASCADE",
        onUpdate: (selectedRel as any)?.fk?.onUpdate ?? undefined,
        index: (selectedRel as any)?.fk?.index ?? true,
      });
    }
    setJustSaved(null);
    setJustReset(false);
  }, [selectedRel?.id, selectedRel?.type]);

  const changeRelType = (id: string, next: Relationship["type"]) => {
    updateRelationshipType(id, next);
    if (next === "many-to-many") {
      updateRelationshipMeta(id, { fk: undefined });
    } else {
      updateRelationshipMeta(id, { link: undefined });
    }
  };

  const isLinked = (entityId: string) =>
    relationships.some(
      (r) =>
        (hoveredRel === r.id || selectedRelationshipId === r.id) &&
        (r.from === entityId || r.to === entityId)
    );

  return (
    <div className="w-full">
      <style>{`@keyframes erd-flow-hover { to { stroke-dashoffset: -260; } }`}</style>

      {/* Тулбар */}
      <div className="mb-3 flex flex-wrap gap-2 items-center">
        <button
          onClick={() => {
            setIsAddingEntity(true);
            setIsLinking(false);
          }}
          className={`px-3 py-1.5 rounded-md text-white text-sm ${
            isAddingEntity ? "bg-indigo-700" : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          + Сущность
        </button>
        <button
          onClick={() => {
            setIsLinking((v) => !v);
            setIsAddingEntity(false);
            setSelectedForLink(null);
            if (!isLinking) setLinkToastPulse((p) => p + 1);
          }}
          className={`px-3 py-1.5 rounded-md text-white text-sm ${
            isLinking ? "bg-purple-700" : "bg-purple-600 hover:bg-purple-700"
          }`}
        >
          🔗 Связь
        </button>
        <button
          onClick={handleExportJSON}
          className="px-3 py-1.5 rounded-md text-white text-sm bg-green-600 hover:bg-green-700"
        >
          💾 Экспорт JSON
        </button>
        <label className="px-3 py-1.5 rounded-md text-white text-sm bg-blue-600 hover:bg-blue-700 cursor-pointer">
          📂 Импорт JSON
          <input
            type="file"
            accept=".json"
            onChange={handleImportJSON}
            className="hidden"
          />
        </label>
        <button
          onClick={handleGenerateSQL}
          className="px-3 py-1.5 rounded-md text-white text-sm bg-yellow-500 hover:bg-yellow-600"
        >
          🧩 Сгенерировать SQL
        </button>
        <button
          onClick={clearAll}
          className="px-3 py-1.5 rounded-md text-white text-sm bg-red-500 hover:bg-red-600"
        >
          🗑 Очистить
        </button>

        <div className="ml-auto flex gap-2">
          <button
            onClick={fitAll}
            className="px-3 py-1.5 rounded-md text-white text-sm bg-gray-600 hover:bg-gray-700"
          >
            Fit
          </button>
          <button
            onClick={reset1x}
            className="px-3 py-1.5 rounded-md text-white text-sm bg-gray-600 hover:bg-gray-700"
          >
            1:1
          </button>
          <button
            title={showMinimap ? "Скрыть мини-карту" : "Показать мини-карту"}
            onClick={() => setShowMinimap((v) => !v)}
            className="px-3 py-1.5 rounded-md text-white text-sm bg-gray-600 hover:bg-gray-700"
          >
            {showMinimap ? "Minimap: On" : "Minimap: Off"}
          </button>
        </div>
      </div>

      <LinkHintToast
        pulse={linkToastPulse}
        text="Выберите две сущности для связи"
        durationMs={1800}
      />

      {/* Canvas */}
      <div
        ref={canvasRef}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative w-full h-[70vh] border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden ${
          isAddingEntity ? "cursor-crosshair bg-gray-100 dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-900"
        }`}
        style={{ overscrollBehavior: "none", touchAction: "none" }}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDownPan}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Мир */}
        <div
          className="absolute top-0 left-0"
          style={{
            transform: `matrix(${scale}, 0, 0, ${scale}, ${offset.x}, ${offset.y})`,
            transformOrigin: "0 0",
            width: WORLD_W,
            height: WORLD_H,
            overflow: "visible",
            willChange: "transform",
          }}
        >
          <CanvasGrid world={{ w: WORLD_W, h: WORLD_H }} gridSize={GRID} />

          {/* Preview сущности */}
          {isAddingEntity && mouseWorld && (
            <div
              className="absolute z-20 w-56 text-center border-2 border-dashed border-indigo-400 rounded-lg bg-indigo-50/50 text-indigo-700 font-semibold pointer-events-none"
              style={{ left: mouseWorld.x - 112, top: mouseWorld.y - 40, padding: 8 }}
            >
              + Новая сущность
            </div>
          )}

          {/* Relations */}
          <svg
            className="absolute top-0 left-0 z-10"
            width={WORLD_W}
            height={WORLD_H}
            style={{ overflow: "visible", pointerEvents: "none" }}
          >
            <defs>
              <marker
                id="arrow"
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L9,3 z" fill="context-stroke" />
              </marker>
            </defs>

            {relationships.map((r) => {
              const from = entities.find((e) => e.id === r.from);
              const to = entities.find((e) => e.id === r.to);
              if (!from || !to) return null;

              const fw = sizes[from.id]?.w ?? 224,
                fh = sizes[from.id]?.h ?? 80;
              const tw = sizes[to.id]?.w ?? 224,
                th = sizes[to.id]?.h ?? 80;

              const fromC = { x: from.x + fw / 2, y: from.y + fh / 2 };
              const toC = { x: to.x + tw / 2, y: to.y + th / 2 };

              const p1 = edgePointRayIntersect(fromC, toC, fw / 2, fh / 2, 8);
              const p2 = edgePointRayIntersect(toC, fromC, tw / 2, th / 2, 8);

              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;

              const hovered = hoveredRel === r.id;
              const selected = selectedRelationshipId === r.id;

              const strokeColor = hovered ? "#8b5cf6" : selected ? "#a78bfa" : "#6366f1";
              const strokeWidth = hovered ? 4 : selected ? 4 : 3;

              return (
                <g key={r.id} style={{ pointerEvents: "auto" }}>
                  {/* толстый невидимый хитбокс — ловит ховер/клик */}
                  <path
                    d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`}
                    fill="none"
                    stroke="rgba(0,0,0,0.001)"
                    strokeWidth={28}
                    pointerEvents="stroke"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setSelectedRelationship(r.id);
                      setInspectorOpen(true);
                      setActiveMenu(null);
                      setHoveredRel(r.id);
                      ignoreCanvasClickUntil.current = performance.now() + 200;
                    }}
                    onPointerEnter={() => setHoveredRel(r.id)}
                    onPointerLeave={() => setHoveredRel(null)}
                  />

                  {/* видимая линия (события отключены, чтобы не мешала хитбоксу) */}
                  <path
                    d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeLinecap="round"
                    strokeWidth={strokeWidth}
                    markerEnd="url(#arrow)"
                    className="cursor-pointer transition-all"
                    style={
                      hovered
                        ? {
                            strokeDasharray: "16 11",
                            animation: "erd-flow-hover 2.1s linear infinite",
                            filter: "drop-shadow(0 0 1px rgba(139,92,246,.6))",
                          }
                        : undefined
                    }
                    pointerEvents="none"
                  />

                  {/* чип типа связи — ТОЛЬКО меню типов; инспектор не трогаем */}
                  <foreignObject
                    x={midX - 40}
                    y={midY - 34}
                    width={100}
                    height={40}
                    style={{ pointerEvents: "auto", overflow: "visible" }}
                  >
                    <div
                      data-chip="true"
                      className="relative z-50 text-[11px] rounded px-2 py-1 text-center cursor-pointer select-none shadow-sm"
                      style={{
                        background: "rgba(17,24,39,0.70)",
                        color: "#F3F4F6",
                        border: "1px solid rgba(139,92,246,0.5)",
                        backdropFilter: "blur(2px)",
                        minWidth: 56,
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // не меняем selectedRelationship — чип не открывает инспектор
                        ignoreCanvasClickUntil.current = performance.now() + 200;
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === r.id ? null : r.id);
                      }}
                    >
                      <span className="font-semibold select-none">
                        {r.type === "one-to-one"
                          ? "1:1"
                          : r.type === "one-to-many"
                          ? "1:N"
                          : "N:M"}
                      </span>

                      {activeMenu === r.id && (
                        <div
                          data-chip="true"
                          className="absolute top-7 left-1/2 -translate-x-1/2 z-[9999] rounded shadow-lg text-xs w-28"
                          style={{
                            background: "rgba(17,24,39,0.95)",
                            color: "#F9FAFB",
                            border: "1px solid rgba(99,102,241,0.6)",
                            backdropFilter: "blur(2px)",
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            ignoreCanvasClickUntil.current =
                              performance.now() + 200;
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            className="px-2 py-1 hover:bg-indigo-600/30 cursor-pointer"
                            onClick={() => {
                              changeRelType(r.id, "one-to-one");
                              setActiveMenu(null);
                            }}
                          >
                            1:1
                          </div>
                          <div
                            className="px-2 py-1 hover:bg-indigo-600/30 cursor-pointer"
                            onClick={() => {
                              changeRelType(r.id, "one-to-many");
                              setActiveMenu(null);
                            }}
                          >
                            1:N
                          </div>
                          <div
                            className="px-2 py-1 hover:bg-indigo-600/30 cursor-pointer"
                            onClick={() => {
                              changeRelType(r.id, "many-to-many");
                              setActiveMenu(null);
                            }}
                          >
                            N:M
                          </div>
                        </div>
                      )}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>

          {/* Entities */}
          {entities.map((entity) => (
            <div
              key={entity.id}
              ref={(el) => {
                if (el) cardRefs.current[entity.id] = el;
                else delete cardRefs.current[entity.id];
              }}
              className={`absolute z-20 w-56 shadow-md rounded-lg border select-none p-2 transition-all duration-150 ease-out ${
                isLinked(entity.id)
                  ? "border-purple-500 ring-2 ring-purple-400 bg-indigo-50 dark:bg-indigo-900/30 scale-[1.02]"
                  : "border-indigo-400 hover:border-indigo-600 hover:scale-[1.02] hover:shadow-lg"
              } bg-white dark:bg-gray-800 text-left`}
              style={{ left: entity.x, top: entity.y }}
              onMouseDown={(e) => handleMouseDownEntity(e, entity.id)}
              onClick={(e) => handleEntityClick(entity.id, e)}
            >
              {/* Заголовок + действия */}
              <div
                className="flex justify-between items-center cursor-move active:cursor-grabbing"
                onMouseDown={(e) => handleMouseDownEntity(e, entity.id)}
              >
                {renamingId === entity.id ? (
                  <input
                    autoFocus
                    defaultValue={entity.name}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        renameEntity(
                          entity.id,
                          (e.target as HTMLInputElement).value.trim() ||
                            entity.name
                        );
                        setRenamingId(null);
                      }
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={(e) => {
                      renameEntity(
                        entity.id,
                        e.target.value.trim() || entity.name
                      );
                      setRenamingId(null);
                    }}
                    className="font-semibold text-indigo-700 dark:text-indigo-300 bg-transparent border-b border-indigo-400 focus:outline-none w-32"
                  />
                ) : (
                  <p
                    className="font-semibold text-indigo-700 dark:text-indigo-300 cursor-text"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(entity.id);
                    }}
                  >
                    {entity.name}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId((cur) => (cur === entity.id ? null : entity.id));
                    }}
                    className="text-sm text-gray-500 hover:text-indigo-500"
                    title="Редактировать атрибуты"
                  >
                    ⚙️
                  </button>
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeEntity(entity.id);
                    }}
                    className="text-sm text-red-500 hover:text-red-700"
                    title="Удалить сущность"
                  >
                    🗑
                  </button>
                </div>
              </div>

              {/* Список атрибутов */}
              <ul className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {entity.attributes.map((a) => (
                  <li
                    key={a.id}
                    className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-1 mt-1"
                  >
                    <span
                      className={`${
                        (a as any).isPrimaryKey
                          ? "font-bold text-indigo-600 dark:text-indigo-300"
                          : ""
                      }`}
                    >
                      {(a as any).isPrimaryKey && "🔑 "}
                      {a.name}: {a.type}
                    </span>
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => removeAttribute(entity.id, a.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                      title="Удалить атрибут"
                    >
                      ✖
                    </button>
                  </li>
                ))}
              </ul>

              {/* Редактор: добавить атрибут */}
              {editingId === entity.id && (
                <div
                  className="mt-2 border-t border-gray-300 dark:border-gray-700 pt-2"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    value={newAttrName}
                    onChange={(e) => {
                      const filtered = e.target.value.replace(/[^A-Za-z0-9_]/g, "");
                      const noLeadingDigit = /^[0-9]/.test(filtered)
                        ? "_" + filtered
                        : filtered;
                      setNewAttrName(noLeadingDigit);
                    }}
                    placeholder="имя"
                    className="text-sm p-1 border rounded mr-1 w-24 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <select
                    value={newAttrType}
                    onChange={(e) => setNewAttrType(e.target.value)}
                    className="text-sm p-1 border rounded mr-1 w-28 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="">Тип</option>
                    <option value="INT">INT</option>
                    <option value="BIGINT">BIGINT</option>
                    <option value="UUID">UUID</option>
                    <option value="VARCHAR(255)">VARCHAR(255)</option>
                    <option value="TEXT">TEXT</option>
                    <option value="DATE">DATE</option>
                    <option value="TIMESTAMP">TIMESTAMP</option>
                    <option value="BOOLEAN">BOOLEAN</option>
                    <option value="FLOAT">FLOAT</option>
                    <option value="DECIMAL(10,2)">DECIMAL(10,2)</option>
                  </select>
                  <label className="text-xs text-gray-600 dark:text-gray-300 mr-2">
                    <input
                      type="checkbox"
                      checked={isPrimaryKey}
                      onChange={(e) => setIsPrimaryKey(e.target.checked)}
                      className="mr-1"
                    />
                    PK
                  </label>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!newAttrName || !newAttrType) return;
                      addAttribute(entity.id, newAttrName, newAttrType, isPrimaryKey);
                      setNewAttrName("");
                      setNewAttrType("");
                      setIsPrimaryKey(false);
                    }}
                    className="text-sm bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-600"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Мини-карта */}
        {showMinimap && (
          <Minimap
            entities={entities}
            viewport={viewportWorldRect}
            world={{ w: WORLD_W, h: WORLD_H }}
            onJump={(x, y) => {
              const root = canvasRef.current!.getBoundingClientRect();
              const s = scaleRef.current;
              const off = {
                x: -x * s + root.width / 2,
                y: -y * s + root.height / 2,
              };
              offsetRef.current = off;
              setOffset(off);
            }}
          />
        )}

        {/* Инспектор */}
        {inspectorOpen && selectedRel && (
          <RelationInspector
            refEl={inspectorRef}
            relation={selectedRel}
            entities={entities}
            onClose={() => setInspectorOpen(false)}
            onSaveFK={(patch: Partial<FKForm>) => {
              setRelationshipFK(selectedRel.id, patch);
              setJustSaved("fk");
              const fresh = useERStore
                .getState()
                .relationships.find((rr) => rr.id === selectedRel.id);
              if (fresh?.fk) {
                setFkForm({
                  column: fresh.fk.column ?? "",
                  type: fresh.fk.type ?? "",
                  notNull: fresh.fk.notNull ?? true,
                  unique: fresh.fk.unique,
                  onDelete: fresh.fk.onDelete ?? "CASCADE",
                  onUpdate: fresh.fk.onUpdate,
                  index: fresh.fk.index ?? true,
                });
              }
              setTimeout(() => setJustSaved(null), 1200);
            }}
            onSaveLink={(patch: Partial<LinkForm>) => {
              setRelationshipLink(selectedRel.id, patch);
              setJustSaved("link");
              const fresh = useERStore
                .getState()
                .relationships.find((rr) => rr.id === selectedRel.id);
              if (fresh?.link) {
                setLinkForm({
                  tableName: fresh.link.tableName ?? "",
                  leftColumn: fresh.link.leftColumn ?? "",
                  rightColumn: fresh.link.rightColumn ?? "",
                  compositePrimaryKey: fresh.link.compositePrimaryKey ?? true,
                  onDelete: fresh.link.onDelete ?? "CASCADE",
                  onUpdate: fresh.link.onUpdate,
                  index: fresh.link.index ?? true,
                });
              }
              setTimeout(() => setJustSaved(null), 1200);
            }}
            onReset={() => {
              updateRelationshipMeta(selectedRel.id, {
                fk: undefined,
                link: undefined,
              });
              setJustReset(true);
              if (selectedRel.type === "many-to-many") {
                setLinkForm({
                  tableName: "",
                  leftColumn: "",
                  rightColumn: "",
                  compositePrimaryKey: true,
                  onDelete: "CASCADE",
                  onUpdate: undefined,
                  index: true,
                });
              } else {
                setFkForm({
                  column: "",
                  type: "",
                  notNull: true,
                  unique: selectedRel.type === "one-to-one" ? true : undefined,
                  onDelete: "CASCADE",
                  onUpdate: undefined,
                  index: true,
                });
              }
              setTimeout(() => setJustReset(false), 1200);
            }}
            fkForm={fkForm}
            setFkForm={setFkForm}
            linkForm={linkForm}
            setLinkForm={setLinkForm}
          />
        )}
      </div>
    </div>
  );
}
