# Карта проекта и подробное описание файлов

Ниже перечислены основные файлы/папки и их назначение. Это краткая «карта» для поддержки, демонстрации и дальнейшей разработки.

## Корень репозитория
- `README.md` — основной README: возможности, установка, сборка, CI/CD и карта репозитория.
- `LICENSE` — лицензия MIT.
- `.gitignore` — исключения из git для IDE, виртуальных окружений, логов, локальных сайтов и артефактов сборки.
- `dist/` — результаты локальной сборки (zip‑архивы). Не редактируется вручную.

## Исходники расширения: `apps/extension/`
- `manifest.json` — манифест MV3: версия, permissions, popup, background, content script и ресурсы модели.
- `background/index.js` — сервис‑воркер: кэш trusted списка, уведомления, обработка сообщений, fallback‑ML.
- `background/download-guard.js` — сопоставление guarded tabs и отмена загрузок.
- `content/index.js` — собранный контент‑скрипт, который реально подключается браузером.
- `content/src/*.js` — исходные модули для сборки `content/index.js`.
- `content/page-form-guard.js` — page‑world guard для SPA и JS‑форм.
- `offscreen/index.html`, `offscreen/offscreen.js` — offscreen‑страница для ML‑инференса (обход CSP, выполнение в расширении).
- `trusted.json` — встроенный список доверенных доменов, который расширение объединяет с пользовательскими whitelist/blacklist.
- `blocked/index.html`, `blocked/blocked.css`, `blocked/blocked.js` — отдельный экран блокировки опасного сайта.

### UI попапа
- `popup/index.html` — разметка интерфейса попапа.
- `popup/popup.css` — стили попапа.
- `popup/main.js` — основной контроллер попапа: загрузка настроек, запуск проверки, обновление UI.
- `popup/inspection.js` — логика вердикта: проверка списков, похожесть доменов, сигналы, ML.
- `popup/data.js` — доступ к storage, загрузка/сохранение whitelist/blacklist и истории.
- `popup/model.js` — локальный ML‑инференс (onnxruntime‑web) + эвристический fallback.
- `popup/utils.js` — нормализация доменов, расстояние Левенштейна, бренд‑токены.
- `popup/config.js` — дефолтные настройки, тексты интерфейса (RU/EN), константы.
- `popup/i18n.js` — переводчик (подстановка параметров).
- `popup/dom.js` — сбор DOM‑элементов и безопасное навешивание событий.
- `popup/ui.js` — применение состояний, рендер списков, подсказки.

### Ресурсы
- `assets/icons/` — иконки расширения.
- `assets/models/` — ONNX‑модель.
- `assets/vendor/ort/` — runtime onnxruntime‑web (не редактировать вручную).

## Документация и материалы: `docs/`
- `docs/badges/` — бейджи, скриншоты и запись экрана для README.
- `docs/beta/` — demo-страница для проверки подсветки ссылок.
- `docs/navigation.md` — быстрый маршрут по коду под задачу.
- `docs/project_map.md` — расширенная карта файлов и папок.
- `docs/testing/` — пакет тестовой документации, метрик и сводок по validation-контуру.
- `docs/meta/CHANGELOG.md` — история изменений.
- `docs/meta/RELEASING.md` — инструкция по релизам.
- `docs/meta/SECURITY.md` — политика безопасности.

## CI/CD и шаблоны
- `.github/workflows/build.yml` — сборка и проверка пакета.
- `.github/workflows/release.yml` — релиз по тегу.
- `.github/dependabot.yml` — отслеживание обновлений GitHub Actions.
- `.github/ISSUE_TEMPLATE/` — шаблоны Issues.
- `.github/PULL_REQUEST_TEMPLATE.md` — шаблон PR.

## Тестовый контур
- `package.json` — npm scripts для запуска тестов и coverage.
- `tests/unit/` — unit-тесты на `node:test`.
- `tests/integration/` — integration runner и генератор сценариев на `348` запусков.
- `tests/helpers/` — вспомогательные mock-утилиты для тестов.

## Скрипты
- `scripts/build-content.sh` — объединяет модули `content/src/*` в один `content/index.js`.
- `scripts/verify.sh` — проверка перед сборкой: пересборка content script, версия, состав и обязательные файлы.
- `scripts/package.sh` — сборка zip‑архива для релиза.

## Что менять в первую очередь
- Версия релиза: `apps/extension/manifest.json`.
- Список trusted: `apps/extension/trusted.json`.
- Тексты UI: `apps/extension/popup/config.js`.
- Логика вердикта: `apps/extension/popup/inspection.js`.
- Внешний вид попапа: `apps/extension/popup/index.html`, `apps/extension/popup/popup.css`.
- Блокировки/оверлей: `apps/extension/content/index.js`, `apps/extension/content/src/05-blocking-init-and-events.js`.

## Релиз (вручную)
1) Обновить `version` в `apps/extension/manifest.json`.
2) Обновить `docs/meta/CHANGELOG.md`.
3) Прогнать `./scripts/verify.sh`.
4) Поставить тег `vX.Y.Z`.
5) Отправить коммиты и тег на GitHub — CI/CD соберет релиз.
