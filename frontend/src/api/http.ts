// frontend/src/api/http.ts
const API = import.meta.env.VITE_API_URL || "http://localhost:8787";

export async function apiFetch<T>(
  path: string,
  opts: { method?: string; token?: string; body?: any } = {}
): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method: opts.method || "GET",
    headers: {
      ...(opts.body ? { "Content-Type": "application/json; charset=utf-8" } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await r.text();
  let j: any = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch {
    // если вдруг сервер вернул не JSON
  }

  if (!r.ok || (j && j.ok === false)) {
    const msg =
      (j && (j.error || j.message)) ||
      `Ошибка запроса (${r.status}). Проверь сервер.`;
    throw new Error(msg);
  }

  return j as T;
}
