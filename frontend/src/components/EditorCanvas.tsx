import { useERStore } from "../store/useERStore";
import { useEffect, useRef, useState, createElement } from "react";

type Size = { w: number; h: number };

export default function EditorCanvas() {
  const {
    entities,
    relationships,
    addEntity,
    updateEntityPosition,
    addAttribute,
    removeAttribute,
    addRelationship,
    removeEntity,
    renameEntity,
    selectedRelationshipId,
    setSelectedRelationship,
    updateRelationshipType,
  } = useERStore();

  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedForLink, setSelectedForLink] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [hoveredRel, setHoveredRel] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrType, setNewAttrType] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement>>({});
  const [sizes, setSizes] = useState<Record<string, Size>>({});

  const GRID_SIZE = 32;
  const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

  /* === Автоматическая подстройка размеров карточек === */
  useEffect(() => {
    const observers: Record<string, ResizeObserver> = {};
    entities.forEach((e) => {
      const el = cardRefs.current[e.id];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setSizes((prev) => ({ ...prev, [e.id]: { w: rect.width, h: rect.height } }));
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          setSizes((prev) => ({ ...prev, [e.id]: { w: cr.width, h: cr.height } }));
        }
      });
      ro.observe(el);
      observers[e.id] = ro;
    });
    return () => Object.values(observers).forEach((ro) => ro.disconnect());
  }, [entities, editingId]);

  /* === Добавление сущности === */
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingEntity) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = snapToGrid(e.clientX - rect.left);
    const y = snapToGrid(e.clientY - rect.top);
    addEntity("Новая сущность", x, y);
    setIsAddingEntity(false);
  };

  /* === Перетаскивание === */
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation();
    setDraggingId(id);
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = snapToGrid(e.clientX - rect.left - dragOffset.current.x);
    const y = snapToGrid(e.clientY - rect.top - dragOffset.current.y);
    updateEntityPosition(draggingId, x, y);
  };

  const handleMouseUp = () => setDraggingId(null);

  /* === Экспорт в JSON === */
