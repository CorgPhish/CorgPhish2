# CorgPhish

Локальное anti-phishing расширение для Chrome/Chromium. Проверяет домены, сигналы страницы и ссылки прямо в браузере без внешних API.

<p align="left">
  <a href="https://github.com/physcorgi/CorgPhish2/actions/workflows/build.yml">
    <img src="https://github.com/physcorgi/CorgPhish2/actions/workflows/build.yml/badge.svg" alt="build status" />
  </a>
  <img src="docs/badges/offline.svg" alt="offline badge" />
  <img src="docs/badges/mv3.svg" alt="mv3 badge" />
  <img src="docs/badges/local-ml.svg" alt="local ml badge" />
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-4a86b8" alt="license badge" />
  </a>
</p>

## Что делает расширение
- Локальная проверка домена по `trusted.json`, пользовательскому whitelist и blacklist.
- Эвристика и локальная ONNX-модель без удалённых запросов.
- Проверка брендовых признаков, форм, редиректов и подозрительных ссылок.
- Pre-click защита и подсветка рискованных ссылок на странице.
- Блокировка опасного сайта до ввода данных или скачивания файлов.
- История проверок и быстрые действия в popup.

Расширение работает полностью локально:
- не требует внешнего API для вынесения вердикта;
- хранит настройки, историю и пользовательские списки в `chrome.storage`;
- использует ML только внутри браузера;
- умеет падать обратно в эвристику, если ORT или offscreen недоступны.

## Скриншоты и демо
<p align="left">
  <img src="docs/badges/leg.png" alt="Главная панель" width="320" />
  <img src="docs/badges/phishing.png" alt="Экран блокировки" width="320" />
  <img src="docs/badges/history.png" alt="История проверок" width="320" />
  <img src="docs/badges/links_high.png" alt="Подсветка ссылок" width="320" />
  <img src="docs/settings/Screenshot%202026-01-16%20at%2018.31.32.png" alt="Настройки" width="320" />
</p>

- Запись экрана: [docs/badges/Screen Recording 2026-01-16 at 18.26.26.mov](docs/badges/Screen%20Recording%202026-01-16%20at%2018.26.26.mov)
- Демо-страница для теста подсветки: [docs/beta/index.html](docs/beta/index.html)

## Как работает
1. Popup или content script получает URL текущей страницы.
2. Домен нормализуется и сверяется с `trusted.json`, whitelist и blacklist.
3. Если точного совпадения нет, включаются проверки похожести домена, брендовых сигналов, форм и контента.
4. Затем выполняется локальный ML-инференс через `offscreen.js` или fallback-эвристику.
5. На выходе расширение ставит один из вердиктов: `trusted`, `suspicious`, `phishing`, `blacklisted`.
6. При опасном вердикте включается блокировка страницы, кнопки действий и запись в историю.

## Архитектура
- `popup` показывает состояние сайта, историю, настройки и ручные действия.
- `background` кэширует trusted-список, показывает уведомления и создаёт offscreen-контекст для ML.
- `offscreen` запускает локальный ONNX inference вне контекста страницы, чтобы CSP сайта не мешал модели.
- `content script` анализирует DOM страницы, ссылки, формы, редиректы и при необходимости блокирует взаимодействие.
- `blocked.html` открывается как отдельная безопасная страница, если сайт лучше не показывать пользователю вовсе.

## Установка
1. Откройте `chrome://extensions`.
2. Включите `Developer mode`.
3. Нажмите `Load unpacked`.
4. Выберите папку `CorgPhish/`.

## Локальная сборка
```bash
./scripts/build-content.sh
./scripts/verify.sh
./scripts/package.sh
```

Что делает каждая команда:
- `build-content.sh` собирает `CorgPhish/content.js` из модулей `CorgPhish/src/content/*`.
- `verify.sh` пересобирает content script, проверяет обязательные файлы и выводит версию из `manifest.json`.
- `package.sh` создаёт релизный ZIP-архив в `dist/`.

Типовой локальный цикл разработки:
```bash
./scripts/build-content.sh
npm test
./scripts/verify.sh
```

После этого достаточно перезагрузить расширение в `chrome://extensions`.

## Тесты
Для проекта добавлен исполняемый test harness на встроенном `node:test`.

