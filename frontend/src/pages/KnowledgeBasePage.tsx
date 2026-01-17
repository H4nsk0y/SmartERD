import React, { useMemo, useState, useEffect } from "react";

type TabId = "theory" | "normalization" | "tasks" | "literature" | "guide";
type Difficulty = "beginner" | "intermediate" | "advanced";
type SearchScope = "all" | "definitions" | "examples" | "tasks";

const TABS: Array<{ 
  id: TabId; 
  title: string; 
  subtitle: string; 
  icon: React.ReactNode;
  tags: string[];
  related: TabId[];
}> = [
  { 
    id: "theory", 
    title: "Теория", 
    subtitle: "ER-модель, ключи, связи", 
    icon: "📚",
    tags: ["базовые", "ключи", "связи", "ER-модель"],
    related: ["normalization", "tasks"]
  },
  { 
    id: "normalization", 
    title: "Нормализация", 
    subtitle: "1НФ → 3НФ → BCNF", 
    icon: "🧼",
    tags: ["1нф", "2нф", "3нф", "bcnf", "аномалии", "денормализация"],
    related: ["theory", "tasks"]
  },
  { 
    id: "tasks", 
    title: "Задачи", 
    subtitle: "Тренажёр + ответы", 
    icon: "🧩",
    tags: ["тренировка", "ответы", "решение", "практика"],
    related: ["theory", "normalization"]
  },
  { 
    id: "literature", 
    title: "Литература", 
    subtitle: "Книги, статьи, доки", 
    icon: "🔗",
    tags: ["книги", "статьи", "документация"],
    related: ["theory", "normalization"]
  },
  { 
    id: "guide", 
    title: "Руководство", 
    subtitle: "Как пользоваться SmartERD", 
    icon: "🧭",
    tags: ["инструкция", "гайд", "помощь"],
    related: []
  },
];

function cx(...s: Array<string | false | undefined | null>) {
  return s.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone = "indigo",
}: {
  children: React.ReactNode;
  tone?: "indigo" | "gray" | "green" | "amber" | "purple";
}) {
  const cls =
    tone === "indigo"
      ? "bg-indigo-600/10 text-indigo-700 dark:text-indigo-200 border-indigo-600/20"
      : tone === "green"
      ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-200 border-emerald-600/20"
      : tone === "amber"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-200 border-amber-500/20"
      : tone === "purple"
      ? "bg-purple-600/10 text-purple-700 dark:text-purple-200 border-purple-600/20"
      : "bg-gray-500/10 text-gray-700 dark:text-gray-200 border-gray-500/20";

  return (
    <span className={cx("inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs", cls)}>
      {children}
    </span>
  );
}

