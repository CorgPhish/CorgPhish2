# CorgPhish

CorgPhish — локальное анти‑фишинг расширение для Chrome/Chromium. Работает офлайн, без внешних запросов. Проверяет домены, формы и признаки подмены, показывает понятный источник вердикта и при необходимости блокирует рискованные действия.

<p align="left">
  <img src="docs/badges/offline.svg" alt="offline badge" />
  <img src="docs/badges/mv3.svg" alt="mv3 badge" />
  <a href="https://github.com/physcorgi/CorgPhish2/actions/workflows/build.yml">
    <img src="https://github.com/physcorgi/CorgPhish2/actions/workflows/build.yml/badge.svg" alt="build status" />
  </a>
</p>

## Быстрый старт (установка)
1. Откройте `chrome://extensions`.
2. Включите **Developer mode**.
3. Нажмите **Load unpacked** и выберите папку `CorgPhish/`.
4. Обновите вкладку и откройте попап расширения.

## Локальная сборка и пересборка
```bash
./scripts/verify.sh
./scripts/package.sh
```
- Архив появится в `dist/`.
- Версия берется из `CorgPhish/manifest.json`.

## CI/CD
- `.github/workflows/build.yml` — сборка и проверка пакета.
- `.github/workflows/release.yml` — выпуск релиза по тегу.
- Для релиза: обновите `version` в `CorgPhish/manifest.json`, добавьте запись в `docs/meta/CHANGELOG.md`, создайте тег `vX.Y.Z` и отправьте его на GitHub.

## Структура проекта (папки и файлы)
- `CorgPhish/` — исходники расширения.
- `CorgPhish/manifest.json` — манифест и permissions.
- `CorgPhish/background.js` — сервис‑воркер, кэш trusted списка, фоновая логика.
- `CorgPhish/content.js` — сигналы страницы и блокирующий оверлей.
- `CorgPhish/offscreen.js` — offscreen‑контекст для локальных вычислений.
- `CorgPhish/popup.html` — разметка попапа.
- `CorgPhish/popup.css` — стили попапа.
- `CorgPhish/popup/main.js` — основной контроллер попапа.
- `CorgPhish/popup/inspection.js` — логика вердикта.
- `CorgPhish/popup/data.js` — работа со storage и списками.
- `CorgPhish/popup/model.js` — локальная модель и fallback‑логика.
- `CorgPhish/popup/utils.js` — нормализация доменов и похожесть.
- `CorgPhish/popup/config.js` — настройки по умолчанию и тексты.
- `CorgPhish/trusted.json` — встроенный список доверенных доменов.
- `CorgPhish/models/` — файлы модели.
- `CorgPhish/vendor/ort/` — runtime для модели.
- `CorgPhish/icons/` — иконки.
- `docs/` — сайт проекта, скриншоты и материалы.
- `docs/index.html` — статический сайт проекта.
- `docs/screenshots/` — изображения UI.
- `docs/meta/` — changelog, гайды и политики.
- `scripts/` — локальные скрипты сборки.
- `.github/` — шаблоны Issues/PR и CI/CD.
- `dist/` — результаты сборки (zip‑архивы).
- `LICENSE` — лицензия.

## Что обычно меняют
- trusted список: `CorgPhish/trusted.json`.
- тексты UI: `CorgPhish/popup/config.js`.
- логика вердикта: `CorgPhish/popup/inspection.js`.
- внешний вид попапа: `CorgPhish/popup.html`, `CorgPhish/popup.css`.
- блокировка и поведение на странице: `CorgPhish/content.js`.

## Обновление trusted списка
1. Отредактируйте `CorgPhish/trusted.json`.
2. Если нужно обновить кэш, удалите ключ `builtinTrustedDomains` из `chrome.storage.local` или переустановите расширение.

## Документация
- Техническая документация: `CorgPhish/README.md`.
- История изменений: `docs/meta/CHANGELOG.md`.
- Гайд по релизу: `docs/meta/RELEASING.md`.
- Security policy: `docs/meta/SECURITY.md`.

## Примечания
- Корпоративная версия живет в отдельном репозитории.

## Лицензия
MIT — см. `LICENSE`.
