/**
 * canvas/components/LinkHintToast
 * Подсказка при включении режима "Связь".
 * Корректный «въезд» снизу: форсируем reflow перед началом анимации.
 */

import * as React from "react";

export default function LinkHintToast({
  pulse,
  text = "Выберите сущности для связи",
  durationMs = 1800,
}: {
  pulse: number;
  text?: string;
  durationMs?: number;
}) {
  const [phase, setPhase] = React.useState<"hidden" | "pre" | "show" | "hide">(
    "hidden"
  );
  const exitTimer = React.useRef<number | null>(null);
  const raf = React.useRef<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (pulse === 0) return;

    if (exitTimer.current) {
      window.clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }

    // 1) Поставили off-screen без transition
    setPhase("pre");

    // 2) На следующий кадр форсируем reflow и включаем "show" с transition
    raf.current = requestAnimationFrame(() => {
      // форсируем reflow, чтобы браузер применил transform из "pre"
      // и заметил последующий переход к "show"
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      containerRef.current && containerRef.current.offsetHeight;

      setPhase("show");
      exitTimer.current = window.setTimeout(() => {
        setPhase("hide");
      }, durationMs) as unknown as number;
    });

    return () => {
      if (exitTimer.current) {
        window.clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
      if (raf.current) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
    };
  }, [pulse, durationMs]);

  const handleTransitionEnd = () => {
    if (phase === "hide") setPhase("hidden");
  };

  if (phase === "hidden") return null;

  // Плавная кривулька: show — easeOut, hide — easeIn
  const translate =
    phase === "show" ? "translateY(0%)" : "translateY(140%)";
  const opacity = phase === "show" ? 1 : 0.001; // лёгкое проявление
  const transition =
    phase === "show"
      ? "transform 260ms cubic-bezier(0.22,1,0.36,1), opacity 260ms linear"
      : phase === "hide"
      ? "transform 300ms cubic-bezier(0.4,0,1,1), opacity 240ms linear"
      : "none"; // у pre нет transition, чтобы избежать «моргания»

  return (
    <div
      ref={containerRef}
      className="fixed left-4 bottom-4 z-[1000] pointer-events-none"
      style={{ transform: translate, opacity, transition }}
      onTransitionEnd={handleTransitionEnd}
      aria-live="polite"
    >
      <div className="px-3 py-2 rounded-md shadow-lg border bg-gray-900/90 text-gray-100 text-xs backdrop-blur">
        {text}
      </div>
    </div>
  );
}
