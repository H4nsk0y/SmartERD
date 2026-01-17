import { useEffect } from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import { useAppStore } from "./store/useAppStore";
import { useTranslation } from "react-i18next";
import EditorPage from "./pages/EditorPage";
import AIPage from "./pages/AIPage";

import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import AccountPage from "./pages/AccountPage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";


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
      <header className="shrink-0 w-full flex flex-col items-center gap-2 py-2">
        <nav className="flex gap-6 text-lg font-semibold">
          <Link to="/" className="text-indigo-700 dark:text-indigo-300 hover:underline">
            {t("nav.home")}
          </Link>

          <Link to="/editor" className="text-indigo-700 dark:text-indigo-300 hover:underline">
            {t("nav.editor")}
          </Link>

          <Link to="/ai" className="text-indigo-700 dark:text-indigo-300 hover:underline">
            {t("nav.ai")}
          </Link>
          
          <Link to="/kb" className="text-indigo-700 dark:text-indigo-300 hover:underline">
            {t("nav.kb")}
          </Link>

           <Link to="/settings" className="text-indigo-700 dark:text-indigo-300 hover:underline">
            {t("nav.settings")}
          </Link>

          {/* ОДНА кнопка/ссылка вместо "Вход/Регистрация" */}
          <Link to="/account" className="text-indigo-700 dark:text-indigo-300 hover:underline">
            {t("nav.account", { defaultValue: "Личный кабинет" })}
          </Link>
        </nav>
      </header>

      <main className="flex-1 w-full min-h-0 flex overflow-hidden">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/editor/:projectId" element={<EditorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/ai" element={<AIPage />} />
          <Route path="/kb" element={<KnowledgeBasePage />} />

          {/* auth */}
          <Route path="/account" element={<AccountPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
              