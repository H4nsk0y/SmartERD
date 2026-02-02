import React, { useEffect, useState } from "react";
import { clamp } from "../utils";

type Dot = { id: string; x: number; y: number };

const COLOR_PRESETS = [
  { id: "default", label: "По умолчанию", dotColor: "rgba(99,102,241,0.95)", viewportColor: "rgba(99,102,241,0.4)" },
  { id: "sky", label: "Небесный", dotColor: "rgba(135,206,250,0.95)", viewportColor: "rgba(135,206,250,0.4)" },
  { id: "lime", label: "Лаймовый", dotColor: "rgba(50,205,50,0.95)", viewportColor: "rgba(50,205,50,0.4)" },
  { id: "violet", label: "Фиолетовый", dotColor: "rgba(138,43,226,0.95)", viewportColor: "rgba(138,43,226,0.4)" },
  { id: "gold", label: "Золотой", dotColor: "rgba(255,215,0,0.95)", viewportColor: "rgba(255,215,0,0.4)" },
  { id: "turquoise", label: "Бирюзовый", dotColor: "rgba(64,224,208,0.95)", viewportColor: "rgba(64,224,208,0.4)" },
  { id: "orchid", label: "Орхидея", dotColor: "rgba(218,112,214,0.95)", viewportColor: "rgba(218,112,214,0.4)" },
  { id: "tomato", label: "Томатный", dotColor: "rgba(255,99,71,0.95)", viewportColor: "rgba(255,99,71,0.4)" },
];