const handleExportJSON = () => {
  const data = {
    entities,
    relationships,
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "diagram.json";
  a.click();

  URL.revokeObjectURL(url);
};


  /* === Атрибуты === */
  const handleAddAttribute = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!editingId || !newAttrName || !newAttrType) return;
    addAttribute(editingId, newAttrName, newAttrType);
    setNewAttrName("");
    setNewAttrType("");
  };

  /* === Связывание === */
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

  /* === Геометрия === */
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

  /* === Рендер === */
  return (
    <div
      ref={canvasRef}
      className="relative w-full h-[70vh] bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden"
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Панель инструментов */}
      <div className="absolute top-4 left-4 z-30 flex gap-2">
        <button
          onClick={() => {
            setIsAddingEntity(true);
            setIsLinking(false);
          }}
          className={`px-4 py-2 rounded-lg text-white ${
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
          }}
          className={`px-4 py-2 rounded-lg text-white ${
            isLinking ? "bg-purple-700" : "bg-purple-600 hover:bg-purple-700"
          }`}
        >
          🔗 Связь
        </button>
        
        <button
        onClick={handleExportJSON}
        className="px-4 py-2 rounded-lg text-white bg-green-600 hover:bg-green-700"
                                            >
          💾 Экспорт JSON
          </button>

      </div>

      {/* SVG связи */}
      <svg className="absolute inset-0 z-10 w-full h-full">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
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

          const color =
            r.type === "one-to-one"
              ? "#22c55e"
              : r.type === "one-to-many"
              ? "#3b82f6"
              : "#f59e0b";

          return (
            <g key={r.id}>
              <path
                d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                markerEnd="url(#arrow)"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRelationship(selectedRelationshipId === r.id ? null : r.id);
                }}
                onMouseEnter={() => setHoveredRel(r.id)}
                onMouseLeave={() => setHoveredRel(null)}
                className="cursor-pointer"
              />

              {/* === Метка типа связи === */}
              <foreignObject
                x={midX - 20}
                y={midY - 15}
                width={60}
                height={40}
                className="overflow-visible"
                style={{ pointerEvents: "auto", overflow: "visible" }}
              >
                {createElement(
                  "div",
                  {
                    xmlns: "http://www.w3.org/1999/xhtml",
                    className:
                      "bg-white text-xs border border-indigo-400 rounded px-1 py-0.5 text-center cursor-pointer hover:bg-indigo-50 select-none relative",
                    onClick: (e: React.MouseEvent) => {
                      e.stopPropagation();
                      setActiveMenu(activeMenu === r.id ? null : r.id);
                    },
                  },
                  <>
                    {r.type === "one-to-one"
                      ? "1:1"
                      : r.type === "one-to-many"
                      ? "1:N"
                      : "N:M"}

                    {activeMenu === r.id && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 top-5 bg-white border border-indigo-300 rounded shadow-lg z-50 w-16 text-xs"
                        style={{ pointerEvents: "auto" }}
                      >
                        <div
                          className="px-2 py-1 hover:bg-indigo-100 cursor-pointer"
                          onClick={() => {
                            updateRelationshipType(r.id, "one-to-one");
                            setActiveMenu(null);
                          }}
                        >
                          1:1
                        </div>
                        <div
                          className="px-2 py-1 hover:bg-indigo-100 cursor-pointer"
                          onClick={() => {
                            updateRelationshipType(r.id, "one-to-many");
                            setActiveMenu(null);
                          }}
                        >
                          1:N
                        </div>
                        <div
                          className="px-2 py-1 hover:bg-indigo-100 cursor-pointer"
                          onClick={() => {
                            updateRelationshipType(r.id, "many-to-many");
                            setActiveMenu(null);
                          }}
                        >
                          N:M
                        </div>
                      </div>
                    )}
                  </>
                )}
              </foreignObject>
            </g>
          );
        })}
      </svg>

      {/* === Карточки === */}
      {entities.map((entity) => (
        <div
          key={entity.id}
          ref={(el) => {
            if (el) cardRefs.current[entity.id] = el;
            else delete cardRefs.current[entity.id];
          }}
          className={`absolute z-20 w-56 shadow-md rounded-lg border select-none p-2
            ${
              selectedForLink === entity.id ||
              relationships.some(
                (r) =>
                  r.id === selectedRelationshipId &&
                  (r.from === entity.id || r.to === entity.id)
              )
                ? "border-purple-500 ring-2 ring-purple-400 bg-indigo-50 scale-[1.02]"
                : "border-indigo-400 hover:border-indigo-600 hover:scale-[1.02] hover:shadow-lg"
            }
            bg-white text-left transition-all duration-150 ease-out`}
          style={{ left: entity.x, top: entity.y }}
          onMouseDown={(e) => handleMouseDown(e, entity.id)}
          onClick={(e) => handleEntityClick(entity.id, e)}
        >
          {/* === Заголовок === */}
          <div
            className="flex justify-between items-center cursor-move active:cursor-grabbing"
            onMouseDown={(e) => handleMouseDown(e, entity.id)}
          >
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
                className="font-semibold text-indigo-700 bg-transparent border-b border-indigo-400 focus:outline-none w-32"
              />
            ) : (
              <p
                className="font-semibold text-indigo-700 cursor-text"
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
              >
                🗑
              </button>
            </div>
          </div>

          {/* === Атрибуты === */}
          <ul className="mt-1 text-sm text-gray-700">
            {entity.attributes.map((a) => (
              <li
                key={a.id}
                className="flex justify-between items-center border-t border-gray-200 pt-1 mt-1"
              >
                <span>
                  {a.name}: {a.type}
                </span>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => removeAttribute(entity.id, a.id)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  ✖
                </button>
              </li>
            ))}
          </ul>

          {/* === Добавление атрибутов === */}
          {editingId === entity.id && (
            <div
              className="mt-2 border-t border-gray-300 pt-2"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                value={newAttrName}
                onChange={(e) => setNewAttrName(e.target.value)}
                placeholder="Имя"
                className="text-sm p-1 border rounded mr-1 w-24"
              />
              <input
                value={newAttrType}
                onChange={(e) => setNewAttrType(e.target.value)}
                placeholder="Тип"
                className="text-sm p-1 border rounded mr-1 w-20"
              />
              <button
                onClick={handleAddAttribute}
                className="text-sm bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-600"
              >
                +
              </button>
            </div>
          )}
        </div>
      ))}

      {/* === Сетка === */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25 
        bg-[linear-gradient(to_right,#9ca3af_1px,transparent_1px),
            linear-gradient(to_bottom,#9ca3af_1px,transparent_1px)]
        bg-[size:32px_32px]"
      />
    </div>
  );
}