function Card({
  title,
  desc,
  children,
  right,
  className = "",
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-3xl bg-white/85 dark:bg-gray-900/80 border border-gray-200/70 dark:border-gray-700/70 shadow-lg backdrop-blur px-6 py-5", className)}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            {right}
          </div>
          {desc && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{desc}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-gray-200/80 dark:bg-gray-700/60 my-4" />;
}

function Reveal({
  title,
  children,
  defaultOpen = false,
  hint,
  onReveal,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  hint?: string;
  onReveal?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const handleClick = () => {
    setOpen((v) => !v);
    if (!open && onReveal) {
      onReveal();
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white/60 dark:bg-gray-900/60">
      <button
        type="button"
        onClick={handleClick}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
      >
        <div className="text-left">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</div>
          {hint && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</div>}
        </div>
        <span
          className={cx(
            "text-gray-500 dark:text-gray-300 transition-transform duration-200",
            open && "rotate-180"
          )}
        >
          ▾
        </span>
      </button>

      <div
        className={cx(
          "px-4 overflow-hidden transition-[max-height] duration-300 ease-out",
          open ? "max-h-[900px]" : "max-h-0"
        )}
      >
        <div className={cx("pb-4 text-sm text-gray-800 dark:text-gray-200", open && "animate-fadeIn")}>
          {children}
        </div>
      </div>
    </div>
  );
}

function KbLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group block rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 px-4 py-3 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:underline">
            {title}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">{desc}</div>
        </div>
        <div className="text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition">↗</div>
      </div>
    </a>
  );
}

function RelationshipVisual({ type }: { type: "1:1" | "1:N" | "N:M" }) {
  const visuals = {
    "1:1": (
      <div className="flex items-center justify-between px-2">
        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center text-xs font-medium text-gray-800 dark:text-gray-100 shadow-sm">
          A
        </div>
        <div className="flex-1 h-px mx-2 bg-gray-300 dark:bg-gray-600"></div>
        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center text-xs font-medium text-gray-800 dark:text-gray-100 shadow-sm">
          B
        </div>
      </div>
    ),
    "1:N": (
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center text-xs font-medium text-gray-800 dark:text-gray-100 shadow-sm mb-1">
          A
        </div>
        <div className="h-3 w-px bg-gray-300 dark:bg-gray-600 mb-1"></div>
        <div className="flex items-center space-x-1">
          {[1, 2].map((i) => (
            <div key={i} className="w-6 h-6 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center text-[10px] text-gray-800 dark:text-gray-100 shadow-sm">
              B{i}
            </div>
          ))}
        </div>
      </div>
    ),
    "N:M": (
      <div className="flex flex-col items-center justify-center">
        <div className="flex items-center space-x-1 mb-1">
          {[1, 2].map((i) => (
            <div key={i} className="w-6 h-6 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center text-[10px] text-gray-800 dark:text-gray-100 shadow-sm">
              A{i}
            </div>
          ))}
        </div>
        <div className="h-4 flex items-center justify-center w-full">
          <div className="h-px w-4 bg-gray-300 dark:bg-gray-600"></div>
          <div className="mx-1 text-xs text-gray-500 dark:text-gray-400">↔</div>
          <div className="h-px w-4 bg-gray-300 dark:bg-gray-600"></div>
        </div>
        <div className="flex items-center space-x-1 mt-1">
          {[1, 2].map((i) => (
            <div key={i} className="w-6 h-6 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center text-[10px] text-gray-800 dark:text-gray-100 shadow-sm">
              B{i}
            </div>
          ))}
        </div>
      </div>
    ),
  };

  return (
    <div className="p-3 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/40 dark:to-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 h-full flex flex-col">
      <div className="text-center text-xs text-gray-500 dark:text-gray-400 mb-2">
        <span className="font-semibold text-gray-700 dark:text-gray-200">{type}</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        {visuals[type]}
      </div>
    </div>
  );
}

function InteractiveQuiz({
  question,
  options,
  correctAnswer,
  explanation
}: {
  question: string;
  options: Array<{ id: string; text: string }>;
  correctAnswer: string;
  explanation: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleSelect = (id: string) => {
    if (selected) return; // Запрещаем менять ответ после выбора
    
    setSelected(id);
    setShowResult(true);
    setAttempts(prev => prev + 1);
  };

  const reset = () => {
    setSelected(null);
    setShowResult(false);
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-gray-800/40 dark:to-gray-900/40">
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium text-gray-900 dark:text-gray-100">{question}</p>
        {attempts > 0 && (
          <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300">
            Попыток: {attempts}
          </span>
        )}
      </div>
      
      <div className="space-y-2 mb-3">
        {options.map((opt) => {
          const isSelected = selected === opt.id;
          const isCorrect = opt.id === correctAnswer;
          
          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={cx(
                "w-full text-left px-4 py-3 rounded-lg border transition-all",
                !selected && "hover:bg-white dark:hover:bg-gray-800/80 border-gray-200 dark:border-gray-700",
                isSelected && isCorrect && "border-green-500 bg-green-50 dark:bg-green-900/30",
                isSelected && !isCorrect && "border-red-500 bg-red-50 dark:bg-red-900/30"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cx(
                  "w-6 h-6 rounded-full border flex items-center justify-center text-xs",
                  isSelected && isCorrect && "border-green-500 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300",
                  isSelected && !isCorrect && "border-red-500 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300",
                  !isSelected && "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                )}>
                  {isSelected && (isCorrect ? "✓" : "✗")}
                </div>
                <span className="text-gray-800 dark:text-gray-200">{opt.text}</span>
              </div>
            </button>
          );
        })}
      </div>
      
      {showResult && (
        <div className={cx(
          "mt-4 p-3 rounded-lg animate-fadeIn",
          selected === correctAnswer 
            ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50" 
            : "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50"
        )}>
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-800 dark:text-gray-200">
              {selected === correctAnswer ? "✓ Правильно!" : "✗ Неверно"}
            </p>
            <button
              onClick={reset}
              className="text-xs px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Попробовать снова
            </button>
          </div>
          <p className="text-sm mt-2 text-gray-700 dark:text-gray-300">{explanation}</p>
        </div>
      )}
    </div>
  );
}

function DifficultyToggle({ 
  value, 
  onChange 
}: { 
  value: Difficulty; 
  onChange: (d: Difficulty) => void 
}) {
  const levels = [
    { id: "beginner", label: "Начинающий", color: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
    { id: "intermediate", label: "Средний", color: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
    { id: "advanced", label: "Продвинутый", color: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300" },
  ] as const;

  return (
    <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-gray-50/50 dark:bg-gray-800/50">
      {levels.map((level) => (
        <button
          key={level.id}
          onClick={() => onChange(level.id as Difficulty)}
          className={cx(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex-1",
            value === level.id
              ? `${level.color} shadow-sm`
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/70"
          )}
        >
          {level.label}
        </button>
      ))}
    </div>
  );
}

function BookmarkButton({ 
  sectionId, 
  isBookmarked, 
  onToggle 
}: { 
  sectionId: string; 
  isBookmarked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cx(
        "transition-all hover:scale-110",
        isBookmarked 
          ? "text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300" 
          : "text-gray-400 hover:text-amber-400 dark:text-gray-500 dark:hover:text-amber-300"
      )}
      title={isBookmarked ? "Удалить из закладок" : "Добавить в закладки"}
    >
      {isBookmarked ? "★" : "☆"}
    </button>
  );
}

function ProgressIndicator({ 
  progress 
}: { 
  progress: Record<string, boolean> 
}) {
  const totalSections = 15; // Примерное количество секций
  const completedSections = Object.values(progress).filter(v => v).length;
  const percentage = Math.round((completedSections / totalSections) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-300">Прогресс изучения</span>
        <span className="font-semibold text-gray-800 dark:text-gray-100">{percentage}%</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Изучено {completedSections} из {totalSections} разделов
      </div>
    </div>
  );
}

function RelatedTopics({ 
  currentTopic, 
  onNavigate 
}: { 
  currentTopic: TabId; 
  onNavigate: (tab: TabId) => void;
}) {
  const currentTab = TABS.find(t => t.id === currentTopic);
  
  if (!currentTab?.related?.length) return null;

  return (
    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Связанные темы:</span>
        {currentTab.related.map(topicId => {
          const tab = TABS.find(t => t.id === topicId);
          if (!tab) return null;
          
          return (
            <button
              key={topicId}
              onClick={() => onNavigate(topicId)}
              className="text-xs px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <span>{tab.icon}</span>
              <span>{tab.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SearchScopeToggle({
  scope,
  onChange
}: {
  scope: SearchScope;
  onChange: (s: SearchScope) => void;
}) {
  const scopes: Array<{ id: SearchScope; label: string }> = [
    { id: "all", label: "Все" },
    { id: "definitions", label: "Определения" },
    { id: "examples", label: "Примеры" },
    { id: "tasks", label: "Задачи" },
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {scopes.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={cx(
            "text-xs px-2 py-1 rounded border transition-colors",
            scope === s.id
              ? "bg-indigo-100 dark:bg-indigo-900/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
              : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export default function KnowledgeBasePage() {
  const [tab, setTab] = useState<TabId>("theory");
  const [q, setQ] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const query = q.trim().toLowerCase();

  // Загрузка прогресса и закладок из localStorage
  useEffect(() => {
    const savedProgress = localStorage.getItem('kbase-progress');
    const savedBookmarks = localStorage.getItem('kbase-bookmarks');
    const savedHistory = localStorage.getItem('kbase-search-history');
    
    if (savedProgress) setProgress(JSON.parse(savedProgress));
    if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
    if (savedHistory) setSearchHistory(JSON.parse(savedHistory));
  }, []);

  // Сохранение прогресса и закладок
  useEffect(() => {
    localStorage.setItem('kbase-progress', JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    localStorage.setItem('kbase-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  const handleSearch = (query: string) => {
    if (query && !searchHistory.includes(query)) {
      const newHistory = [query, ...searchHistory].slice(0, 5);
      setSearchHistory(newHistory);
      localStorage.setItem('kbase-search-history', JSON.stringify(newHistory));
    }
  };

  const toggleBookmark = (sectionId: string) => {
    setBookmarks(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const markAsRead = (sectionId: string) => {
    setProgress(prev => ({
      ...prev,
      [sectionId]: true
    }));
  };

  const filteredTabs = useMemo(() => {
    if (!query) return null;

    const hints: Array<{ 
      when: string[]; 
      go: TabId; 
      label: string;
      priority: number;
    }> = [
      { 
        when: ["1нф", "2нф", "3нф", "bcnf", "нормал", "нормализация", "аномал"], 
        go: "normalization", 
        label: "Нормализация",
        priority: 1
      },
      { 
        when: ["ключ", "pk", "первич", "fk", "внешн", "unique", "uk"], 
        go: "theory", 
        label: "Ключи и связи",
        priority: 1
      },
      { 
        when: ["сущност", "entity", "атрибут", "attribute", "er-модель", "er модель"], 
        go: "theory", 
        label: "ER-модель",
        priority: 2
      },
      { 
        when: ["задач", "тест", "квиз", "тренаж", "практик", "упражнен"], 
        go: "tasks", 
        label: "Задачи",
        priority: 1
      },
      { 
        when: ["как", "инструк", "гайд", "пользоват", "руководств", "help"], 
        go: "guide", 
        label: "Руководство",
        priority: 1
      },
      { 
        when: ["книг", "стать", "литератур", "документ", "источник"], 
        go: "literature", 
        label: "Литература",
        priority: 2
      },
      { 
        when: ["денорм", "денормал", "оптимизац"], 
        go: "normalization", 
        label: "Денормализация",
        priority: 3
      },
    ];

    // Поиск по тегам вкладок
    const tagMatches = TABS.filter(t => 
      t.tags.some(tag => tag.toLowerCase().includes(query))
    );

    // Поиск по обычным подсказкам
    const hintMatches = hints
      .filter(h => h.when.some(w => query.includes(w)))
      .sort((a, b) => a.priority - b.priority);

    if (tagMatches.length > 0) {
      return {
        go: tagMatches[0].id,
        label: tagMatches[0].title,
        type: "tag" as const
      };
    }

    if (hintMatches.length > 0) {
      return {
        go: hintMatches[0].go,
        label: hintMatches[0].label,
        type: "hint" as const
      };
    }

    return null;
  }, [query]);

  const currentTabData = TABS.find(t => t.id === tab);

  return (
    <div className="relative w-full min-h-[calc(100vh-64px)] flex items-start justify-center px-4 py-10 overflow-y-auto">
      {/* фон */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        {/* light */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:hidden" />
        <div className="absolute -top-24 -left-24 h-[520px] w-[520px] rounded-full bg-indigo-500/15 blur-3xl dark:hidden" />
        <div className="absolute -bottom-28 -right-24 h-[560px] w-[560px] rounded-full bg-fuchsia-500/10 blur-3xl dark:hidden" />
        {/* dark */}
        <div className="hidden dark:block absolute inset-0 bg-gradient-to-b from-[#0b1220] via-[#0b1220] to-[#070b14]" />
        <div className="hidden dark:block absolute -top-24 -left-24 h-[520px] w-[520px] rounded-full bg-indigo-600/25 blur-3xl motion-safe:animate-pulse" />
        <div className="hidden dark:block absolute -bottom-28 -right-24 h-[560px] w-[560px] rounded-full bg-fuchsia-500/15 blur-3xl motion-safe:animate-pulse" />
        {/* subtle grid */}
        <div className="absolute inset-0 opacity-[0.12] dark:opacity-[0.18] bg-[linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="w-full max-w-6xl mx-auto">
        {/* HERO */}
        <div className="rounded-[28px] border border-indigo-200/70 dark:border-indigo-500/30 bg-white/70 dark:bg-gray-900/70 shadow-xl backdrop-blur p-6 sm:p-8 animate-fadeIn">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-indigo-700 dark:text-indigo-200">
                  База знаний SmartERD
                </h1>
                <Pill tone="indigo">теория + практика</Pill>
                <Pill tone="green">мини-тренажёр</Pill>
                <Pill tone="amber">интерактивно</Pill>
                <Pill tone="purple">персонализация</Pill>
              </div>
              
              <ProgressIndicator progress={progress} />
              
              <p className="mt-4 text-gray-700 dark:text-gray-300 max-w-2xl">
                Здесь собрано практически все, что нужно для работы со SmartERD: ключи, связи, нормальные формы, типовые ошибки,
                задачи с ответами и руководство пользователя по SmartERD.
              </p>
            </div>

            {/* Search */}
            <div className="w-full sm:w-[400px]">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">Расширенный поиск</label>
                <SearchScopeToggle scope={searchScope} onChange={setSearchScope} />
              </div>
              
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 px-3 py-2">
                <span className="text-gray-400 dark:text-gray-500">⌕</span>
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    if (e.target.value.trim()) {
                      handleSearch(e.target.value.trim().toLowerCase());
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && q.trim()) {
                      handleSearch(q.trim().toLowerCase());
                    }
                  }}
                  placeholder="Напр.: 3НФ, первичный ключ, FK, гайд…"
                  className="w-full bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition text-gray-700 dark:text-gray-300"
                    title="Очистить"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* История поиска */}
              {searchHistory.length > 0 && !q && (
                <div className="mt-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">История поиска:</div>
                  <div className="flex flex-wrap gap-1">
                    {searchHistory.slice(0, 3).map((term, idx) => (
                      <button
                        key={idx}
                        onClick={() => setQ(term)}
                        className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredTabs && (
                <button
                  type="button"
                  onClick={() => setTab(filteredTabs.go)}
                  className="mt-2 w-full text-left text-xs rounded-xl border border-indigo-200/70 dark:border-indigo-500/30 bg-indigo-600/10 dark:bg-indigo-500/10 px-3 py-2 hover:bg-indigo-600/15 dark:hover:bg-indigo-500/15 transition flex items-center justify-between group"
                >
                  <span className="text-gray-700 dark:text-gray-300">
                    {filteredTabs.type === "tag" ? "🏷️ По тегу" : "💡 Подсказка"}: 
                    <b className="ml-1 text-gray-900 dark:text-gray-100">{filteredTabs.label}</b>
                  </span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 dark:text-gray-400">→</span>
                </button>
              )}

              <div className="mt-4">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Уровень сложности:</div>
                <DifficultyToggle value={difficulty} onChange={setDifficulty} />
              </div>
            </div>
          </div>

          <Divider />

          {/* Tabs */}
          <div className="flex flex-nowrap overflow-x-auto gap-2 pb-1">
            {TABS.map((t) => {
              const active = t.id === tab;
              const bookmarked = bookmarks[t.id];
              
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cx(
                    "shrink-0 rounded-2xl px-4 py-3 border transition-all relative",
                    active
                      ? "border-indigo-300 dark:border-indigo-500/60 bg-indigo-600/10 dark:bg-indigo-500/20 shadow"
                      : "border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 hover:bg-white/70 dark:hover:bg-gray-900/70"
                  )}
                >
                  {bookmarked && (
                    <div className="absolute -top-1 -right-1 text-amber-500 dark:text-amber-400 text-xs">
                      ★
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3">
                    <div className={cx("text-xl", active && "animate-bob")}>{t.icon}</div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.title}</div>
                        <BookmarkButton
                          sectionId={t.id}
                          isBookmarked={bookmarked}
                          onToggle={() => toggleBookmark(t.id)}
                        />
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">{t.subtitle}</div>
                      
                      {/* Теги */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {t.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTENT */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fadeIn">
          {/* Left: main */}
          <div className="lg:col-span-2 space-y-4">
            {tab === "theory" && (
              <TheorySection 
                difficulty={difficulty} 
                onMarkAsRead={markAsRead}
                bookmarks={bookmarks}
                onToggleBookmark={toggleBookmark}
              />
            )}
            {tab === "normalization" && (
              <NormalizationSection 
                difficulty={difficulty} 
                onMarkAsRead={markAsRead}
                bookmarks={bookmarks}
                onToggleBookmark={toggleBookmark}
              />
            )}
            {tab === "tasks" && (
              <TasksSection 
                difficulty={difficulty} 
                onMarkAsRead={markAsRead}
                bookmarks={bookmarks}
                onToggleBookmark={toggleBookmark}
              />
            )}
            {tab === "literature" && (
              <LiteratureSection 
                difficulty={difficulty} 
                onMarkAsRead={markAsRead}
                bookmarks={bookmarks}
                onToggleBookmark={toggleBookmark}
              />
            )}
            {tab === "guide" && (
              <GuideSection 
                difficulty={difficulty} 
                onMarkAsRead={markAsRead}
                bookmarks={bookmarks}
                onToggleBookmark={toggleBookmark}
              />
            )}

            {/* Связанные темы */}
            {currentTabData && (
              <RelatedTopics 
                currentTopic={tab} 
                onNavigate={setTab}
              />
            )}
          </div>

          {/* Right: sticky tips */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-4 space-y-4">
              <Card
                title="Шпаргалка"
                desc="Ключевые определения и хоткеи для быстрого доступа."
              >
                <div className="space-y-3">
                  <div className="text-sm text-gray-800 dark:text-gray-200 space-y-2">
                    <li>• <b>PK</b> — уникально идентифицирует строку, не NULL.</li>
                    <li>• <b>FK</b> — ссылка на PK/UK другой таблицы.</li>
                    <li>• <b>1НФ</b> — атомарность значений, нет повторяющихся групп.</li>
                    <li>• <b>2НФ</b> — нет частичных зависимостей от части составного PK.</li>
                    <li>• <b>3НФ</b> — нет транзитивных зависимостей от PK.</li>
                  </div>
                  
                  <Divider />
                  
                  <div>
                    <div className="font-medium text-sm mb-2 text-gray-800 dark:text-gray-200">Визуализация связей:</div>
                    <div className="grid grid-cols-3 gap-2">
                      <RelationshipVisual type="1:1" />
                      <RelationshipVisual type="1:N" />
                      <RelationshipVisual type="N:M" />
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Хоткеи">
                <div className="text-sm text-gray-800 dark:text-gray-200 space-y-2">
                  <p>• <b>Ctrl/⌘ + Z</b> — Undo</p>
                  <p>• <b>Ctrl/⌘ + Y</b> или <b>Ctrl/⌘ + Shift + Z</b> — Redo</p>
                  <p>• <b>Del/Backspace</b> — удалить связь (если включено подтверждение — спросит)</p>
                  <p>• <b>Esc</b> — закрыть/выйти из режимов</p>
                  <p>• <b>Ctrl/⌘ + S</b> — сохранить проект</p>
                  <p>• <b>Ctrl/⌘ + F</b> — поиск по диаграмме</p>
                </div>
              </Card>

              {/* Закладки */}
              {Object.keys(bookmarks).filter(k => bookmarks[k]).length > 0 && (
                <Card
                  title="Закладки"
                  desc="Ваши сохраненные разделы"
                >
                  <div className="space-y-2">
                    {TABS.filter(t => bookmarks[t.id]).map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setTab(tab.id)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span>{tab.icon}</span>
                          <span className="text-sm text-gray-800 dark:text-gray-200">{tab.title}</span>
                        </div>
                        <span className="text-amber-500 dark:text-amber-400">★</span>
                      </button>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">
          SmartERD • База знаний — интерактивная обучающая система • Версия 2.0
        </div>
      </div>
    </div>
  );
}

function TheorySection({ 
  difficulty, 
  onMarkAsRead,
  bookmarks,
  onToggleBookmark
}: { 
  difficulty: Difficulty;
  onMarkAsRead: (id: string) => void;
  bookmarks: Record<string, boolean>;
  onToggleBookmark: (id: string) => void;
}) {
  const difficultyContent = {
    beginner: "Базовые понятия с простыми примерами",
    intermediate: "Детальное объяснение с реальными кейсами",
    advanced: "Углубленная теория и лучшие практики"
  };

  return (
    <div className="space-y-4">
      <Card
        title={`ER-модель: сущности, атрибуты, связи`}
        desc={difficultyContent[difficulty]}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => onMarkAsRead("theory-1")}
              className="text-xs px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/60"
            >
              ✓ Изучено
            </button>
            <BookmarkButton
              sectionId="theory-1"
              isBookmarked={bookmarks["theory-1"]}
              onToggle={() => onToggleBookmark("theory-1")}
            />
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/30 dark:to-gray-900/30">
              <div className="font-semibold text-blue-700 dark:text-blue-300">Сущность (Entity)</div>
              <div className="text-gray-600 dark:text-gray-300 mt-2 text-sm">
                Объект предметной области: <b>User</b>, <b>Order</b>, <b>Product</b>.
              </div>
              {difficulty === "advanced" && (
                <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  Типы: сильные (independent) и слабые (dependent)
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-gradient-to-br from-green-50 to-white dark:from-green-900/30 dark:to-gray-900/30">
              <div className="font-semibold text-green-700 dark:text-green-300">Атрибут (Attribute)</div>
              <div className="text-gray-600 dark:text-gray-300 mt-2 text-sm">
                Свойство сущности: <b>email</b>, <b>created_at</b>, <b>price</b>.
              </div>
              {difficulty === "advanced" && (
                <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                  Типы: простые, составные, производные, многозначные
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/30 dark:to-gray-900/30">
              <div className="font-semibold text-purple-700 dark:text-purple-300">Связи (Relationships)</div>
              <div className="text-gray-600 dark:text-gray-300 mt-2 text-sm space-y-1">
                <div>• <b>1:1</b> — один к одному</div>
                <div>• <b>1:N</b> — один ко многим</div>
                <div>• <b>N:M</b> — многие ко многим</div>
              </div>
            </div>
          </div>

          {difficulty === "intermediate" && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20">
              <div className="font-semibold text-amber-700 dark:text-amber-300">💡 Практический совет</div>
              <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                При проектировании начинайте с выявления сущностей и их атрибутов, 
                затем определяйте связи между ними. Не забывайте про кардинальность связей.
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Ключи: PK, UK, FK"
        desc="Ключи — основа целостности данных и корректных связей."
        right={
          <div className="flex items-center gap-2">
            <Pill tone="indigo">важно</Pill>
            <BookmarkButton
              sectionId="theory-2"
              isBookmarked={bookmarks["theory-2"]}
              onToggle={() => onToggleBookmark("theory-2")}
            />
          </div>
        }
      >
        <div className="space-y-3">
          <Reveal 
            title="Первичный ключ (PK)" 
            hint="Как понять, что это PK?"
            onReveal={() => onMarkAsRead("theory-pk")}
          >
            <ul className="space-y-2">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Уникально идентифицирует запись</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Не должен быть NULL (NOT NULL)</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Должен быть стабильным (не меняться со временем)</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Обычно один на таблицу (но бывают составные PK)</span>
              </li>
            </ul>
            
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Примеры:</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <div>• <b>users(id)</b> — суррогатный ключ</div>
                <div>• <b>orders(order_id)</b> — бизнес-ключ</div>
                <div>• <b>order_items(order_id, product_id)</b> — составной ключ</div>
              </div>
            </div>

            {difficulty === "advanced" && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Продвинутый уровень:</div>
                <div className="mt-1 text-sm text-blue-600 dark:text-blue-400">
                  Выбор между суррогатным и натуральным ключом зависит от требований бизнеса, 
                  производительности и возможности изменений.
                </div>
              </div>
            )}
          </Reveal>

          <Reveal 
            title="Уникальный ключ (UK)" 
            hint="Не PK, но тоже уникальность"
            onReveal={() => onMarkAsRead("theory-uk")}
          >
            <p className="text-gray-700 dark:text-gray-300">
              Обеспечивает уникальность значения(й) без роли "главного идентификатора". 
              Может быть NULL (если не указано иное).
            </p>
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Пример: <b>users(email)</b>, <b>products(sku)</b>, <b>employees(passport_number)</b>
              </div>
            </div>
          </Reveal>

          <Reveal 
            title="Внешний ключ (FK)" 
            hint="Ссылка на другую таблицу"
            onReveal={() => onMarkAsRead("theory-fk")}
          >
            <p className="text-gray-700 dark:text-gray-300">
              FK хранит значение PK/UK другой таблицы, обеспечивая ссылочную целостность.
            </p>
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <div>• <b>orders.user_id → users.id</b> — простая ссылка</div>
                <div>• <b>order_items.order_id → orders.id</b> — часть связи 1:N</div>
                <div>• <b>product_tags.product_id → products.id</b> — часть связи N:M</div>
              </div>
            </div>
            
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
              <div className="text-sm font-medium text-amber-700 dark:text-amber-300">💡 Важно:</div>
              <div className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                FK помогает гарантировать ссылочную целостность — нельзя ссылаться на несуществующую запись.
                Используйте ON DELETE и ON UPDATE для управления поведением.
              </div>
            </div>
          </Reveal>
        </div>
      </Card>

      {/* Интерактивный тест */}
      {difficulty !== "beginner" && (
        <Card
          title="Проверь себя"
          desc="Тест на понимание ключевых концепций"
          right={<Pill tone="purple">тест</Pill>}
        >
          <InteractiveQuiz
            question="Какой из следующих вариантов НЕ является обязательным свойством первичного ключа?"
            options={[
              { id: "1", text: "Уникальность" },
              { id: "2", text: "Не может быть NULL" },
              { id: "3", text: "Должен быть суррогатным (автоинкремент)" },
              { id: "4", text: "Стабильность (не должен меняться)" }
            ]}
            correctAnswer="3"
            explanation="Первичный ключ не обязательно должен быть суррогатным. Он может быть и натуральным (например, номер паспорта), главное — уникальность, NOT NULL и стабильность."
          />
        </Card>
      )}
    </div>
  );
}

function NormalizationSection({ 
  difficulty, 
  onMarkAsRead,
  bookmarks,
  onToggleBookmark
}: { 
  difficulty: Difficulty;
  onMarkAsRead: (id: string) => void;
  bookmarks: Record<string, boolean>;
  onToggleBookmark: (id: string) => void;
}) {
  const getContentForLevel = (level: string) => {
    switch(level) {
      case "beginner": return "Простые объяснения с понятными примерами";
      case "intermediate": return "Детальный разбор с реальными кейсами";
      case "advanced": return "Углубленный анализ, BCNF и денормализация";
      default: return "";
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="Нормальные формы — цель"
        desc={getContentForLevel(difficulty)}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => onMarkAsRead("norm-1")}
              className="text-xs px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/60"
            >
              ✓ Изучено
            </button>
            <BookmarkButton
              sectionId="norm-1"
              isBookmarked={bookmarks["norm-1"]}
              onToggle={() => onToggleBookmark("norm-1")}
            />
          </div>
        }
      >
        <div className="text-sm text-gray-800 dark:text-gray-200 space-y-4">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/30 dark:to-pink-900/30">
            <div className="font-semibold text-rose-700 dark:text-rose-300">Три аномалии, которые устраняет нормализация:</div>
            <ul className="mt-2 space-y-2">
              <li className="flex items-start">
                <span className="text-rose-500 mr-2">•</span>
                <span className="text-gray-700 dark:text-gray-300"><b>Вставки</b> — нельзя добавить факт без лишних данных</span>
              </li>
              <li className="flex items-start">
                <span className="text-rose-500 mr-2">•</span>
                <span className="text-gray-700 dark:text-gray-300"><b>Обновления</b> — одно и то же приходится менять в нескольких местах</span>
              </li>
              <li className="flex items-start">
                <span className="text-rose-500 mr-2">•</span>
                <span className="text-gray-700 dark:text-gray-300"><b>Удаления</b> — удаляя одно, случайно теряешь другое</span>
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Reveal 
              title="1НФ (первая нормальная форма)" 
              hint="Атомарность + нет повторяющихся групп"
              defaultOpen
              onReveal={() => onMarkAsRead("norm-1nf")}
            >
              <div className="space-y-2">
                <div className="text-gray-700 dark:text-gray-300">
                  <b>Требования:</b>
                </div>
                <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                  <li>• Значения в ячейке — атомарные (не списки)</li>
                  <li>• Нет повторяющихся групп столбцов</li>
                  <li>• Все записи имеют одинаковую структуру</li>
                </ul>
                
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Пример нарушения:</div>
                  <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                    <b>Плохо:</b> users(id, name, phones) где phones = "+7..., +7..."
                  </div>
                  <div className="text-sm font-medium mt-2 text-gray-700 dark:text-gray-300">Решение:</div>
                  <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                    <b>Хорошо:</b> users(id, name) + user_phones(user_id, phone)
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal 
              title="2НФ" 
              hint="Только для таблиц с составным PK"
              onReveal={() => onMarkAsRead("norm-2nf")}
            >
              <div className="text-gray-700 dark:text-gray-300 space-y-2">
                <p>
                  Нет <b>частичных</b> зависимостей неключевых атрибутов от части составного PK.
                </p>
                
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Пример:</div>
                  <div className="text-xs mt-1 text-blue-600 dark:text-blue-400">
                    PK = <b>(order_id, product_id)</b><br/>
                    Атрибут <b>order_date</b> зависит только от <b>order_id</b><br/>
                    → Выносим в таблицу <b>orders</b>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal 
              title="3НФ" 
              hint="Убираем транзитивные зависимости"
              onReveal={() => onMarkAsRead("norm-3nf")}
            >
              <div className="text-gray-700 dark:text-gray-300 space-y-2">
                <p>
                  Неключевые атрибуты не должны зависеть от других неключевых атрибутов.
                </p>
                
                <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                  <div className="text-sm font-medium text-green-700 dark:text-green-300">Пример:</div>
                  <div className="text-xs mt-1 text-green-600 dark:text-green-400">
                    <b>orders(order_id, customer_id, customer_city)</b><br/>
                    customer_city зависит от customer_id → вынести в <b>customers</b>
                  </div>
                </div>
              </div>
            </Reveal>

            {difficulty === "advanced" && (
              <Reveal 
                title="BCNF (усиленная 3НФ)" 
                hint="Строже: любой детерминант — ключ"
                onReveal={() => onMarkAsRead("norm-bcnf")}
              >
                <div className="text-gray-700 dark:text-gray-300 space-y-2">
                  <p>
                    Если <b>X → Y</b>, то <b>X</b> должен быть суперключом.
                  </p>
                  <p>
                    Часто возникает в таблицах с несколькими кандидатными ключами.
                  </p>
                  
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                    <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Пример нарушения:</div>
                    <div className="text-xs mt-1 text-purple-600 dark:text-purple-400">
                      <b>classes(teacher, subject, classroom)</b><br/>
                      Предположение: один учитель ведет один предмет<br/>
                      Ключи: (teacher, subject), (teacher, classroom)<br/>
                      Зависимость: subject → classroom (но subject не ключ)
                    </div>
                  </div>
                </div>
              </Reveal>
            )}
          </div>

          {difficulty === "advanced" && (
            <Reveal 
              title="Денормализация" 
              hint="Когда нарушать нормальные формы"
              onReveal={() => onMarkAsRead("norm-denorm")}
            >
              <div className="text-gray-700 dark:text-gray-300 space-y-3">
                <p>
                  <b>Денормализация</b> — сознательное нарушение нормальных форм для оптимизации производительности.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                    <div className="font-medium text-amber-700 dark:text-amber-300">Когда применять:</div>
                    <ul className="mt-1 text-xs space-y-1 text-amber-600 dark:text-amber-400">
                      <li>• Частые сложные JOIN-запросы</li>
                      <li>• Очень большие объемы данных</li>
                      <li>• Требования к скорости чтения</li>
                      <li>• Data warehouse / аналитические системы</li>
                    </ul>
                  </div>
                  
                  <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-lg">
                    <div className="font-medium text-rose-700 dark:text-rose-300">Риски:</div>
                    <ul className="mt-1 text-xs space-y-1 text-rose-600 dark:text-rose-400">
                      <li>• Аномалии данных</li>
                      <li>• Сложность обновлений</li>
                      <li>• Повышенные требования к хранилищу</li>
                      <li>• Необходимость поддержки согласованности</li>
                    </ul>
                  </div>
                </div>
                
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <div className="text-sm font-medium text-blue-700 dark:text-blue-300">💡 Рекомендация:</div>
                  <div className="text-xs mt-1 text-blue-600 dark:text-blue-400">
                    Сначала проектируйте в 3НФ/BCNF, затем измеряйте производительность. 
                    Денормализуйте только там, где это действительно необходимо, и документируйте причины.
                  </div>
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </Card>

      <Card
        title="Практический совет"
        desc="Нормализация — это инструмент. Иногда допустима денормализация ради скорости, но осознанно."
        right={<Pill tone="gray">практика</Pill>}
      >
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <b>Золотое правило:</b> "Сначала проектируем в 3НФ, затем при необходимости денормализуем под нагрузку, 
          сохраняя целостность через триггеры или логику приложения."
        </div>
        
        {difficulty === "intermediate" && (
          <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
            <div className="text-sm font-medium text-green-700 dark:text-green-300">💡 Стратегия:</div>
            <div className="text-xs mt-1 text-green-600 dark:text-green-400">
              1. Проектируйте в 3НФ<br/>
              2. Профилируйте запросы<br/>
              3. Денормализуйте только "горячие" данные<br/>
              4. Используйте материализованные представления<br/>
              5. Регулярно проверяйте актуальность денормализации
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function TasksSection({ 
  difficulty, 
  onMarkAsRead,
  bookmarks,
  onToggleBookmark
}: { 
  difficulty: Difficulty;
  onMarkAsRead: (id: string) => void;
  bookmarks: Record<string, boolean>;
  onToggleBookmark: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card 
        title="Задачи — первичный ключ" 
        desc="Потренируем выбор PK/UK/FK на понятных кейсах."
        right={
          <div className="flex items-center gap-2">
            <BookmarkButton
              sectionId="tasks-1"
              isBookmarked={bookmarks["tasks-1"]}
              onToggle={() => onToggleBookmark("tasks-1")}
            />
          </div>
        }
      >
        <div className="space-y-4">
          <Reveal 
            title="Задача 1: Пользователи" 
            hint="Выбери лучший PK"
            onReveal={() => onMarkAsRead("task-1")}
          >
            <div className="space-y-3">
              <p className="text-gray-700 dark:text-gray-300">
                Таблица <b>users</b> содержит: email, phone, name, created_at. Какой PK выбрать?
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="font-medium text-sm text-gray-800 dark:text-gray-200">Вариант A:</div>
                  <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">email как PK</div>
                </div>
                <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="font-medium text-sm text-gray-800 dark:text-gray-200">Вариант B:</div>
                  <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">phone как PK</div>
                </div>
                <div className="p-3 border border-blue-200 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                  <div className="font-medium text-sm text-blue-700 dark:text-blue-300">Вариант C:</div>
                  <div className="text-xs mt-1 text-blue-600 dark:text-blue-400">id (суррогатный)</div>
                </div>
              </div>
              
              <Divider />
              
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                <div className="font-medium text-green-700 dark:text-green-300">Ответ:</div>
                <div className="text-sm mt-1 text-gray-700 dark:text-gray-300">
                  Лучше завести суррогатный PK <b>id</b>, а <b>email</b> сделать UK. 
                  Почему? Email может меняться, телефон может быть не у всех или меняться, 
                  а суррогатный id — стабильный и простой в использовании для связей.
                </div>
              </div>
              
              {difficulty === "advanced" && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Продвинутый контекст:</div>
                  <div className="text-xs mt-1 text-blue-600 dark:text-blue-400">
                    В распределенных системах рассмотрите UUID вместо автоинкремента для 
                    упрощения шардинга и избежания конфликтов при репликации.
                  </div>
                </div>
              )}
            </div>
          </Reveal>

          <Reveal 
            title="Задача 2: Заказ и позиции" 
            hint="Как реализовать N:M?"
            onReveal={() => onMarkAsRead("task-2")}
          >
            <div className="space-y-3">
              <p className="text-gray-700 dark:text-gray-300">
                Есть <b>orders</b> и <b>products</b>. Один заказ содержит много товаров, 
                и товар встречается в разных заказах. Как хранить?
              </p>
              
              <div className="flex items-center justify-center my-4">
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-8">
                    <div className="p-3 border border-blue-200 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                      <div className="font-medium text-gray-800 dark:text-gray-200">orders</div>
                      <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">id, total, date</div>
                    </div>
                    <div className="text-2xl text-gray-700 dark:text-gray-300">↔</div>
                    <div className="p-3 border border-green-200 dark:border-green-700 rounded-lg bg-green-50 dark:bg-green-900/30">
                      <div className="font-medium text-gray-800 dark:text-gray-200">products</div>
                      <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">id, name, price</div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">Как связать?</div>
                </div>
              </div>
              
              <Divider />
              
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                <div className="font-medium text-green-700 dark:text-green-300">Ответ:</div>
                <div className="text-sm mt-1 text-gray-700 dark:text-gray-300">
                  Нужна таблица-связка <b>order_items</b> со структурой:
                </div>
                <div className="mt-2 text-xs bg-white dark:bg-gray-800 p-2 rounded text-gray-700 dark:text-gray-300">
                  order_items(<br/>
                  &nbsp;&nbsp;id PK,<br/>
                  &nbsp;&nbsp;order_id FK → orders.id,<br/>
                  &nbsp;&nbsp;product_id FK → products.id,<br/>
                  &nbsp;&nbsp;quantity INTEGER,<br/>
                  &nbsp;&nbsp;price_at_order DECIMAL<br/>
                  )
                </div>
                <div className="text-sm mt-2 text-gray-700 dark:text-gray-300">
                  PK может быть суррогатный <b>id</b> + UK на пару <b>(order_id, product_id)</b>.
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Card>

      <Card 
        title="Задачи — нормальные формы" 
        desc="Короткие кейсы: определить нарушение и исправить."
        right={
          <div className="flex items-center gap-2">
            <BookmarkButton
              sectionId="tasks-2"
              isBookmarked={bookmarks["tasks-2"]}
              onToggle={() => onToggleBookmark("tasks-2")}
            />
          </div>
        }
      >
        <div className="space-y-4">
          <Reveal 
            title="Задача 3: Нарушение 1НФ" 
            hint="Где нарушение?"
            onReveal={() => onMarkAsRead("task-3")}
          >
            <div className="space-y-3">
              <p className="text-gray-700 dark:text-gray-300">
                Таблица <b>customers(id, name, phones)</b>, где phones = "+7..., +7...".
              </p>
              
              <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-lg">
                <div className="font-medium text-rose-700 dark:text-rose-300">Проблема:</div>
                <div className="text-sm mt-1 text-rose-600 dark:text-rose-400">
                  Нарушение 1НФ: неатомарные значения в столбце phones.
                </div>
              </div>
              
              <Divider />
              
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                <div className="font-medium text-green-700 dark:text-green-300">Решение:</div>
                <div className="text-sm mt-1 text-gray-700 dark:text-gray-300">
                  Создать отдельную таблицу для телефонов:
                </div>
                <div className="mt-2 text-xs bg-white dark:bg-gray-800 p-2 rounded text-gray-700 dark:text-gray-300">
                  customers(<br/>
                  &nbsp;&nbsp;id PK,<br/>
                  &nbsp;&nbsp;name VARCHAR<br/>
                  )<br/><br/>
                  customer_phones(<br/>
                  &nbsp;&nbsp;id PK,<br/>
                  &nbsp;&nbsp;customer_id FK → customers.id,<br/>
                  &nbsp;&nbsp;phone VARCHAR<br/>
                  )
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal 
            title="Задача 4: Нарушение 3НФ" 
            hint="Транзитивная зависимость"
            onReveal={() => onMarkAsRead("task-4")}
          >
            <div className="space-y-3">
              <p className="text-gray-700 dark:text-gray-300">
                Таблица <b>orders(id, user_id, user_email, total)</b>. В чём проблема?
              </p>
              
              <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                <div className="font-medium text-amber-700 dark:text-amber-300">Анализ:</div>
                <div className="text-sm mt-1 text-amber-600 dark:text-amber-400">
                  user_email зависит от user_id (неключевой → неключевой), что создает 
                  транзитивную зависимость и нарушает 3НФ.
                </div>
              </div>
              
              <Divider />
              
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                <div className="font-medium text-green-700 dark:text-green-300">Решение:</div>
                <div className="text-sm mt-1 text-gray-700 dark:text-gray-300">
                  Вынести email в таблицу users:
                </div>
                <div className="mt-2 text-xs bg-white dark:bg-gray-800 p-2 rounded text-gray-700 dark:text-gray-300">
                  orders(<br/>
                  &nbsp;&nbsp;id PK,<br/>
                  &nbsp;&nbsp;user_id FK → users.id,<br/>
                  &nbsp;&nbsp;total DECIMAL<br/>
                  )<br/><br/>
                  users(<br/>
                  &nbsp;&nbsp;id PK,<br/>
                  &nbsp;&nbsp;email VARCHAR UNIQUE<br/>
                  )
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Card>

      {/* Интерактивный тест */}
      <Card
        title="Интерактивный тренажёр"
        desc="Проверь свои знания на практике"
        right={<Pill tone="purple">интерактивно</Pill>}
      >
        <div className="space-y-4">
          <InteractiveQuiz
            question="Какая нормальная форма требует, чтобы все неключевые атрибуты зависели ТОЛЬКО от первичного ключа, а не от других неключевых атрибутов?"
            options={[
              { id: "1", text: "1НФ (первая нормальная форма)" },
              { id: "2", text: "2НФ (вторая нормальная форма)" },
              { id: "3", text: "3НФ (третья нормальная форма)" },
              { id: "4", text: "Все перечисленные" }
            ]}
            correctAnswer="3"
            explanation="Третья нормальная форма (3НФ) требует устранения транзитивных зависимостей. В 3НФ неключевые атрибуты должны зависеть только от первичного ключа, а не от других неключевых атрибутов."
          />
          
          <InteractiveQuiz
            question="В таблице 'OrderItems(order_id, product_id, product_name, quantity)' есть нарушение 2НФ. Почему?"
            options={[
              { id: "1", text: "Потому что есть составной первичный ключ" },
              { id: "2", text: "Потому что product_name зависит только от product_id, а не от всего PK" },
              { id: "3", text: "Потому что quantity не является атомарным значением" },
              { id: "4", text: "Потому что нет внешних ключей" }
            ]}
            correctAnswer="2"
            explanation="Верно! product_name зависит только от части составного первичного ключа (product_id), а не от всей пары (order_id, product_id). Это нарушение 2НФ, которое устраняется выносом product_name в таблицу Products."
          />
        </div>
      </Card>
    </div>
  );
}

function LiteratureSection({ 
  difficulty, 
  onMarkAsRead,
  bookmarks,
  onToggleBookmark
}: { 
  difficulty: Difficulty;
  onMarkAsRead: (id: string) => void;
  bookmarks: Record<string, boolean>;
  onToggleBookmark: (id: string) => void;
}) {
  const getLiteratureByLevel = () => {
    const base = [
      {
        title: "Elmasri & Navathe",
        desc: "Fundamentals of Database Systems — ER, нормализация, проектирование.",
        level: "all" as const
      },
      {
        title: "Silberschatz et al.",
        desc: "Database System Concepts — теория + практика на SQL.",
        level: "all" as const
      },
      {
        title: "C.J. Date",
        desc: "An Introduction to Database Systems — классика реляционной теории.",
        level: "intermediate" as const
      },
      {
        title: "Martin Kleppmann",
        desc: "Designing Data-Intensive Applications — современные подходы к проектированию.",
        level: "advanced" as const
      }
    ];
    
    return base.filter(item => 
      item.level === "all" || 
      (difficulty === "intermediate" && item.level === "intermediate") ||
      (difficulty === "advanced" && (item.level === "intermediate" || item.level === "advanced"))
    );
  };

  return (
    <div className="space-y-4">
      <Card
        title="Книги"
        desc="Классика. Базовые понятия и углублённое понимание."
        right={
          <div className="flex items-center gap-2">
            <Pill tone="gray">классика</Pill>
            <BookmarkButton
              sectionId="lit-1"
              isBookmarked={bookmarks["lit-1"]}
              onToggle={() => onToggleBookmark("lit-1")}
            />
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {getLiteratureByLevel().map((book, idx) => (
            <div 
              key={idx}
              className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-900/20 dark:to-gray-900/20 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onMarkAsRead(`book-${idx}`)}
            >
              <div className="font-semibold text-gray-900 dark:text-gray-100">{book.title}</div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-2">{book.desc}</div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300">
                  {book.level === "all" ? "Все уровни" : book.level === "intermediate" ? "Средний+" : "Продвинутый"}
                </span>
                <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  Подробнее →
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card 
        title="Онлайн-источники" 
        desc="Документация и справочные материалы (удобно для ссылок)."
        right={
          <BookmarkButton
            sectionId="lit-2"
            isBookmarked={bookmarks["lit-2"]}
            onToggle={() => onToggleBookmark("lit-2")}
          />
        }
      >
        <div className="grid grid-cols-1 gap-3">
          <KbLink
            href="https://www.postgresql.org/docs/"
            title="PostgreSQL Documentation"
            desc="Официальная документация: ограничения, индексы, внешние ключи, каскады."
          />
          <KbLink
            href="https://dev.mysql.com/doc/"
            title="MySQL Documentation"
            desc="Официальная документация MySQL."
          />
          <KbLink
            href="https://learn.microsoft.com/en-us/sql/"
            title="Microsoft SQL Server docs"
            desc="Официальные материалы по MS SQL Server."
          />
          <KbLink
            href="https://en.wikipedia.org/wiki/Database_normalization"
            title="Database normalization (Wikipedia)"
            desc="Быстрый обзор нормальных форм (как справка)."
          />
          
          {difficulty === "advanced" && (
            <KbLink
              href="https://www.cidrdb.org/"
              title="CIDR Conference Proceedings"
              desc="Передовые исследования в области баз данных."
            />
          )}
        </div>
      </Card>

      <Card
        title="Курсы и обучение"
        desc="Онлайн-курсы для разных уровней подготовки."
      >
        <div className="space-y-3">
          <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
            <div className="font-medium text-gray-800 dark:text-gray-200">Coursera: Database Design</div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
              Стэнфордский курс по проектированию баз данных, покрывает ER-модели и нормализацию.
            </div>
          </div>
          
          <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
            <div className="font-medium text-gray-800 dark:text-gray-200">Udemy: Advanced SQL</div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
              Практический курс с акцентом на оптимизацию запросов и продвинутые техники.
            </div>
          </div>
          
          {difficulty === "advanced" && (
            <div className="p-3 border border-purple-200 dark:border-purple-700 rounded-lg bg-purple-50 dark:bg-purple-900/30">
              <div className="font-medium text-purple-700 dark:text-purple-300">CMU: Database Systems</div>
              <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Продвинутый курс от Carnegie Mellon University, покрывающий внутреннее устройство СУБД.
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function GuideSection({ 
  difficulty, 
  onMarkAsRead,
  bookmarks,
  onToggleBookmark
}: { 
  difficulty: Difficulty;
  onMarkAsRead: (id: string) => void;
  bookmarks: Record<string, boolean>;
  onToggleBookmark: (id: string) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { title: "Создание сущностей", icon: "➕" },
    { title: "Добавление атрибутов", icon: "⚙️" },
    { title: "Создание связей", icon: "🔗" },
    { title: "Проверка и валидация", icon: "✓" },
    { title: "Экспорт и сохранение", icon: "💾" },
  ];

  return (
    <div className="space-y-4">
      <Card
        title="Руководство пользователя SmartERD"
        desc="Как быстро сделать диаграмму, проверить, экспортировать и получить SQL."
        right={
          <div className="flex items-center gap-2">
            <Pill tone="green">user guide</Pill>
            <BookmarkButton
              sectionId="guide-1"
              isBookmarked={bookmarks["guide-1"]}
              onToggle={() => onToggleBookmark("guide-1")}
            />
          </div>
        }
      >
        <div className="space-y-4">
          {/* Шаги */}
          <div className="relative">
            <div className="flex justify-between mb-4">
              {steps.map((step, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={cx(
                    "flex flex-col items-center w-20",
                    idx <= currentStep ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"
                  )}
                >
                  <div className={cx(
                    "w-10 h-10 rounded-full flex items-center justify-center text-lg mb-1 transition-all",
                    idx === currentStep 
                      ? "bg-indigo-100 dark:bg-indigo-900/50 border-2 border-indigo-500 dark:border-indigo-400"
                      : idx < currentStep
                      ? "bg-green-100 dark:bg-green-900/50 border-2 border-green-500 dark:border-green-400"
                      : "bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600"
                  )}>
                    {step.icon}
                  </div>
                  <span className="text-xs text-center">{step.title}</span>
                </button>
              ))}
            </div>
            
            {/* Линия прогресса */}
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200 dark:bg-gray-700 -z-10">
              <div 
                className="h-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-300"
                style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
              />
            </div>
          </div>

          {/* Контент шагов */}
          <div className="min-h-[200px]">
            {currentStep === 0 && (
              <Reveal title="1) Создание сущностей" defaultOpen onReveal={() => onMarkAsRead("guide-step1")}>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Нажмите кнопку <b>Сущность</b> на панели инструментов</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Кликните по холсту — появится новая сущность</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Двойной клик по названию — переименование</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Перетаскивайте сущности для удобного расположения</span>
                  </li>
                </ul>
                
                {difficulty === "beginner" && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300">💡 Совет для новичков:</div>
                    <div className="text-xs mt-1 text-blue-600 dark:text-blue-400">
                      Начните с главных сущностей вашей предметной области (например, User, Product, Order).
                    </div>
                  </div>
                )}
              </Reveal>
            )}
            
            {currentStep === 1 && (
              <Reveal title="2) Добавление атрибутов" onReveal={() => onMarkAsRead("guide-step2")}>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Нажмите на иконку <b>⚙️</b> в карточке сущности</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Откроется панель редактирования атрибутов</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Добавьте имя атрибута, выберите тип данных</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Отметьте <b>PK</b> для первичного ключа, <b>UQ</b> для уникального</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Нажмите <b>⚙️</b> еще раз для выхода из режима</span>
                  </li>
                </ul>
              </Reveal>
            )}
            
            {currentStep === 2 && (
              <Reveal title="3) Создание связей" onReveal={() => onMarkAsRead("guide-step3")}>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Нажмите кнопку <b>Связь</b> на панели инструментов (режим линковки)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Кликните по первой сущности, затем по второй</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Тип связи можно менять через меню на лейбле связи</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Для связи N:M создается автоматически таблица-связка</span>
                  </li>
                </ul>
                
                <div className="mt-3 flex items-center justify-center">
                  <RelationshipVisual type="1:N" />
                </div>
              </Reveal>
            )}
            
            {currentStep === 3 && (
              <Reveal title="4) Проверка и валидация" onReveal={() => onMarkAsRead("guide-step4")}>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Панель подсказок показывает ошибки/предупреждения</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Нажимайте "Показать на диаграмме" для навигации</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Проверка нормализации: доступны действия "применить"</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Используйте режим валидации для комплексной проверки</span>
                  </li>
                </ul>
              </Reveal>
            )}
            
            {currentStep === 4 && (
              <Reveal title="5) Экспорт и сохранение" onReveal={() => onMarkAsRead("guide-step5")}>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300"><b>Экспорт</b> — JSON/PNG/SVG (через модалку экспорта)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300"><b>Импорт</b> — загрузите JSON для продолжения работы</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300"><b>SQL</b> — генерация кода для разных диалектов</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-700 dark:text-gray-300">Авторизованные пользователи: <b>Сохранить</b> в "Личном кабинете"</span>
                  </li>
                </ul>
                
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="p-2 border border-gray-200 dark:border-gray-700 rounded text-center bg-white dark:bg-gray-800">
                    <div className="text-lg text-gray-700 dark:text-gray-300">📄</div>
                    <div className="text-xs mt-1 text-gray-700 dark:text-gray-300">JSON</div>
                  </div>
                  <div className="p-2 border border-gray-200 dark:border-gray-700 rounded text-center bg-white dark:bg-gray-800">
                    <div className="text-lg text-gray-700 dark:text-gray-300">🖼️</div>
                    <div className="text-xs mt-1 text-gray-700 dark:text-gray-300">PNG</div>
                  </div>
                  <div className="p-2 border border-gray-200 dark:border-gray-700 rounded text-center bg-white dark:bg-gray-800">
                    <div className="text-lg text-gray-700 dark:text-gray-300">📊</div>
                    <div className="text-xs mt-1 text-gray-700 dark:text-gray-300">SQL</div>
                  </div>
                </div>
              </Reveal>
            )}
          </div>

          {/* Навигация по шагам */}
          <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className={cx(
                "px-4 py-2 rounded-lg border transition-colors",
                currentStep === 0
                  ? "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              )}
            >
              ← Назад
            </button>
            
            <button
              onClick={() => {
                if (currentStep < steps.length - 1) {
                  setCurrentStep(prev => prev + 1);
                }
              }}
              className={cx(
                "px-4 py-2 rounded-lg transition-colors",
                currentStep === steps.length - 1
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-indigo-500 hover:bg-indigo-600 text-white"
              )}
            >
              {currentStep === steps.length - 1 ? "Готово! 🎉" : "Далее →"}
            </button>
          </div>
        </div>
      </Card>

      <Card
        title="AI Панель и Генерация SQL"
        desc="Используйте искусственный интеллект для помощи в проектировании."
        className="bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-900/30 dark:to-pink-900/30"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-purple-200 dark:border-purple-700 rounded-xl bg-white/50 dark:bg-gray-900/40">
            <div className="font-medium text-purple-700 dark:text-purple-300">🤖 AI Панель</div>
            <ul className="mt-2 text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>• Чат-помощник по проектированию</li>
              <li>• Генерация ER-модели по описанию</li>
              <li>• Анализ существующей модели</li>
              <li>• Предложения по улучшению</li>
            </ul>
          </div>
          
          <div className="p-4 border border-blue-200 dark:border-blue-700 rounded-xl bg-white/50 dark:bg-gray-900/40">
            <div className="font-medium text-blue-700 dark:text-blue-300">💾 SQL Генерация</div>
            <ul className="mt-2 text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>• Автоматическая генерация DDL</li>
              <li>• Поддержка PostgreSQL, MySQL, SQLite</li>
              <li>• Опции для разных диалектов SQL</li>
              <li>• Копирование в буфер обмена</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-lg">
          <div className="text-sm font-medium text-amber-700 dark:text-amber-300">💡 Профессиональный совет:</div>
          <div className="text-xs mt-1 text-amber-600 dark:text-amber-400">
            Используйте AI панель для быстрого старта, но всегда проверяйте и дорабатывайте 
            результат вручную. Генерация SQL — отличный способ получить основу для миграций.
          </div>
        </div>
      </Card>
    </div>
  );
}