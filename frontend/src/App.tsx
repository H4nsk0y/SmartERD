import React, { useEffect } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { useAppStore } from "./store/useAppStore";
import { useTranslation } from "react-i18next";
import EditorPage from "./pages/EditorPage";
import AIPage from "./pages/AIPage";

function App() {
  const { theme, language } = useAppStore();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") html.classList.add("dark");
    else html.classList.remove("dark");
  }, [theme]);

  return (
    <div className="h-screen w-full flex flex-col items-center overflow-hidden">
      {/* Шапка */}
      <header className="shrink-0 w-full flex flex-col items-center gap-2 py-2">
        <nav className="flex gap-6 text-lg font-semibold">
          <Link to="/" className="text-indigo-700 dark:text-indigo-300 hover:underline">
            {t("nav.home")}
          </Link>
          <Link to="/editor" className="text-indigo-700 dark:text-indigo-300 hover:underline">
            {t("nav.editor")}
          </Link>
          <Link to="/settings" className="text-indigo-700 dark:text-indigo-300 hover:underline">
            {t("nav.settings")}
          </Link>
          <Link to="/ai" className="text-indigo-700 dark:text-indigo-300 hover:underline">
            {t("nav.ai")}
          </Link>
        </nav>
      </header>

      {/* Область страниц */}
      <main className="flex-1 w-full min-h-0 flex overflow-hidden">
        <Routes>
          <Route path="/" element={<Home t={t} />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/settings" element={<Settings t={t} />} />
          <Route path="/ai" element={<AIPage />} />
        </Routes>
      </main>
    </div>
  );
}

function Home({ t }: { t: any }) {
  return (
    <div className="m-auto p-10 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl text-center transition-colors duration-500">
      <h1 className="text-4xl font-extrabold text-indigo-700 dark:text-indigo-300">SmartERD</h1>
      <p className="text-gray-700 dark:text-gray-300 mt-4 text-lg">{t("home.welcome")}</p>
    </div>
  );
}

/** Временная страница настроек (без выноса в отдельный файл) */
function Settings({ t }: { t: any }) {
  const {
    language, setLanguage,
    theme, setTheme,
    compactToolbar, setCompactToolbar,
    defaultShowSqlPanel, setDefaultShowSqlPanel,
    defaultShowMinimap, setDefaultShowMinimap,
    confirmDelete, setConfirmDelete,
    resetSettings
  } = useAppStore();

  return (
    <div className="m-auto w-full max-w-3xl px-4 py-6">
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">{t("settings.title")}</h2>

      {/* Раздел: Внешний вид */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            {t("settings.sections.appearance")}
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">{t("settings.appearance.theme")}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme("light")}
                  className={`px-3 py-1 rounded border ${theme === "light" ? "bg-indigo-600 text-white border-indigo-600" : "bg-transparent text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600"}`}
                >
                  {t("settings.appearance.light")}
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`px-3 py-1 rounded border ${theme === "dark" ? "bg-indigo-600 text-white border-indigo-600" : "bg-transparent text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600"}`}
                >
                  {t("settings.appearance.dark")}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">{t("settings.appearance.language")}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setLanguage("ru")}
                  className={`px-3 py-1 rounded border ${language === "ru" ? "bg-indigo-600 text-white border-indigo-600" : "bg-transparent text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600"}`}
                >
                  RU
                </button>
                <button
                  onClick={() => setLanguage("en")}
                  className={`px-3 py-1 rounded border ${language === "en" ? "bg-indigo-600 text-white border-indigo-600" : "bg-transparent text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600"}`}
                >
                  EN
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">{t("settings.appearance.compactToolbar")}</span>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={compactToolbar}
                  onChange={(e) => setCompactToolbar(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-gray-300 peer-checked:bg-indigo-600 rounded-full relative transition">
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-4" />
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Раздел: Редактор */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            {t("settings.sections.editor")}
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">{t("settings.editor.sqlPanelDefault")}</span>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={defaultShowSqlPanel}
                  onChange={(e) => setDefaultShowSqlPanel(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-gray-300 peer-checked:bg-indigo-600 rounded-full relative transition">
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-4" />
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">{t("settings.editor.minimapDefault")}</span>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={defaultShowMinimap}
                  onChange={(e) => setDefaultShowMinimap(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-gray-300 peer-checked:bg-indigo-600 rounded-full relative transition">
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-4" />
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">{t("settings.editor.confirmDelete")}</span>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmDelete}
                  onChange={(e) => setConfirmDelete(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-gray-300 peer-checked:bg-indigo-600 rounded-full relative transition">
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-4" />
                </div>
              </label>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {t("settings.hint")}
        </p>
        <button
          onClick={() => resetSettings()}
          className="px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          {t("settings.reset")}
        </button>
      </div>
    </div>
  );
}

export default App;
