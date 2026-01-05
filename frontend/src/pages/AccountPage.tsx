import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/useAuthStore";

export default function AccountPage() {
  const { t } = useTranslation();
  const nav = useNavigate();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const projects = useAuthStore((s) => s.projects);
  const logout = useAuthStore((s) => s.logout);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const initials =
    (user?.name || "U")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join("") || "U";

  return (
    <div className="m-auto w-full max-w-3xl px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 transition-colors duration-500">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-extrabold">
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
              {t("account.title", { defaultValue: "Личный кабинет" })}
            </h1>
            <div className="mt-1 text-gray-700 dark:text-gray-300">
              <span className="font-semibold">{user?.name}</span>{" "}
              <span className="opacity-70">({user?.email})</span>
            </div>
          </div>

          <button
            onClick={() => {
              logout();
              nav("/login");
            }}
            className="shrink-0 px-4 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            {t("account.logout", { defaultValue: "Выйти" })}
          </button>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {t("account.projects", { defaultValue: "Проекты" })}
            </h2>

            <button
              onClick={() => nav("/editor")}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              {t("account.newProject", { defaultValue: "Новый проект" })}
            </button>
          </div>

          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {t("account.projectsHint", {
              defaultValue:
                "Позже тут появятся проекты из БД. Пока это заготовка (можно хранить локально).",
            })}
          </div>

          <div className="mt-4 divide-y divide-gray-200 dark:divide-gray-700 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {projects.length === 0 ? (
              <div className="p-4 text-gray-700 dark:text-gray-300">
                {t("account.noProjects", { defaultValue: "Проектов пока нет." })}
              </div>
            ) : (
              projects.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(p.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => nav("/editor")}
                    className="ml-4 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-gray-800 dark:text-gray-100"
                  >
                    {t("account.open", { defaultValue: "Открыть" })}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
