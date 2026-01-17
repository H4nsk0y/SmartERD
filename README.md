# SmartERD 
Интерактивный редактор ER-диаграмм для учебных проектов по базам данных: сущности/связи → проверка → SQL + AI-помощник.

<p align="center">
  <img alt="SmartERD" src="docs/banner.png" width="860" />
</p>

<p align="center">
  <a href="https://github.com/H4nsk0y/SmartERD">
    <img alt="Repo" src="https://img.shields.io/badge/GitHub-SmartERD-181717?logo=github" />
  </a>
  <img alt="Tech" src="https://img.shields.io/badge/Frontend-React%20%2B%20TS-61DAFB?logo=react&logoColor=000" />
  <img alt="Tech" src="https://img.shields.io/badge/Styling-TailwindCSS-38BDF8?logo=tailwindcss&logoColor=000" />
  <img alt="Tech" src="https://img.shields.io/badge/Backend-Node%20%2B%20Express-3C873A?logo=node.js&logoColor=fff" />
  <img alt="AI" src="https://img.shields.io/badge/AI-OpenAI%20Compatible-111827" />
</p>

---

## Содержание
- [Что это](#что-это)
- [Фичи](#фичи)
- [Быстрый старт](#быстрый-старт)
- [Конфигурация AI](#конфигурация-ai)
- [Структура репозитория](#структура-репозитория)
- [Roadmap](#roadmap)
- [Автор](#автор)

---

## Что это
**SmartERD** помогает быстро собрать ER-модель (сущности, атрибуты, связи), подсветить проблемы и получить SQL под разные диалекты.

Проект подходит для:
- лабораторных/курсовых по БД,
- подготовки к зачёту/экзамену (проверка модели + нормализация),
- прототипирования схемы перед реализацией.

---

## Фичи
### Editor
- 🧱 Создание сущностей и атрибутов (в т.ч. отметка PK)
- 🔗 Создание связей между сущностями (1:N, N:M)
- 🧭 Панорамирование/зум канваса, «вписать всё», миникарта
- ✅ Валидация модели (подсказки и предупреждения)
- 🧠 Подсказки по нормализации (и действия по исправлению)
- 📤 Экспорт: JSON / PNG / SVG
- 📥 Импорт JSON

### SQL
- ⚙️ Генерация SQL из ER-модели
- 🗂️ Переключение диалекта (PostgreSQL/MySQL/SQLite/MS SQL)
- ✍️ Редактируемое SQL-поле + копирование

### AI
- 💬 AI-чат
- 🧬 Генерация ER-модели по текстовому описанию предметной области
- 🔌 Поддержка **OpenAI-compatible** серверов (например, LM Studio локально)

---

## Быстрый старт

### Требования
- Node.js (желательно 18+)
- npm (или pnpm/yarn — по желанию)

### Запуск backend (API)
```bash
cd backend
npm install
node src/server.js
# API будет на http://localhost:8787


Автор
GitHub: H4nsk0y
```

