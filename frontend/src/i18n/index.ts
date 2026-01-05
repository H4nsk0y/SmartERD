// frontend/src/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  ru: {
    translation: {
      nav: {
        home: "Главная",
        editor: "Редактор",
        settings: "Настройки",
        ai: "AI-Помощник",
        kb: "База знаний",
      },
      buttons: {
        changeLang: "Сменить язык → EN",
        dark: "Тёмная тема",
        light: "Светлая тема",
      },
      home: {
        welcome: "Добро пожаловать! Выберите раздел выше 👆",
      },
      editor: {
        title: "Редактор ER-диаграмм",
      },
      settings: {
        title: "Настройки",
        sections: {
          appearance: "Внешний вид",
          editor: "Редактор",
        },
        appearance: {
          theme: "Тема",
          language: "Язык интерфейса",
          light: "Светлая",
          dark: "Тёмная",
          compactToolbar: "Компактные кнопки тулбара (иконки)",
        },
        editor: {
          sqlPanelDefault: "SQL-панель по умолчанию",
          minimapDefault: "Мини-карта по умолчанию",
          confirmDelete: "Подтверждать удаление",
        },
        reset: "Сбросить настройки",
        hint: "Настройки сохраняются локально и применяются ко всем страницам.",
      },
      ai: {
        title: "AI-Помощник",
      },
    },
  },
  en: {
    translation: {
      nav: {
        home: "Home",
        editor: "Editor",
        settings: "Settings",
        ai: "AI Helper",
        kb: "Knowledge Base",
      },
      buttons: {
        changeLang: "Switch language → RU",
        dark: "Dark theme",
        light: "Light theme",
      },
      home: {
        welcome: "Welcome! Choose a section above 👆",
      },
      editor: {
        title: "ER Diagram Editor",
      },
      settings: {
        title: "Settings",
        sections: {
          appearance: "Appearance",
          editor: "Editor",
        },
        appearance: {
          theme: "Theme",
          language: "Interface language",
          light: "Light",
          dark: "Dark",
          compactToolbar: "Compact toolbar (icons)",
        },
        editor: {
          sqlPanelDefault: "SQL panel by default",
          minimapDefault: "Minimap by default",
          confirmDelete: "Confirm delete",
        },
        reset: "Reset settings",
        hint: "Settings are stored locally and applied across pages.",
      },
      ai: {
        title: "AI Assistant",
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "ru",
  fallbackLng: "ru",
  interpolation: { escapeValue: false },
});

export default i18n;
// frontend/src/canvas/components/SQLPanel.tsx