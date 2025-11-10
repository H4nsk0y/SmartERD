import React, { useState, useRef, useEffect } from "react";
import { aiChat, type ChatMessage } from "../api/ai";

export default function AIPage() {
  // простая история: user → assistant
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // автопрокрутка вниз после добавления сообщения
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setErr(null);
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");

    try {
      const req: ChatMessage[] = [{ role: "user", content: text }];
      const reply = await aiChat(req);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e: any) {
      setErr(e?.message || "Ошибка запроса");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 w-full flex justify-center items-stretch">
      <div className="flex flex-col w-full max-w-3xl px-4 py-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          AI помощник
        </h2>

        {/* Карточка с историей сообщений — фиксированная высота, скролл внутри */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-0 flex flex-col overflow-hidden">
          {/* История */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-[320px] max-h-[60vh] overflow-auto divide-y divide-gray-200 dark:divide-gray-700"
          >
            {messages.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                Напишите запрос в поле ниже и нажмите «Отправить».
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className="p-4">
                  <div
                    className={
                      m.role === "user"
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-800 dark:text-gray-200"
                    }
                  >
                    <div className="text-xs opacity-60 mb-1">
                      {m.role === "user" ? "Вы" : "Модель"}
                    </div>
                    <div className="whitespace-pre-wrap break-words">
                      {m.content}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Поле ввода + действия */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Спросите что-нибудь…"
              className="w-full h-28 p-2 rounded border dark:bg-gray-900 dark:text-gray-100"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={send}
                disabled={busy || !input.trim()}
                className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-60"
              >
                {busy ? "Отправка…" : "Отправить"}
              </button>
              <button
                onClick={() => { setInput(""); setErr(null); }}
                className="px-3 py-2 rounded border"
              >
                Сброс поля
              </button>
              <button
                onClick={() => { setMessages([]); setErr(null); }}
                className="px-3 py-2 rounded border"
              >
                Очистить чат
              </button>
            </div>
            {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
          </div>
        </div>

        {/* Подсказка */}
        <div className="mt-3 text-xs opacity-70 text-gray-600 dark:text-gray-400">
          Длинные ответы не раздвигают страницу — прокрутите область истории.
        </div>
      </div>
    </div>
  );
}
