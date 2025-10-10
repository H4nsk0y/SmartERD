import { useERStore } from "../store/useERStore";
import { useState, useRef } from "react";

export default function EditorCanvas() {
  const {
    entities,
    relationships,
    addEntity,
    updateEntityPosition,
    addAttribute,
    removeAttribute,
    addRelationship,
  } = useERStore();

  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedForLink, setSelectedForLink] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrType, setNewAttrType] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  // Добавление сущности
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingEntity) return;
    const rect = (e.target as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addEntity("Новая сущность", x, y);
    setIsAddingEntity(false);
  };

  // Перетаскивание
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation();
    setDraggingId(id);
    const rect = (e.target as HTMLDivElement).getBoundingClientRect();
    offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingId) return;
    const canvasRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - canvasRect.left - offsetRef.current.x;
    const y = e.clientY - canvasRect.top - offsetRef.current.y;
    updateEntityPosition(draggingId, x, y);
  };

  const handleMouseUp = () => setDraggingId(null);

  // Добавление атрибута
  const handleAddAttribute = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!editingId || !newAttrName || !newAttrType) return;
    addAttribute(editingId, newAttrName, newAttrType);
    setNewAttrName("");
    setNewAttrType("");
  };

  // Связывание сущностей
  const handleEntityClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLinking) return;
    if (!selectedForLink) {
      setSelectedForLink(id);
    } else if (selectedForLink !== id) {
      addRelationship(selectedForLink, id, "one-to-many");
      setSelectedForLink(null);
      setIsLinking(false);
    }
  };

  return (
    <div
      className="w-full h-[70vh] bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg relative overflow-hidden"
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Панель инструментов */}
      <div className="absolute top-4 left-4 flex gap-2">
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

    {/* SVG для связей */}
<svg
  className="absolute inset-0 w-full h-full pointer-events-none z-10"
  style={{ overflow: "visible" }}
>
  <defs>
    <marker
      id="arrow"
      markerWidth="10"
      markerHeight="10"
      refX="8"
      refY="3"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <path d="M0,0 L0,6 L9,3 z" fill="#6366f1" />
    </marker>
  </defs>

  {relationships.map((r) => {
    const from = entities.find((e) => e.id === r.from);
    const to = entities.find((e) => e.id === r.to);
    if (!from || !to) return null;

    // Размеры блока (совпадают с CSS)
    const boxWidth = 224; // 56 * 4 (w-56)
    const boxHeight = 80; // примерная высота блока
    const fromCenter = { x: from.x + boxWidth / 2, y: from.y + boxHeight / 2 };
    const toCenter = { x: to.x + boxWidth / 2, y: to.y + boxHeight / 2 };

    // Разница между центрами
    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;
    const angle = Math.atan2(dy, dx);

    // Смещения для "стыковки" к краю блока
    const fromOffsetX = (boxWidth / 2) * Math.cos(angle);
    const fromOffsetY = (boxHeight / 2) * Math.sin(angle);
    const toOffsetX = (boxWidth / 2) * Math.cos(angle + Math.PI);
    const toOffsetY = (boxHeight / 2) * Math.sin(angle + Math.PI);

    const x1 = fromCenter.x + fromOffsetX;
    const y1 = fromCenter.y + fromOffsetY;
    const x2 = toCenter.x + toOffsetX;
    const y2 = toCenter.y + toOffsetY;

    return (
      <line
        key={r.id}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#6366f1"
        strokeWidth="2.5"
        markerEnd="url(#arrow)"
      />
    );
  })}
</svg>


      {/* Сущности */}
      {entities.map((entity) => (
        <div
          key={entity.id}
          onMouseDown={(e) => handleMouseDown(e, entity.id)}
          onClick={(e) => handleEntityClick(entity.id, e)}
           className={`absolute z-20 w-56 bg-white dark:bg-gray-800 shadow-md rounded-lg border ${
                selectedForLink === entity.id
                        ?  "border-purple-500"
                        : "border-indigo-400"
          } text-left select-none p-2`}
          style={{ left: entity.x, top: entity.y }}
        >
          {/* Заголовок */}
          <div
            className="flex justify-between items-center cursor-move active:cursor-grabbing"
            onMouseDown={(e) => handleMouseDown(e, entity.id)}
          >
            <p className="font-semibold text-indigo-700 dark:text-indigo-300">
              {entity.name}
            </p>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(editingId === entity.id ? null : entity.id);
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
                <span>
                  {a.name}: {a.type}
                </span>
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

          {/* Форма добавления атрибутов */}
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
                onMouseDown={(e) => e.stopPropagation()}
                className="text-sm p-1 border rounded mr-1 w-20"
              />
              <input
                value={newAttrType}
                onChange={(e) => setNewAttrType(e.target.value)}
                placeholder="Тип"
                onMouseDown={(e) => e.stopPropagation()}
                className="text-sm p-1 border rounded mr-1 w-20"
              />
              <button
                onMouseDown={(e) => e.stopPropagation()}
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
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#d1d5db_1px,transparent_1px),linear-gradient(to_bottom,#d1d5db_1px,transparent_1px)] bg-[size:24px_24px] opacity-20 pointer-events-none" />
    </div>
  );
}
