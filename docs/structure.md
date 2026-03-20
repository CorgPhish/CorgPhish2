# Структура репозитория

Ниже приведена укрупнённая структура проекта и назначение основных каталогов.

```text
CorgPhish2/
├── .github/
│   ├── workflows/
│   └── ISSUE_TEMPLATE/
├── apps/extension/
│   ├── assets/
│   │   ├── icons/
│   │   ├── models/
│   │   └── vendor/ort/
│   ├── background/
│   │   ├── download-guard.js
│   │   └── index.js
│   ├── blocked/
│   │   ├── blocked.css
│   │   ├── blocked.js
│   │   └── index.html
│   ├── content/
│   │   ├── src/
│   │   ├── index.js
│   │   └── page-form-guard.js
│   ├── offscreen/
│   │   ├── index.html
│   │   └── offscreen.js
│   ├── popup/
│   │   ├── index.html
│   │   └── popup.css
│   ├── manifest.json
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
- `background/index.js` — service worker
- `background/download-guard.js` — отмена загрузок и сопоставление guarded tab/download
- `offscreen/` — изолированный контекст для ML
- `blocked/` — экран блокировки
- `content/page-form-guard.js` — page-world guard для SPA/JS-форм
- `content/index.js` — итоговый собранный content script
- `content/src/` — модульные исходники content-скрипта
- `popup/` — popup UI, storage, i18n, verdict logic, ML wrapper
- `assets/icons/` — иконки расширения
- `assets/models/` — ONNX-модель
- `assets/vendor/ort/` — ONNX Runtime Web
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

- `build-content.sh` — сборка `content/index.js`
- `verify.sh` — проверка сборки и обязательных файлов
- `package.sh` — упаковка релизного ZIP

### `tests/`

- `unit/` — тесты чистой логики
- `integration/` — интеграционные сценарии и runner
- `helpers/` — вспомогательные test utilities и mock `chrome.*`

## Логика модульности

Проект сейчас разделён по ролям:

- UI и настройки — в `popup/`
- фоновые задачи и orchestration — в `background/`
- логика анализа страницы — в `content/src/`
- итоговый browser bundle — в `content/index.js`
- статические ресурсы и ML runtime — в `assets/`
- пользовательская документация — в `docs/`
- автоматическая проверка и релиз — в `.github/workflows/` и `scripts/`

Это разделение нормальное и удобное для сопровождения: runtime-код, документация, тесты и служебные скрипты не смешаны между собой.
