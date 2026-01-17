import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { apiAuthLogin, apiAuthRegister, type ApiUser } from "../api/auth";
import { apiProjectsList, type ApiProject } from "../api/projects";

export type AuthUser = ApiUser;

export type ProjectStub = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type AuthState = {
  isAuthenticated: boolean;
  token: string | null;
  user: AuthUser | null;

  projects: ProjectStub[];
  loadingProjects: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;

  fetchProjects: () => Promise<void>;
  upsertProject: (p: ProjectStub | ApiProject) => void;
  removeProject: (id: string) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      token: null,
      user: null,

      projects: [],
      loadingProjects: false,

      login: async (email, password) => {
        const res = await apiAuthLogin(email.trim(), password);
        set({
          isAuthenticated: true,
          token: res.token,
          user: res.user,
        });
        await get().fetchProjects();
      },

      register: async (name, email, password) => {
        const res = await apiAuthRegister(name.trim(), email.trim(), password);
        set({
          isAuthenticated: true,
          token: res.token,
          user: res.user,
        });
        await get().fetchProjects();
      },

      logout: () => {
        set({
          isAuthenticated: false,
          token: null,
          user: null,
          projects: [],
          loadingProjects: false,
        });
      },

      fetchProjects: async () => {
        const token = get().token;
        if (!token) return;

        set({ loadingProjects: true });
        try {
          const list = await apiProjectsList(token);
          set({
            projects: list.map((p) => ({
              id: p.id,
              name: p.name,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
            })),
          });
        } finally {
          set({ loadingProjects: false });
        }
      },

      upsertProject: (p) => {
        const cur = get().projects.slice();
        const next: ProjectStub = {
          id: (p as any).id,
          name: (p as any).name,
          createdAt: (p as any).createdAt,
          updatedAt: (p as any).updatedAt,
        };

        const i = cur.findIndex((x) => x.id === next.id);
        if (i >= 0) cur[i] = next;
        else cur.unshift(next);

        set({ projects: cur });
      },

      removeProject: (id) => {
        set({ projects: get().projects.filter((x) => x.id !== id) });
      },
    }),
    {
      name: "smarterd-auth",
      version: 2,
      storage: createJSONStorage(() => localStorage),
    }
  )
);
