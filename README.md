# CorgPhish

CorgPhish — локальное анти‑фишинг расширение для Chrome/Chromium. Всё работает офлайн, без внешних запросов.

CorgPhish is a local anti‑phishing extension for Chrome/Chromium. Everything runs offline with no external requests.

<p align="left">
  <img src="docs/badges/offline.svg" alt="offline badge" />
  <img src="docs/badges/mv3.svg" alt="mv3 badge" />
  <img src="docs/badges/local-ml.svg" alt="local ml badge" />
  <a href="https://github.com/physcorgi/CorgPhish2/actions/workflows/build.yml">
    <img src="https://github.com/physcorgi/CorgPhish2/actions/workflows/build.yml/badge.svg" alt="build status" />
  </a>
</p>

## Русский

### О проекте
CorgPhish анализирует URL при открытии страницы, сверяет домены со встроенным trusted списком и пользовательскими whitelist/blacklist, ищет признаки подмены (бренд‑упоминания, подозрительные формы, похожие домены), затем запускает локальную ML‑модель. При высоком риске включается блокировка форм и загрузок.

### Быстрый старт
1. Откройте `chrome://extensions`.
2. Включите **Developer mode**.
3. Нажмите **Load unpacked** и выберите папку `CorgPhish/`.
4. Обновите вкладку и откройте попап расширения.

### Возможности
- Офлайн‑проверка HTTP/HTTPS страниц.
- trusted.json + пользовательский whitelist/blacklist.
- BrandGuard: поиск упоминаний брендов на странице.
- Form Action Guard: анализ доменов, куда отправляются формы.
- Похожесть доменов (Левенштейн + бренд‑токены).
- Локальный ML‑инференс (onnxruntime‑web) с эвристическим фоллбеком.
- Блокировка форм/скачиваний на опасных страницах.
- История проверок, фильтры, ручная проверка доменов.

### Как работает (коротко)
1. Нормализация домена.
2. Проверка trusted/whitelist/blacklist.
3. Сигналы страницы (бренд/формы) для активной вкладки.
4. Похожесть доменов (Левенштейн + бренд‑токены).
5. ML‑инференс (ONNX) или эвристика.
6. Вердикт и действия (блокировка при риске).

### Скриншоты

<p align="left">
  <img src="docs/screenshots/popup-main.svg" width="240" alt="Popup main preview" />
  <img src="docs/screenshots/block-overlay.svg" width="240" alt="Blocking overlay preview" />
</p>

### Документация
- Техническая документация: `CorgPhish/README.md`.
- История изменений: `docs/meta/CHANGELOG.md`.
- Гайд по релизу: `docs/meta/RELEASING.md`.
- Security policy: `docs/meta/SECURITY.md`.
- Contributing: `docs/meta/CONTRIBUTING.md`.
- Code of Conduct: `docs/meta/CODE_OF_CONDUCT.md`.
- GitHub templates (не активны): `docs/meta/github/`.

### Локальная сборка
```bash
./scripts/verify.sh
./scripts/package.sh
```

### Релизы
- Тег `vX.Y.Z` должен совпадать с `version` в `CorgPhish/manifest.json`.
- GitHub Actions соберёт zip и создаст Release.
- Подробнее: `docs/meta/RELEASING.md`.

### Важно
- Корпоративная версия вынесена отдельно (отдельный репозиторий/сборка).
- GitHub templates перемещены в `docs/meta/github/`; если нужно вернуть форму Issue/PR в GitHub, переместите их обратно в `.github/`.

### Лицензия
MIT — см. `LICENSE`.

## English

### About
CorgPhish analyzes URLs on page open, checks trusted/whitelist/blacklist, detects spoofing signals (brand mentions, suspicious forms, domain similarity), and runs a local ML model. High‑risk pages are blocked for forms and downloads.

### Quick start
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `CorgPhish/` folder.
4. Reload a tab and open the extension popup.

### Features
- Offline scanning of HTTP/HTTPS pages.
- trusted.json + user whitelist/blacklist.
- BrandGuard: brand mention detection on page.
- Form Action Guard: checks form submission domains.
- Domain similarity (Levenshtein + brand tokens).
- Local ML inference (onnxruntime‑web) with heuristic fallback.
- Blocking of forms/downloads on risky pages.
- Scan history, filters, manual domain checks.

### How it works (short)
1. Normalize domain.
2. Check trusted/whitelist/blacklist.
3. Page signals (brand/forms) for active tab.
4. Domain similarity (Levenshtein + brand tokens).
5. ML inference (ONNX) or heuristic fallback.
6. Verdict and actions (blocking on risk).

### Screenshots

<p align="left">
  <img src="docs/screenshots/popup-main.svg" width="240" alt="Popup main preview" />
  <img src="docs/screenshots/block-overlay.svg" width="240" alt="Blocking overlay preview" />
</p>

### Documentation
- Technical documentation: `CorgPhish/README.md`.
- Changelog: `docs/meta/CHANGELOG.md`.
- Release guide: `docs/meta/RELEASING.md`.
- Security policy: `docs/meta/SECURITY.md`.
- Contributing: `docs/meta/CONTRIBUTING.md`.
- Code of Conduct: `docs/meta/CODE_OF_CONDUCT.md`.
- GitHub templates (inactive): `docs/meta/github/`.

### Local build
```bash
./scripts/verify.sh
./scripts/package.sh
```

### Releases
- Tag `vX.Y.Z` must match `version` in `CorgPhish/manifest.json`.
- GitHub Actions builds the zip and creates a Release.
- Details: `docs/meta/RELEASING.md`.

### Notes
- Corporate edition lives in a separate repo/build.
- GitHub templates were moved to `docs/meta/github/`; move them back into `.github/` to enable Issue/PR forms.

### License
MIT — see `LICENSE`.
