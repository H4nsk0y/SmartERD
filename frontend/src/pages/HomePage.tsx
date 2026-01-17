import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

function Svg({
  children,
  className = "",
  viewBox = "0 0 24 24",
}: React.PropsWithChildren<{ className?: string; viewBox?: string }>) {
  return (
    <svg
      viewBox={viewBox}
      width="20"
      height="20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const Icons = {
  er: (
    <Svg className="text-white">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </Svg>
  ),
  sql: (
    <Svg className="text-white">
      <path d="M8 9l-3 3 3 3" />
      <path d="M16 9l3 3-3 3" />
      <path d="M10 19l4-14" />
    </Svg>
  ),
  llm: (
    <Svg className="text-white">
      <path d="M12 8V4" />
      <path d="M9 4h6" />
      <rect x="6" y="8" width="12" height="12" rx="3" />
      <path d="M9 13h.01" />
      <path d="M15 13h.01" />
      <path d="M9 17c1.5 1 4.5 1 6 0" />
    </Svg>
  ),
  check: (
    <Svg className="text-white">
      <path d="M9 12l2 2 4-4" />
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  ),
  bolt: (
    <Svg className="text-white">
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </Svg>
  ),
  wand: (
    <Svg className="text-white">
      <path d="M14 4l6 6" />
      <path d="M7 21l10-10" />
      <path d="M4 14l6 6" />
      <path d="M3 21l3-3" />
    </Svg>
  ),
  layers: (
    <Svg className="text-white">
      <path d="M12 2l9 5-9 5-9-5 9-5z" />
      <path d="M3 12l9 5 9-5" />
      <path d="M3 17l9 5 9-5" />
    </Svg>
  ),
  arrow: (
    <Svg className="text-white">
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </Svg>
  ),
};

// Хук для определения темы
const useTheme = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
    
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    });
    
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);
  
  return theme;
};

function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      {/* Light theme */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:hidden" />
      <div className="absolute -top-24 -left-24 h-[520px] w-[520px] rounded-full bg-indigo-500/15 blur-3xl dark:hidden motion-safe:animate-pulse" />
      <div className="absolute -bottom-28 -right-24 h-[560px] w-[560px] rounded-full bg-fuchsia-500/10 blur-3xl dark:hidden motion-safe:animate-pulse" />
      <div className="absolute -bottom-24 left-[15%] h-[520px] w-[520px] rounded-full bg-sky-500/10 blur-3xl dark:hidden motion-safe:animate-pulse" />
      
      {/* Dark theme */}
      <div className="hidden dark:block absolute inset-0 bg-gradient-to-b from-[#0b1220] via-[#0b1220] to-[#070b14]" />
      <div className="hidden dark:block absolute -top-24 -left-24 h-[520px] w-[520px] rounded-full bg-indigo-600/25 blur-3xl motion-safe:animate-pulse" />
      <div className="hidden dark:block absolute -bottom-28 -right-24 h-[560px] w-[560px] rounded-full bg-fuchsia-500/15 blur-3xl motion-safe:animate-pulse" />
      <div className="hidden dark:block absolute -bottom-24 left-[15%] h-[520px] w-[520px] rounded-full bg-sky-500/10 blur-3xl motion-safe:animate-pulse" />
      
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.12] dark:opacity-[0.18]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>
      
      {/* Soft waves - light theme */}
      <div className="absolute inset-0 opacity-30 dark:hidden bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.08),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.06),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(56,189,248,0.04),transparent_40%)]" />
      
      {/* Soft waves - dark theme */}
      <div className="hidden dark:block absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.22),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.18),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(56,189,248,0.12),transparent_40%)]" />
    </div>
  );
}

