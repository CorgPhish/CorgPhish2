# Навигация по проекту CorgPhish

Этот файл нужен как быстрый указатель: куда идти в коде под конкретную задачу.

## 1) Корень репозитория

- `CorgPhish/` — само расширение (основной продукт).
- `docs/` — документация, скриншоты, материалы для README и релизов.
- `scripts/` — скрипты сборки и проверки.
- `.github/` — CI/CD и шаблоны Issues/PR.
- `README.md` — основная документация репозитория.
- `CONTRIBUTING.md` — правила внесения изменений.
- `LICENSE` — лицензия MIT.

## 2) Расширение (папка `CorgPhish/`)

### Точки входа

- `manifest.json` — версия расширения, permissions, popup, background, content script и web-accessible ресурсы.
- `background.js` — service worker: trusted-кэш, уведомления, фоновые сообщения.
- `content.js` — итоговый собранный content script (загружается на все `http/https` страницы).
- `popup.html` + `popup.css` — интерфейс popup.
- `popup/main.js` — главная логика popup (проверка активной вкладки, настройки, история).
- `blocked.html` + `blocked.js` + `blocked.css` — экран блокировки опасного сайта.
- `offscreen.html` + `offscreen.js` — offscreen-контекст для ML-инференса.

### Внутренние модули popup

- `popup/inspection.js` — финальный вердикт (`trusted/suspicious/phishing/blacklisted`).
- `popup/model.js` — ML + fallback на эвристику.
- `popup/data.js` — `chrome.storage` и trusted/white/black list.
- `popup/utils.js` — нормализация доменов, вспомогательные функции.
- `popup/config.js` — дефолтные настройки, пороги, тексты.
- `popup/ui.js`, `popup/dom.js`, `popup/i18n.js` — UI-слой popup.

### Модель и runtime

- `models/hybrid_tfidf_num.onnx` — ONNX-модель.
- `vendor/ort/*` — ONNX Runtime Web (wasm + js).
- `trusted.json` — встроенный trusted-список доменов.

## 3) Новая модульная структура content-скрипта

Исходники content-скрипта разнесены по файлам:

- `CorgPhish/src/content/01-bootstrap-and-constants.js`
- `CorgPhish/src/content/02-domain-and-content-risk.js`
- `CorgPhish/src/content/03-links-storage-redirects-antiscam.js`
- `CorgPhish/src/content/04-sensitive-ui-and-signals.js`
- `CorgPhish/src/content/05-blocking-init-and-events.js`

Рабочий файл для браузера: `CorgPhish/content.js`  
Он собирается автоматически из модулей (см. раздел 4).

## 4) Сборка и проверка

- `scripts/build-content.sh` — собирает `CorgPhish/content.js` из `CorgPhish/src/content/*`.
- `scripts/verify.sh` — базовая проверка проекта + наличие обязательных файлов.
- `scripts/package.sh` — упаковка расширения в zip (`dist/`).

Команды:

```bash
./scripts/build-content.sh
./scripts/verify.sh
./scripts/package.sh
```

## 5) Документация и релизы

- `docs/testing/` — методика и результаты unit, integration и user testing.
- `docs/user-guide.md` — пользовательская инструкция по установке и работе с расширением.
- `docs/meta/CHANGELOG.md` — история изменений.
- `docs/meta/RELEASING.md` — порядок подготовки релиза.
- `docs/meta/SECURITY.md` — политика по безопасности.
- `.github/dependabot.yml` — обновления GitHub Actions.
- `.github/workflows/build.yml` — CI-проверка и сборка артефакта.
- `.github/workflows/release.yml` — выпуск релиза по тегу `vX.Y.Z`.
- `tests/` — исполняемые unit/integration тесты и test helpers.

## 6) Быстрые маршруты по задачам

- Нужно поменять логику детекта: `popup/inspection.js`, `popup/model.js`, `content.js`.
- Нужно поменять блокировку форм/загрузок: `CorgPhish/src/content/05-blocking-init-and-events.js`.
- Нужно поменять pre-click/редиректы/подсветку ссылок: `CorgPhish/src/content/03-links-storage-redirects-antiscam.js`.
- Нужно поменять настройки в UI: `popup.html`, `popup/main.js`, `popup/config.js`.
- Нужно обновить trusted-список: `trusted.json`.
- Нужно поменять экран блокировки: `blocked.html`, `blocked.js`, `blocked.css`.
- Нужно поменять сборку content script: `scripts/build-content.sh`.
- Нужно обновить описание тестирования: `docs/testing/*`.

## 7) Что сейчас с `website-angular/`

На данный момент в `website-angular/` остались служебные директории (`node_modules`, `.angular`, `dist`),  
без исходников приложения (`src`, `package.json` и т.д.).  
Папка исключена из текущего релизного контура и в работу расширения не входит.
