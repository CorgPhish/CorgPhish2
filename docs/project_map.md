# Карта проекта и подробное описание файлов

Ниже перечислены основные файлы/папки и их назначение. Это краткая «карта» для поддержки, демонстрации и дальнейшей разработки.

## Корень репозитория
- `README.md` — основной README (краткое описание, сборка, CI/CD, структура).
- `LICENSE` — лицензия MIT.
- `.gitignore` — исключения из git (IDE, артефакты сборки и т.д.).
- `dist/` — результаты локальной сборки (zip‑архивы). Не редактируется вручную.

## Исходники расширения: `CorgPhish/`
- `manifest.json` — манифест MV3, permissions, background, content scripts, web_accessible_resources. Главный файл для версии и разрешений.
- `background.js` — сервис‑воркер: кэш trusted списка, уведомления, обработка сообщений, fallback‑ML.
- `content.js` — контент‑скрипт: сбор сигналов страницы (формы/бренд), блокирующий оверлей, блокировка форм/загрузок.
- `offscreen.js` — offscreen‑страница для ML‑инференса (обход CSP, выполнение в расширении).
- `trusted.json` — встроенный список доверенных доменов + blacklist (используется сразу при проверке).

### UI попапа
- `popup.html` — разметка интерфейса попапа.
- `popup.css` — стили попапа.
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
- `icons/` — иконки расширения.
- `models/` — ONNX‑модель.
- `vendor/ort/` — runtime onnxruntime‑web (не редактировать вручную).

## Документация и материалы: `docs/`
- `docs/badges/` — svg‑бейджи для README.
- `docs/meta/CHANGELOG.md` — история изменений.
- `docs/meta/RELEASING.md` — инструкция по релизам.

## CI/CD и шаблоны
- `.github/workflows/build.yml` — сборка и проверка пакета.
- `.github/workflows/release.yml` — релиз по тегу.
- `.github/ISSUE_TEMPLATE/` — шаблоны Issues.
- `.github/PULL_REQUEST_TEMPLATE.md` — шаблон PR.

## Скрипты
- `scripts/verify.sh` — проверка перед сборкой: версия, состав, наличие файлов.
- `scripts/package.sh` — сборка zip‑архива для релиза.

## Что менять в первую очередь
- Версия релиза: `CorgPhish/manifest.json`.
- Список trusted: `CorgPhish/trusted.json`.
- Тексты UI: `CorgPhish/popup/config.js`.
- Логика вердикта: `CorgPhish/popup/inspection.js`.
- Внешний вид попапа: `CorgPhish/popup.html`, `CorgPhish/popup.css`.
- Блокировки/оверлей: `CorgPhish/content.js`.

## Релиз (вручную)
1) Обновить `version` в `CorgPhish/manifest.json`.
2) Обновить `docs/meta/CHANGELOG.md`.
3) Поставить тег `vX.Y.Z`.
4) Отправить тег на GitHub — CI/CD соберет релиз.

