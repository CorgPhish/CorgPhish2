# Структура репозитория

Ниже приведена укрупнённая структура проекта и назначение основных каталогов.

```text
CorgPhish2/
├── .github/
│   ├── workflows/
│   └── ISSUE_TEMPLATE/
├── apps/extension/
│   ├── icons/
│   ├── models/
│   ├── popup/
│   ├── src/content/
│   ├── vendor/ort/
│   ├── background.js
│   ├── background-download-guard.js
│   ├── blocked.css
│   ├── blocked.html
│   ├── blocked.js
│   ├── content.js
│   ├── manifest.json
│   ├── offscreen.html
│   ├── offscreen.js
│   ├── page-form-guard.js
│   └── trusted.json
├── docs/
│   ├── badges/
│   ├── beta/
│   ├── demo-blocking/
│   ├── meta/
│   ├── settings/
│   ├── testing/
│   ├── navigation.md
│   ├── project_map.md
│   ├── structure.md
│   └── user-guide.md
├── scripts/
├── tests/
│   ├── helpers/
│   ├── integration/
│   └── unit/
├── CONTRIBUTING.md
├── LICENSE
├── README.md
└── package.json
```

## Что где находится

### `.github/`

- CI/CD workflow
- Dependabot
- шаблоны issue/PR

### `apps/extension/`

Основной код расширения.

- `manifest.json` — точка входа расширения
- `background.js` — service worker
- `offscreen.*` — изолированный контекст для ML
- `blocked.*` — экран блокировки
- `page-form-guard.js` — page-world guard для SPA/JS-форм
- `content.js` — итоговый собранный content script
- `src/content/` — модульные исходники content-скрипта
- `popup/` — popup UI, storage, i18n, verdict logic, ML wrapper
- `models/` — ONNX-модель
- `vendor/ort/` — ONNX Runtime Web
- `trusted.json` — встроенный trusted-список доменов

### `docs/`

Пользовательская и проектная документация.

- `user-guide.md` — руководство пользователя
- `navigation.md` — быстрый навигатор по коду
- `project_map.md` — карта проекта
- `meta/` — changelog, security, release guide
- `testing/` — методика и результаты тестирования, включая CSV с пользовательскими отзывами
- `demo-blocking/` и `beta/` — demo-страницы для показа работы расширения
- `badges/` и `settings/` — изображения и материалы для README

### `scripts/`

- `build-content.sh` — сборка `content.js`
- `verify.sh` — проверка сборки и обязательных файлов
- `package.sh` — упаковка релизного ZIP

### `tests/`

- `unit/` — тесты чистой логики
- `integration/` — интеграционные сценарии и runner
- `helpers/` — вспомогательные test utilities и mock `chrome.*`

## Логика модульности

Проект сейчас разделён по ролям:

- UI и настройки — в `popup/`
- фоновые задачи и orchestration — в `background.js`
- логика анализа страницы — в `src/content/`
- итоговый browser bundle — в `content.js`
- пользовательская документация — в `docs/`
- автоматическая проверка и релиз — в `.github/workflows/` и `scripts/`

Это разделение нормальное и удобное для сопровождения: runtime-код, документация, тесты и служебные скрипты не смешаны между собой.
