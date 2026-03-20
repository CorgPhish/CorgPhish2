# CorgPhish — локальное расширение против фишинга (MV3)

CorgPhish — офлайн‑расширение для Chrome/Chromium, которое проверяет сайты при открытии, предупреждает о рисках и блокирует опасные страницы. Все списки, модель и эвристика работают локально: внешних запросов нет.

CorgPhish is an offline Chrome/Chromium extension that scans sites on open, warns about risks, and blocks dangerous pages. All lists, models, and heuristics run locally — no external requests.

[Русский](#русский) · [English](#english)

## Русский

### Содержание
- О проекте
- Ключевые возможности
- Результаты проверки (вердикты)
- Как работает (пайплайн)
- Технологии
- Архитектура и структура
- Данные и хранение
- Установка
- Использование
- Настройки
- Модель и эвристика
- Обновление и развитие стека
- Отладка
- Ограничения и заметки
- Лицензия

### О проекте
Расширение автоматически анализирует URL при открытии страницы, сверяет домен со встроенным списком доверенных сайтов и пользовательскими whitelist/blacklist, анализирует страницу на упоминания брендов и подозрительные формы, ищет похожие домены (Левенштейн/бренд‑токены), а затем (при необходимости) запускает локальную ML‑модель в формате ONNX. При высоком риске показывается полноэкранный оверлей с блокировкой форм и загрузок.

### Ключевые возможности
- Автопроверка HTTP/HTTPS‑страниц при открытии (content script `run_at: document_start`).
- Локальный список доверенных доменов `trusted.json` + пользовательский whitelist/blacklist.
- BrandGuard: поиск упоминаний брендов на странице и проверка соответствия домена.
- Form Action Guard: обнаружение форм, отправляющих данные на другой домен/IP/HTTP.
- Поиск похожих доменов (Левенштейн ≤ 2 + бренд‑токены) для выявления подмены.
- Локальный ML‑инференс (onnxruntime‑web + wasm) с фоллбек‑эвристикой.
- Полноэкранная блокировка подозрительных сайтов: запрет форм, загрузок, файловых input.
- Быстрые действия: выйти со страницы, добавить в ЧС, временно разрешить домен на 5 минут.
- Удобный попап: статус активной вкладки, история с фильтрами/поиском, проверка всех вкладок, быстрый переход на официальный домен.
- Строгий режим: все домены вне trusted/whitelist помечаются как подозрительные.
- Полностью офлайн — никаких удалённых запросов.

### Результаты проверки (вердикты)
- `trusted` — домен найден в trusted.json или в пользовательском whitelist, либо ML дал безопасный прогноз (если нет сигналов риска и строгий режим выключен).
- `suspicious` — домен похож на доверенный, найдено несоответствие бренда/подозрительная форма, или включён строгий режим. Это предупреждение (не блокирует страницу).
- `phishing` — ML подтвердил высокий риск.
- `blacklisted` — домен найден в пользовательском blacklist.
- `unsupported` — страница не HTTP/HTTPS (системные страницы и локальные файлы не анализируются).
- `error` — ошибка анализа.

### Как работает (пайплайн)
1. **Нормализация домена** — удаляем `www.`, нижний регистр, убираем точку в конце.
2. **Blacklist/Whitelist/Trusted** — мгновенная классификация на основе списков (включая поддомены).
3. **Сигналы страницы** — BrandGuard и Form Action Guard (только для активной вкладки).
4. **Похожесть** — поиск домена из trusted списка с расстоянием Левенштейна ≤ 2 + бренд‑токены.
5. **ML‑инференс** — локальная ONNX‑модель (через offscreen document или в контенте). Если ORT недоступен — эвристика.
6. **Строгий режим** — при включении переводит `trusted` в `suspicious`.
7. **Вердикт** — `trusted / suspicious / phishing / blacklisted`.
8. **Действия** — при `phishing/blacklisted` включается блокировка страницы, данные сохраняются в историю.

### Технологии
- **Chrome Extension Manifest V3**.
- **Service Worker** (`background/index.js`) для логики расширения и системных уведомлений.
- **Content Script** (`content/index.js`) для автоинспекции и блокировки страницы.
- **Offscreen Document API** (`offscreen/index.html`, `offscreen/offscreen.js`) для ML‑инференса, не зависящего от CSP сайта.
- **onnxruntime‑web (WASM)** — локальный инференс модели.
- **ONNX модель** (`assets/models/hybrid_tfidf_num.onnx`).
- **ES Modules** в попапе и фоне.
- **Chrome Storage** (`sync`, `local`, `managed`) для настроек и списков.

### Архитектура и структура
- `manifest.json` — MV3 конфигурация, разрешения, web‑resources.
- `background/index.js` — сервис‑воркер: кэш trusted.json, offscreen‑инференс, уведомления, закрытие вкладок.
- `offscreen/index.html`, `offscreen/offscreen.js` — sandbox‑среда для ORT, чтобы избежать CSP страницы.
- `content/index.js` — автоинспекция, оверлей, блокировка форм/загрузок, временные разрешения, сигналы страницы (бренд/формы).
- `trusted.json` — встроенный список доверенных доменов.
- `assets/models/` — ONNX‑модель.
- `assets/vendor/ort/` — onnxruntime‑web (js/wasm).
- `popup/` — UI попапа:
  - `popup/index.html`, `popup/popup.css` — разметка и стили.
  - `main.js` — точка входа.
  - `inspection.js` — логика проверки домена.
  - `model.js` — локальный ML‑инференс + фоллбеки.
  - `data.js` — доступ к trusted.json, политике, истории, спискам и настройкам.
  - `ui.js`, `dom.js`, `i18n.js`, `utils.js` — UI, переводы, вспомогательные утилиты.
- `assets/icons/` — иконки расширения.

### Данные и хранение
Хранение полностью локальное:

**chrome.storage.local**
- `builtinTrustedDomains`: кеш trusted.json (загружается в фоне на install/startup).
- `customTrustedDomains`: пользовательский whitelist.
- `customBlockedDomains`: пользовательский blacklist.
- `scanHistory`: история проверок (макс. 50 записей).
- `tempAllowDomains`: временные разрешения `{ domain: timestamp_ms }`.

**chrome.storage.sync**
- настройки интерфейса и поведения (ключи из `DEFAULT_SETTINGS`, включая `strictMode`).


**Формат trusted.json**
```json
{
  "trusted": ["example.com", "bank.com"]
}
```


### Установка
1. Откройте `chrome://extensions`.
2. Включите *Developer mode*.
3. Нажмите *Load unpacked* и выберите папку `apps/extension/`.
4. Перезагрузите нужные вкладки.

### Использование
- **Автопроверка**: при открытии HTTP/HTTPS страницы контент‑скрипт сам запускает инспекцию.
- **Попап**: показывает статус активной вкладки, рекомендации, быстрые действия, кнопку “Проверить всё”.
- **История**: хранит последние проверки, поддерживает поиск и фильтры, учитывает retention.
- **Списки**: whitelist/blacklist управляются через вкладку “Списки” в настройках.
- **Официальный сайт**: при подозрении на бренд‑подмену доступна кнопка быстрого перехода.
- **Блокировка**: при фишинге — оверлей, блок форм/загрузок, быстрые действия.

### Настройки
Доступны в попапе → Settings (вкладки “Опции”, “Списки”):
- **Язык**: ru/en.
- **Тема**: светлая/тёмная.
- **Автопроверка при открытии попапа**.
- **Уведомления в попапе о рисках**.
- **Строгий режим**.
- **Блокировка ввода и загрузок**.
- **Системные уведомления**.
- **Автоочистка истории (retention)**: 0/7/30/90 дней.
- **Компактный режим**.

### Модель и эвристика
**Модель** — ONNX, ожидает:
- вход `url` (string);
- числовые признаки (`FEATURE_COLUMNS`):
  - length_url
  - qty_dot_url
  - qty_hyphen_url
  - qty_underline_url
  - qty_slash_url
  - qty_questionmark_url
  - qty_equal_url
  - qty_at_url
  - qty_and_url
  - qty_exclamation_url
  - qty_space_url
  - qty_tilde_url
  - qty_comma_url
  - qty_plus_url
  - qty_asterisk_url
  - qty_hashtag_url
  - qty_dollar_url
  - qty_percent_url
  - domain_length
  - qty_dot_domain
  - qty_hyphen_domain
  - qty_underline_domain
  - domain_in_ip

**Выход модели** — probability/label. Вердикт считается по порогу `MODEL_THRESHOLD` (по умолчанию 0.7).

**Фоллбек‑эвристика**: если ORT/ONNX недоступен, используется простая модель риска на основе длины URL, спецсимволов, IP‑домена и количества точек.

### Обновление и развитие стека
Ниже — практические шаги, как обновлять и улучшать систему.

#### 1) Обновить trusted список
- Отредактируйте `trusted.json`.
- Перезагрузите расширение в `chrome://extensions`.
- При необходимости очистите кеш: удалите `builtinTrustedDomains` из `chrome.storage.local` (или переустановите расширение).

#### 2) Обновить/заменить ML‑модель
1. Замените файл в `assets/models/` (рекомендуется сохранить имя `hybrid_tfidf_num.onnx`).
2. Если имя другое — обновите:
   - `MODEL_PATH` в `popup/model.js` и `offscreen/offscreen.js`;
   - `manifest.json` в `web_accessible_resources`.
3. Убедитесь, что входы модели совпадают с `FEATURE_COLUMNS` и `url`.
4. Если выходы имеют другое имя — адаптируйте выбор тензора в `popup/model.js` и `offscreen/offscreen.js`.
5. Проверьте работу на тестовых доменах.

#### 3) Смена/добавление признаков
**ВАЖНО:** признаки продублированы в трёх файлах, они должны быть синхронизированы:
- `popup/model.js` (FEATURE_COLUMNS + extractFeatures + эвристика)
- `offscreen/offscreen.js` (FEATURE_COLUMNS + extractFeatures + эвристика)
- `background/index.js` (FEATURE_COLUMNS + extractFeatures + эвристика)

Меняете набор признаков — меняйте сразу все три места и модель.

#### 4) Изменить порог риска
- `popup/config.js` → `MODEL_THRESHOLD`
- `offscreen/offscreen.js` → `DEFAULT_THRESHOLD` (отдельная константа)

#### 5) Обновить onnxruntime‑web
1. Замените файлы в `assets/vendor/ort/`.
2. Проверьте список файлов в `manifest.json` → `web_accessible_resources`.
3. Убедитесь, что `ort.env.wasm.wasmPaths` указывает на актуальные wasm файлы.

#### 6) Обновить UI/локализацию
- Разметка: `popup/index.html`
- Стили: `popup/popup.css`
- Тексты: `popup/config.js` → `translations`

Важное правило: **ID и классы, которые используются в JS, должны оставаться стабильными.**

#### 7) Изменить оверлей и блокировки
- Оверлей создаётся в `content/index.js` и изолирован в Shadow DOM.
- Блокировка форм/загрузок — в `blockInteractions()`.
- Список блокируемых расширений — `BLOCKED_FILE_EXT`.

#### 8) Подключение настроек к поведению
В UI уже есть переключатели, но некоторые из них пока не влияют на логику:
- `autoCheckOnOpen`
- `blockOnUntrusted`
- `systemNotifyOnRisk`

Чтобы подключить:
- используйте `currentSettings` из `popup/main.js` для условного вызова `checkActiveTab()`;
- прокиньте настройки в контент‑скрипт через `chrome.storage` или `chrome.runtime.sendMessage`;
- отправляйте сообщения типа `riskNotification` в `background/index.js` для системных уведомлений.

#### 9) Добавить ручную проверку домена
Логика уже есть в `popup/main.js`, но в `popup/index.html` нет формы.
Добавьте блок с ID:
- `manualForm`, `manualInput`, `manualHint`

Тексты и стили уже подготовлены в `popup/config.js` и `popup/popup.css`.

#### 10) Версионирование и релиз
- Поднимайте `version` в `manifest.json`.
- Пересоберите/упакуйте расширение (или перезагрузите в Dev Mode).

### Отладка
- **Попап:** `chrome://extensions` → Inspect views.
- **Контент‑скрипт:** DevTools вкладки → Console.
- **Background (Service Worker):** `chrome://extensions` → Service Worker → Inspect.

Если видите `ort_load_failed` — включился фоллбек‑эвристика, это ожидаемо при жёстком CSP.

### Ограничения и заметки
- Проверяются только HTTP/HTTPS страницы.
- Жёсткий CSP может блокировать ORT в контенте, но offscreen‑документ обычно работает.
- Модель бинарная (trusted/phishing) и лёгкая; для критичных сценариев используйте whitelist/blacklist.
- Часть UI‑переключателей пока не влияет на логику (см. раздел «Подключение настроек»).
- Сигналы BrandGuard/Form Action Guard доступны только при проверке активной вкладки через попап.

### Лицензия
MIT.

## English

### Table of contents
- About
- Key features
- Verdicts
- Pipeline
- Technologies
- Architecture
- Data & storage
- Installation
- Usage
- Settings
- Model & heuristic
- Maintenance guide
- Debugging
- Limitations
- License

### About
The extension automatically analyzes URLs on page open, compares domains with trusted/whitelist/blacklist, checks brand mentions and suspicious forms, searches for similar domains (Levenshtein/brand tokens), and runs a local ONNX ML model when needed. High‑risk pages show a full‑screen overlay with blocked forms and downloads.

### Key features
- Auto scan for HTTP/HTTPS pages (content script `run_at: document_start`).
- Local trusted list `trusted.json` + user whitelist/blacklist.
- BrandGuard: brand mention detection and domain mismatch checks.
- Form Action Guard: forms posting to another domain/IP/HTTP.
- Similar domain detection (Levenshtein ≤ 2 + brand tokens).
- Local ML inference (onnxruntime‑web + wasm) with heuristic fallback.
- Full‑screen blocking on risky pages: forms, downloads, file inputs.
- Quick actions: exit, blacklist, temporary allow (5 minutes).
- Polished popup: status, scan history, filters, scan all tabs, open official domain.
- Strict mode: non‑trusted domains become suspicious.
- Fully offline.

### Verdicts
- `trusted` — in trusted.json or user whitelist, or ML marks trusted (no risk signals, strict mode off).
- `suspicious` — similar to trusted, brand mismatch, suspicious form, or strict mode. Warning only (no blocking).
- `phishing` — ML confirmed high risk.
- `blacklisted` — in user blacklist.
- `unsupported` — not HTTP/HTTPS.
- `error` — scan failure.

### Pipeline
1. **Domain normalization** — strip `www.`, lowercase, remove trailing dot.
2. **Blacklist/Whitelist/Trusted** — immediate classification (including subdomains).
3. **Page signals** — BrandGuard and Form Action Guard (active tab only).
4. **Similarity** — search trusted list with Levenshtein ≤ 2 + brand tokens.
5. **ML inference** — local ONNX model (via offscreen or content). If ORT fails — heuristic fallback.
6. **Strict mode** — turns `trusted` into `suspicious`.
7. **Verdict** — `trusted / suspicious / phishing / blacklisted`.
8. **Actions** — phishing/blacklisted triggers blocking and history logging.

### Technologies
- **Chrome Extension Manifest V3**.
- **Service Worker** (`background/index.js`) for logic and notifications.
- **Content Script** (`content/index.js`) for auto inspection and blocking.
- **Offscreen Document API** (`offscreen/index.html`, `offscreen/offscreen.js`) for ML inference independent of CSP.
- **onnxruntime‑web (WASM)** — local model inference.
- **ONNX model** (`assets/models/hybrid_tfidf_num.onnx`).
- **ES Modules** in popup and background.
- **Chrome Storage** (`sync`, `local`, `managed`) for settings and lists.

### Architecture
- `manifest.json` — MV3 config, permissions, web resources.
- `background/index.js` — service worker: trusted cache, offscreen inference, notifications, tab closing.
- `offscreen/index.html`, `offscreen/offscreen.js` — isolated ORT runtime.
- `content/index.js` — auto inspection, overlay, blocking, temp allow, page signals (brand/forms).
- `trusted.json` — built‑in trusted domains.
- `assets/models/` — ONNX model.
- `assets/vendor/ort/` — onnxruntime‑web assets.
- `popup/` — popup UI code.
- `assets/icons/` — extension icons.

### Data & storage
All storage is local:

**chrome.storage.local**
- `builtinTrustedDomains`: cached trusted.json.
- `customTrustedDomains`: user whitelist.
- `customBlockedDomains`: user blacklist.
- `scanHistory`: scan history (max 50 entries).
- `tempAllowDomains`: temporary allow map.

**chrome.storage.sync**
- UI and behavior settings (keys from `DEFAULT_SETTINGS`).


**trusted.json format**
```json
{
  "trusted": ["example.com", "bank.com"]
}
```


### Installation
1. Open `chrome://extensions`.
2. Enable *Developer mode*.
3. Click *Load unpacked* and select `apps/extension/`.
4. Reload target tabs.

### Usage
- **Auto scan**: content script runs automatically on HTTP/HTTPS pages.
- **Popup**: status, recommendations, quick actions, “Scan all tabs”.
- **History**: stores recent scans with search and filters.
- **Lists**: whitelist/blacklist via the “Lists” tab in settings.
- **Official site**: quick link to official domain when brand spoofing is detected.
- **Blocking**: phishing verdict triggers overlay and input/download blocks.

### Settings
Popup → Settings (tabs “Options”, “Lists”):
- **Language**: ru/en.
- **Theme**: light/dark.
- **Auto scan on popup open**.
- **Popup risk alerts**.
- **Strict mode**.
- **Block input & downloads**.
- **System notifications**.
- **History retention**: 0/7/30/90 days.
- **Compact mode**.

### Model & heuristic
**Model** — ONNX, expects:
- `url` (string);
- numerical features (`FEATURE_COLUMNS`) listed in source.

**Model output** — probability/label. Verdict uses threshold `MODEL_THRESHOLD` (default 0.7).

**Fallback heuristic**: if ORT/ONNX fails, a lightweight risk model based on URL length, special chars, IP domains, and dot count is used.

### Maintenance guide
#### 1) Update trusted list
- Edit `trusted.json`.
- Reload extension in `chrome://extensions`.
- Clear cache by deleting `builtinTrustedDomains` from `chrome.storage.local` if needed.

#### 2) Update/replace ML model
1. Replace file in `assets/models/` (keep name `hybrid_tfidf_num.onnx` if possible).
2. If renamed, update:
   - `MODEL_PATH` in `popup/model.js` and `offscreen/offscreen.js`;
   - `manifest.json` web_accessible_resources.
3. Ensure model inputs match `FEATURE_COLUMNS` and `url`.
4. Update tensor output name in `popup/model.js` and `offscreen/offscreen.js` if needed.

#### 3) Add/change features
**IMPORTANT:** features are duplicated in three files and must stay in sync:
- `popup/model.js`
- `offscreen/offscreen.js`
- `background/index.js`

#### 4) Change risk threshold
- `popup/config.js` → `MODEL_THRESHOLD`
- `offscreen/offscreen.js` → `DEFAULT_THRESHOLD`

#### 5) Update onnxruntime‑web
1. Replace files in `assets/vendor/ort/`.
2. Check `manifest.json` web_accessible_resources list.
3. Verify `ort.env.wasm.wasmPaths`.

#### 6) Update UI/localization
- Markup: `popup/index.html`
- Styles: `popup/popup.css`
- Text: `popup/config.js` → `translations`

IDs/classes used in JS must stay stable.

#### 7) Update overlay & blocking
- Overlay lives in `content/index.js` (Shadow DOM).
- Blocking logic in `blockInteractions()`.
- Blocked file extensions: `BLOCKED_FILE_EXT`.

#### 8) Wire settings to behavior
Some toggles exist in UI but are not fully wired yet:
- `autoCheckOnOpen`
- `blockOnUntrusted`
- `systemNotifyOnRisk`

To wire them:
- use `currentSettings` in `popup/main.js` to gate `checkActiveTab()`;
- pass settings to content script via storage or messages;
- send `riskNotification` to `background/index.js` for system notifications.

#### 9) Add manual domain check
Logic exists in `popup/main.js` but the form is missing in `popup/index.html`.
Add elements with IDs:
- `manualForm`, `manualInput`, `manualHint`

Texts/styles are already in `popup/config.js` and `popup/popup.css`.

#### 10) Versioning & release
- Bump `version` in `manifest.json`.
- Repack or reload extension.

### Debugging
- **Popup:** `chrome://extensions` → Inspect views.
- **Content script:** tab DevTools → Console.
- **Background:** `chrome://extensions` → Service Worker → Inspect.

If you see `ort_load_failed`, the heuristic fallback is active (expected under strict CSP).

### Limitations
- Only HTTP/HTTPS pages are scanned.
- Strict CSP can block ORT in content scripts, but offscreen usually works.
- The ML model is binary (trusted/phishing); for critical cases use whitelist/blacklist.
- Some UI toggles are not wired yet (see “Wire settings to behavior”).
- BrandGuard/Form Action Guard signals are available only for active tab checks.

### License
MIT.
