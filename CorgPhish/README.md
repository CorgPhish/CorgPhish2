# CorgPhish

## Overview (English)
- Chrome/Chromium MV3 extension for phishing detection.
- Flow: trusted.json + user whitelist → Levenshtein similarity → ONNX ML (binary: trusted/phishing) → content script overlay/block.
- Offline by design: model and trusted data ship with the extension.
- Bilingual UI (ru/en), light/dark themes, compact mode.
- History (up to 50), manual domain check, whitelist/blacklist management.
- Content script blocks forms/downloads on phishing and shows a full-screen overlay with actions.

## Обзор (Русский)
- Расширение MV3 для Chrome/Chromium: проверка по trusted.json, вашему белому списку, похожести (Левенштейн) и ML (бинарный вердикт).
- Работает локально: модель и trusted.json внутри расширения.
- Двуязычный UI, светлая/тёмная темы, компактный режим.
- История (до 50 записей), ручная проверка домена, управление белым/чёрным списками.
- Контент-скрипт при фишинге блокирует формы/загрузки и показывает полноэкранный оверлей с действиями.

## Structure / Структура
- `manifest.json` — MV3 declaration; permissions, WER for model/runtime, content/background wiring.
- `background.js` — сервис-воркер: кеш trusted.json, системные уведомления, закрытие вкладки.
- `content.js` — автоинспекция на странице, оверлей при phishing/ЧС, блок форм/скачиваний, временное разрешение (5 мин).
- `trusted.json` — каталог доверенных доменов (обновляемый).
- `models/` — ONNX модель (binary verdict).
- `vendor/ort/` — onnxruntime-web (JS + wasm).
- `popup/`
  - `config.js` — настройки по умолчанию, переводы, статусы UI.
  - `data.js` — trusted/whitelist/blacklist/history/settings storage helpers.
  - `utils.js` — нормализация хоста, Левенштейн, время.
  - `inspection.js` — инспекция домена: trusted/ЧС → Левенштейн → ML.
  - `model.js` — загрузка ORT, фичи из URL, бинарный вердикт.
  - `dom.js` — реестр DOM и безопасное навешивание событий.
  - `ui.js` — применение статусов, рендер списков/истории/списков.
  - `main.js` — точка входа попапа, события UI, история, сообщения в content script.
  - `i18n.js` — переводчик по ключам.
  - `popup.html/css` — разметка и стили попапа.

## Usage / Использование
1. Load unpacked: `chrome://extensions` → Developer mode → Load unpacked → `CorgPhish/`.
2. Open popup on any HTTP/HTTPS page:
   - Trusted/whitelist domain → “Легитимный сайт” / safe.
   - Similar domain (<=2 Levenshtein) → “Подозрительный, похож на доверенный”, ML runs.
   - ML phishing → “Опасный сайт”, страница блокируется (оверлей, формы/скачивания запрещены).
3. Manage lists:
   - Whitelist/Blacklist sections in Settings.
   - “Добавить в ЧС”/“Белый список” на карточке статуса.
   - Добавление в ЧС закрывает вкладку и блокирует дальнейшие заходы.
4. Manual check card: enter domain or full URL without visiting it.

## Dev notes
- Auto scan runs on popup open; content script also auto-inspects pages to show overlay without opening popup.
- Trusted additions live in `trusted.json`; lists in storage: `customTrustedDomains`, `customBlockedDomains`.
- Temporary allow (content) stored in `tempAllowDomains` for 5 minutes.
- History retention configurable (0/7/30/90 days).

## UI refresh checklist / Чек-лист обновления UI
- Keep IDs/data hooks intact: elements referenced in `popup/dom.js` and used by `ui.js`/`main.js` must remain (`statusBadge`, `statusTitle`, `statusHint`, `domainValue`, `sourceValue`, `riskLevel`, `recommendationsList`, buttons, forms).
- Layout freedom: you can reorder/reshape markup, but preserve element IDs and form names; avoid removing whitelist/blacklist sections and manual check form.
- Statuses are discrete (trusted / suspicious / phishing / blacklisted / unsupported / error); no percentages. Colors/themes can change.
- Overlay/blocks live in `content.js` — UI there can be restyled with inline/CSS, but keep button labels/actions (exit, add to blacklist, allow 5 min).
- CSS currently in `popup.css` only; no build step. Fonts: Inter/system stack; can extend palette but keep light/dark tokens.
