/**
 * canvas/hooks/useCamera
 * Хук камеры: зум, панорамирование, перевод экранных координат в мировые, viewport-прямоугольник.
 * Не вешает обработчики сам — возвращает функции, которые ты прокинешь на контейнер канваса.
 */

import * as React from "react";
import type { Size } from "../types";
import { clamp } from "../utils";

type Point = { x: number; y: number };

export type UseCameraOptions = {
  /** Пределы масштаба */
  minScale?: number;
  maxScale?: number;
  /** Изначальный масштаб/смещение */
  initialScale?: number;
  initialOffset?: Point;
};

export function useCamera(opts: UseCameraOptions = {}) {
  const {
    minScale = 0.3,
    maxScale = 3,
    initialScale = 1,
    initialOffset = { x: 0, y: 0 },
  } = opts;

  const [scale, setScale] = React.useState<number>(initialScale);
  const [offset, setOffset] = React.useState<Point>(initialOffset);

  const scaleRef = React.useRef(scale);
  const offsetRef = React.useRef(offset);
  React.useEffect(() => { scaleRef.current = scale; }, [scale]);
  React.useEffect(() => { offsetRef.current = offset; }, [offset]);

  // панорамирование
  const isPanning = React.useRef(false);
  const panStartScreen = React.useRef<Point>({ x: 0, y: 0 });

  const toWorld = React.useCallback((clientX: number, clientY: number, rect: DOMRect): Point => {
    return {
      x: (clientX - rect.left - offsetRef.current.x) / scaleRef.current,
      y: (clientY - rect.top  - offsetRef.current.y)  / scaleRef.current,
    };
  }, []);

  const onPanStart = React.useCallback((e: React.MouseEvent) => {
    if (e.button === 2 || e.button === 1 || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      isPanning.current = true;
      panStartScreen.current = {
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y,
      };
    }
  }, []);

  const onPanMove = React.useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const off = {
      x: e.clientX - panStartScreen.current.x,
      y: e.clientY - panStartScreen.current.y,
    };
    offsetRef.current = off;
    setOffset(off);
  }, []);

  const onPanEnd = React.useCallback(() => {
    isPanning.current = false;
  }, []);

  // колесо (зум к курсору)
  const onWheel = React.useCallback((e: React.WheelEvent, host: HTMLElement | null) => {
    if (!host) return;
    e.preventDefault();
    const rect = host.getBoundingClientRect();
    const pre = toWorld(e.clientX, e.clientY, rect);
    const sPrev = scaleRef.current;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const sNext = clamp(sPrev * factor, minScale, maxScale);
    const offNext = {
      x: e.clientX - rect.left - pre.x * sNext,
      y: e.clientY - rect.top  - pre.y * sNext,
    };
    scaleRef.current = sNext; offsetRef.current = offNext;
    setScale(sNext); setOffset(offNext);
  }, [minScale, maxScale, toWorld]);

  // вьюпорт в мировых координатах
  const getViewportWorldRect = React.useCallback((host: HTMLElement | null): { x: number; y: number; w: number; h: number } => {
    if (!host) return { x: 0, y: 0, w: 0, h: 0 };
    const r = host.getBoundingClientRect();
    return {
      x: (-offsetRef.current.x) / scaleRef.current,
      y: (-offsetRef.current.y) / scaleRef.current,
      w: r.width / scaleRef.current,
      h: r.height / scaleRef.current,
    };
  }, []);

  // fit-all и 1:1
  const fitAll = React.useCallback((
    host: HTMLElement | null,
    boxes: Array<{ x: number; y: number; w: number; h: number }>,
    pad = 64
  ) => {
    if (!host || boxes.length === 0) {
      scaleRef.current = 1; offsetRef.current = { x: 0, y: 0 };
      setScale(1); setOffset({ x: 0, y: 0 });
      return;
    }
    const rect = host.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of boxes) {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    }
    const worldW = (maxX - minX) + pad * 2;
    const worldH = (maxY - minY) + pad * 2;
    const sX = rect.width / worldW;
    const sY = rect.height / worldH;
    const sNext = clamp(Math.min(sX, sY), 0.05, maxScale);
    const offNext = {
      x: (rect.width - worldW * sNext) / 2 - (minX - pad) * sNext,
      y: (rect.height - worldH * sNext) / 2 - (minY - pad) * sNext,
    };
    scaleRef.current = sNext; offsetRef.current = offNext;
    setScale(sNext); setOffset(offNext);
  }, [maxScale]);

  const reset1x = React.useCallback(() => {
    scaleRef.current = 1; offsetRef.current = { x: 0, y: 0 };
    setScale(1); setOffset({ x: 0, y: 0 });
  }, []);

  return {
    // state
    scale, offset,
    // refs (на случай, если нужны синхронные значения)
    scaleRef, offsetRef,
    // helpers
    toWorld, getViewportWorldRect, fitAll, reset1x,
    // handlers (вешаются на контейнер)
    onPanStart, onPanMove, onPanEnd, onWheel,
    setScale, setOffset,
  };
}
