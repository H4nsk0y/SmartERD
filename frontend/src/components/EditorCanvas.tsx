// src/components/EditorCanvas.tsx
import { useEffect, useRef, useState } from "react";
import { useERStore } from "../store/useERStore";
import { generateSQL } from "../utils/generateSQL";

type Size = { w: number; h: number };

const GRID = 32;
const snap = (v: number) => Math.round(v / GRID) * GRID;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const WORLD_W = 50000;
const WORLD_H = 50000;
const DEBUG = true; // включи/выключи логи

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
    setDiagramData,
    clearAll,
  } = useERStore();

  // UI
  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedForLink, setSelectedForLink] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [hoveredRel, setHoveredRel] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrType, setNewAttrType] = useState("");
  const [isPrimaryKey, setIsPrimaryKey] = useState(false);

  // drag
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartWorld = useRef<{ x: number; y: number } | null>(null);
  const entityStartPos = useRef<{ x: number; y: number } | null>(null);

  // preview
  const [mouseWorld, setMouseWorld] = useState<{ x: number; y: number } | null>(null);

  // refs & sizes
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [sizes, setSizes] = useState<Record<string, Size>>({}); // размеры в WORLD

  // камера
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  const isPanning = useRef(false);
  const panStartScreen = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // утилиты координат
  const toWorld = (cx: number, cy: number, rect: DOMRect) => ({
    x: (cx - rect.left - offsetRef.current.x) / scaleRef.current,
    y: (cy - rect.top  - offsetRef.current.y) / scaleRef.current,
  });

  // слежение за размерами карточек -> WORLD
  useEffect(() => {
    const observers: Record<string, ResizeObserver> = {};
    entities.forEach((e) => {
      const el = cardRefs.current[e.id];
      if (!el) return;

      const update = () => {
        const r = el.getBoundingClientRect();
        setSizes((p) => ({ ...p, [e.id]: { w: r.width / scaleRef.current, h: r.height / scaleRef.current } }));
      };

      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      observers[e.id] = ro;
    });
    return () => Object.values(observers).forEach((ro) => ro.disconnect());
  }, [entities, editingId, scale]);

  // удалить связь
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedRelationshipId) {
        removeRelationship(selectedRelationshipId);
        setSelectedRelationship(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedRelationshipId, removeRelationship, setSelectedRelationship]);

  // === ЗУМ: нативный wheel, passive:false, зум к курсору, matrix ===
  useEffect(() => {
    const root = canvasRef.current;
    if (!root) return;

    let raf = 0;
    let last: WheelEvent | null = null;

    const onWheel = (e: WheelEvent) => {
      // блокируем скролл/системный зум, иначе оффсет «прыгает»
      e.preventDefault();
      last = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!last) return;

        const rect = root.getBoundingClientRect();
        const sPrev = scaleRef.current;
        const offPrev = offsetRef.current;
        const pre = toWorld(last!.clientX, last!.clientY, rect);

        // плавный фактор, экспонента = предсказуемые шаги
        const factor = Math.exp(-last!.deltaY * 0.0015);
        const sNext = clamp(sPrev * factor, 0.3, 3);

        const offNext = {
          x: last!.clientX - rect.left - pre.x * sNext,
          y: last!.clientY - rect.top  - pre.y * sNext,
        };

        if (DEBUG) {
          console.debug("[wheel]", {
            deltaY: last!.deltaY,
            sPrev, sNext,
            offPrev, offNext,
            cursorScreen: { x: last!.clientX - rect.left, y: last!.clientY - rect.top },
            preWorld: pre,
          });
        }

        scaleRef.current = sNext;
        offsetRef.current = offNext;
        setScale(sNext);
        setOffset(offNext);
      });
    };

    const preventGesture = (e: Event) => {
      e.preventDefault();
      if (DEBUG) console.debug("[gesture] prevented", e.type);
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("gesturestart", preventGesture as EventListener, { passive: false } as any);
    root.addEventListener("gesturechange", preventGesture as EventListener, { passive: false } as any);

    return () => {
      root.removeEventListener("wheel", onWheel as EventListener);
      root.removeEventListener("gesturestart", preventGesture as EventListener);
      root.removeEventListener("gesturechange", preventGesture as EventListener);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // панорамирование
  const handleMouseDownPan = (e: React.MouseEvent) => {
    if (e.button === 2 || e.button === 1 || e.ctrlKey || e.metaKey || e.shiftKey) {
      e.preventDefault();
      isPanning.current = true;
      panStartScreen.current = { x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y };
      if (DEBUG) console.debug("[pan] start", { panStartScreen: panStartScreen.current });
    }
  };
  const handleMouseMovePan = (e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const off = { x: e.clientX - panStartScreen.current.x, y: e.clientY - panStartScreen.current.y };
    offsetRef.current = off;
    setOffset(off);
  };
  const handleMouseUpPan = () => {
    if (isPanning.current && DEBUG) console.debug("[pan] end", { offset: offsetRef.current });
    isPanning.current = false;
  };

  // добавить сущность
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingEntity) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const w = toWorld(e.clientX, e.clientY, rect);
    addEntity("Новая сущность", snap(w.x - 112), snap(w.y - 40));
    setIsAddingEntity(false);
    setMouseWorld(null);
  };

  // drag сущности
  const handleMouseDownEntity = (e: React.MouseEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation();
    const rect = canvasRef.current!.getBoundingClientRect();
    const w = toWorld(e.clientX, e.clientY, rect);
    dragStartWorld.current = w;
    const ent = entities.find((x) => x.id === id);
    entityStartPos.current = ent ? { x: ent.x, y: ent.y } : null;
    setDraggingId(id);
    if (DEBUG) console.debug("[drag] down", { id, dragStartWorld: w, entityStartPos: entityStartPos.current });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning.current) {
      handleMouseMovePan(e);
      return;
    }

    const rect = canvasRef.current!.getBoundingClientRect();
    const wNow = toWorld(e.clientX, e.clientY, rect);
    setMouseWorld(wNow);

    if (draggingId && dragStartWorld.current && entityStartPos.current) {
      const dx = wNow.x - dragStartWorld.current.x;
      const dy = wNow.y - dragStartWorld.current.y;
      const nx = snap(entityStartPos.current.x + dx);
      const ny = snap(entityStartPos.current.y + dy);
      updateEntityPosition(draggingId, nx, ny);
    }
  };

  const handleMouseUp = () => {
    if (draggingId && DEBUG) console.debug("[drag] up", { id: draggingId });
    setDraggingId(null);
    dragStartWorld.current = null;
    entityStartPos.current = null;
    handleMouseUpPan();
  };

  // линковка
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

  // геометрия коннектора
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

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const scaleX = halfW / absDx;
    const scaleY = halfH / absDy;
    const t = Math.min(scaleX, scaleY);

    let ex = rectCenter.x + dx * t;
    let ey = rectCenter.y + dy * t;

    const len = Math.hypot(dx, dy);
    ex += (dx / len) * pad;
    ey += (dy / len) * pad;
    return { x: ex, y: ey };
  }

  // экспорт / импорт
  const handleExportJSON = () => {
    const data = { entities, relationships };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
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
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);
        if (data.entities && data.relationships) setDiagramData(data.entities, data.relationships);
        else alert("Некорректный JSON-файл");
      } catch {
        alert("Ошибка при чтении файла");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // === Рендер ===
  return (
    <div
      ref={canvasRef}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative w-full h-[70vh] border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden 
        ${isAddingEntity ? "cursor-crosshair bg-gray-100 dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-900"}`}
      style={{ overscrollBehavior: "none", touchAction: "none" }}
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDownPan}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      // ВАЖНО: здесь НЕТ onWheel — зум обрабатывается нативным listener-ом
    >
      {/* Панель */}
      <div className="absolute top-4 left-4 z-30 flex gap-2">
        <button onClick={() => { setIsAddingEntity(true); setIsLinking(false); }}
                className={`px-4 py-2 rounded-lg text-white ${isAddingEntity ? "bg-indigo-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
          + Сущность
        </button>
        <button onClick={() => { setIsLinking((v) => !v); setIsAddingEntity(false); setSelectedForLink(null); }}
                className={`px-4 py-2 rounded-lg text-white ${isLinking ? "bg-purple-700" : "bg-purple-600 hover:bg-purple-700"}`}>
          🔗 Связь
        </button>
        <button onClick={handleExportJSON} className="px-4 py-2 rounded-lg text-white bg-green-600 hover:bg-green-700">
          💾 Экспорт JSON
        </button>
        <label className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 cursor-pointer">
          📂 Импорт JSON
          <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
        </label>
        <button onClick={() => { const sql = generateSQL(entities, relationships); console.log(sql); alert("SQL сгенерирован! Проверь консоль (F12)"); }}
                className="px-4 py-2 rounded-lg text-white bg-yellow-500 hover:bg-yellow-600">
          🧩 Сгенерировать SQL
        </button>
        <button onClick={clearAll} className="px-4 py-2 rounded-lg text-white bg-red-500 hover:bg-red-600">🗑 Очистить</button>
      </div>

      {/* Мир: ОДНА матрица (без translate+scale) */}
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
        {/* Превью */}
        {isAddingEntity && mouseWorld && (
          <div
            className="absolute z-20 w-56 text-center border-2 border-dashed border-indigo-400 rounded-lg bg-indigo-50/50 text-indigo-700 font-semibold pointer-events-none"
            style={{ left: mouseWorld.x - 112, top: mouseWorld.y - 40, padding: 8 }}
          >
            + Новая сущность
          </div>
        )}

        {/* Связи */}
        <svg className="absolute top-0 left-0 z-10" width={WORLD_W} height={WORLD_H} style={{ overflow: "visible", pointerEvents: "none" }}>
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
              <path d="M0,0 L0,6 L9,3 z" fill="#6366f1" />
            </marker>
          </defs>

          {relationships.map((r) => {
            const from = entities.find((e) => e.id === r.from);
            const to = entities.find((e) => e.id === r.to);
            if (!from || !to) return null;

            const fw = sizes[from.id]?.w ?? 224;
            const fh = sizes[from.id]?.h ?? 80;
            const tw = sizes[to.id]?.w ?? 224;
            const th = sizes[to.id]?.h ?? 80;

            const fromC = { x: from.x + fw / 2, y: from.y + fh / 2 };
            const toC = { x: to.x + tw / 2, y: to.y + th / 2 };

            const p1 = edgePointRayIntersect(fromC, toC, fw / 2, fh / 2);
            const p2 = edgePointRayIntersect(toC, fromC, tw / 2, th / 2);

            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            const isSelected = selectedRelationshipId === r.id;
            const strokeColor = isSelected ? "#a78bfa" : hoveredRel === r.id ? "#8b5cf6" : "#6366f1";

            return (
              <g key={r.id} style={{ pointerEvents: "auto" }}>
                <path
                  d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={2.5}
                  markerEnd="url(#arrow)"
                  className="cursor-pointer transition-all"
                  onClick={(e) => { e.stopPropagation(); setSelectedRelationship(isSelected ? null : r.id); }}
                  onMouseEnter={() => setHoveredRel(r.id)}
                  onMouseLeave={() => setHoveredRel(null)}
                />
                <foreignObject x={midX - 18} y={midY - 15} width={40} height={25} style={{ pointerEvents: "auto", overflow: "visible" }}>
                  <div
                    className="relative z-50 bg-white dark:bg-gray-800 text-xs border border-indigo-400 rounded px-1 py-0.5 text-center cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-700 select-none shadow-sm"
                    onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === r.id ? null : r.id); }}
                  >
                    <span className="text-indigo-700 dark:text-indigo-200 font-semibold">
                      {r.type === "one-to-one" ? "1:1" : r.type === "one-to-many" ? "1:N" : "N:M"}
                    </span>
                    {activeMenu === r.id && (
                      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[9999] bg-white dark:bg-gray-800 border border-indigo-300 dark:border-gray-600 rounded shadow-lg text-xs w-16">
                        <div className="px-2 py-1 hover:bg-indigo-100 dark:hover:bg-gray-700 cursor-pointer" onClick={() => { updateRelationshipType(r.id, "one-to-one"); setActiveMenu(null); }}>1:1</div>
                        <div className="px-2 py-1 hover:bg-indigo-100 dark:hover:bg-gray-700 cursor-pointer" onClick={() => { updateRelationshipType(r.id, "one-to-many"); setActiveMenu(null); }}>1:N</div>
                        <div className="px-2 py-1 hover:bg-indigo-100 dark:hover:bg-gray-700 cursor-pointer" onClick={() => { updateRelationshipType(r.id, "many-to-many"); setActiveMenu(null); }}>N:M</div>
                      </div>
                    )}
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>

        {/* Сущности */}
        {entities.map((entity) => {
          const isLinkedToSelected =
            selectedRelationshipId &&
            relationships.some((r) => r.id === selectedRelationshipId && (r.from === entity.id || r.to === entity.id));

          return (
            <div
              key={entity.id}
              ref={(el) => {
                if (el) cardRefs.current[entity.id] = el;
                else delete cardRefs.current[entity.id];
              }}
              className={`absolute z-20 w-56 shadow-md rounded-lg border select-none p-2 transition-all duration-150 ease-out ${
                isLinkedToSelected
                  ? "border-purple-500 ring-2 ring-purple-400 bg-indigo-50 dark:bg-indigo-900/30 scale-[1.02]"
                  : "border-indigo-400 hover:border-indigo-600 hover:scale-[1.02] hover:shadow-lg"
              } bg-white dark:bg-gray-800 text-left`}
              style={{ left: entity.x, top: entity.y }}
              onMouseDown={(e) => handleMouseDownEntity(e, entity.id)}
              onClick={(e) => handleEntityClick(entity.id, e)}
            >
              <div className="flex justify-between items-center cursor-move active:cursor-grabbing" onMouseDown={(e) => handleMouseDownEntity(e, entity.id)}>
                {renamingId === entity.id ? (
                  <input
                    autoFocus
                    defaultValue={entity.name}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        renameEntity(entity.id, (e.target as HTMLInputElement).value.trim() || entity.name);
                        setRenamingId(null);
                      }
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={(e) => {
                      renameEntity(entity.id, e.target.value.trim() || entity.name);
                      setRenamingId(null);
                    }}
                    className="font-semibold text-indigo-700 dark:text-indigo-300 bg-transparent border-b border-indigo-400 focus:outline-none w-32"
                  />
                ) : (
                  <p className="font-semibold text-indigo-700 dark:text-indigo-300 cursor-text" onDoubleClick={(e) => { e.stopPropagation(); setRenamingId(entity.id); }}>
                    {entity.name}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setEditingId((cur) => (cur === entity.id ? null : entity.id)); }} className="text-sm text-gray-500 hover:text-indigo-500">⚙️</button>
                  <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); removeEntity(entity.id); }} className="text-sm text-red-500 hover:text-red-700">🗑</button>
                </div>
              </div>

              <ul className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {entity.attributes.map((a) => (
                  <li key={a.id} className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                    <span className={`${a.isPrimaryKey ? "font-bold text-indigo-600 dark:text-indigo-300" : ""}`}>
                      {a.isPrimaryKey && "🔑 "}
                      {a.name}: {a.type}
                    </span>
                    <button onMouseDown={(e) => e.stopPropagation()} onClick={() => removeAttribute(entity.id, a.id)} className="text-red-500 hover:text-red-700 text-xs">✖</button>
                  </li>
                ))}
              </ul>

              {editingId === entity.id && (
                <div className="mt-2 border-t border-gray-300 dark:border-gray-700 pt-2" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                  <input value={newAttrName} onChange={(e) => setNewAttrName(e.target.value)} placeholder="Имя" className="text-sm p-1 border rounded mr-1 w-24" />
                  <select value={newAttrType} onChange={(e) => setNewAttrType(e.target.value)} className="text-sm p-1 border rounded mr-1 w-28">
                    <option value="">Тип</option>
                    <option value="INT">INT</option>
                    <option value="VARCHAR(255)">VARCHAR(255)</option>
                    <option value="BOOLEAN">BOOLEAN</option>
                    <option value="DATE">DATE</option>
                    <option value="FLOAT">FLOAT</option>
                  </select>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mr-2">
                    <input type="checkbox" checked={isPrimaryKey} onChange={(e) => setIsPrimaryKey(e.target.checked)} className="mr-1" />
                    PK
                  </label>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!newAttrName || !newAttrType) return;
                      addAttribute(entity.id, newAttrName, newAttrType, isPrimaryKey);
                      setNewAttrName(""); setNewAttrType(""); setIsPrimaryKey(false);
                    }}
                    className="text-sm bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-600"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Сетка */}
        <div
          className="absolute top-0 left-0 pointer-events-none opacity-20"
          style={{
            width: WORLD_W,
            height: WORLD_H,
            backgroundImage: `
              linear-gradient(to right, var(--tw-prose-bullets) 1px, transparent 1px),
              linear-gradient(to bottom, var(--tw-prose-bullets) 1px, transparent 1px)
            `,
            backgroundSize: `${GRID}px ${GRID}px`,
          }}
        />
      </div>
    </div>
  );
}
