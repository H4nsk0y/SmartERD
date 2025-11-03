// frontend/src/components/EditorCanvas.tsx
import { useEffect, useRef, useState, useMemo } from "react";
import { useERStore } from "../store/useERStore";
import { generateSQL } from "../utils/generateSQL";

import SQLPanel, { type SqlDialect } from "../canvas/components/SQLPanel";
import RelationInspector from "../canvas/components/RelationInspector";
import LinkHintToast from "../canvas/components/LinkHintToast";
import RelationsSvg from "../canvas/components/RelationsSvg";
import RelationLabel from "../canvas/components/RelationLabel";
import CanvasGrid from "../canvas/components/CanvasGrid";
import Minimap from "../canvas/components/Minimap";
import EntitiesLayer from "../canvas/components/EntitiesLayer";
import { useCamera } from "../canvas/hooks/useCamera";
import type { FKForm as FKFormT, LinkForm as LinkFormT, Size } from "../canvas/types";
import EditorToolbar from "../canvas/components/EditorToolbar";

const GRID = 32;
const WORLD_W = 50000;
const WORLD_H = 50000;

type RelationKind = "one-to-one" | "one-to-many" | "many-to-many";
const snap = (v: number) => Math.round(v / GRID) * GRID;

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
  const [hoveredRel, setHoveredRel] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showSqlPanel, setShowSqlPanel] = useState(true); // переключатель SQL-панели

  // toast
  const [linkHintPulse, setLinkHintPulse] = useState(0);
  useEffect(() => { if (isLinking) setLinkHintPulse((n) => n + 1); }, [isLinking]);

  // SQL
  const [sqlOut, setSqlOut] = useState<string>("");
  const [dialect, setDialect] = useState<SqlDialect>("postgres");

  // локальный ввод атрибутов (для EntitiesLayer форм)
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrType, setNewAttrType] = useState("");
  const [isPrimaryKey, setIsPrimaryKey] = useState(false);

  // инспектор
  const selectedRel = relationships.find((r) => r.id === selectedRelationshipId) || null;
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const inspectorRef = useRef<HTMLDivElement | null>(null);

  const defaultFkForm: FKFormT = {
    column: "",
    type: "",
    notNull: true,
    unique: undefined,
    onDelete: "CASCADE",
    onUpdate: undefined,
    index: true,
  };
  const defaultLinkForm: LinkFormT = {
    tableName: "",
    leftColumn: "",
    rightColumn: "",
    compositePrimaryKey: true,
    onDelete: "CASCADE",
    onUpdate: undefined,
    index: true,
  };

  const [fkForm, setFkForm] = useState<FKFormT>(defaultFkForm);
  const [linkForm, setLinkForm] = useState<LinkFormT>(defaultLinkForm);

  const [justSaved, setJustSaved] = useState<"fk" | "link" | null>(null);
  const [justReset, setJustReset] = useState(false);
  void justSaved; void justReset;

  // drag
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartWorld = useRef<{ x: number; y: number } | null>(null);
  const entityStartPos = useRef<{ x: number; y: number } | null>(null);

  // preview «+ сущность»
  const [mouseWorld, setMouseWorld] = useState<{ x: number; y: number } | null>(null);

  // refs & sizes
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [sizes, setSizes] = useState<Record<string, Size>>({});

  // camera
  const camera = useCamera({ minScale: 0.3, maxScale: 3, initialScale: 1 });

  // размеры карточек -> мировые
  useEffect(() => {
    const observers: Record<string, ResizeObserver> = {};
    entities.forEach((e) => {
      const el = cardRefs.current[e.id];
      if (!el) return;
      const update = () => {
        const r = el.getBoundingClientRect();
        setSizes((p) => ({
          ...p,
          [e.id]: {
            w: r.width / camera.scaleRef.current,
            h: r.height / camera.scaleRef.current,
          },
        }));
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      observers[e.id] = ro;
    });
    return () => Object.values(observers).forEach((ro) => ro.disconnect());
  }, [entities, editingId, camera.scale]);

  // колесо: нативно (passive: false), чтобы работал preventDefault
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => camera.onWheelNative(ev, el);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel as EventListener);
  }, [camera]);

  // блок iOS pinch
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    (el as any).addEventListener("gesturestart", prevent as any, { passive: false } as any);
    (el as any).addEventListener("gesturechange", prevent as any, { passive: false } as any);
    return () => {
      (el as any).removeEventListener("gesturestart", prevent as any);
      (el as any).removeEventListener("gesturechange", prevent as any);
    };
  }, []);

  // Esc снимает режим добавления И закрывает инспектор
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isAddingEntity) {
          setIsAddingEntity(false);
          setMouseWorld(null);
        }
        if (inspectorOpen) {
          setInspectorOpen(false);
          setSelectedRelationship(null);
          setHoveredRel(null);
          // при закрытии — сбрасываем локальные черновики
          setFkForm(defaultFkForm);
          setLinkForm(defaultLinkForm);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAddingEntity, inspectorOpen]);

  // Delete/Backspace удаляет связь по hover (если инспектор закрыт)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inspectorOpen) return;
      if ((e.key === "Delete" || e.key === "Backspace") && hoveredRel) {
        const inInput = (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]");
        if (inInput) return;
        useERStore.getState().removeRelationship(hoveredRel);
        setSelectedRelationship(null);
        setHoveredRel(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hoveredRel, inspectorOpen, setSelectedRelationship]);

  // Undo/Redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const z = e.key.toLowerCase() === "z";
      const y = e.key.toLowerCase() === "y";
      const meta = e.ctrlKey || e.metaKey;
      const inInput = (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]");
      if (!meta || inInput) return;
      if (z && !e.shiftKey) { e.preventDefault(); undo?.(); }
      else if (y || (z && e.shiftKey)) { e.preventDefault(); redo?.(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // ---- ДЕФОЛТНОЕ УНИКАЛЬНОЕ ИМЯ ДЛЯ НОВОЙ СУЩНОСТИ ----
  const nextDefaultEntityName = () => {
    const base = "Entity";
    const used = new Set(entities.map((e) => e.name.toLowerCase()));
    if (!used.has(base.toLowerCase())) return base;
    let i = 2;
    let candidate = `${base}_${i}`;
    while (used.has(candidate.toLowerCase())) {
      i += 1;
      candidate = `${base}_${i}`;
    }
    return candidate;
  };

  // click на пустом месте → добавить сущность
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingEntity) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const w = camera.toWorld(e.clientX, e.clientY, rect);
    addEntity(nextDefaultEntityName(), snap(w.x - 112), snap(w.y - 40));
    setIsAddingEntity(false);
    setMouseWorld(null);
  };

  // drag карточки (RAF)
  const moveRaf = useRef<number>(0);
  const movePayload = useRef<{ type: "move" | "drag"; e: React.MouseEvent<HTMLDivElement> } | null>(null);

  const handleMouseDownEntity = (e: React.MouseEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation();
    const rect = canvasRef.current!.getBoundingClientRect();
    const w = camera.toWorld(e.clientX, e.clientY, rect);
    dragStartWorld.current = w;
    const ent = entities.find((x) => x.id === id);
    entityStartPos.current = ent ? { x: ent.x, y: ent.y } : null;
    setDraggingId(id);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    camera.onPanMove(e);
    movePayload.current = { type: draggingId ? "drag" : "move", e };
    if (moveRaf.current) return;
    moveRaf.current = requestAnimationFrame(() => {
      moveRaf.current = 0;
      const payload = movePayload.current;
      if (!payload) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const wNow = camera.toWorld(payload.e.clientX, payload.e.clientY, rect);

      if (isAddingEntity) setMouseWorld(wNow);

      if (payload.type === "drag" && draggingId && dragStartWorld.current && entityStartPos.current) {
        const dx = wNow.x - dragStartWorld.current.x;
        const dy = wNow.y - dragStartWorld.current.y;
        updateEntityPosition(draggingId, snap(entityStartPos.current.x + dx), snap(entityStartPos.current.y + dy));
      }
    });
  };

  const handleMouseUp = () => {
    camera.onPanEnd();
    setDraggingId(null);
    dragStartWorld.current = null;
    entityStartPos.current = null;
  };

  // link mode
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

  // Утилита: инициализация черновиков форм из стора (по текущей выбранной связи)
  const initFormsFromSelected = () => {
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
      // на всякий случай чистим FK-форму
      setFkForm(defaultFkForm);
    } else {
      setFkForm({
        column: (selectedRel as any)?.fk?.column ?? "",
        type: (selectedRel as any)?.fk?.type ?? "",
        notNull: (selectedRel as any)?.fk?.notNull ?? true,
        unique: (selectedRel as any)?.fk?.unique ?? (selectedRel.type === "one-to-one" ? true : undefined),
        onDelete: (selectedRel as any)?.fk?.onDelete ?? "CASCADE",
        onUpdate: (selectedRel as any)?.fk?.onUpdate ?? undefined,
        index: (selectedRel as any)?.fk?.index ?? true,
      });
      // и наоборот — чистим Link-форму
      setLinkForm(defaultLinkForm);
    }
  };

  // Открытие инспектора: когда он становится open И есть выбранная связь — подхватываем актуальные данные из стора
  useEffect(() => {
    if (inspectorOpen && selectedRel) {
      initFormsFromSelected();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectorOpen, selectedRel?.id, selectedRel?.type]);

  // viewport для миникарты
  const viewportWorldRect = useMemo(
    () => camera.getViewportWorldRect(canvasRef.current),
    [camera.scale, camera.offset]
  );

  // подсветка сущностей
  const isLinked = (entityId: string) =>
    relationships.some(
      (r) =>
        (hoveredRel === r.id || selectedRelationshipId === r.id) &&
        (r.from === entityId || r.to === entityId)
    );

  const changeRelType = (id: string, next: RelationKind) => {
    updateRelationshipType(id, next);
    if (next === "many-to-many") updateRelationshipMeta(id, { fk: undefined });
    else updateRelationshipMeta(id, { link: undefined });
  };

  // Экспорт/импорт/SQL
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
    a.href = url; a.download = "diagram.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size === 0) { alert("Файл пустой."); e.target.value = ""; return; }
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
    if (entities.length === 0) { alert("ER-модель пустая — нечего преобразовывать в SQL."); return; }
    const sql = generateSQL(entities, relationships);
    setSqlOut(sql);
    if (!showSqlPanel) setShowSqlPanel(true); // если панель скрыта — покажем её
  };

  // Fit / 1:1
  const handleFitAll = () => {
    const boxes = entities.map((e) => ({
      x: e.x,
      y: e.y,
      w: sizes[e.id]?.w ?? 224,
      h: sizes[e.id]?.h ?? 80,
    }));
    camera.fitAll(canvasRef.current, boxes, 64);
  };
  const handleReset1x = () => camera.reset1x();

  return (
    <div className="w-full h-full flex min-h-0 overflow-hidden items-stretch">
      {/* Левая колонка */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {/* Тулбар */}
        <div className="shrink-0">
          <EditorToolbar
            isLinking={isLinking}
            showMinimap={showMinimap}
            showSqlPanel={showSqlPanel}
            onAddEntity={() => { setIsAddingEntity(true); setIsLinking(false); }}
            onToggleLink={() => { setIsLinking((v) => !v); setIsAddingEntity(false); setSelectedForLink(null); }}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            onGenerateSQL={handleGenerateSQL}
            onToggleSqlPanel={() => setShowSqlPanel((v) => !v)}
            onClearAll={clearAll}
            onFitAll={handleFitAll}
            onReset1x={handleReset1x}
            onToggleMinimap={() => setShowMinimap((v) => !v)}
          />
        </div>
        {/* Canvas */}
        <div
          ref={canvasRef}
          onContextMenu={(e) => e.preventDefault()}
          className={`relative w-full flex-1 min-h-0 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden ${
            isAddingEntity ? "cursor-crosshair bg-gray-100 dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-900"
          }`}
          style={{ overscrollBehavior: "none", touchAction: "none" }}
          onClick={handleCanvasClick}
          onMouseDown={(e) => camera.onPanStart(e)}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Мир */}
          <div
            className="absolute top-0 left-0"
            style={{
              transform: `matrix(${camera.scale}, 0, 0, ${camera.scale}, ${camera.offset.x}, ${camera.offset.y})`,
              transformOrigin: "0 0",
              width: WORLD_W,
              height: WORLD_H,
              overflow: "visible",
              willChange: "transform",
            }}
          >
            {/* Preview */}
            {isAddingEntity && mouseWorld && (
              <div
                className="absolute z-20 w-56 text-center border-2 border-dashed border-indigo-400 rounded-lg bg-indigo-50/50 text-indigo-700 font-semibold pointer-events-none"
                style={{ left: mouseWorld.x - 112, top: mouseWorld.y - 40, padding: 8 }}
              >
                + Новая сущность
              </div>
            )}

            {/* Relations + labels */}
            <RelationsSvg
              entities={entities}
              relationships={relationships as any}
              sizes={sizes}
              hoveredId={hoveredRel}
              selectedId={selectedRelationshipId ?? null}
              onHover={(id) => setHoveredRel(id)}
              onClick={(id) => {
                setActiveMenu(null);
                setSelectedRelationship(id);
                setInspectorOpen(true);         // Открываем инспектор…
              }}
              worldSize={{ w: WORLD_W, h: WORLD_H }}
              renderLabel={({ id, x, y, kind }) => (
                <RelationLabel
                  id={id}
                  x={x}
                  y={y}
                  kind={kind}
                  open={activeMenu === id}
                  onToggle={(rid) => setActiveMenu((cur) => (cur === rid ? null : rid))}
                  onPick={(rid, next) => {
                    changeRelType(rid, next as RelationKind);
                    setActiveMenu(null);
                  }}
                />
              )}
            />

            {/* Entities */}
            <EntitiesLayer
              entities={entities}
              sizes={sizes}
              cardRefs={cardRefs}
              editingId={editingId}
              setEditingId={setEditingId}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
              isLinked={isLinked}
              onMouseDownEntity={handleMouseDownEntity}
              onEntityClick={handleEntityClick}
              renameEntity={renameEntity}
              removeEntity={removeEntity}
              addAttribute={addAttribute}
              removeAttribute={removeAttribute}
              newAttrName={newAttrName}
              setNewAttrName={setNewAttrName}
              newAttrType={newAttrType}
              setNewAttrType={setNewAttrType}
              isPrimaryKey={isPrimaryKey}
              setIsPrimaryKey={setIsPrimaryKey}
            />

            {/* Grid */}
            <CanvasGrid world={{ w: WORLD_W, h: WORLD_H }} gridSize={GRID} />
          </div>

          {/* Мини-карта */}
          {showMinimap && (
            <Minimap
              entities={entities}
              viewport={viewportWorldRect}
              world={{ w: WORLD_W, h: WORLD_H }}
              onJump={(x, y) => camera.centerOn(canvasRef.current, x, y)}
            />
          )}

          {/* Инспектор */}
          {inspectorOpen && selectedRel && (
            <RelationInspector
              refEl={inspectorRef}
              relation={selectedRel as any}
              entities={entities as any}
              onClose={() => {
                setInspectorOpen(false);
                setSelectedRelationship(null);
                setHoveredRel(null);           // убираем подсветку
                setFkForm(defaultFkForm);      // чистим локальные формы
                setLinkForm(defaultLinkForm);
              }}
              onSaveFK={(patch: Partial<FKFormT>) => {
                setRelationshipFK(selectedRel.id, patch);
                setJustSaved("fk");
                setTimeout(() => setJustSaved(null), 1200);
              }}
              onSaveLink={(patch: Partial<LinkFormT>) => {
                setRelationshipLink(selectedRel.id, patch);
                setJustSaved("link");
                setTimeout(() => setJustSaved(null), 1200);
              }}
              onReset={() => {
                // Чистим метаданные в сторе…
                updateRelationshipMeta(selectedRel.id, { fk: undefined, link: undefined });
                // …и сразу же откатываем локальные формы к дефолтным по текущему типу связи
                if (selectedRel.type === "many-to-many") {
                  setLinkForm(defaultLinkForm);
                } else {
                  setFkForm(defaultFkForm);
                }
                setJustReset(true);
                setTimeout(() => setJustReset(false), 1200);
              }}
              fkForm={fkForm}
              setFkForm={setFkForm}
              linkForm={linkForm}
              setLinkForm={setLinkForm}
            />
          )}

          {/* Тост режима «Связь» */}
          <LinkHintToast pulse={linkHintPulse} text="Выберите две сущности для связи" durationMs={1800} />
        </div>
      </div>

      {/* Правая колонка: SQL — рендерим только когда включена */}
      {showSqlPanel && (
        <SQLPanel
          className="h-full"
          sql={sqlOut}
          dialect={dialect}
          onChangeDialect={(d) => { setDialect(d); }}
          onCopyAll={() => { if (sqlOut) navigator.clipboard?.writeText(sqlOut).catch(() => {}); }}
        />
      )}
    </div>
  );
}
