import { useEffect, useRef, useState, useMemo } from "react";
import { useERStore } from "../store/useERStore";
import { generateSQL } from "../utils/generateSQL";
import { validateModel, type ValidationIssue } from "../utils/validateModel";

import SQLPanel from "../canvas/components/SQLPanel";
import AIPanel from "../canvas/components/AIPanel";
import type { SqlDialect } from "../utils/sql/types";
import RelationInspector from "../canvas/components/RelationInspector";
import LinkHintToast from "../canvas/components/LinkHintToast";
import RelationsSvg from "../canvas/components/RelationsSvg";
import RelationLabel from "../canvas/components/RelationLabel";
import CanvasGrid from "../canvas/components/CanvasGrid";
import Minimap from "../canvas/components/Minimap";
import EntitiesLayer from "../canvas/components/EntitiesLayer";
import ValidationHints from "../canvas/components/ValidationHints";
import { analyzeNormalization, applyNormalizationAction } from "../utils/normalization";
import { useCamera } from "../canvas/hooks/useCamera";
import type { FKForm as FKFormT, LinkForm as LinkFormT, Size } from "../canvas/types";
import EditorToolbar from "../canvas/components/EditorToolbar";
import ConfirmModal from "../canvas/components/ConfirmModal";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";

import ExportModal, { type ExportOptions } from "../canvas/components/ExportModal";
import SaveProjectModal from "../canvas/components/SaveProjectModal";

const GRID = 32;
const WORLD_W = 50000;
const WORLD_H = 50000;

type RelationKind = "one-to-one" | "one-to-many" | "many-to-many";
const snap = (v: number) => Math.round(v / GRID) * GRID;

/** Смещаем диаграмму так, чтобы не было отрицательных координат и минимальные x/y ≥ margin */
function normalizeDiagramPositions(
  data: { entities?: any[]; relationships?: any[] },
  margin = 40
) {
  const ents = Array.isArray(data?.entities) ? data.entities : [];
  if (ents.length === 0) return data;

  let minX = Infinity,
    minY = Infinity;
  for (const e of ents) {
    const x = typeof e.x === "number" ? e.x : 0;
    const y = typeof e.y === "number" ? e.y : 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }

  if (minX >= margin && minY >= margin) return data;

  const dx = minX < margin ? margin - minX : 0;
  const dy = minY < margin ? margin - minY : 0;

  return {
    entities: ents.map((e) => ({
      ...e,
      x: (typeof e.x === "number" ? e.x : 0) + dx,
      y: (typeof e.y === "number" ? e.y : 0) + dy,
    })),
    relationships: Array.isArray(data?.relationships) ? data.relationships : [],
  };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}

