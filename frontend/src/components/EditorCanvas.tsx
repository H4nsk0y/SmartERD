// frontend/src/components/EditorCanvas.tsx
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
import InfoModal from "../canvas/components/InfoModal";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import { apiProjectCreate } from "../api/projects";
import ExportModal, { type ExportOptions } from "../canvas/components/ExportModal";
import SaveProjectModal from "../canvas/components/SaveProjectModal";

const GRID = 32;
const WORLD_W = 50000;
const WORLD_H = 50000;

type RelationKind = "one-to-one" | "one-to-many" | "many-to-many";
const snap = (v: number) => Math.round(v / GRID) * GRID;

type Point = { x: number; y: number };

type Marquee = {
  mode: "replace" | "add";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};


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

function uniq(ids: string[]) {
  return Array.from(new Set(ids));
}

function intersects(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export default function EditorCanvas() {
  const {
    entities,
    relationships,
    addEntity,
    beginBatch,
    endBatch,
    updateEntitiesPositions,
    addAttribute,
    removeAttribute,
    addRelationship,
    removeEntity,
    removeEntities,
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

  // Настройки из стора 
  const { defaultShowMinimap, defaultShowSqlPanel, confirmDelete } = useAppStore();

  // AUTH
  const { isAuthenticated } = useAuthStore();

  // UI
  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedForLink, setSelectedForLink] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [hoveredRel, setHoveredRel] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const selectedEntityIdsSet = useMemo(() => new Set(selectedEntityIds), [selectedEntityIds]);
  const selectedEntityIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedEntityIdsRef.current = new Set(selectedEntityIds);
  }, [selectedEntityIds]);

  
  useEffect(() => {
    const alive = new Set(entities.map((e) => e.id));
    setSelectedEntityIds((prev) => prev.filter((id) => alive.has(id)));
  }, [entities]);

  
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const marqueeRef = useRef<Marquee | null>(null);
  const marqueeMovedRef = useRef(false);
  useEffect(() => {
    marqueeRef.current = marquee;
  }, [marquee]);

 
  const [confirmEntities, setConfirmEntities] = useState<string[] | null>(null);
  const [pulseEntityIds, setPulseEntityIds] = useState<string[]>([]);
  const [pulseRelId, setPulseRelId] = useState<string | null>(null);
  const [pulseToken, setPulseToken] = useState(0);
  const pulseTimerRef = useRef<number | null>(null);

  const pulseEntitySet = useMemo(() => new Set(pulseEntityIds), [pulseEntityIds]);

  const triggerPulse = (opts: { entityIds?: string[]; relId?: string | null }) => {
    if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);

    const eids = uniq((opts.entityIds ?? []).filter(Boolean));
    const rid = opts.relId ?? null;

    setPulseEntityIds(eids);
    setPulseRelId(rid);
    setPulseToken((t) => t + 1);

    
    pulseTimerRef.current = window.setTimeout(() => {
      setPulseEntityIds([]);
      setPulseRelId(null);
    }, 1400);
  };


  // локальные видимости панелей (инициализируем из настроек)
  const [showMinimap, setShowMinimap] = useState<boolean>(defaultShowMinimap);
  const [showSqlPanel, setShowSqlPanel] = useState<boolean>(defaultShowSqlPanel);
  const [showAIPanel, setShowAIPanel] = useState<boolean>(false);

  // модалки подтверждений
  const [confirmRelId, setConfirmRelId] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState<boolean>(false);

  // info modal
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoModalMessage, setInfoModalMessage] = useState("");
  const [infoModalTitle, setInfoModalTitle] = useState("");

  // Функция для показа информационного модального окна
  const showInfoModal = (message: string, title: string = "Информация") => {
    setInfoModalMessage(message);
    setInfoModalTitle(title);
    setInfoModalOpen(true);
  };

  
  const [linkHintPulse, setLinkHintPulse] = useState(0);
  useEffect(() => {
    if (isLinking) setLinkHintPulse((n) => n + 1);
  }, [isLinking]);

  const [sqlOut, setSqlOut] = useState<string>("");
  const [sqlSource, setSqlSource] = useState<"none" | "generated" | "edited">("none");
  const [dialect, setDialect] = useState<SqlDialect>("postgres");

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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartWorld = useRef<Point | null>(null);
  const dragGroupStartPos = useRef<Record<string, Point>>({});
  const draggingIdsRef = useRef<string[]>([]);
  const dragBatchStartedRef = useRef(false);
  const dragStartClientRef = useRef<Point | null>(null);
  const [mouseWorld, setMouseWorld] = useState<Point | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const camera = useCamera({ minScale: 0.3, maxScale: 3, initialScale: 1 });
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

  const errorCount = useMemo(
    () => validation.issues.filter((i) => i.level === "error").length,
    [validation.issues]
  );
  const sqlBlocked = errorCount > 0;


  useEffect(() => {
    if (!sqlBlocked) return;
    if (sqlOut) setSqlOut("");
    if (sqlSource !== "none") setSqlSource("none");
  }, [sqlBlocked, sqlOut, sqlSource]);


  useEffect(() => {
    if (sqlBlocked) return;
    if (!showSqlPanel) return;
    if (sqlSource !== "generated") return;
    if (!sqlOut) return;
    setSqlOut(generateSQL(entities, relationships, { dialect }));
  }, [dialect, entities, relationships, showSqlPanel, sqlBlocked, sqlSource, sqlOut]);

  const [exportOpen, setExportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const defaultExportName = useMemo(() => "diagram", []);

  async function doExport(opts: ExportOptions) {
    if (entities.length === 0 && relationships.length === 0) {
      showInfoModal(
        "ER-модель пустая — экспортировать нечего.",
        "Нет данных для экспорта"
      );
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
      showInfoModal(
        "Не удалось экспортировать PNG/SVG. Проверьте консоль и наличие пакета html-to-image.",
        "Ошибка экспорта"
      );
    }
  }

  async function doSaveProject(projectName: string) {
    if (entities.length === 0 && relationships.length === 0) {
      showInfoModal(
        "ER-модель пустая — сохранять нечего.",
        "Нет данных для сохранения"
      );
      return;
    }

    const token = useAuthStore.getState().token;
    if (!token) {
      showInfoModal(
        "Сначала войдите в аккаунт, чтобы сохранять проекты в БД.",
        "Требуется авторизация"
      );
      return;
    }

    try {
      const created = await apiProjectCreate(token, {
        name: projectName,
        data: { entities, relationships },
      });

      useAuthStore.getState().upsertProject(created);
    } catch (e: any) {
      showInfoModal(
        e?.message || "Не удалось сохранить проект.",
        "Ошибка сохранения"
      );
      return;
    }
  }

  const jumpToWhere = (whereIds: string[]) => {
    const entityHits = whereIds.filter((id) => entities.some((e) => e.id === id));
    const relHit = whereIds.find((id) => relationships.some((r) => r.id === id)) ?? null;

    if (entityHits.length > 0) {
      const first = entities.find((x) => x.id === entityHits[0])!;
      camera.centerOn(canvasRef.current, first.x + 100, first.y + 60);

      setSelectedRelationship(null);
      setInspectorOpen(false);
      setHoveredRel(null);

      triggerPulse({ entityIds: entityHits, relId: null });
      return;
    }
    if (relHit) {
      const r = relationships.find((x) => x.id === relHit)!;
      const from = entities.find((e) => e.id === r.from);
      const to = entities.find((e) => e.id === r.to);
      if (from && to) {
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        camera.centerOn(canvasRef.current, midX, midY);
      }

      setSelectedRelationship(relHit);
      setInspectorOpen(true);

      setSelectedEntityIds([]);

      triggerPulse({ entityIds: [], relId: relHit });
    }
  };

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
        setMarquee(null);
        marqueeMovedRef.current = false;
        setSelectedEntityIds([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAddingEntity, inspectorOpen, exportOpen, saveOpen]);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inspectorOpen) return;

      const inInput = (e.target as HTMLElement)?.closest(
        "input, textarea, select, [contenteditable]"
      );
      if (inInput) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        const sel = [...selectedEntityIdsRef.current];
        if (sel.length > 0) {
          e.preventDefault();
          if (confirmDelete) {
            setConfirmEntities(sel);
          } else {
            removeEntities(sel);
            setSelectedEntityIds([]);
          }
          return;
        }

        if (hoveredRel) {
          e.preventDefault();
          if (confirmDelete) {
            setConfirmRelId(hoveredRel);
          } else {
            useERStore.getState().removeRelationship(hoveredRel);
            setSelectedRelationship(null);
            setHoveredRel(null);
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hoveredRel, inspectorOpen, confirmDelete, removeEntity, setSelectedRelationship]);

  useEffect(() => {
    setShowMinimap(defaultShowMinimap);
  }, [defaultShowMinimap]);
  useEffect(() => {
    setShowSqlPanel(defaultShowSqlPanel);
  }, [defaultShowSqlPanel]);

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

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    camera.onPanStart(e);

    if (isAddingEntity || isLinking) return;

    if (e.button !== 0) return;
    if (e.ctrlKey || e.metaKey) return;

    const inInput = (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable], button");
    if (inInput) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const w = camera.toWorld(e.clientX, e.clientY, rect);

    marqueeMovedRef.current = false;

    const mode: Marquee["mode"] = e.shiftKey ? "add" : "replace";
    if (mode === "replace") {
      setSelectedEntityIds([]);
    }

    setSelectedRelationship(null);
    setInspectorOpen(false);
    setHoveredRel(null);

    setMarquee({ mode, x0: w.x, y0: w.y, x1: w.x, y1: w.y });
    e.preventDefault();
  };

  const moveRaf = useRef<number>(0);
  const movePayload = useRef<{ kind: "move" | "drag"; e: React.MouseEvent<HTMLDivElement> } | null>(
    null
  );

  const handleMouseDownEntity = (e: React.MouseEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation();
    if (isLinking) return;

    setMarquee(null);
    marqueeMovedRef.current = false;

    const prev = selectedEntityIdsRef.current;
    const isMeta = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    let nextSel: string[] = [];

    if (isMeta) {
      nextSel = prev.has(id) ? selectedEntityIds.filter((x) => x !== id) : [...selectedEntityIds, id];
    } else if (isShift) {
      nextSel = prev.has(id) ? selectedEntityIds : [...selectedEntityIds, id];
    } else {
      nextSel = prev.has(id) ? selectedEntityIds : [id];
    }

    nextSel = uniq(nextSel);
    setSelectedEntityIds(nextSel);
    setSelectedRelationship(null);
    setInspectorOpen(false);
    setHoveredRel(null);


    if (!nextSel.includes(id)) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const w = camera.toWorld(e.clientX, e.clientY, rect);
    dragStartWorld.current = w;

    const startMap: Record<string, Point> = {};
    for (const sid of nextSel) {
      const ent = entities.find((x) => x.id === sid);
      if (ent) startMap[sid] = { x: ent.x, y: ent.y };
    }
    dragGroupStartPos.current = startMap;
    draggingIdsRef.current = nextSel;

    dragBatchStartedRef.current = false;
    dragStartClientRef.current = { x: e.clientX, y: e.clientY };
    setDraggingId(id);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    camera.onPanMove(e);
    movePayload.current = { kind: draggingId ? "drag" : "move", e };
    if (moveRaf.current) return;

    moveRaf.current = requestAnimationFrame(() => {
      moveRaf.current = 0;
      const payload = movePayload.current;
      if (!payload) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const wNow = camera.toWorld(payload.e.clientX, payload.e.clientY, rect);

      if (isAddingEntity) setMouseWorld(wNow);
      const m = marqueeRef.current;
      if (m && !draggingId) {
        const dx = Math.abs(wNow.x - m.x0);
        const dy = Math.abs(wNow.y - m.y0);
        if (dx > 1 || dy > 1) marqueeMovedRef.current = true;

        setMarquee((cur) => (cur ? { ...cur, x1: wNow.x, y1: wNow.y } : cur));
      }

      if (payload.kind === "drag" && draggingId && dragStartWorld.current) {
        if (!dragBatchStartedRef.current && dragStartClientRef.current) {
          const dxs = payload.e.clientX - dragStartClientRef.current.x;
          const dys = payload.e.clientY - dragStartClientRef.current.y;
          if (dxs * dxs + dys * dys < 9) return; // < 3px
          beginBatch();
          dragBatchStartedRef.current = true;
        }

        const dx = wNow.x - dragStartWorld.current.x;
        const dy = wNow.y - dragStartWorld.current.y;

        const updates = draggingIdsRef.current
          .map((sid) => {
            const start = dragGroupStartPos.current[sid];
            if (!start) return null;
            return { id: sid, x: snap(start.x + dx), y: snap(start.y + dy) };
          })
          .filter(Boolean) as Array<{ id: string; x: number; y: number }>;

        if (updates.length) updateEntitiesPositions(updates);
      }
    });
  };

  const applyMarqueeSelection = () => {
    const m = marqueeRef.current;
    if (!m) return;

    if (!marqueeMovedRef.current) {
      setMarquee(null);
      return;
    }

    const minX = Math.min(m.x0, m.x1);
    const minY = Math.min(m.y0, m.y1);
    const maxX = Math.max(m.x0, m.x1);
    const maxY = Math.max(m.y0, m.y1);

    const selRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

    const hits = entities
      .filter((en) => {
        const w = sizes[en.id]?.w ?? 224;
        const h = sizes[en.id]?.h ?? 80;
        const box = { x: en.x, y: en.y, w, h };
        return intersects(selRect, box);
      })
      .map((en) => en.id);

    if (m.mode === "add") {
      setSelectedEntityIds((prev) => uniq([...prev, ...hits]));
    } else {
      setSelectedEntityIds(uniq(hits));
    }

    setMarquee(null);
    marqueeMovedRef.current = false;
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    camera.onPanEnd();
    if (marqueeRef.current) applyMarqueeSelection();

    if (dragBatchStartedRef.current) {
      endBatch();
      dragBatchStartedRef.current = false;
    }
    dragStartClientRef.current = null;
    setDraggingId(null);
    dragStartWorld.current = null;
    dragGroupStartPos.current = {};
    draggingIdsRef.current = [];
  };

  const handleEntityClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLinking) return;
    if (!selectedForLink) {
      setSelectedForLink(id);
      return;
    }

    addRelationship(selectedForLink, id, "one-to-many");

    setSelectedForLink(null);
    setIsLinking(false);
  };

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
  }, [inspectorOpen, selectedRel?.id, selectedRel?.type]);

  const viewportWorldRect = useMemo(
    () => camera.getViewportWorldRect(canvasRef.current),
    [camera.scale, camera.offset]
  );

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

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size === 0) {
      showInfoModal("Файл пустой.", "Ошибка импорта");
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
          showInfoModal(
            "Импортировать нечего — файл не содержит данных ER-модели.",
            "Нет данных для импорта"
          );
        }
      } catch {
        showInfoModal("Ошибка при чтении файла: невалидный JSON.", "Ошибка импорта");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleGenerateSQL = () => {
    if (entities.length === 0) {
      showInfoModal(
        "ER-модель пустая — нечего преобразовывать в SQL.",
        "Нет данных для генерации SQL"
      );
      setHintsOpen(true);
      return;
    }

    const { ok, issues } = validateModel(entities, relationships);
    if (!ok) {
      showInfoModal(
        "Найдены проблемы:\n\n" +
          issues
            .map(
              (i) =>
                `• [${i.level}] ${i.message}${i.suggestion ? `\n  → ${i.suggestion}` : ""}`
            )
            .join("\n\n"),
        "Проблемы с моделью"
      );
      setHintsOpen(true);
      return;
    } else {
      const hints = issues.filter((i) => i.level !== "error");
      if (hints.length > 0) setHintsOpen(true);
    }

   const sql = generateSQL(entities, relationships, { dialect });
    setSqlOut(sql);
    setSqlSource("generated");
    setShowSqlPanel(true);
    setShowAIPanel(false);
  };

  const handleFitAll = () => {
    const boxes = entities.map((e) => ({
      x: e.x,
      y: e.y,
      w: sizes[e.id]?.w ?? 224,
      h: sizes[e.id]?.h ?? 80,
    }));
    camera.fitAll(canvasRef.current, boxes, 64);
  };

  const handleClearAll = () => {
    if (confirmDelete) {
      setConfirmClearOpen(true);
    } else {
      clearAll();
      setSelectedRelationship(null);
      setHoveredRel(null);
      setSelectedEntityIds([]);
    }
  };

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

  const marqueeBox = useMemo(() => {
    if (!marquee) return null;
    const minX = Math.min(marquee.x0, marquee.x1);
    const minY = Math.min(marquee.y0, marquee.y1);
    const maxX = Math.max(marquee.x0, marquee.x1);
    const maxY = Math.max(marquee.y0, marquee.y1);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [marquee]);

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0">
        <EditorToolbar
          isLinking={isLinking}
          isAddingEntity={isAddingEntity}
          sqlBlocked={sqlBlocked}
          sqlErrorCount={errorCount}
          onShowIssues={() => setHintsOpen(true)}
          showMinimap={showMinimap}
          showSqlPanel={showSqlPanel}
          showAIPanel={showAIPanel}
          onAddEntity={() => {
            setIsAddingEntity((v) => !v);
            setIsLinking(false);
            setSelectedForLink(null);
          }}
          onToggleLink={() => {
            setIsLinking((v) => !v);
            setIsAddingEntity(false);
            setSelectedForLink(null);
          }}
          onExportJSON={() => setExportOpen(true)}
          onImportJSON={handleImportJSON}
          canSaveProject={isAuthenticated}
          onSaveProject={() => setSaveOpen(true)}
          onGenerateSQL={handleGenerateSQL}
          onToggleSqlPanel={() => {
            if (!showSqlPanel && sqlBlocked) {
              showInfoModal(
                `В модели есть критические ошибки (${errorCount}). SQL недоступен, пока вы их не исправите.`,
                "SQL заблокирован"
              );
              setHintsOpen(true);
              return;
            }

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
      <div className="flex-1 min-h-0 flex overflow-hidden items-stretch">
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
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
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
              {isAddingEntity && mouseWorld && (
                <div
                  className="absolute z-20 w-56 text-center border-2 border-dashed border-indigo-500 rounded-lg bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm shadow-md pointer-events-none"
                  style={{ 
                    left: mouseWorld.x - 112, 
                    top: mouseWorld.y - 40,
                    transition: "transform 0.1s ease-out, opacity 0.15s ease-out",
                    transform: "scale(0.95)",
                    opacity: 0.85
                  }}
                >
                  <div className="p-4">
                    <div className="w-10 h-10 mx-auto mb-2 flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      + Новая сущность
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Кликните для создания
                    </p>
                  </div>
                </div>
              )}
              {marqueeBox && (
                <div
                  className="absolute z-40 pointer-events-none rounded border border-indigo-500 bg-indigo-400/20"
                  style={{ left: marqueeBox.x, top: marqueeBox.y, width: marqueeBox.w, height: marqueeBox.h }}
                />
              )}

              <RelationsSvg
                entities={entities}
                relationships={relationships as any}
                sizes={sizes}
                hoveredId={hoveredRel}
                selectedId={selectedRelationshipId ?? null}
                pulsedId={pulseRelId}
                pulseToken={pulseToken}
                onHover={(id) => setHoveredRel(id)}
                onClick={(id) => {
                  setActiveMenu(null);
                  setSelectedRelationship(id);
                  setInspectorOpen(true);
                  setSelectedEntityIds([]);
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
              <EntitiesLayer
                entities={entities}
                sizes={sizes}
                cardRefs={cardRefs}
                pulseEntityIds={pulseEntitySet}
                pulseToken={pulseToken}
                selectedEntityIds={selectedEntityIdsSet}
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
              <CanvasGrid world={{ w: WORLD_W, h: WORLD_H }} gridSize={GRID} />
            </div>
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
                    showInfoModal(
                      "Не удалось применить действие нормализации. Проверьте консоль.",
                      "Ошибка применения"
                    );
                  }
                }}
              />
            </div>
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
            <div data-export-ignore="1">
              <LinkHintToast
                pulse={linkHintPulse}
                text="Выберите две сущности для связи"
                durationMs={1800}
              />
            </div>
          </div>
        </div>
        {showSqlPanel && !showAIPanel && (
          <SQLPanel
            className="h-full"
            sql={sqlOut}
            dialect={dialect}
            blocked={sqlBlocked}
            errorCount={errorCount}
            onShowIssues={() => setHintsOpen(true)}
            onClose={() => setShowSqlPanel(false)}
            onResetToGenerated={() => setSqlSource("generated")}
            onChangeDialect={(d) => setDialect(d)}
            onCopyAll={() => {
              if (!sqlBlocked && sqlOut) navigator.clipboard?.writeText(sqlOut).catch(() => {});
            }}
            editable={!sqlBlocked}
            onChangeSql={(s) => {
              setSqlOut(s);
              setSqlSource("edited");
            }}
          />
        )}

        {showAIPanel && !showSqlPanel && <AIPanel className="h-full" />}
      </div>
      <ExportModal
        open={exportOpen}
        defaultFileName={defaultExportName}
        onClose={() => setExportOpen(false)}
        onConfirm={async (opts) => {
          await doExport(opts);
          setExportOpen(false);
        }}
      />
      <SaveProjectModal
        open={saveOpen}
        defaultName="My Project"
        onClose={() => setSaveOpen(false)}
        onConfirm={async (name) => {
          await doSaveProject(name);
          setSaveOpen(false);
        }}
      />

      {confirmEntities && (
        <ConfirmModal
          open={true}
          title="Удалить выбранные сущности?"
          message={`Удалить выбранные сущности (${confirmEntities.length}) и все их связи?`}
          confirmText="Удалить"
          cancelText="Отмена"
          onCancel={() => setConfirmEntities(null)}
          onConfirm={() => {
            removeEntities(confirmEntities);
            setSelectedEntityIds([]);
            setConfirmEntities(null);
          }}
        />
      )}

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
            setSelectedEntityIds([]);
            setConfirmClearOpen(false);
          }}
        />
      )}
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
        
      <InfoModal
        open={infoModalOpen}
        title={infoModalTitle}
        message={infoModalMessage}
        onConfirm={() => setInfoModalOpen(false)}
        type="info"
      />
    </div>
  );
}
