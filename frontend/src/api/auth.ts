// frontend/src/api/auth.ts
import { apiFetch } from "./http";

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type AuthResponse = {
  ok: true;
  user: ApiUser;
  token: string;
};

export async function apiAuthLogin(email: string, password: string) {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function apiAuthRegister(name: string, email: string, password: string) {
  return apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: { name, email, password },
  });
}

export async function apiAuthMe(token: string) {
  return apiFetch<{ ok: true; user: ApiUser }>("/api/me", { token });
}
