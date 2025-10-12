import { useERStore } from "../store/useERStore";
import { useEffect, useRef, useState } from "react";

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
  } = useERStore();

  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedForLink, setSelectedForLink] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrType, setNewAttrType] = useState("");

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [sizes, setSizes] = useState<Record<string, Size>>({});

  // === Автоматическая подстройка размеров карточек ===
  useEffect(() => {
    const observers: Record<string, ResizeObserver> = {};
    entities.forEach((e) => {
      const el = cardRefs.current[e.id];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setSizes((prev) => ({
        ...prev,
        [e.id]: { w: rect.width, h: rect.height },
      }));
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          setSizes((prev) => ({
            ...prev,
            [e.id]: { w: cr.width, h: cr.height },
          }));
        }
      });
      ro.observe(el);
      observers[e.id] = ro;
    });
    return () => Object.values(observers).forEach((ro) => ro.disconnect());
  }, [entities, editingId]);

  // === Добавление сущности ===
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingEntity) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addEntity("Новая сущность", x, y);
    setIsAddingEntity(false);
  };

  // === Перетаскивание ===
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
    const x = e.clientX - rect.left - dragOffset.current.x;
    const y = e.clientY - rect.top - dragOffset.current.y;
    updateEntityPosition(draggingId, x, y);
  };

  const handleMouseUp = () => setDraggingId(null);

  // === Атрибуты ===
  const handleAddAttribute = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!editingId || !newAttrName || !newAttrType) return;
    addAttribute(editingId, newAttrName, newAttrType);
    setNewAttrName("");
    setNewAttrType("");
  };

  // === Связывание ===
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

  // === Геометрия ===
  function edgePointRayIntersect(
    rectCenter: { x: number; y: number },
    targetCenter: { x: number; y: number },
    halfW: number,
    halfH: number,
    pad = 6
  ) {
    const vx = targetCenter.x - rectCenter.x;
    const vy = targetCenter.y - rectCenter.y;
    if (vx === 0 && vy === 0) return { x: rectCenter.x, y: rectCenter.y };

    const absX = Math.abs(vx);
    const absY = Math.abs(vy);
    const scale = 1 / Math.max(absX / halfW, absY / halfH);

    let ex = rectCenter.x + vx * scale;
    let ey = rectCenter.y + vy * scale;

    const len = Math.hypot(vx, vy);
    ex += (vx / len) * pad;
    ey += (vy / len) * pad;
    return { x: ex, y: ey };
  }

  // === Рендер ===
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
      </div>

      {/* SVG связи */}
      <svg className="absolute inset-0 z-10 w-full h-full pointer-events-none">
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

          const p1 = edgePointRayIntersect(fromC, toC, fw / 2, fh / 2, 6);
          const p2 = edgePointRayIntersect(toC, fromC, tw / 2, th / 2, 6);

          const horizontalFirst = Math.abs(p1.x - p2.x) > Math.abs(p1.y - p2.y);
          const d = horizontalFirst
            ? `M ${p1.x} ${p1.y} L ${(p1.x + p2.x) / 2} ${p1.y} L ${(p1.x + p2.x) / 2} ${p2.y} L ${p2.x} ${p2.y}`
            : `M ${p1.x} ${p1.y} L ${p1.x} ${(p1.y + p2.y) / 2} L ${p2.x} ${(p1.y + p2.y) / 2} L ${p2.x} ${p2.y}`;

          const isActive = selectedForLink && (r.from === selectedForLink || r.to === selectedForLink);

          return (
            <path
              key={r.id}
              d={d}
              fill="none"
              stroke={isActive ? "#9333ea" : "#6366f1"} // ярче активные связи
              strokeWidth={isActive ? 3 : 2}
              markerEnd="url(#arrow)"
            >
              <title>{r.type}</title>
            </path>
          );
        })}
      </svg>

      {/* Карточки сущностей */}
      {entities.map((entity) => (
        <div
          key={entity.id}
          ref={(el) => { cardRefs.current[entity.id] = el; }}
          className={`absolute z-20 w-56 bg-white dark:bg-gray-800 shadow-md rounded-lg border 
            ${
              selectedForLink === entity.id
                ? "border-purple-600 ring-2 ring-purple-300"
                : "border-indigo-400 hover:border-indigo-600"
            }
            text-left select-none p-2`}
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
                className="font-semibold text-indigo-700 dark:text-indigo-300 bg-transparent border-b border-indigo-400 focus:outline-none focus:border-indigo-600 w-32"
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
          <ul className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {entity.attributes.map((a) => (
              <li
                key={a.id}
                className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-1 mt-1"
              >
                <span>{a.name}: {a.type}</span>
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

          {/* === Форма добавления атрибутов === */}
          {editingId === entity.id && (
            <div
              className="mt-2 border-t border-gray-300 dark:border-gray-700 pt-2"
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

      {/* Сетка */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#d1d5db_1px,transparent_1px),linear-gradient(to_bottom,#d1d5db_1px,transparent_1px)] bg-[size:24px_24px]" />
    </div>
  );
}
