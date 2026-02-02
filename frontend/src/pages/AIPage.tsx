import React, { useEffect, useMemo, useRef, useState } from "react";
import { aiChat, type ChatMessage } from "../api/ai";

type UiMsg = {
  role: "user" | "assistant";
  content: string;
  ts: number;
};

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

function Svg({
  children,
  className = "",
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <svg
      viewBox="0 0 24 24"
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
  bot: (
    <Svg>
      <path d="M12 8V4" />
      <path d="M9 4h6" />
      <rect x="6" y="8" width="12" height="12" rx="3" />
      <path d="M9 13h.01" />
      <path d="M15 13h.01" />
      <path d="M9 17c1.5 1 4.5 1 6 0" />
    </Svg>
  ),
  user: (
    <Svg>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </Svg>
  ),
  send: (
    <Svg>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4z" />
    </Svg>
  ),
  trash: (
    <Svg>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Svg>
  ),
  erase: (
    <Svg>
      <path d="M20 20H8l-4-4 10-10 8 8-6 6" />
      <path d="M6 16l6 4" />
    </Svg>
  ),
  copy: (
    <Svg>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  ),
  spark: (
    <Svg>
      <path d="M12 2l1.3 4.1L17 7l-3.7.9L12 12l-1.3-4.1L7 7l3.7-.9L12 2z" />
      <path d="M19 13l.9 2.8L23 17l-3.1.7L19 21l-.9-3.3L15 17l3.1-1.2L19 13z" />
    </Svg>
  ),
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function StatusDot({ busy }: { busy: boolean }) {
  return (
    <span className="relative inline-flex items-center gap-2">
      <span className="relative">
        <span
          className={classNames(
            "absolute inline-flex h-3 w-3 rounded-full opacity-60",
            busy ? "bg-violet-400 motion-safe:animate-ping" : "bg-emerald-400 motion-safe:animate-ping"
          )}
        />
        <span
          className={classNames(
            "relative inline-flex h-3 w-3 rounded-full",
            busy ? "bg-violet-500" : "bg-emerald-500"
          )}
        />
      </span>
      <span className="text-xs text-white/60 dark:text-white/60">{busy ? "Обрабатываю…" : "Готов к диалогу"}</span>
    </span>
  );
}

function PromptChip({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-white/75 text-xs transition active:scale-[0.98] shadow-sm"
      title="Вставить в поле"
    >
      {text}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="mt-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/25 p-3 overflow-auto text-xs leading-relaxed shadow-inner">
      <code className="text-slate-800 dark:text-white/85 whitespace-pre font-mono">
        {code}
      </code>
    </pre>
  );
}

function RenderMessage({ content }: { content: string }) {
  const parts = useMemo(() => {
    const out: Array<{ t: "text" | "code"; v: string }> = [];
    const s = content ?? "";
    const re = /```([\s\S]*?)```/g;
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = re.exec(s))) {
      const start = m.index;
      const end = re.lastIndex;
      if (start > last) out.push({ t: "text", v: s.slice(last, start) });
      out.push({ t: "code", v: (m[1] ?? "").replace(/^\s*\n/, "") });
      last = end;
    }
    if (last < s.length) out.push({ t: "text", v: s.slice(last) });
    return out.length ? out : [{ t: "text", v: s }];
  }, [content]);

  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
      {parts.map((p, i) =>
        p.t === "code" ? (
          <CodeBlock key={i} code={p.v} />
        ) : (
          <span key={i} className="text-slate-800 dark:text-white/85">
            {p.v}
          </span>
        )
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="inline-flex gap-1">
        <span className="h-2 w-2 rounded-full bg-slate-500 dark:bg-white/60 motion-safe:animate-[aiDot_1.1s_ease-in-out_infinite]" />
        <span className="h-2 w-2 rounded-full bg-slate-500 dark:bg-white/60 motion-safe:animate-[aiDot_1.1s_ease-in-out_infinite_0.15s]" />
        <span className="h-2 w-2 rounded-full bg-slate-500 dark:bg-white/60 motion-safe:animate-[aiDot_1.1s_ease-in-out_infinite_0.3s]" />
      </span>
      <span className="text-xs text-slate-500 dark:text-white/60">Печатает…</span>
    </div>
  );
}

function Bubble({
  role,
  content,
  isLastAssistant,
  onCopy,
  ts,
}: {
  role: UiMsg["role"];
  content: string;
  isLastAssistant: boolean;
  onCopy?: () => void;
  ts: number;
}) {
  const isUser = role === "user";

  return (
    <div
      className={classNames(
        "w-full flex",
        isUser ? "justify-end" : "justify-start",
        "motion-safe:animate-[fadeUp_180ms_ease-out]"
      )}
      title={new Date(ts).toLocaleString()}
    >
      <div className={classNames("max-w-[92%] sm:max-w-[78%] flex items-start gap-3", isUser && "flex-row-reverse")}>
    
        <div
          className={classNames(
            "shrink-0 h-9 w-9 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur flex items-center justify-center shadow-sm",
            isUser ? "text-indigo-600 dark:text-indigo-200" : "text-violet-600 dark:text-violet-200"
          )}
        >
          {isUser ? Icons.user : Icons.bot}
        </div>


        <div
          className={classNames(
            "relative rounded-2xl px-4 py-3 border backdrop-blur shadow-sm",
            isUser
              ? "bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-600/45 dark:to-violet-600/35 border-indigo-100 dark:border-white/10"
              : "bg-white/80 dark:bg-white/5 border-slate-200 dark:border-white/10",
            isLastAssistant && !isUser ? "ring-1 ring-violet-300/30 shadow-md" : ""
          )}
        >
   
          {!isUser && onCopy && (
            <button
              type="button"
              onClick={onCopy}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-600 dark:text-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md"
              aria-label="Скопировать ответ"
              title="Скопировать"
            >
              {Icons.copy}
            </button>
          )}

          <RenderMessage content={content} />
        </div>
      </div>
    </div>
  );
}

function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">

      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:hidden" />
      <div className="absolute -top-28 -left-28 w-[560px] h-[560px] rounded-full bg-indigo-500/15 blur-3xl dark:hidden motion-safe:animate-[floatSlow_7s_ease-in-out_infinite]" />
      <div className="absolute -bottom-28 -right-28 w-[620px] h-[620px] rounded-full bg-fuchsia-500/10 blur-3xl dark:hidden motion-safe:animate-[floatSlow_9s_ease-in-out_infinite]" />
      
      <div className="hidden dark:block absolute inset-0 bg-gradient-to-b from-[#0b1220] via-[#0b1220] to-[#070b14]" />
      <div className="hidden dark:block absolute -top-28 -left-28 w-[560px] h-[560px] rounded-full bg-indigo-600/25 blur-3xl motion-safe:animate-[floatSlow_7s_ease-in-out_infinite]" />
      <div className="hidden dark:block absolute -bottom-28 -right-28 w-[620px] h-[620px] rounded-full bg-fuchsia-500/15 blur-3xl motion-safe:animate-[floatSlow_9s_ease-in-out_infinite]" />

      <div className="absolute inset-0 opacity-[0.12] dark:opacity-[0.18]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>
      
      <div className="absolute inset-0 opacity-30 dark:hidden bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.08),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.06),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(56,189,248,0.04),transparent_40%)]" />

      <div className="hidden dark:block absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.22),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.18),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(56,189,248,0.12),transparent_40%)]" />
    </div>
  );
}