function makeProjectId() {
  const anyCrypto = (globalThis as any).crypto;
  if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

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

  // Настройки из стора (persist)
  const { defaultShowMinimap, defaultShowSqlPanel, confirmDelete } = useAppStore();

  // AUTH
  const { isAuthenticated, addProject } = useAuthStore();

  // UI
  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedForLink, setSelectedForLink] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [hoveredRel, setHoveredRel] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // локальные видимости панелей (инициализируем из настроек)
  const [showMinimap, setShowMinimap] = useState<boolean>(defaultShowMinimap);
  const [showSqlPanel, setShowSqlPanel] = useState<boolean>(defaultShowSqlPanel);
  const [showAIPanel, setShowAIPanel] = useState<boolean>(false);

  // модалки подтверждений
  const [confirmRelId, setConfirmRelId] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState<boolean>(false);

  // toast
  const [linkHintPulse, setLinkHintPulse] = useState(0);
  useEffect(() => {
    if (isLinking) setLinkHintPulse((n) => n + 1);
  }, [isLinking]);

  // SQL
  const [sqlOut, setSqlOut] = useState<string>("");
  const [dialect, setDialect] = useState<SqlDialect>("postgres");

  useEffect(() => {
    if (!sqlOut) return;
    setSqlOut(generateSQL(entities, relationships, { dialect }));
  }, [dialect, entities, relationships, sqlOut]);

  // локальный ввод атрибутов
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
  void justSaved;
  void justReset;

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

  // ====== ВАЛИДАЦИЯ ======
  const validation = useMemo(() => validateModel(entities, relationships), [entities, relationships]);
  const [issues, setIssues] = useState<ValidationIssue[]>(validation.issues);

  const [hintsOpen, setHintsOpen] = useState<boolean>(false);

  const normalizationIssues = useMemo(
    () => analyzeNormalization(entities, relationships),
    [entities, relationships]
  );

  useEffect(() => {
    setIssues(validation.issues);
  }, [validation.issues]);

  // ====== EXPORT / SAVE MODALS ======
  const [exportOpen, setExportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const defaultExportName = useMemo(() => "diagram", []);

  async function doExport(opts: ExportOptions) {
    if (entities.length === 0 && relationships.length === 0) {
      alert("ER-модель пустая — экспортировать нечего.");
      return;
    }

    const base = opts.fileName || "diagram";
    const ext = opts.format;

    if (ext === "json") {
      const data = { entities, relationships };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json, "\n"], { type: "application/json" });
      downloadBlob(blob, `${base}.json`);
      return;
    }

    const node = canvasRef.current;
    if (!node) return;

    const isDark = document.documentElement.classList.contains("dark");
    const backgroundColor = opts.transparentBg ? undefined : isDark ? "#0b1220" : "#ffffff";

    const filter = (n: Node) => {
      const el = n as any;
      if (el?.dataset?.exportIgnore === "1") return false;
      if (el?.closest && el.closest('[data-export-ignore="1"]')) return false;
      return true;
    };

    try {
      const mod = await import("html-to-image");

      if (ext === "png") {
        const dataUrl = await mod.toPng(node, {
          cacheBust: true,
          pixelRatio: opts.pngScale,
          backgroundColor,
          filter,
        });
        downloadDataUrl(dataUrl, `${base}.png`);
        return;
      }

      if (ext === "svg") {
        const dataUrl = await mod.toSvg(node, {
          cacheBust: true,
          backgroundColor,
          filter,
        });
        downloadDataUrl(dataUrl, `${base}.svg`);
        return;
      }
    } catch (err) {
      console.error(err);
      alert("Не удалось экспортировать PNG/SVG. Проверь консоль и наличие пакета html-to-image.");
    }
  }

  function doSaveProject(projectName: string) {
    if (entities.length === 0 && relationships.length === 0) {
      alert("ER-модель пустая — сохранять нечего.");
      return;
    }
    const id = makeProjectId();
    const updatedAt = Date.now();

    try {
      localStorage.setItem(
        `smarterd-project:${id}`,
        JSON.stringify({ id, name: projectName, updatedAt, entities, relationships })
      );
    } catch (err) {
      console.error(err);
      alert("Не удалось сохранить проект в localStorage (возможно, лимит).");
      return;
    }

    addProject({ id, name: projectName, updatedAt });
  }

  const jumpToWhere = (whereIds: string[]) => {
    const entityId = whereIds.find((id) => entities.some((e) => e.id === id));
    if (entityId) {
      const e = entities.find((x) => x.id === entityId)!;
      camera.centerOn(canvasRef.current, e.x + 100, e.y + 60);
      return;
    }
    const relId = whereIds.find((id) => relationships.some((r) => r.id === id));
    if (relId) {
      const r = relationships.find((x) => x.id === relId)!;
      const from = entities.find((e) => e.id === r.from);
      const to = entities.find((e) => e.id === r.to);
      if (from && to) {
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        camera.centerOn(canvasRef.current, midX, midY);
      }
      setSelectedRelationship(relId);
      setInspectorOpen(true);
    }
  };

  // размеры карточек
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

  // колесо: нативно (passive: false)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => camera.onWheelNative(ev, el);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel as EventListener);
  }, [camera]);

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

  // Esc
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
          setFkForm(defaultFkForm);
          setLinkForm(defaultLinkForm);
        }
        if (exportOpen) setExportOpen(false);
        if (saveOpen) setSaveOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAddingEntity, inspectorOpen, exportOpen, saveOpen]);

  // Delete/Backspace — удаление связи (с подтверждением, если выбрано в настройке)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inspectorOpen) return;
      if ((e.key === "Delete" || e.key === "Backspace") && hoveredRel) {
        const inInput = (e.target as HTMLElement)?.closest(
          "input, textarea, select, [contenteditable]"
        );
        if (inInput) return;

        if (confirmDelete) {
          setConfirmRelId(hoveredRel);
        } else {
          useERStore.getState().removeRelationship(hoveredRel);
          setSelectedRelationship(null);
          setHoveredRel(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hoveredRel, inspectorOpen, confirmDelete, setSelectedRelationship]);

  // Синхронизация локальной видимости панелей с настройками
  useEffect(() => {
    setShowMinimap(defaultShowMinimap);
  }, [defaultShowMinimap]);
  useEffect(() => {
    setShowSqlPanel(defaultShowSqlPanel);
  }, [defaultShowSqlPanel]);

  // Undo/Redo
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
  const movePayload = useRef<{ type: "move" | "drag"; e: React.MouseEvent<HTMLDivElement> } | null>(
    null
  );

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
        updateEntityPosition(
          draggingId,
          snap(entityStartPos.current.x + dx),
          snap(entityStartPos.current.y + dy)
        );
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

  // инициализация форм инспектора
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
      setFkForm(defaultFkForm);
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
      setLinkForm(defaultLinkForm);
    }
  };

  useEffect(() => {
    if (inspectorOpen && selectedRel) initFormsFromSelected();
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

  // Импорт/SQL
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
        const raw = JSON.parse(text);
        if (raw.entities?.length || raw.relationships?.length) {
          const data = normalizeDiagramPositions(raw, 40);
          setDiagramData(data.entities || [], data.relationships || []);
          setTimeout(() => {
            const boxes = (data.entities || []).map((en: any) => ({
              x: en.x,
              y: en.y,
              w: 224,
              h: 80,
            }));
            camera.fitAll(canvasRef.current, boxes, 64);
          }, 0);
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

    const { ok, issues } = validateModel(entities, relationships);
    if (!ok) {
      alert(
        "Найдены проблемы:\n\n" +
          issues
            .map(
              (i) =>
                `• [${i.level}] ${i.message}${i.suggestion ? `\n  → ${i.suggestion}` : ""}`
            )
            .join("\n\n")
      );
      setHintsOpen(true);
      return;
    } else {
      const hints = issues.filter((i) => i.level !== "error");
      if (hints.length > 0) setHintsOpen(true);
    }

    const sql = generateSQL(entities, relationships, { dialect });
    setSqlOut(sql);
    setShowSqlPanel(true);
    setShowAIPanel(false);
  };

  // Fit
  const handleFitAll = () => {
    const boxes = entities.map((e) => ({
      x: e.x,
      y: e.y,
      w: sizes[e.id]?.w ?? 224,
      h: sizes[e.id]?.h ?? 80,
    }));
    camera.fitAll(canvasRef.current, boxes, 64);
  };

  // Очистить всё
  const handleClearAll = () => {
    if (confirmDelete) {
      setConfirmClearOpen(true);
    } else {
      clearAll();
      setSelectedRelationship(null);
      setHoveredRel(null);
    }
  };

  // чтобы скролл внутри панели не “прокручивал” канвас
  const hintsWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = hintsWrapRef.current;
    if (!el) return;
    const stop = (ev: WheelEvent) => {
      ev.stopPropagation();
    };
    el.addEventListener("wheel", stop, { passive: true });
    return () => el.removeEventListener("wheel", stop);
  }, []);

  return (
    // ✅ ВАЖНО: теперь это колонка -> тулбар сверху, рабочая зона снизу
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      {/* ✅ ТУЛБАР — ВЕРХНЯЯ СТРОКА НА ВСЮ ШИРИНУ */}
      <div className="shrink-0">
        <EditorToolbar
          isLinking={isLinking}
          showMinimap={showMinimap}
          showSqlPanel={showSqlPanel}
          showAIPanel={showAIPanel}
          onAddEntity={() => {
            setIsAddingEntity(true);
            setIsLinking(false);
          }}
          onToggleLink={() => {
            setIsLinking((v) => !v);
            setIsAddingEntity(false);
            setSelectedForLink(null);
          }}
          // экспорт открывает модалку
          onExportJSON={() => setExportOpen(true)}
          onImportJSON={handleImportJSON}
          canSaveProject={isAuthenticated}
          onSaveProject={() => setSaveOpen(true)}
          onGenerateSQL={handleGenerateSQL}
          onToggleSqlPanel={() => {
            setShowSqlPanel((v) => {
              const next = !v;
              if (next) setShowAIPanel(false);
              return next;
            });
          }}
          onToggleAIPanel={() => {
            setShowAIPanel((v) => {
              const next = !v;
              if (next) setShowSqlPanel(false);
              return next;
            });
          }}
          onClearAll={handleClearAll}
          onFitAll={handleFitAll}
          onToggleMinimap={() => setShowMinimap((v) => !v)}
        />
      </div>

      {/* РАБОЧАЯ ЗОНА: канва + правая панель (под тулбаром) */}
      <div className="flex-1 min-h-0 flex overflow-hidden items-stretch">
        {/* Левая колонка: Canvas */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <div
            ref={canvasRef}
            onContextMenu={(e) => e.preventDefault()}
            className={`relative w-full flex-1 min-h-0 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden ${
              isAddingEntity
                ? "cursor-crosshair bg-gray-100 dark:bg-gray-800"
                : "bg-gray-50 dark:bg-gray-900"
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
                  setInspectorOpen(true);
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

            {/* Мини-карта (не экспортируем) */}
            {showMinimap && (
              <div data-export-ignore="1">
                <Minimap
                  entities={entities}
                  viewport={viewportWorldRect}
                  world={{ w: WORLD_W, h: WORLD_H }}
                  onJump={(x, y) => camera.centerOn(canvasRef.current, x, y)}
                />
              </div>
            )}

            {/* ПАНЕЛЬ ПОДСКАЗОК (не экспортируем) */}
            <div
              data-export-ignore="1"
              ref={hintsWrapRef}
              className="absolute left-2 bottom-2 z-40"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <ValidationHints
                issues={issues}
                normalizationIssues={normalizationIssues}
                open={hintsOpen}
                onToggle={() => setHintsOpen((v) => !v)}
                onJump={jumpToWhere}
                onAction={(action) => {
                  try {
                    const out = applyNormalizationAction(action as any, entities, relationships);
                    setDiagramData(out.entities, out.relationships);
                    setHintsOpen(true);
                  } catch (err) {
                    console.error(err);
                    alert("Не удалось применить действие нормализации (см. консоль).");
                  }
                }}
              />
            </div>

            {/* Инспектор (не экспортируем) */}
            {inspectorOpen && selectedRel && (
              <div data-export-ignore="1">
                <RelationInspector
                  refEl={inspectorRef}
                  relation={selectedRel as any}
                  entities={entities as any}
                  onClose={() => {
                    setInspectorOpen(false);
                    setSelectedRelationship(null);
                    setHoveredRel(null);
                    setFkForm(defaultFkForm);
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
                    updateRelationshipMeta(selectedRel.id, { fk: undefined, link: undefined });
                    if (selectedRel.type === "many-to-many") setLinkForm(defaultLinkForm);
                    else setFkForm(defaultFkForm);
                    setJustReset(true);
                    setTimeout(() => setJustReset(false), 1200);
                  }}
                  fkForm={fkForm}
                  setFkForm={setFkForm}
                  linkForm={linkForm}
                  setLinkForm={setLinkForm}
                />
              </div>
            )}

            {/* Тост режима «Связь» (не экспортируем) */}
            <div data-export-ignore="1">
              <LinkHintToast
                pulse={linkHintPulse}
                text="Выберите две сущности для связи"
                durationMs={1800}
              />
            </div>
          </div>
        </div>

        {/* ✅ Правая колонка: показываем ИЛИ SQL, ИЛИ AI панель */}
        {showSqlPanel && !showAIPanel && (
          <SQLPanel
            className="h-full"
            sql={sqlOut}
            dialect={dialect}
            onChangeDialect={(d) => setDialect(d)}
            onCopyAll={() => {
              if (sqlOut) navigator.clipboard?.writeText(sqlOut).catch(() => {});
            }}
            editable={true}
            onChangeSql={(s) => setSqlOut(s)}
          />
        )}

        {showAIPanel && !showSqlPanel && <AIPanel className="h-full" />}
      </div>

      {/* EXPORT MODAL */}
      <ExportModal
        open={exportOpen}
        defaultFileName={defaultExportName}
        onClose={() => setExportOpen(false)}
        onConfirm={async (opts) => {
          await doExport(opts);
          setExportOpen(false);
        }}
      />

      {/* SAVE MODAL (auth only) */}
      <SaveProjectModal
        open={saveOpen}
        defaultName="My Project"
        onClose={() => setSaveOpen(false)}
        onConfirm={(name) => {
          doSaveProject(name);
          setSaveOpen(false);
        }}
      />

      {/* Модалка подтверждения очистки всей диаграммы */}
      {confirmClearOpen && (
        <ConfirmModal
          open={true}
          title="Очистить диаграмму?"
          message="Удалить все сущности и связи без возможности восстановления?"
          confirmText="Очистить"
          cancelText="Отмена"
          onCancel={() => setConfirmClearOpen(false)}
          onConfirm={() => {
            clearAll();
            setSelectedRelationship(null);
            setHoveredRel(null);
            setConfirmClearOpen(false);
          }}
        />
      )}

      {/* Модалка подтверждения удаления связи */}
      {confirmRelId &&
        (() => {
          const rel = relationships.find((r) => r.id === confirmRelId);
          const fromName = rel ? entities.find((en) => en.id === rel.from)?.name ?? "from" : "";
          const toName = rel ? entities.find((en) => en.id === rel.to)?.name ?? "to" : "";

          return (
            <ConfirmModal
              open={true}
              title="Удалить связь?"
              message={`Удалить связь между «${fromName}» и «${toName}»?`}
              confirmText="Удалить"
              cancelText="Отмена"
              onCancel={() => setConfirmRelId(null)}
              onConfirm={() => {
                if (confirmRelId) useERStore.getState().removeRelationship(confirmRelId);
                setSelectedRelationship(null);
                setHoveredRel(null);
                setConfirmRelId(null);
              }}
            />
          );
        })()}
    </div>
  );
}
