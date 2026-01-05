import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/useAuthStore";

export default function LoginPage() {
  const { t } = useTranslation();
  const nav = useNavigate();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isAuthenticated) nav("/account", { replace: true });
  }, [isAuthenticated, nav]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError(
        t("auth.errors.fill", { defaultValue: "Заполните email и пароль." })
      );
      return;
    }

    // МОК: просто ставим isAuthenticated=true
    login(email, password);
    nav("/account");
  };

  return (
    <div className="m-auto w-full max-w-md px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 transition-colors duration-500">
        <h1 className="text-3xl font-extrabold text-indigo-700 dark:text-indigo-300">
          {t("auth.login.title", { defaultValue: "Вход" })}
        </h1>
        <p className="text-gray-700 dark:text-gray-300 mt-2">
          {t("auth.login.subtitle", {
            defaultValue: "Войдите, чтобы видеть проекты в личном кабинете.",
          })}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm text-gray-700 dark:text-gray-300">
              {t("auth.password", { defaultValue: "Пароль" })}
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            {t("auth.login.action", { defaultValue: "Войти" })}
          </button>

          <button
            type="button"
            onClick={() => nav("/editor")}
            className="w-full px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-gray-800 dark:text-gray-100 font-semibold"
          >
            {t("auth.guest", { defaultValue: "Продолжить как гость" })}
          </button>
        </form>

        <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
          {t("auth.noAccount", { defaultValue: "Нет аккаунта?" })}{" "}
          <Link
            className="text-indigo-700 dark:text-indigo-300 hover:underline font-semibold"
            to="/register"
          >
            {t("auth.register.link", { defaultValue: "Зарегистрироваться" })}
          </Link>
        </div>
      </div>
    </div>
  );
}
