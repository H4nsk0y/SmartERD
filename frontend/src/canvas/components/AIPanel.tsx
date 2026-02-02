// frontend/src/canvas/components/AIPanel.tsx
/**
 * canvas/components/AIPanel
 * Панель AI-помощника: чат и генерация ER.
 */
import { useState } from "react";
import { aiChat, aiGenerateER, type ChatMessage } from "../../api/ai";
import { useERStore } from "../../store/useERStore";

export default function AIPanel({ className = "" }: { className?: string }) {
  // чат
  const [chatIn, setChatIn] = useState("");
  const [chatOut, setChatOut] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatErr, setChatErr] = useState<string | null>(null);

  // генерация ER
  const [erIn, setErIn] = useState("");
  const [erBusy, setErBusy] = useState(false);
  const [erErr, setErErr] = useState<string | null>(null);

  const setDiagramData = useERStore(s => s.setDiagramData);

  async function sendChat() {
    if (!chatIn.trim()) return;
    setChatBusy(true);
    setChatErr(null);
    setChatOut("");
    try {
      const messages: ChatMessage[] = [{ role: "user", content: chatIn.trim() }];
      const r = await aiChat(messages);
      setChatOut(r);
    } catch (e: any) {
      setChatErr(e?.message || "Ошибка запроса");
    } finally {
      setChatBusy(false);
    }
  }

  async function generateER() {
    if (!erIn.trim()) return;
    setErBusy(true);
    setErErr(null);
    try {
      const { entities, relationships } = await aiGenerateER(erIn.trim());
      setDiagramData(entities, relationships);
    } catch (e: any) {
      setErErr(e?.message || "Ошибка генерации");
    } finally {
      setErBusy(false);
    }
  }

  return (
    <aside
      className={[
        "w-[420px] min-w-[360px] max-w-[520px]",
        "border-l border-black/20 dark:border-white/10",
        "bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-xl",
        "flex flex-col min-h-0",
        className,
      ].join(" ")}
    >
      {/* Заголовок панели с градиентом */}
      <div className="shrink-0 p-4 border-b border-black/10 dark:border-white/10 bg-gradient-to-r from-indigo-100/90 to-purple-100/90 dark:from-indigo-950/70 dark:to-purple-950/70">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-black/5 text-gray-900 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white">
            🤖
          </span>
          <div className="min-w-0">
            <div className="text-lg font-extrabold text-gray-900 dark:text-white">AI-помощник</div>
            <div className="text-sm text-gray-700 dark:text-white/60">Чат и генерация ER-диаграмм</div>
          </div>
        </div>
      </div>

      {/* Основной контент с прокруткой */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
        {/* Секция чата */}
        <div className="rounded-[24px] border border-black/15 bg-white/90 p-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.1)] backdrop-blur-sm dark:border-white/15 dark:bg-gray-800/90">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">💬</span>
            <div className="font-extrabold text-gray-900 dark:text-white">AI Чат</div>
            <span className="ml-auto text-xs px-2 py-1 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 text-indigo-800 dark:text-indigo-200">
              Умные ответы
            </span>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <textarea
                value={chatIn}
                onChange={(e) => setChatIn(e.target.value)}
                placeholder="Спроси что-нибудь о структуре базы данных, нормализации, SQL оптимизации..."
                className="w-full min-h-[120px] p-4 rounded-2xl border border-black/15 bg-white/80 text-gray-900 dark:border-white/15 dark:bg-gray-700/80 dark:text-white placeholder-gray-600 dark:placeholder-white/40 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:focus:ring-indigo-400/40 resize-none"
              />
              <div className="absolute bottom-3 right-3 text-xs text-gray-600 dark:text-white/50">
                {chatIn.length}/2000
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={sendChat}
                disabled={chatBusy || !chatIn.trim()}
                className={`
                  group relative flex-1 px-5 py-3 rounded-2xl text-sm font-bold text-white
                  transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg
                  ${chatBusy || !chatIn.trim()
                    ? "bg-gradient-to-r from-gray-400 to-gray-500 dark:from-gray-700 dark:to-gray-800 cursor-not-allowed"
                    : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-indigo-500/30"
                  }
                `}
              >
                <span className="flex items-center justify-center gap-2">
                  {chatBusy ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                      <span>Отправка...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-base">🚀</span>
                      <span>Отправить запрос</span>
                    </>
                  )}
                </span>
              </button>

              <button
                onClick={() => { setChatIn(""); setChatOut(""); setChatErr(null); }}
                className="px-5 py-3 rounded-2xl text-sm font-bold border border-black/15 bg-white/80 text-gray-900 dark:border-white/15 dark:bg-gray-700/80 dark:text-white hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 hover:scale-[1.02] shadow-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">↺</span>
                  Сбросить
                </span>
              </button>
            </div>

            {chatErr && (
              <div className="rounded-2xl border border-red-300 bg-red-100/90 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/40 dark:text-red-100">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚠️</span>
                  <span className="font-semibold">Ошибка:</span>
                  <span>{chatErr}</span>
                </div>
              </div>
            )}

            {chatOut && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">🤖</span>
                  <div className="font-semibold text-gray-900 dark:text-white">Ответ AI:</div>
                </div>
                <div className="p-4 rounded-2xl border border-black/10 bg-black/[0.03] text-sm text-gray-800 dark:border-white/10 dark:bg-gray-700/80 dark:text-white/90 whitespace-pre-wrap leading-relaxed">
                  {chatOut}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Секция генерации ER */}
        <div className="rounded-[24px] border border-black/15 bg-white/90 p-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.1)] backdrop-blur-sm dark:border-white/15 dark:bg-gray-800/90">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">✨</span>
            <div className="font-extrabold text-gray-900 dark:text-white">Генерация ER-диаграммы</div>
            <span className="ml-auto text-xs px-2 py-1 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 text-amber-800 dark:text-amber-200">
              Бета-функция
            </span>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <textarea
                value={erIn}
                onChange={(e) => setErIn(e.target.value)}
                placeholder="Опишите предметную область:
• Интернет-магазин с пользователями, товарами, корзиной
• Блог с постами, комментариями, категориями
• Система бронирования отелей с комнатами, гостями, бронями"
                className="w-full min-h-[140px] p-4 rounded-2xl border border-black/15 bg-white/80 text-gray-900 dark:border-white/15 dark:bg-gray-700/80 dark:text-white placeholder-gray-600 dark:placeholder-white/40 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:focus:ring-indigo-400/40 resize-none"
              />
              <div className="absolute bottom-3 right-3 text-xs text-gray-600 dark:text-white/50">
                {erIn.length}/3000
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={generateER}
                disabled={erBusy || !erIn.trim()}
                className={`
                  group relative flex-1 px-5 py-3 rounded-2xl text-sm font-bold text-white
                  transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg
                  ${erBusy || !erIn.trim()
                    ? "bg-gradient-to-r from-gray-400 to-gray-500 dark:from-gray-700 dark:to-gray-800 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/30"
                  }
                `}
                title="Сгенерировать диаграмму и вставить в редактор"
              >
                <span className="flex items-center justify-center gap-2">
                  {erBusy ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                      <span>Генерация...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-base">⚡</span>
                      <span>Сгенерировать ER-диаграмму</span>
                    </>
                  )}
                </span>
              </button>

              <button
                onClick={() => { setErIn(""); setErErr(null); }}
                className="px-5 py-3 rounded-2xl text-sm font-bold border border-black/15 bg-white/80 text-gray-900 dark:border-white/15 dark:bg-gray-700/80 dark:text-white hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 hover:scale-[1.02] shadow-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">🗑️</span>
                  Очистить
                </span>
              </button>
            </div>

            {erErr && (
              <div className="rounded-2xl border border-red-300 bg-red-100/90 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/40 dark:text-red-100">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚠️</span>
                  <span className="font-semibold">Ошибка генерации:</span>
                  <span>{erErr}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Статусная строка */}
      <div className="shrink-0 px-4 py-2.5 text-xs text-gray-600 dark:text-white/50 border-t border-black/15 dark:border-white/15 bg-white/70 dark:bg-gray-800/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
              <span>AI готов к работе</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 text-[11px]">
              GPT-4 Turbo
            </span>
          </div>
          <div className="text-[11px] opacity-70">
            SmartERD AI • v1.0
          </div>
        </div>
      </div>
    </aside>
  );
}