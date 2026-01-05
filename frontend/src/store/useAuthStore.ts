import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = {
  name: string;
  email: string;
};

export type ProjectStub = {
  id: string;
  name: string;
  updatedAt: number;
};

type AuthState = {
  isAuthenticated: boolean;
  user: AuthUser | null;

  // заготовка под будущие проекты
  projects: ProjectStub[];

  login: (email: string, password: string) => void;
  register: (name: string, email: string, password: string) => void;
  logout: () => void;

  // на будущее
  addProject: (p: ProjectStub) => void;
  removeProject: (id: string) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      projects: [],

      login: (email: string, _password: string) => {
        const safeEmail = (email || "").trim();
        const nameGuess = safeEmail.includes("@")
          ? safeEmail.split("@")[0]
          : safeEmail || "User";

        set({
          isAuthenticated: true,
          user: { name: nameGuess, email: safeEmail || "user@example.com" },
        });
      },

      register: (name: string, email: string, _password: string) => {
        const safeEmail = (email || "").trim();
        const safeName =
          (name || "").trim() ||
          (safeEmail.includes("@") ? safeEmail.split("@")[0] : "") ||
          "User";

        set({
          isAuthenticated: true,
          user: { name: safeName, email: safeEmail || "user@example.com" },
        });
      },

      logout: () => set({ isAuthenticated: false, user: null }),

      addProject: (p: ProjectStub) => {
        const list = get().projects;
        set({ projects: [p, ...list] });
      },

      removeProject: (id: string) => {
        set({ projects: get().projects.filter((x) => x.id !== id) });
      },
    }),
    { name: "smarterd-auth" }
  )
);
