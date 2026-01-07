# CorgPhish

CorgPhish — локальное расширение против фишинга для Chrome/Chromium. Работает офлайн и не отправляет данные наружу.

CorgPhish is a local anti‑phishing extension for Chrome/Chromium. It runs fully offline with no external requests.

<p align="left">
  <img src="docs/badges/offline.svg" alt="offline badge" />
  <img src="docs/badges/mv3.svg" alt="mv3 badge" />
  <img src="docs/badges/local-ml.svg" alt="local ml badge" />
  <img src="docs/badges/enterprise.svg" alt="enterprise badge" />
</p>

- [Русский](#русский)
- [English](#english)

## Screenshots / Скриншоты

<p align="left">
  <img src="docs/screenshots/popup-main.svg" width="240" alt="Popup main preview" />
  <img src="docs/screenshots/popup-enterprise.svg" width="240" alt="Corporate settings preview" />
  <img src="docs/screenshots/block-overlay.svg" width="240" alt="Blocking overlay preview" />
</p>

## How it works / Как работает

<img src="docs/diagram/how-it-works.svg" alt="How it works diagram" />

## Русский

### О проекте
CorgPhish проверяет URL при открытии страницы, сопоставляет домен с trusted/whitelist/blacklist, ищет признаки подмены (бренд‑упоминания, подозрительные формы, похожие домены), а затем запускает локальную ML‑модель. При высоком риске включается блокировка форм и загрузок.

### Быстрый старт
1. Откройте `chrome://extensions`.
2. Включите **Developer mode**.
3. Нажмите **Load unpacked** и выберите папку `CorgPhish/`.
4. Обновите вкладку с сайтом и откройте попап расширения.

### Возможности
- Офлайн‑проверка HTTP/HTTPS страниц.
- trusted.json + пользовательские whitelist/blacklist.
- BrandGuard: поиск упоминаний брендов на странице.
- Form Action Guard: анализ доменов, куда отправляются формы.
- Похожесть доменов (Левенштейн + бренд‑токены).
- Локальный ML‑инференс (onnxruntime‑web) с эвристическим фоллбеком.
- Блокировка форм/скачиваний на опасных страницах.
- История проверок, фильтры, ручная проверка доменов.
- Корпоративный режим (allow/deny списки, warn/block).

### Корпоративный режим
Политика задаёт allow/deny домены и режим реакции (off/warn/block). Поддерживается `chrome.storage.managed` для управления политикой администратором.

**Как работает:**
- `allowlist`: если список не пустой, любой домен вне него считается нарушением.
- `denylist`: домены всегда считаются запрещёнными.
- Проверяется домен текущей страницы и домен, куда отправляется форма (`action`).
- `warn` → вердикт `suspicious` (предупреждение в UI).
- `block` → блокировка ввода и загрузок + оверлей в контент‑скрипте.
- `managed` политика делает UI “только чтение”.

**Конфиг:** `enterprise.json` (по умолчанию) или `chrome.storage.local` (`enterprisePolicy`). Managed политика перекрывает локальную.

```json
{
  "mode": "warn",
  "allowlist": ["corp.com"],
  "denylist": ["badcorp.com"]
}
```

### Структура репозитория
- `CorgPhish/` — код расширения (MV3).
- `.github/` — шаблоны Issues/PR.
- `README.md`, `LICENSE`, `CHANGELOG.md` — документация и метаданные.

### Документация
- Полная техническая документация: `CorgPhish/README.md`.

### Лицензия
MIT — см. `LICENSE`.

## English

### About
CorgPhish inspects URLs on page load, checks trusted/whitelist/blacklist, detects spoofing signals (brand mentions, suspicious form actions, domain similarity), then runs a local ML model. High‑risk pages are blocked for forms and downloads.

### Quick start
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `CorgPhish/` folder.
4. Reload a target tab and open the extension popup.

### Features
- Offline scanning of HTTP/HTTPS pages.
- trusted.json + user whitelist/blacklist.
- BrandGuard: brand mention detection on page.
- Form Action Guard: checks form submission domains.
- Domain similarity (Levenshtein + brand tokens).
- Local ML inference (onnxruntime‑web) with heuristic fallback.
- Blocking of forms/downloads on risky pages.
- Scan history, filters, manual domain checks.
- Corporate mode (allow/deny lists, warn/block).

### Corporate mode
Policy defines allow/deny domains and reaction mode (off/warn/block). Supports `chrome.storage.managed` for admin‑managed policies.

**How it works:**
- `allowlist`: if not empty, anything outside is treated as a violation.
- `denylist`: domains are always restricted.
- Checks the current page domain and the form `action` domain.
- `warn` → `suspicious` verdict (UI warning).
- `block` → blocks input/downloads and shows the overlay.
- `managed` policy makes the UI read‑only.

**Config:** `enterprise.json` (default) or `chrome.storage.local` (`enterprisePolicy`). Managed policy overrides local.

```json
{
  "mode": "warn",
  "allowlist": ["corp.com"],
  "denylist": ["badcorp.com"]
}
```

### Repository layout
- `CorgPhish/` — extension code (MV3).
- `.github/` — Issue/PR templates.
- `README.md`, `LICENSE`, `CHANGELOG.md` — docs and metadata.

### Documentation
- Full technical documentation: `CorgPhish/README.md`.

### License
MIT — see `LICENSE`.