export default function AIPage() {
  const [messages, setMessages] = useState<UiMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const theme = useTheme();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const r = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const prompts = useMemo(
    () => [
      "Расскажи о современных подходах к проектированию баз данных",
      "Какие инструменты для моделирования данных сейчас популярны? ",
      "В чем основные различия между SQL и NoSQL базами",
      "Объясни принципы нормализации баз данных простыми словами",
    ],
    []
  );

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    setErr(null);
    setBusy(true);

    const userMsg: UiMsg = { role: "user", content: text, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    try {
      const ctx = [...messages, userMsg].slice(-16).map(
        (m): ChatMessage => ({
          role: m.role,
          content: m.content,
        })
      );

      const reply = await aiChat(ctx);

      setMessages((m) => [
        ...m,
        { role: "assistant", content: reply, ts: Date.now() },
      ]);
    } catch (e: any) {
      setErr(e?.message || "Ошибка запроса");
    } finally {
      setBusy(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setErr(null);
  };

  const clearInput = () => {
    setInput("");
    setErr(null);
  };

  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  const copyLastAssistant = async () => {
    const idx = lastAssistantIndex;
    if (idx < 0) return;
    const text = messages[idx].content || "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {

    }
  };

  return (
    <div className="relative w-full min-h-screen overflow-y-auto">
      <Background />
      
 
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatSlow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes aiDot { 0%,100% { transform: translateY(0); opacity: .45 } 50% { transform: translateY(-3px); opacity: 1 } }
        @keyframes shimmer { 0% { transform: translateX(-40%); } 100% { transform: translateX(140%); } }
      `}</style>

      <div className="relative w-full max-w-6xl mx-auto px-4 py-10">
        <div className={classNames(
          "rounded-[32px] border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] shadow-2xl backdrop-blur-xl p-6 md:p-8",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
          "transition-all duration-500"
        )}>

          <div className="pointer-events-none absolute top-0 left-0 right-0 h-[3px]">
            <div className="h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-80" />
            <div className="h-full blur-md bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-70" />
          </div>
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-stretch">
            <div className="lg:w-[360px] shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-violet-600 dark:text-violet-200 flex items-center justify-center shadow-sm">
                    {Icons.spark}
                  </div>
                  <div>
                    <div className="text-slate-900 dark:text-white text-lg font-semibold">AI помощник</div>
                    <div className="mt-1">
                      <StatusDot busy={busy} />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={copyLastAssistant}
                  disabled={lastAssistantIndex < 0}
                  className="h-10 w-10 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-white/80 flex items-center justify-center transition shadow-sm disabled:opacity-40"
                  title="Скопировать последний ответ"
                  aria-label="Скопировать последний ответ"
                >
                  {Icons.copy}
                </button>
              </div>

              <div className={classNames(
                "mt-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-4 shadow-sm",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                "transition-all duration-500 delay-100"
              )}>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Быстрые запросы</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {prompts.map((p, i) => (
                    <PromptChip
                      key={i}
                      text={p}
                      onClick={() => setInput((cur) => (cur ? cur + "\n\n" + p : p))}
                    />
                  ))}
                </div>
              </div>

              <details className={classNames(
                "mt-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-4 shadow-sm",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                "transition-all duration-500 delay-150"
              )}>
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900 dark:text-white">
                  Как использовать
                </summary>
                <div className="mt-3 space-y-3 text-sm text-slate-600 dark:text-white/70 leading-relaxed">
                  <div>
                    1) Задай любой вопрос по базам данных, SQL или проектированию. 
                  </div>
                  <div>
                    2) Приложи код или модель, если нужен анализ конкретного примера
                  </div>
                  <div>
                    3) Пиши код как есть — AI поймет, но для лучшего форматирования используй ```.
                  </div>
                </div>
              </details>

              {err && (
                <div className={classNames(
                  "mt-4 rounded-2xl border border-red-300 dark:border-red-400/30 bg-red-50/80 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200",
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                  "transition-all duration-500 delay-200"
                )}>
                  {err}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className={classNames(
                "rounded-[28px] border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden flex flex-col min-h-[560px]",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
                "transition-all duration-500 delay-100"
              )}>
                <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 bg-white/50 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-white/80">
                    <span className="h-9 w-9 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-violet-600 dark:text-violet-200 shadow-sm">
                      {Icons.bot}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">Диалог</div>
                      <div className="text-xs text-slate-500 dark:text-white/55">
                        Enter — отправить, Shift+Enter — новая строка
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={clearInput}
                      className="h-10 w-10 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-white/80 flex items-center justify-center transition shadow-sm"
                      title="Сброс поля"
                      aria-label="Сброс поля"
                    >
                      {Icons.erase}
                    </button>
                    <button
                      type="button"
                      onClick={clearChat}
                      className="h-10 w-10 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-white/80 flex items-center justify-center transition shadow-sm"
                      title="Очистить чат"
                      aria-label="Очистить чат"
                    >
                      {Icons.trash}
                    </button>
                  </div>
                </div>

                <div
                  ref={scrollRef}
                  className="flex-1 overflow-auto px-4 py-4 space-y-3"
                >
                  {messages.length === 0 ? (
                    <div className={classNames(
                      "rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-5 text-sm text-slate-600 dark:text-white/70 shadow-sm",
                      mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                      "transition-all duration-500"
                    )}>
                      Напиши запрос снизу. Можешь начать с одного из быстрых шаблонов слева.
                    </div>
                  ) : (
                    <div className="space-y-3 group">
                      {messages.map((m, i) => (
                        <Bubble
                          key={m.ts + "_" + i}
                          role={m.role}
                          content={m.content}
                          ts={m.ts}
                          isLastAssistant={i === lastAssistantIndex}
                          onCopy={
                            m.role === "assistant"
                              ? async () => {
                                  try {
                                    await navigator.clipboard.writeText(m.content || "");
                                  } catch {
                                  }
                                }
                              : undefined
                          }
                        />
                      ))}

                      {busy && (
                        <div className="w-full flex justify-start">
                          <div className="max-w-[92%] sm:max-w-[78%] flex items-start gap-3">
                            <div className="shrink-0 h-9 w-9 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-violet-600 dark:text-violet-200 flex items-center justify-center shadow-sm">
                              {Icons.bot}
                            </div>
                            <div className="rounded-2xl px-4 py-3 border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 shadow-sm">
                              <TypingIndicator />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 dark:border-white/10 p-3 bg-white/50 dark:bg-white/[0.03]">
                  <div className="relative">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      placeholder="Спроси про ER, SQL, нормализацию или генерацию модели…"
                      className="w-full h-28 resize-none rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white/90 placeholder:text-slate-400 dark:placeholder:text-white/40 p-4 pr-14 outline-none focus:ring-2 focus:ring-indigo-300/40 dark:focus:ring-violet-300/40 shadow-sm transition"
                    />

                    <button
                      type="button"
                      onClick={send}
                      disabled={busy || !input.trim()}
                      className={classNames(
                        "absolute right-3 bottom-3 h-11 w-11 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center justify-center transition active:scale-[0.98] shadow-sm",
                        busy || !input.trim()
                          ? "bg-white/80 dark:bg-white/5 text-slate-400 dark:text-white/30"
                          : "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-violet-700"
                      )}
                      aria-label="Отправить"
                      title="Отправить"
                    >

                      {!busy && input.trim() && (
                        <span className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
                          <span className="absolute -left-12 top-0 h-full w-16 rotate-12 bg-white/20 blur-md opacity-0 hover:opacity-100 transition motion-safe:animate-[shimmer_2.2s_linear_infinite]" />
                        </span>
                      )}
                      <span className="relative">{Icons.send}</span>
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500 dark:text-white/45">
                      История сообщений скроллится внутри окна чата.
                    </div>
                    <div className="text-xs text-slate-500 dark:text-white/45">
                      {busy ? "Запрос выполняется…" : "Готово"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pointer-events-none relative mt-4">
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[86%] h-10 blur-2xl bg-indigo-500/20 dark:bg-violet-500/20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}