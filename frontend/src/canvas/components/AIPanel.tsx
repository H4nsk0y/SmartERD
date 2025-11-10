import React, { useState } from "react";
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
        "w-[420px] min-w-[360px] max-w-[520px] border-l border-gray-300 dark:border-gray-700",
        "bg-white dark:bg-gray-900",
        "flex flex-col min-h-0", // важно: без скролла у панели, только у контента
        className,
      ].join(" ")}
    >
      {/* header */}
      <div className="shrink-0 px-3 py-2 border-b border-gray-200 dark:border-gray-800">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">AI-помощник</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Чат и генерация ER</div>
      </div>

      {/* content — отдельный скролл */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-12 pb-4 space-y-12">
        {/* ЧАТ */}
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-800 dark:text-gray-100">
            Чат
          </div>
          <div className="p-3 space-y-2">
            <textarea
              value={chatIn}
              onChange={(e) => setChatIn(e.target.value)}
              placeholder="Спроси у модели…"
              className="w-full min-h-[84px] p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={sendChat}
                disabled={chatBusy || !chatIn.trim()}
                className={[
                  "inline-flex items-center justify-center gap-2",
                  "h-9 px-3 rounded-lg text-sm font-medium",
                  "bg-indigo-600 text-white disabled:opacity-60"
                ].join(" ")}
              >
                {chatBusy ? (
                  <>
                    <GifLoader />
                    <span>Отправка…</span>
                  </>
                ) : (
                  "Отправить"
                )}
              </button>

              <button
                onClick={() => { setChatIn(""); setChatOut(""); setChatErr(null); }}
                className={[
                  "h-9 px-3 rounded-lg text-sm font-medium",
                  // светлая/тёмная тема — видно всегда
                  "border border-gray-300 dark:border-gray-700",
                  "bg-white text-gray-800 dark:bg-gray-900 dark:text-gray-100"
                ].join(" ")}
              >
                Сброс
              </button>
            </div>

            {chatErr && <div className="text-xs text-red-600">{chatErr}</div>}
            {chatOut && (
              <div className="mt-1 p-2 rounded-lg border border-gray-200 dark:border-gray-800 text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                {chatOut}
              </div>
            )}
          </div>
        </section>

        {/* ER */}
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-800 dark:text-gray-100">
            Генерация ER
          </div>
          <div className="p-3 space-y-2">
            <textarea
              value={erIn}
              onChange={(e) => setErIn(e.target.value)}
              placeholder="Опиши предметную область, например: интернет-магазин с пользователями, товарами, корзиной и заказами…"
              className="w-full min-h-[96px] p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={generateER}
                disabled={erBusy || !erIn.trim()}
                className={[
                  "inline-flex items-center justify-center gap-2",
                  "h-9 px-3 rounded-lg text-sm font-medium",
                  "bg-indigo-600 text-white disabled:opacity-60"
                ].join(" ")}
                title="Сгенерировать диаграмму и вставить в редактор"
              >
                {erBusy ? (
                  <>
                    <GifLoader />
                    <span>Генерируется…</span>
                  </>
                ) : (
                  "Сгенерировать и вставить"
                )}
              </button>

              <button
                onClick={() => { setErIn(""); setErErr(null); }}
                className={[
                  "h-9 px-3 rounded-lg text-sm font-medium",
                  "border border-gray-300 dark:border-gray-700",
                  "bg-white text-gray-800 dark:bg-gray-900 dark:text-gray-100"
                ].join(" ")}
              >
                Очистить поле
              </button>
            </div>

            {erErr && <div className="text-xs text-red-600">{erErr}</div>}

            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              После генерации переключись на вкладку «Editor» — диаграмма уже вставлена.
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}

function GifLoader() {
  // грузим из public: /loader.gif
  return <img src="/loader.gif" alt="" className="h-4 w-4" />;
}