function FeatureCard({
  title,
  icon,
  text,
  delayMs = 0,
  accent = false,
  mounted,
  href,
}: {
  title: string;
  icon: React.ReactNode;
  text: string;
  delayMs?: number;
  accent?: boolean;
  mounted: boolean;
  href?: string;
}) {
  const content = (
    <div
      className={[
        "group relative rounded-2xl overflow-hidden w-full h-full",
        // Стили для светлой темы
        "border border-slate-200 dark:border-white/10",
        "bg-white/80 dark:bg-white/5 backdrop-blur-md",
        "shadow-sm dark:shadow-none",
        // hover эффекты
        "transition-all duration-300 hover:-translate-y-0.5",
        "hover:shadow-lg dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
        "hover:bg-white/90 dark:hover:bg-white/[0.07]",
        // входная анимация
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
      ].join(" ")}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {/* Градиентная подсветка для тёмной темы */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 dark:block hidden">
        <div className="absolute -inset-[1px] rounded-2xl bg-[linear-gradient(90deg,rgba(99,102,241,0.35),rgba(168,85,247,0.25),rgba(56,189,248,0.18))]" />
      </div>
      
      {/* Подсветка для светлой темы */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 dark:hidden block">
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-sky-50/20" />
      </div>

      <div className="relative rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className={[
            "shrink-0 rounded-xl p-2 transition",
            // Иконка для светлой темы
            "bg-slate-100/80 dark:bg-white/10",
            "ring-1 ring-slate-200/50 dark:ring-white/10",
            "group-hover:bg-slate-200/80 dark:group-hover:bg-white/15",
            accent ? "bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-500/20 dark:to-purple-500/20" : "",
          ].join(" ")}>
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-slate-900 dark:text-white">{title}</div>
              
              {href && (
                <span className="text-slate-400 dark:text-white/40 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-transform group-hover:translate-x-0.5">
                  ↗
                </span>
              )}
            </div>
            
            {accent && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="relative inline-flex">
                  <span className="absolute inline-flex h-2 w-2 rounded-full bg-indigo-400/50 blur-[1px]" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                </span>
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  Популярно
                </span>
              </div>
            )}
            
            <div className="mt-2 text-sm text-slate-600 dark:text-white/70 leading-snug">
              {text}
            </div>
            
            {/* Прогресс-бар для будущих функций */}
            {title.includes("LLM") && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500 dark:text-white/50 mb-1">
                  <span>Статус: бета</span>
                  <span>80%</span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-4/5 bg-gradient-to-r from-indigo-500 to-purple-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Тонкая рамка */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-slate-200/0 group-hover:ring-slate-300/50 dark:ring-white/0 dark:group-hover:ring-white/10 transition" />
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="block">
        {content}
      </Link>
    );
  }
  
  return content;
}

function MiniValue({
  icon,
  title,
  text,
  delayMs,
  mounted,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  delayMs: number;
  mounted: boolean;
}) {
  return (
    <div
      className={[
        "flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-white/10",
        "bg-white/60 dark:bg-white/5 p-5 backdrop-blur-sm",
        "transition-all duration-500 hover:-translate-y-0.5",
        "hover:bg-white/80 dark:hover:bg-white/[0.07]",
        "hover:shadow-md",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
      ].join(" ")}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      <div className="mt-0.5 shrink-0 rounded-xl bg-slate-100/80 dark:bg-white/10 p-2 ring-1 ring-slate-200/50 dark:ring-white/10">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
        <div className="mt-1 text-sm text-slate-600 dark:text-white/70 leading-snug">{text}</div>
      </div>
    </div>
  );
}

