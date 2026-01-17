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
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (isAuthenticated) nav("/account", { replace: true });
  }, [isAuthenticated, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError(t("auth.errors.fill", { defaultValue: "Заполните email и пароль." }));
      return;
    }

    setBusy(true);
    try {
      await login(email, password);
      nav("/account", { replace: true });
    } catch (e: any) {
      setError(e?.message || "Не удалось войти. Проверь email/пароль.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="m-auto w-full max-w-md px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 transition-all duration-300 hover:shadow-[0_30px_80px_-40px_rgba(0,0,0,.35)]">
        <h1 className="text-3xl font-extrabold text-indigo-700 dark:text-indigo-300">
          {t("auth.login.title", { defaultValue: "Вход" })}
        </h1>
        <p className="text-gray-700 dark:text-gray-300 mt-2">
          {t("auth.login.subtitle", { defaultValue: "Войдите, чтобы видеть проекты в личном кабинете." })}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-gray-700 dark:text-gray-300">Email</label>
            <input
              data-testid="auth-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm text-gray-700 dark:text-gray-300">
              {t("auth.password", { defaultValue: "Пароль" })}
            </label>
            <input
              data-testid="auth-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {/* красивый “выезжающий” блок ошибки */}
          <div
            className={`overflow-hidden transition-all duration-300 ${
              error ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            {error && (
              <div className="text-sm border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl px-3 py-2">
                {error}
              </div>
            )}
          </div>

          <button
            data-testid="auth-submit"
            type="submit"
            disabled={busy}
            className="w-full px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Входим...
              </span>
            ) : (
              t("auth.login.action", { defaultValue: "Войти" })
            )}
          </button>

          <button
            type="button"
            onClick={() => nav("/editor")}
            className="w-full px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-gray-800 dark:text-gray-100 font-semibold transition active:scale-[0.98]"
          >
            {t("auth.guest", { defaultValue: "Продолжить как гость" })}
          </button>
        </form>

        <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
          {t("auth.noAccount", { defaultValue: "Нет аккаунта?" })}{" "}
          <Link className="text-indigo-700 dark:text-indigo-300 hover:underline font-semibold" to="/register">
            {t("auth.register.link", { defaultValue: "Зарегистрироваться" })}
          </Link>
        </div>
      </div>
    </div>
  );
}
