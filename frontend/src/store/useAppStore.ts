import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';


type Lang = 'ru' | 'en';
type Theme = 'light' | 'dark';

interface AppState {
  // базовые
  language: Lang;
  theme: Theme;

  // настройки UX
  compactToolbar: boolean;          // иконки вместо текста в тулбаре
  defaultShowSqlPanel: boolean;     // показывать SQL-панель по умолчанию
  defaultShowMinimap: boolean;      // показывать миникарту по умолчанию
  confirmDelete: boolean;           // подтверждать удаление сущности/связи

  // сеттеры
  setLanguage: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;

  setCompactToolbar: (v: boolean) => void;
  setDefaultShowSqlPanel: (v: boolean) => void;
  setDefaultShowMinimap: (v: boolean) => void;
  setConfirmDelete: (v: boolean) => void;

  // сброс
  resetSettings: () => void;
}

const defaults: Pick<
  AppState,
  'language' | 'theme' | 'compactToolbar' | 'defaultShowSqlPanel' | 'defaultShowMinimap' | 'confirmDelete'
> = {
  language: 'ru',
  theme: 'light',
  compactToolbar: true,       
  defaultShowSqlPanel: true,
  defaultShowMinimap: true,
  confirmDelete: true,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...defaults,

      setLanguage: (lang) => set({ language: lang }),
      setTheme: (theme) => set({ theme }),

      setCompactToolbar: (v) => set({ compactToolbar: v }),
      setDefaultShowSqlPanel: (v) => set({ defaultShowSqlPanel: v }),
      setDefaultShowMinimap: (v) => set({ defaultShowMinimap: v }),
      setConfirmDelete: (v) => set({ confirmDelete: v }),

      resetSettings: () => set({ ...defaults }),
    }),
    {
      name: 'app-settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    }
  )
);
