import { create } from 'zustand'

interface AppState {
  language: 'ru' | 'en'
  theme: 'light' | 'dark'
  setLanguage: (lang: 'ru' | 'en') => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useAppStore = create<AppState>((set) => ({
  language: 'ru',
  theme: 'light',

  setLanguage: (lang) => set({ language: lang }),
  setTheme: (theme) => set({ theme }),
}))
