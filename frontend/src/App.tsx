import { useEffect } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { useAppStore } from "./store/useAppStore";
import { useTranslation } from "react-i18next";
import EditorPage from "./pages/EditorPage";


function App() {
  const { theme, setTheme, language, setLanguage } = useAppStore();
  const { t, i18n } = useTranslation();

  // При смене языка обновляем i18next
  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  // При смене темы обновляем класс
  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") html.classList.add("dark");
    else html.classList.remove("dark");
  }, [theme]);

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center
      bg-gradient-to-br from-blue-100 via-indigo-100 to-indigo-200
      dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-500`}
    >
      {/* Навигация */}
      <nav className="flex gap-6 text-lg font-semibold mb-8">
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

      {/* Кнопки */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setLanguage(language === "ru" ? "en" : "ru")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition"
        >
          {t("buttons.changeLang")}
        </button>

        <button
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg shadow hover:bg-gray-800 transition"
        >
          {theme === "light" ? t("buttons.dark") : t("buttons.light")}
        </button>
      </div>

      {/* Основное содержимое */}
      <Routes>
        <Route path="/" element={<Home t={t} />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/settings" element={<Settings t={t} />} />
        <Route path="/ai" element={<AIHelper t={t} />} />
      </Routes>
    </div>
  );
}

/* ---------- Главная ---------- */
function Home({ t }: { t: any }) {
  return (
    <div className="p-10 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl text-center transition-colors duration-500">
      <h1 className="text-4xl font-extrabold text-indigo-700 dark:text-indigo-300">SmartERD</h1>
      <p className="text-gray-700 dark:text-gray-300 mt-4 text-lg">{t("home.welcome")}</p>
    </div>
  );
}

/* ---------- Редактор ---------- */
function Editor({ t }: { t: any }) {
  return <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">{t("editor.title")}</h2>;
}

/* ---------- Настройки ---------- */
function Settings({ t }: { t: any }) {
  return <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">{t("settings.title")}</h2>;
}

/* ---------- AI Помощник ---------- */
function AIHelper({ t }: { t: any }) {
  return <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">{t("ai.title")}</h2>;
}

export default App;
