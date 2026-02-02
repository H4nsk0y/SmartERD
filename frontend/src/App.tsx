import { useEffect } from "react";
import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
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
  const location = useLocation();

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") html.classList.add("dark");
    else html.classList.remove("dark");
  }, [theme]);

 
  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };


  const navItems = [
    { 
      path: "/", 
      label: t("nav.home"), 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    { 
      path: "/editor", 
      label: t("nav.editor"), 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      )
    },
    { 
      path: "/ai", 
      label: t("nav.ai"), 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    { 
      path: "/kb", 
      label: t("nav.kb"), 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    { 
      path: "/settings", 
      label: t("nav.settings"), 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    { 
      path: "/account", 
      label: t("nav.account", { defaultValue: "Личный кабинет" }), 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
  ];

  return (
    <div className="h-screen w-full flex flex-col">
      <header className="shrink-0 w-full bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 backdrop-blur-sm border-b border-indigo-100/50 dark:border-indigo-900/20 py-3">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex flex-wrap justify-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  group relative flex items-center gap-2 px-5 py-2.5 rounded-lg 
                  transition-all duration-300 hover:scale-[1.02] text-base
                  ${isActive(item.path) 
                    ? "text-indigo-950 dark:text-white font-semibold shadow-lg" 
                    : "text-indigo-700 dark:text-indigo-300 hover:bg-white/50 dark:hover:bg-indigo-900/20 hover:shadow"
                  }
                `}
              >
                {isActive(item.path) && (
                  <div className="absolute inset-0 rounded-lg backdrop-blur-md bg-gradient-to-r from-white/70 to-white/40 dark:from-white/10 dark:to-white/5 border border-white/60 dark:border-white/20 shadow-inner"></div>
                )}
                
                <span className="relative z-10 text-indigo-600 dark:text-indigo-300">
                  {item.icon}
                </span>
                <span className="relative z-10 font-medium whitespace-nowrap">{item.label}</span>
                {isActive(item.path) && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-gradient-to-r from-indigo-400 to-purple-400 dark:from-indigo-300 dark:to-purple-300 rounded-full"></span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full overflow-y-auto">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/editor/:projectId" element={<EditorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/ai" element={<AIPage />} />
          <Route path="/kb" element={<KnowledgeBasePage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="shrink-0 py-2 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4">
          SmartERD © {new Date().getFullYear()} • Простой редактор ER-диаграмм
        </div>
      </footer>
    </div>
  );
}

export default App;