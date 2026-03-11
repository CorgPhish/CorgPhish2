# CorgPhish

Локальное anti-phishing расширение для Chrome/Chromium.  
Проверяет URL и сигналы страницы офлайн, без внешних API-запросов.

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

## Содержание
- [Что умеет расширение](#что-умеет-расширение)
- [Скриншоты и демо](#скриншоты-и-демо)
- [Установка](#установка)
- [Локальная сборка](#локальная-сборка)
- [CI/CD](#cicd)
- [Структура репозитория](#структура-репозитория)
- [Где чаще всего вносят изменения](#где-чаще-всего-вносят-изменения)
- [Документация](#документация)
- [Contributing](#contributing)
- [Лицензия](#лицензия)

## Что умеет расширение
- Проверка домена и страницы локально (trusted/blacklist, эвристика, ML).
- Pre-click защита: предупреждение до открытия подозрительной ссылки.
- Анализ редирект-цепочки и признаков подмены бренда.
- Подсветка подозрительных ссылок (можно отключить в настройках).
- Блокировка рискованного ввода и переход на экран предупреждения.
- История проверок и ручное управление белым/черным списком.

## Скриншоты и демо
<p align="left">
  <img src="docs/badges/leg.png" alt="Главная панель" width="320" />
  <img src="docs/badges/phishing.png" alt="Экран блокировки" width="320" />
  <img src="docs/badges/history.png" alt="История проверок" width="320" />
  <img src="docs/badges/links_high.png" alt="Подсветка ссылок" width="320" />
  <img src="docs/settings/Screenshot%202026-01-16%20at%2018.31.32.png" alt="Настройки" width="320" />
</p>

- Запись экрана: [Screen Recording](docs/badges/Screen%20Recording%202026-01-16%20at%2018.26.26.mov)
- Демо-страница для теста подсветки: [docs/beta/index.html](docs/beta/index.html)

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

Результат:
- архив в `dist/`
- версия берется из `CorgPhish/manifest.json`

## CI/CD
- `build.yml`: проверка и упаковка на каждый `push` и `pull_request`.
- `release.yml`: автоматический релиз при пуше тега `vX.Y.Z`.

Релизный порядок:
1. Обновить `version` в `CorgPhish/manifest.json`.
2. Добавить запись в `docs/meta/CHANGELOG.md`.
3. Создать тег: `git tag vX.Y.Z`.
4. Отправить тег: `git push origin vX.Y.Z`.

## Структура репозитория
- `CorgPhish/` — исходный код расширения.
- `CorgPhish/popup/` — логика попапа, UI, ML/эвристика, storage.
- `CorgPhish/src/content/` — исходные модули контент-скрипта.
- `CorgPhish/content.js` — итоговый собранный файл контент-скрипта.
- `CorgPhish/models/` — ONNX-модель.
- `CorgPhish/vendor/ort/` — ONNX Runtime Web.
- `CorgPhish/trusted.json` — встроенный trusted-список.
- `docs/` — медиа, демо, changelog и release-документы.
- `.github/` — workflows и шаблоны Issues/PR.
- `scripts/` — скрипты проверки и упаковки.
- `dist/` — готовые ZIP-архивы для релизов.

## Что надо менять для тонкой настройки
- trusted список: `CorgPhish/trusted.json`
- тексты UI: `CorgPhish/popup/config.js`
- логика вердикта: `CorgPhish/popup/inspection.js`
- внешний вид попапа: `CorgPhish/popup.html`, `CorgPhish/popup.css`
- блокировка и поведение на странице: `CorgPhish/content.js`

## Где чаще всего вносят изменения
- Логика вердикта: `CorgPhish/popup/inspection.js`
- Модель и fallback: `CorgPhish/popup/model.js`
- Тексты интерфейса: `CorgPhish/popup/config.js`
- UI попапа: `CorgPhish/popup.html`, `CorgPhish/popup.css`
- Списки trusted: `CorgPhish/trusted.json`

Для обновления trusted-кэша удалите ключ `builtinTrustedDomains` из `chrome.storage.local` или переустановите расширение.

## Документация
- Техническое описание: [CorgPhish/README.md](CorgPhish/README.md)
- Навигация по репозиторию: [docs/navigation.md](docs/navigation.md)
- Карта проекта: [docs/project_map.md](docs/project_map.md)
- История изменений: [docs/meta/CHANGELOG.md](docs/meta/CHANGELOG.md)
- Релизный процесс: [docs/meta/RELEASING.md](docs/meta/RELEASING.md)
- Политика безопасности: [docs/meta/SECURITY.md](docs/meta/SECURITY.md)

## Contributing
Правила внесения изменений: [CONTRIBUTING.md](CONTRIBUTING.md)

## Лицензия
[MIT](LICENSE)
