import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="m-auto w-full max-w-3xl px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 md:p-10 transition-colors duration-500">
        <h1 className="text-4xl font-extrabold text-indigo-700 dark:text-indigo-300">
          SmartERD
        </h1>

        <p className="text-gray-700 dark:text-gray-300 mt-4 text-lg">
          {t("home.welcome")}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            to="/editor"
            className="inline-flex justify-center px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            {t("home.cta.editor", { defaultValue: "Открыть редактор" })}
          </Link>

          <Link
            to="/account"
            className="inline-flex justify-center px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-gray-800 dark:text-gray-100 font-semibold"
          >
            {t("nav.account", { defaultValue: "Личный кабинет" })}
          </Link>
        </div>

        <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
          {t("home.note", {
            defaultValue:
              "Можно работать как гость: всё будет храниться локально. Аккаунт понадобится для проектов в облаке (позже).",
          })}
        </div>
      </div>
    </div>
  );
}