function useIsDarkMode() {
  const [dark, setDark] = React.useState<boolean>(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false
  );

  React.useEffect(() => {
    const mo = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark"))
    );
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  return dark;
}

function ColorPickerPopup({ 
  isOpen, 
  onClose, 
  onSelectColor,
  currentColorId 
}: { 
  isOpen: boolean;
  onClose: () => void;
  onSelectColor: (colorId: string) => void;
  currentColorId: string;
}) {
  const popupRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popupRef}
      className="absolute top-full right-0 mt-2 z-50 p-3 rounded-xl border border-slate-200/60 dark:border-white/10 bg-white/95 dark:bg-[#0b1220]/95 backdrop-blur-xl shadow-2xl"
      style={{ width: '200px' }}
    >
      <div className="mb-2 text-xs font-medium text-slate-700 dark:text-white/90">
        Цветовая схема
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        {COLOR_PRESETS.map((color) => (
          <button
            key={color.id}
            onClick={() => {
              onSelectColor(color.id);
              onClose();
            }}
            className="group relative flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            title={color.label}
          >
            {/* Цветной круг */}
            <div 
              className="w-8 h-8 rounded-full border-2 border-slate-200/50 dark:border-white/10 transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg"
              style={{ 
                background: color.dotColor,
                boxShadow: currentColorId === color.id 
                  ? `0 0 0 2px ${color.viewportColor}, 0 0 12px ${color.viewportColor}`
                  : 'none'
              }}
            >
              {currentColorId === color.id && (
                <div className="w-full h-full flex items-center justify-center">
                  <svg 
                    className="w-4 h-4 text-white drop-shadow" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            
            {/* Название */}
            <div className="text-[9px] text-slate-600 dark:text-white/70 group-hover:text-slate-800 dark:group-hover:text-white/90 text-center leading-tight">
              {color.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Minimap({
  entities,
  viewport,
  world,
  onJump,
}: {
  entities: Dot[];
  viewport: { x: number; y: number; w: number; h: number };
  world: { w: number; h: number };
  onJump: (worldX: number, worldY: number) => void;
}) {
  const W = 220;
  const H = 160;

  const sx = W / world.w;
  const sy = H / world.h;

  const vw = Math.max(8, viewport.w * sx);
  const vh = Math.max(8, viewport.h * sy);
  const vx = clamp(viewport.x * sx, 0, W - vw);
  const vy = clamp(viewport.y * sy, 0, H - vh);

  const isDark = useIsDarkMode();
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredDot, setHoveredDot] = useState<string | null>(null);
  const [viewportHover, setViewportHover] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>("default");
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [pulseEffect, setPulseEffect] = useState(false);

  const currentColor = COLOR_PRESETS.find(c => c.id === selectedColor) || COLOR_PRESETS[0];

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Эффект пульсации при изменении цвета
  useEffect(() => {
    if (selectedColor !== "default") {
      setPulseEffect(true);
      const timer = setTimeout(() => setPulseEffect(false), 600);
      return () => clearTimeout(timer);
    }
  }, [selectedColor]);

  // Сохранение выбранного цвета в localStorage
  useEffect(() => {
    const savedColor = localStorage.getItem('minimap-color');
    if (savedColor) {
      setSelectedColor(savedColor);
    }
  }, []);

  const handleColorSelect = (colorId: string) => {
    setSelectedColor(colorId);
    localStorage.setItem('minimap-color', colorId);
  };

  const gridColor = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
  const gridBg = `radial-gradient(circle at 1px 1px, ${gridColor} 1px, transparent 0)`;

  const handleJumpByPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const px = clamp(e.clientX - rect.left, 0, W);
    const py = clamp(e.clientY - rect.top, 0, H);
    const wx = px / sx;
    const wy = py / sy;
    onJump(wx, wy);
  };

  // Градиент для viewport с выбранным цветом
  const viewportGradient = viewportHover
    ? `linear-gradient(135deg, ${currentColor.viewportColor.replace('0.4', '0.7')}, ${currentColor.dotColor.replace('0.95', '0.6')})`
    : `linear-gradient(135deg, ${currentColor.viewportColor}, ${currentColor.dotColor.replace('0.95', '0.3')})`;

  return (
    <div
      className={[
        "absolute right-3 bottom-3 z-40",
        "rounded-xl border border-slate-200/50 dark:border-white/10",
        "bg-white/90 dark:bg-[#0b1220]/95 backdrop-blur-xl",
        "shadow-lg",
        "transition-all duration-300",
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        pulseEffect ? 'animate-[pulse_0.6s_ease-in-out]' : '',
      ].join(" ")}
      style={{ 
        width: W + 16,
        height: H + 16 + 28 
      }}
    >
      {/* Заголовок с контролами */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-slate-200/40 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg 
              className="w-3.5 h-3.5 text-slate-600 dark:text-white/70" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            {/* Анимированная точка на карте */}
            <div 
              className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full animate-ping opacity-75"
              style={{ background: currentColor.dotColor }}
            />
          </div>
          <span className="text-xs font-medium text-slate-700 dark:text-white/80">
            Миникарта
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Счетчик сущностей */}
          <div className="text-[10px] text-slate-500 dark:text-white/60 px-1.5 py-0.5 rounded bg-slate-100/50 dark:bg-white/5">
            {entities.length} сущ.
          </div>
          
          {/* Кнопка палитры */}
          <div className="relative">
            <button
              onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-white/70 hover:text-slate-800 dark:hover:text-white/90 transition-colors group"
              title="Изменить цветовую схему"
            >
              <svg 
                className="w-3.5 h-3.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              {/* Индикатор текущего цвета */}
              <div 
                className="absolute -bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full border border-white/50"
                style={{ background: currentColor.dotColor }}
              />
            </button>
            
            {/* Попап с палитрой */}
            <ColorPickerPopup
              isOpen={isColorPickerOpen}
              onClose={() => setIsColorPickerOpen(false)}
              onSelectColor={handleColorSelect}
              currentColorId={selectedColor}
            />
          </div>
        </div>
      </div>

      {/* Основная область карты */}
      <div
        className="relative mx-2 mt-2 mb-2 rounded-lg overflow-hidden cursor-pointer group"
        style={{
          width: W,
          height: H,
          backgroundImage: gridBg,
          backgroundSize: "14px 14px",
          backgroundPosition: "0 0",
        }}
        onPointerDown={handleJumpByPointer}
        title="Кликните для перемещения по карте"
      >
        {/* Анимированный градиентный фон */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${currentColor.viewportColor} 0%, transparent 50%), radial-gradient(circle at 70% 70%, ${currentColor.dotColor.replace('0.95', '0.3')} 0%, transparent 50%)`,
            transition: "background 0.5s ease"
          }}
        />

        {/* Точки сущностей с анимацией */}
        {entities.map((en) => {
          const isHovered = hoveredDot === en.id;
          return (
            <div
              key={en.id}
              className="absolute rounded-full transition-all duration-200"
              style={{
                left: en.x * sx,
                top: en.y * sy,
                width: isHovered ? 5 : 3.5,
                height: isHovered ? 5 : 3.5,
                transform: "translate(-50%, -50%)",
                background: currentColor.dotColor,
                boxShadow: isHovered
                  ? `0 0 12px ${currentColor.dotColor}, 0 0 4px white`
                  : `0 0 6px ${currentColor.dotColor}`,
                zIndex: isHovered ? 20 : 10,
              }}
              onPointerEnter={() => setHoveredDot(en.id)}
              onPointerLeave={() => setHoveredDot((cur) => (cur === en.id ? null : cur))}
            >
              {/* Эффект пульсации при наведении */}
              {isHovered && (
                <div 
                  className="absolute inset-0 rounded-full animate-ping opacity-60"
                  style={{ background: currentColor.dotColor }}
                />
              )}
            </div>
          );
        })}

        {/* Viewport с градиентом и анимацией */}
        <div
          className="absolute"
          style={{
            transform: `translate(${vx}px, ${vy}px)`,
            width: vw,
            height: vh,
            transition: "transform 180ms cubic-bezier(0.4, 0, 0.2, 1), width 180ms cubic-bezier(0.4, 0, 0.2, 1), height 180ms cubic-bezier(0.4, 0, 0.2, 1)",
            willChange: "transform, width, height",
          }}
          onPointerEnter={(e) => {
            e.stopPropagation();
            setViewportHover(true);
          }}
          onPointerLeave={(e) => {
            e.stopPropagation();
            setViewportHover(false);
          }}
        >
          <div
            className="absolute inset-0 rounded-md p-[2px]"
            style={{
              background: viewportGradient,
              opacity: viewportHover ? 1 : 0.9,
              transition: "all 200ms ease",
              boxShadow: viewportHover
                ? `0 0 16px ${currentColor.viewportColor}, 0 0 6px white`
                : `0 0 10px ${currentColor.viewportColor}`,
            }}
          >
            <div
              className="w-full h-full rounded-sm backdrop-blur-sm"
              style={{
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.1)",
              }}
            >
              {/* Анимированные угловые маркеры */}
              <div className="absolute -top-1 -left-1 w-2 h-2">
                <div className="w-full h-full border-t border-l border-white/80 rounded-tl animate-pulse"></div>
              </div>
              <div className="absolute -top-1 -right-1 w-2 h-2">
                <div className="w-full h-full border-t border-r border-white/80 rounded-tr animate-pulse delay-75"></div>
              </div>
              <div className="absolute -bottom-1 -left-1 w-2 h-2">
                <div className="w-full h-full border-b border-l border-white/80 rounded-bl animate-pulse delay-150"></div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-2 h-2">
                <div className="w-full h-full border-b border-r border-white/80 rounded-br animate-pulse delay-300"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Эффект при клике */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>
      </div>

      {/* Статусная строка */}
      <div className="flex items-center justify-between px-3 pb-2 text-[10px]">
        <div className="text-slate-500 dark:text-white/60 flex items-center gap-1.5">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Клик для навигации
        </div>
        <div 
          className="px-2 py-0.5 rounded-full text-[9px] font-medium transition-colors"
          style={{ 
            background: `${currentColor.viewportColor}20`,
            color: currentColor.dotColor 
          }}
        >
          {selectedColor === 'default' ? 'По умолчанию' : currentColor.label}
        </div>
      </div>

      {/* CSS анимации */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); box-shadow: 0 0 30px rgba(0,0,0,0.2); }
        }
      `}</style>
    </div>
  );
}