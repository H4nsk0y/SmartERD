import { useERStore } from "../store/useERStore";
import { useEffect, useMemo, useRef, useState } from "react";

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
  } = useERStore();

  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedForLink, setSelectedForLink] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrType, setNewAttrType] = useState("");

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // ===== Канвас-реф: координаты считаем только от него =====
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // ===== DOM-refs карточек + размеры через ResizeObserver =====
const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const [sizes, setSizes] = useState<Record<string, Size>>({}); // { [id]: {w,h} }

  useEffect(() => {
    const observers: Record<string, ResizeObserver> = {};

    // навесим наблюдателей на текущие карточки
    entities.forEach((e) => {
      const el = cardRefs.current[e.id];
      if (!el) return;

      // первичный замер
      const rect = el.getBoundingClientRect();
      setSizes((prev) =>
        prev[e.id]?.w === rect.width && prev[e.id]?.h === rect.height
          ? prev
          : { ...prev, [e.id]: { w: rect.width, h: rect.height } }
      );

      // реакция на изменения размеров
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          setSizes((prev) => {
            const prevSize = prev[e.id];
            if (prevSize && prevSize.w === cr.width && prevSize.h === cr.height) return prev;
            return { ...prev, [e.id]: { w: cr.width, h: cr.height } };
          });
        }
      });
      ro.observe(el);
      observers[e.id] = ro;
    });

    // очистка
    return () => {
      Object.values(observers).forEach((ro) => ro.disconnect());
    };
  }, [entities, editingId]); // при появлении/скрытии формы размеры меняются

  // ===== Добавление сущности (координаты от canvasRef) =====
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingEntity) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect(); // НЕ e.target!
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addEntity("Новая сущность", x, y);
    setIsAddingEntity(false);
  };

  // ===== Перетаскивание сущностей =====
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

  // ===== Атрибуты =====
  const handleAddAttribute = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!editingId || !newAttrName || !newAttrType) return;
    addAttribute(editingId, newAttrName, newAttrType);
    setNewAttrName("");
    setNewAttrType("");
    setEditingId(null); // закрываем форму после добавления
  };

  // ===== Связывание =====
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

  // ===== Точная точка стыка: пересечение луча с прямоугольником =====
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
    const scale = 1 / Math.max(absX / halfW, absY / halfH); // точка ровно на границе

    let ex = rectCenter.x + vx * scale;
    let ey = rectCenter.y + vy * scale;

    const len = Math.hypot(vx, vy);
    ex += (vx / len) * pad; // чуть наружу, чтобы не пряталось под рамку
    ey += (vy / len) * pad;

    return { x: ex, y: ey };
  }

  // ===== Рендер =====
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
          const toC   = { x: to.x + tw / 2,  y: to.y + th / 2 };

          const p1 = edgePointRayIntersect(fromC, toC, fw / 2, fh / 2, 6);
          const p2 = edgePointRayIntersect(toC, fromC, tw / 2, th / 2, 6);

          const horizontalFirst = Math.abs(p1.x - p2.x) > Math.abs(p1.y - p2.y);
          let d: string;
          if (horizontalFirst) {
            const midX = (p1.x + p2.x) / 2;
            d = `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`;
          } else {
            const midY = (p1.y + p2.y) / 2;
            d = `M ${p1.x} ${p1.y} L ${p1.x} ${midY} L ${p2.x} ${midY} L ${p2.x} ${p2.y}`;
          }

          return (
            <path
              key={r.id}
              d={d}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2.5"
              markerEnd="url(#arrow)"
              className="transition-all duration-75"
            />
          );
        })}
      </svg>

      {/* Карточки сущностей */}
      {entities.map((entity) => (
        <div
          key={entity.id}
          ref={(el) => { cardRefs.current[entity.id] = el; }}
          className={`absolute z-20 w-56 bg-white dark:bg-gray-800 shadow-md rounded-lg border ${
            selectedForLink === entity.id ? "border-purple-500" : "border-indigo-400"
          } text-left select-none p-2`}
          style={{ left: entity.x, top: entity.y }}
          onMouseDown={(e) => handleMouseDown(e, entity.id)}
          onClick={(e) => handleEntityClick(entity.id, e)}
        >
          {/* Заголовок */}
          <div
            className="flex justify-between items-center cursor-move active:cursor-grabbing"
            onMouseDown={(e) => handleMouseDown(e, entity.id)}
          >
            <p className="font-semibold text-indigo-700 dark:text-indigo-300">{entity.name}</p>
            <button
              onMouseDown={(e) => e.stopPropagation()}
               onClick={(e) => {
                e.stopPropagation();
                  removeEntity(entity.id);
                        }}
              className="text-sm text-red-500 hover:text-red-700 ml-2"
                  >
                🗑
               </button>

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
            
          </div>

          {/* Атрибуты */}
          <ul className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {entity.attributes.map((a) => (
              <li
                key={a.id}
                className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-1 mt-1"
              >
                <span>{a.name}: {a.type}</span>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAttribute(entity.id, a.id);
                  }}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  ✖
                </button>
              </li>
            ))}
          </ul>

          {/* Форма добавления атрибута */}
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
