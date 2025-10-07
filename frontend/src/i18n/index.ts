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
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
