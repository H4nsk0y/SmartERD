// frontend/src/api/projects.ts
import { apiFetch } from "./http";

export type ProjectData = {
  entities: any[];
  relationships: any[];
};

export type ApiProject = {
  id: string;
  name: string;
  data?: ProjectData;
  createdAt: string;
  updatedAt: string;
};

export async function apiProjectsList(token: string) {
  const r = await apiFetch<{ ok: true; projects: ApiProject[] }>("/api/projects", { token });
  return r.projects;
}

export async function apiProjectGet(token: string, id: string) {
  const r = await apiFetch<{ ok: true; project: ApiProject }>(`/api/projects/${id}`, { token });
  return r.project;
}

export async function apiProjectCreate(
  token: string,
  payload: { name: string; data: ProjectData }
) {
  const r = await apiFetch<{ ok: true; project: ApiProject }>("/api/projects", {
    method: "POST",
    token,
    body: payload,
  });
  return r.project;
}


export async function apiProjectUpdate(
  token: string,
  id: string,
  payload: { name?: string; data?: ProjectData }
) {
  const r = await apiFetch<{ ok: true; project: ApiProject }>(`/api/projects/${id}`, {
    method: "PUT",
    token,
    body: payload,
  });
  return r.project;
}


export async function apiProjectDelete(token: string, id: string) {
  const r = await apiFetch<{ ok: true }>(`/api/projects/${id}`, {
    method: "DELETE",
    token,
  });
  return r;
}
