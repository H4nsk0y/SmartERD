import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';


type Lang = 'ru' | 'en';
type Theme = 'light' | 'dark';

interface AppState {
 
  language: Lang;
  theme: Theme;

 
  compactToolbar: boolean;          
  defaultShowSqlPanel: boolean;     
  defaultShowMinimap: boolean;      
  confirmDelete: boolean;           

  
  setLanguage: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;

  setCompactToolbar: (v: boolean) => void;
  setDefaultShowSqlPanel: (v: boolean) => void;
  setDefaultShowMinimap: (v: boolean) => void;
  setConfirmDelete: (v: boolean) => void;


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
    (set) => ({
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