function MiniPreview({
  mounted,
}: {
  mounted: boolean;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 4), 1200);
    return () => clearInterval(t);
  }, []);

  const active = (i: number) => i === step;

  return (
    <div
      className={[
        "mt-5 rounded-2xl border border-slate-200 dark:border-white/10",
        "bg-white/60 dark:bg-white/5 p-4 overflow-hidden backdrop-blur-sm",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        "transition-all duration-500",
      ].join(" ")}
      style={{ transitionDelay: `420ms` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          Мини-превью редактора
        </div>
        <div className="text-xs text-slate-500 dark:text-white/55">
          сущности + связи
        </div>
      </div>

      <div className="mt-3 relative">
        {/* "живой" фон-сетка внутри превью */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.10]">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.35)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.35)_1px,transparent_1px)] [background-size:36px_36px]" />
        </div>

        <svg viewBox="0 0 560 180" className="relative w-full h-auto">
          {/* линии */}
          <path
            d="M180 60 C 260 60, 300 60, 380 60"
            stroke="rgba(0,0,0,0.20)"
            className="dark:stroke-white/20"
          />
          <path
            d="M180 120 C 260 120, 300 120, 380 120"
            stroke="rgba(0,0,0,0.20)"
            className="dark:stroke-white/20"
          />
          <path
            d="M280 60 C 280 90, 280 90, 280 120"
            stroke="rgba(99,102,241,0.35)"
          />

          {/* узлы */}
          {[
            { x: 120, y: 60, label: "Student", k: 0 },
            { x: 440, y: 60, label: "Course", k: 1 },
            { x: 280, y: 120, label: "Enrollment", k: 2 },
            { x: 440, y: 120, label: "Applied", k: 3 },
          ].map((n) => (
            <g key={n.k} transform={`translate(${n.x},${n.y})`}>
              <rect
                x={-75}
                y={-22}
                width={150}
                height={44}
                rx={14}
                fill={active(n.k) ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.06)"}
                stroke={active(n.k) ? "rgba(99,102,241,0.65)" : "rgba(0,0,0,0.12)"}
                className={active(n.k) ? "dark:fill-indigo-500/18 dark:stroke-indigo-500/65" : "dark:fill-white/6 dark:stroke-white/12"}
              />
              <text
                x="0"
                y="6"
                textAnchor="middle"
                fontSize="12"
                fill="rgba(0,0,0,0.88)"
                className="dark:fill-white/88"
                style={{ fontWeight: 650 }}
              >
                {n.label}
              </text>

              {/* "пульс" активной точки */}
              {active(n.k) && (
                <circle cx="62" cy="-16" r="6" fill="rgba(99,102,241,0.9)">
                  <animate
                    attributeName="r"
                    values="5;8;5"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;0.55;1"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-3 text-xs text-slate-500 dark:text-white/55 leading-snug">
        Подсказки и авто-исправления появляются сразу — без перезагрузок.
      </div>
    </div>
  );
}

function StatsCounter({ 
  mounted,
  target,
  label,
  suffix = "",
  duration = 2000 
}: { 
  mounted: boolean;
  target: number;
  label: string;
  suffix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (!mounted) return;
    
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    
    return () => clearInterval(timer);
  }, [mounted, target, duration]);
  
  return (
    <div className="text-center p-4">
      <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-sm text-slate-600 dark:text-white/70 mt-1">
        {label}
      </div>
    </div>
  );
}

function StatsSection({ mounted }: { mounted: boolean }) {
  return (
    <div className={[
      "mt-8 rounded-2xl border border-slate-200 dark:border-white/10",
      "bg-gradient-to-br from-white/60 to-slate-50/60",
      "dark:from-white/5 dark:to-white/[0.02]",
      "backdrop-blur-sm p-6",
      mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
      "transition-all duration-500"
    ].join(" ")}>
      <div className="text-center mb-4">
        <div className="text-lg font-semibold text-slate-900 dark:text-white">
          SmartERD в цифрах
        </div>
        <div className="text-sm text-slate-600 dark:text-white/60">
          Пользователи выбирают SmartERD для быстрого проектирования
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCounter mounted={mounted} target={1500} label="Создано диаграмм" suffix="+" />
        <StatsCounter mounted={mounted} target={89} label="Сэкономлено часов" suffix="+" />
        <StatsCounter mounted={mounted} target={42} label="Исправлено ошибок" suffix="к" />
        <StatsCounter mounted={mounted} target={98} label="Довольных пользователей" suffix="%" />
      </div>
    </div>
  );
}

function UseCaseCarousel({ mounted }: { mounted: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);
  
  const useCases = [
    {
      title: "Для студентов",
      description: "Быстрое создание ER-диаграмм для учебных проектов и курсовых",
      icon: "🎓",
      color: "from-blue-500 to-cyan-500"
    },
    {
      title: "Для разработчиков",
      description: "Проектирование БД для новых микросервисов и приложений",
      icon: "💻",
      color: "from-purple-500 to-pink-500"
    },
    {
      title: "Для архитекторов",
      description: "Создание комплексных моделей данных для enterprise-систем",
      icon: "🏛️",
      color: "from-amber-500 to-orange-500"
    },
    {
      title: "Для аналитиков",
      description: "Визуализация структур данных и бизнес-процессов",
      icon: "📊",
      color: "from-emerald-500 to-teal-500"
    }
  ];
  
  useEffect(() => {
    if (!mounted) return;
    
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % useCases.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [mounted]);
  
  return (
    <div className={[
      "mt-6 relative overflow-hidden rounded-2xl",
      "border border-slate-200 dark:border-white/10",
      "bg-gradient-to-br from-white/80 to-slate-50/80",
      "dark:from-white/5 dark:to-white/[0.02]",
      "p-6 backdrop-blur-sm",
      mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
      "transition-all duration-500 delay-300"
    ].join(" ")}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-lg font-semibold text-slate-900 dark:text-white">
          Кому подходит SmartERD?
        </div>
        <div className="flex gap-1">
          {useCases.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={[
                "w-2 h-2 rounded-full transition-all",
                idx === activeIndex 
                  ? "bg-indigo-500 w-6" 
                  : "bg-slate-300 dark:bg-white/30 hover:bg-slate-400"
              ].join(" ")}
            />
          ))}
        </div>
      </div>
      
      <div className="relative h-32">
        {useCases.map((useCase, idx) => (
          <div
            key={idx}
            className={[
              "absolute inset-0 p-4 transition-all duration-500",
              idx === activeIndex 
                ? "opacity-100 translate-x-0" 
                : idx < activeIndex
                ? "opacity-0 -translate-x-full"
                : "opacity-0 translate-x-full"
            ].join(" ")}
          >
            <div className="flex items-start gap-4">
              <div className={[
                "text-3xl p-3 rounded-xl bg-gradient-to-br",
                useCase.color,
                "text-white"
              ].join(" ")}>
                {useCase.icon}
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                  {useCase.title}
                </div>
                <div className="text-slate-600 dark:text-white/70 mt-1">
                  {useCase.description}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickStartPanel({ mounted }: { mounted: boolean }) {
  const steps = [
    { title: "Создать сущность", action: "Нажмите 'Добавить'", time: "10 сек" },
    { title: "Добавить атрибуты", action: "Двойной клик по сущности", time: "30 сек" },
    { title: "Создать связи", action: "Перетащите между сущностями", time: "15 сек" },
    { title: "Получить SQL", action: "Нажмите 'Генерировать'", time: "5 сек" },
  ];
  
  return (
    <div className={[
      "mt-6 rounded-2xl border border-slate-200 dark:border-white/10",
      "bg-gradient-to-br from-white/80 to-slate-50/80",
      "dark:from-white/5 dark:to-white/[0.02]",
      "p-6 backdrop-blur-sm",
      mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
      "transition-all duration-500 delay-400"
    ].join(" ")}>
      <div className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Быстрый старт за 60 секунд
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl border border-slate-100 dark:border-white/10 bg-white/50 dark:bg-white/[0.03]"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
                {idx + 1}
              </div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                {step.title}
              </div>
            </div>
            <div className="text-sm text-slate-600 dark:text-white/70 mb-2">
              {step.action}
            </div>
            <div className="text-xs text-slate-500 dark:text-white/50">
              {step.time}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-center">
        <Link
          to="/tutorial"
          className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
        >
          <span>Смотреть видео-туториал</span>
          <span className="text-lg">▶️</span>
        </Link>
      </div>
    </div>
  );
}

function TestimonialCard({ 
  text, 
  author, 
  role, 
  mounted, 
  delay 
}: { 
  text: string; 
  author: string; 
  role: string; 
  mounted: boolean; 
  delay: number;
}) {
  return (
    <div
      className={[
        "relative rounded-xl border border-slate-200 dark:border-white/10",
        "bg-white/60 dark:bg-white/[0.03] p-4",
        "backdrop-blur-sm",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        "transition-all duration-500"
      ].join(" ")}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="text-slate-900 dark:text-white text-sm mb-3">"{text}"</div>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-slate-900 dark:text-white text-sm">{author}</div>
          <div className="text-xs text-slate-500 dark:text-white/60">{role}</div>
        </div>
        <div className="text-amber-500">★★★★★</div>
      </div>
    </div>
  );
}

function TestimonialsSection({ mounted }: { mounted: boolean }) {
  const testimonials = [
    {
      text: "Сэкономил 3 часа на курсовой. ER-диаграмма готова за 15 минут!",
      author: "Алексей С., студент",
      role: "ВШЭ, 3 курс"
    },
    {
      text: "Идеально для быстрого прототипирования БД. Особенно нравится проверка нормализации.",
      author: "Мария К., разработчик",
      role: "Яндекс"
    },
    {
      text: "Простой интерфейс, но мощные возможности. SQL генерируется под все наши БД.",
      author: "Дмитрий П., тимлид",
      role: "Тинькофф"
    }
  ];
  
  return (
    <div className="mt-8">
      <div className="text-center mb-6">
        <div className="text-lg font-semibold text-slate-900 dark:text-white">
          Отзывы пользователей
        </div>
        <div className="text-sm text-slate-600 dark:text-white/60">
          Более 500 разработчиков уже используют SmartERD
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {testimonials.map((testimonial, idx) => (
          <TestimonialCard
            key={idx}
            {...testimonial}
            mounted={mounted}
            delay={200 + idx * 100}
          />
        ))}
      </div>
    </div>
  );
}

function IntegrationsPanel({ mounted }: { mounted: boolean }) {
  const integrations = [
    { name: "GitHub", icon: "🐙", color: "from-slate-800 to-slate-900" },
    { name: "GitLab", icon: "🦊", color: "from-orange-600 to-orange-700" },
    { name: "Notion", icon: "📝", color: "from-slate-900 to-black" },
    { name: "Figma", icon: "🎨", color: "from-purple-600 to-pink-600" },
    { name: "VS Code", icon: "💻", color: "from-blue-600 to-indigo-600" },
    { name: "Slack", icon: "💬", color: "from-purple-500 to-pink-500" },
  ];
  
  return (
    <div className={[
      "mt-8 rounded-2xl border border-slate-200 dark:border-white/10",
      "bg-gradient-to-br from-white/60 to-slate-50/60",
      "dark:from-white/5 dark:to-white/[0.02]",
      "p-6 backdrop-blur-sm",
      mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
      "transition-all duration-500 delay-500"
    ].join(" ")}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-semibold text-slate-900 dark:text-white">
            Интеграции
          </div>
          <div className="text-sm text-slate-600 dark:text-white/60">
            Экспортируйте диаграммы в ваши любимые инструменты
          </div>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
          Скоро
        </span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        {integrations.map((integration, idx) => (
          <div
            key={idx}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] hover:bg-white/80 dark:hover:bg-white/[0.05] transition-colors"
          >
            <div className={[
              "w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-2",
              "bg-gradient-to-br",
              integration.color,
              "text-white"
            ].join(" ")}>
              {integration.icon}
            </div>
            <div className="text-sm font-medium text-slate-900 dark:text-white">
              {integration.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  // Стили для красивого скроллбара
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
      .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 10px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: linear-gradient(45deg, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.4));
        border-radius: 10px;
        border: 2px solid transparent;
        background-clip: padding-box;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(45deg, rgba(99, 102, 241, 0.6), rgba(168, 85, 247, 0.6));
      }
      .dark .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }
      .dark .custom-scrollbar::-webkit-scrollbar-thumb {
        background: linear-gradient(45deg, rgba(99, 102, 241, 0.5), rgba(168, 85, 247, 0.5));
      }
      .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(45deg, rgba(99, 102, 241, 0.7), rgba(168, 85, 247, 0.7));
      }
      .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: rgba(99, 102, 241, 0.4) rgba(0, 0, 0, 0.05);
      }
      .dark .custom-scrollbar {
        scrollbar-color: rgba(99, 102, 241, 0.5) rgba(255, 255, 255, 0.05);
      }
    `;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  useEffect(() => {
    const r = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);

  return (
    <div className="relative w-full min-h-screen overflow-y-auto custom-scrollbar">
      <Background />
      
      <div className="relative w-full max-w-6xl mx-auto px-4 py-10">
        {/* Hero секция */}
        <div className="relative rounded-[32px] border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] shadow-2xl backdrop-blur-xl p-7 md:p-10 mb-8">
          {/* Progress line */}
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-[3px]">
            <div className="h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-80" />
            <div className="h-full blur-md bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-70" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-stretch">
            {/* Левая часть */}
            <div className="flex flex-col justify-between">
              <div>
                <h1 className={[
                  "text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white leading-tight",
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                  "transition-all duration-500",
                ].join(" ")}>
                  SmartERD — быстрый редактор ER-диаграмм
                </h1>

                <p className={[
                  "mt-4 text-slate-600 dark:text-white/75 text-lg leading-relaxed",
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                  "transition-all duration-500",
                ].join(" ")}>
                  Создавайте профессиональные ER-диаграммы, получайте SQL-код под разные СУБД и исправляйте ошибки нормализации в реальном времени.
                </p>

                <div className="mt-6 space-y-3">
                  <MiniValue
                    mounted={mounted}
                    delayMs={160}
                    icon={Icons.bolt}
                    title="Проверка на лету"
                    text="Ошибки и подсказки появляются сразу — по мере редактирования диаграммы."
                  />
                  <MiniValue
                    mounted={mounted}
                    delayMs={220}
                    icon={Icons.wand}
                    title="Авто-исправления"
                    text="Если проблема типовая — можно применить исправление одним кликом."
                  />
                  <MiniValue
                    mounted={mounted}
                    delayMs={280}
                    icon={Icons.layers}
                    title="Несколько SQL-диалектов"
                    text="Одна диаграмма → SQL для Postgres / MySQL / SQLite / MSSQL."
                  />
                </div>

                <div className={[
                  "mt-6 flex flex-col sm:flex-row gap-3",
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                  "transition-all duration-500",
                ].join(" ")}>
                  <Link
                    to="/editor"
                    className="relative inline-flex justify-center items-center px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold transition-all active:scale-[0.98] overflow-hidden group"
                  >
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-indigo-500/20 to-purple-500/20" />
                    <span className="relative flex items-center gap-2">
                      <span>Открыть редактор</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </span>
                  </Link>

                  <Link
                    to="/knowledge"
                    className="inline-flex justify-center items-center gap-2 px-6 py-3 rounded-2xl border border-slate-300 dark:border-white/15 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-white font-semibold transition active:scale-[0.98]"
                  >
                    <span>📚</span>
                    <span>База знаний</span>
                  </Link>
                </div>

                {/* Quick Start Panel */}
                <QuickStartPanel mounted={mounted} />
              </div>

              <div className="mt-8">
                <div className="text-xs text-slate-500 dark:text-white/45">
                  React + Tailwind + Zustand + PostgreSQL + Prisma
                </div>
                <div className="mt-2 text-xs text-slate-400 dark:text-white/30">
                  Версия 2.0.0
                </div>
              </div>
            </div>

            {/* Правая часть */}
            <div className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 p-6 md:p-7 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
                <div className={[
                  "text-slate-900 dark:text-white font-semibold",
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                  "transition-all duration-500",
                ].join(" ")}>
                  Что умеет SmartERD
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FeatureCard
                    mounted={mounted}
                    delayMs={200}
                    accent
                    title="ER-редактор"
                    icon={Icons.er}
                    text="Сущности, атрибуты и связи 1:1 / 1:N / N:M + инспектор."
                    href="/editor"
                  />

                  <FeatureCard
                    mounted={mounted}
                    delayMs={240}
                    accent
                    title="SQL"
                    icon={Icons.sql}
                    text="SQL под Postgres / MySQL / SQLite / MSSQL — без лишнего шума."
                    href="/editor?tab=sql"
                  />

                  <FeatureCard
                    mounted={mounted}
                    delayMs={280}
                    title="LLM-генерация"
                    icon={Icons.llm}
                    text="Опишите проект текстом — получите стартовую ER-модель."
                  />

                  <FeatureCard
                    mounted={mounted}
                    delayMs={320}
                    title="Валидация + нормализация"
                    icon={Icons.check}
                    text="Подсказки по 1НФ/2НФ/3НФ и авто-исправления типовых проблем."
                  />
                </div>

                <MiniPreview mounted={mounted} />
              </div>

              {/* Use Case Carousel */}
              <UseCaseCarousel mounted={mounted} />
            </div>
          </div>
        </div>

        {/* Дополнительные секции */}
        <StatsSection mounted={mounted} />
        
        <TestimonialsSection mounted={mounted} />
        
        <IntegrationsPanel mounted={mounted} />

        {/* CTA внизу */}
        <div className={[
          "mt-8 mb-12 text-center",
          mounted ? "opacity-100" : "opacity-0",
          "transition-opacity duration-700"
        ].join(" ")}>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Начните создавать диаграммы бесплатно
          </div>
          <Link
            to="/editor"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-lg transition-all active:scale-[0.98] shadow-lg hover:shadow-xl"
          >
            <span>Начать сейчас</span>
            <span className="text-xl">🚀</span>
          </Link>
          <div className="mt-4 text-sm text-slate-600 dark:text-white/60">
            Регистрация не обязательна. Просто откройте редактор и начните творить!
          </div>
        </div>
      </div>
    </div>
  );
}