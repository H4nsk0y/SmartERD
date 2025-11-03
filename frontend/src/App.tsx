import { useEffect } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { useAppStore } from "./store/useAppStore";
import { useTranslation } from "react-i18next";
import EditorPage from "./pages/EditorPage";

function App() {
  const { theme, setTheme, language, setLanguage } = useAppStore();
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
      {/* шапка не растягивается по высоте */}
      <header className="shrink-0 flex flex-col items-center gap-6 py-6">
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

        <div className="flex gap-4">
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
      </header>

      {/* ГЛАВНОЕ: этот main отдаёт всю оставшуюся высоту странице редактора */}
      <main className="flex-1 w-full min-h-0 flex overflow-hidden">
        <Routes>
          <Route path="/" element={<Home t={t} />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/settings" element={<Settings t={t} />} />
          <Route path="/ai" element={<AIHelper t={t} />} />
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

function Settings({ t }: { t: any }) {
  return <h2 className="m-auto text-2xl font-semibold text-gray-800 dark:text-gray-200">{t("settings.title")}</h2>;
}

function AIHelper({ t }: { t: any }) {
  return <h2 className="m-auto text-2xl font-semibold text-gray-800 dark:text-gray-200">{t("ai.title")}</h2>;
}

export default App;
