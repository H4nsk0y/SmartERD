// frontend/src/api/client.ts
export const API_BASE: string =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8787";

type ApiOk<T> = T & { ok?: boolean; error?: string; details?: any };

export async function apiJson<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers = new Headers(opts.headers || {});
  if (!headers.has("Content-Type") && opts.body) {
    // важно для кириллицы в Windows + в целом корректно
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  if (opts.token) {
    headers.set("Authorization", `Bearer ${opts.token}`);
  }

  const res = await fetch(url, {
    ...opts,
    headers,
  });

  const text = await res.text();
  let json: ApiOk<any> | null = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // если вдруг сервер вернул HTML/текст
  }

  if (!res.ok) {
    const msg =
      (json && (json.error || JSON.stringify(json))) ||
      text ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  if (json && json.ok === false) {
    const msg = json.error || "Request failed";
    const details = json.details ? `\n${JSON.stringify(json.details)}` : "";
    throw new Error(msg + details);
  }

  return (json as any) ?? (text as any);
}