Команды:

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:coverage
```

Что входит в контур:
- `96` unit-тестов по пяти группам.
- Integration runner на `348` сценариев с проверкой итоговой сводки.
- Coverage-отчёт для unit-части.

Распределение unit-тестов:
- `24` теста на нормализацию URL и доменов.
- `28` тестов на правила риск-оценки и признаки URL.
- `18` тестов на trusted/whitelist/blacklist.
- `14` тестов на ML fallback и итоговые вердикты.
- `12` тестов на локальное хранилище и историю.

## CI/CD
- `.github/workflows/build.yml` проверяет проект на каждый `push` и `pull_request`.
- `.github/workflows/release.yml` публикует релиз по тегу `vX.Y.Z`.
- `.github/dependabot.yml` отслеживает обновления GitHub Actions.

Релизный порядок:
1. Обновить `version` в `CorgPhish/manifest.json`.
2. Обновить `docs/meta/CHANGELOG.md`.
3. Запустить `./scripts/verify.sh`.
4. Создать тег `vX.Y.Z`.
5. Отправить коммиты и тег в GitHub.

## Структура репозитория
- `CorgPhish/` — код расширения, который реально загружается в браузер.
- `CorgPhish/popup/` — popup: интерфейс, состояние, storage, ML и логика проверки.
- `CorgPhish/src/content/` — модульные исходники контент-скрипта.
- `CorgPhish/content.js` — итоговый content script; вручную его не редактируют.
- `CorgPhish/models/` — ONNX-модель.
- `CorgPhish/vendor/ort/` — вендорный `onnxruntime-web`; эти файлы не правятся вручную.
- `CorgPhish/trusted.json` — встроенный trusted-список.
- `tests/` — unit/integration тесты и helper-моки.
- `docs/` — скриншоты, карта проекта и релизная документация.
- `.github/` — workflows, Dependabot и шаблоны GitHub.
- `scripts/` — локальные скрипты сборки и проверки.
- `dist/` — собранные ZIP-архивы.

## Где что менять
- Trusted-список: `CorgPhish/trusted.json`
- Логика итогового вердикта: `CorgPhish/popup/inspection.js`
- ML и fallback: `CorgPhish/popup/model.js`, `CorgPhish/offscreen.js`, `CorgPhish/background.js`
- UI popup: `CorgPhish/popup.html`, `CorgPhish/popup.css`, `CorgPhish/popup/ui.js`
- Основная логика popup: `CorgPhish/popup/main.js`
- Подсветка ссылок и pre-click защита: `CorgPhish/src/content/03-links-storage-redirects-antiscam.js`
- Блокировка форм и загрузок: `CorgPhish/src/content/05-blocking-init-and-events.js`
- Экран блокировки: `CorgPhish/blocked.html`, `CorgPhish/blocked.css`, `CorgPhish/blocked.js`

Если нужно вручную обновить trusted-кэш, удалите ключ `builtinTrustedDomains` из `chrome.storage.local` или переустановите расширение.

## Что делает каждый основной файл
- `CorgPhish/manifest.json` — описание расширения, прав, popup, background, content scripts и web accessible resources.
- `CorgPhish/background.js` — service worker: trusted-кэш, системные уведомления, offscreen и служебные сообщения.
- `CorgPhish/offscreen.html` — минимальная страница для offscreen-контекста.
- `CorgPhish/offscreen.js` — запуск ORT и локального инференса в отдельном контексте.
- `CorgPhish/blocked.html` — HTML экрана полной блокировки.
- `CorgPhish/blocked.css` — стили экрана блокировки.
- `CorgPhish/blocked.js` — действия на экране блокировки: назад, временный доступ, чёрный список, репорт.
- `CorgPhish/popup.html` — каркас popup-интерфейса.
- `CorgPhish/popup.css` — стили popup, истории и настроек.
- `CorgPhish/popup/main.js` — точка входа popup; связывает UI, storage и проверку домена.
- `CorgPhish/popup/ui.js` — рендер UI-состояний и списков.
- `CorgPhish/popup/dom.js` — единый реестр DOM-элементов popup.
- `CorgPhish/popup/data.js` — слой доступа к `chrome.storage` и trusted-спискам.
- `CorgPhish/popup/utils.js` — нормализация доменов, похожесть, форматирование времени.
- `CorgPhish/popup/config.js` — константы, ключи storage и словари переводов.
- `CorgPhish/popup/inspection.js` — обёртка над inspection-core с загрузкой данных и коротким кэшем.
- `CorgPhish/popup/inspection-core.js` — чистая логика итогового вердикта.
- `CorgPhish/popup/model.js` — popup-слой локального ML и fallback.
- `CorgPhish/popup/model-core.js` — извлечение признаков URL и эвристика.
- `CorgPhish/popup/history-core.js` — чистые функции формирования истории.
- `CorgPhish/popup/i18n.js` — переводчик строк интерфейса.
- `CorgPhish/src/content/01-bootstrap-and-constants.js` — общее состояние, константы и bootstrap content script.
- `CorgPhish/src/content/02-domain-and-content-risk.js` — доменные проверки, похожесть и риск-сигналы.
- `CorgPhish/src/content/03-links-storage-redirects-antiscam.js` — pre-click проверка ссылок, редиректы и anti-scam UX.
- `CorgPhish/src/content/04-sensitive-ui-and-signals.js` — предупреждения на странице и сбор сигналов для popup.
- `CorgPhish/src/content/05-blocking-init-and-events.js` — блокировка действий пользователя и инициализация listeners.
- `scripts/build-content.sh` — сборка `content.js` из модулей.
- `scripts/verify.sh` — локальная верификация обязательных файлов и версии.
- `scripts/package.sh` — упаковка расширения в ZIP.
- `tests/helpers/chrome-mock.mjs` — mock `chrome.*` для unit-тестов.
- `tests/unit/*.mjs` — модульные тесты чистой логики и storage layer.
- `tests/integration/scenarios.mjs` — генератор synthetic integration-сценариев.
- `tests/integration/run-integration.mjs` — runner для 348 интеграционных прогонов и сверки summary.

## Документация
- Техническое описание: [CorgPhish/README.md](CorgPhish/README.md)
- Навигация по репозиторию: [docs/navigation.md](docs/navigation.md)
- Карта проекта: [docs/project_map.md](docs/project_map.md)
- Тестирование: [docs/testing/README.md](docs/testing/README.md)
- История изменений: [docs/meta/CHANGELOG.md](docs/meta/CHANGELOG.md)
- Релизный процесс: [docs/meta/RELEASING.md](docs/meta/RELEASING.md)
- Политика безопасности: [docs/meta/SECURITY.md](docs/meta/SECURITY.md)

## Contributing
[CONTRIBUTING.md](CONTRIBUTING.md)

## Лицензия
[MIT](LICENSE)
