// Ссылки на элементы интерфейса / References to UI elements
const dom = {
    app: document.getElementById("app"),
    viewMain: document.getElementById("viewMain"),
    viewHistory: document.getElementById("viewHistory"),
    viewSettings: document.getElementById("viewSettings"),
    statusBadge: document.getElementById("statusBadge"),
    statusTitle: document.getElementById("statusTitle"),
    statusHint: document.getElementById("statusHint"),
    domainValue: document.getElementById("domainValue"),
    checkedAt: document.getElementById("checkedAt"),
    recommendationsList: document.getElementById("recommendationsList"),
    riskLevel: document.getElementById("riskLevel"),
    refreshBtn: document.getElementById("refreshBtn"),
    openSettingsBtn: document.getElementById("openSettingsBtn"),
    openHistoryBtn: document.getElementById("openHistoryBtn"),
    closeHistoryBtn: document.getElementById("closeHistoryBtn"),
    closeSettingsBtn: document.getElementById("closeSettingsBtn"),
    historyList: document.getElementById("historyList"),
    historyEmpty: document.getElementById("historyEmpty"),
    clearHistoryBtn: document.getElementById("clearHistoryBtn"),
    autoCheckInput: document.getElementById("autoCheckInput"),
    alertInput: document.getElementById("alertInput"),
    themeToggle: document.getElementById("themeToggle"),
    languageSelect: document.getElementById("languageSelect"),
    settingsStatus: document.getElementById("settingsStatus"),
    whitelistForm: document.getElementById("whitelistForm"),
    whitelistInput: document.getElementById("whitelistInput"),
    whitelistList: document.getElementById("whitelistList"),
    mlCheckBtn: document.getElementById("mlCheckBtn"),
    mlStatus: document.getElementById("mlStatus")
};

// Настройки по умолчанию / Default extension settings
const DEFAULT_SETTINGS = {
    autoCheckOnOpen: true,
    warnOnUntrusted: true,
    theme: "dark",
    language: "ru"
};

// Таблица переводов интерфейса / UI translation dictionary
const translations = {
    ru: {
        "main.subtitle": "Главная панель защиты",
        "actions.refresh": "Перепроверить",
        "actions.settings": "Настройки",
        "actions.history": "История проверок",
        "actions.back": "Назад",
        "status.domainLabel": "Домен",
        "status.sourceLabel": "Источник проверки",
        "status.lastCheck": "Последняя проверка:",
        "status.pending.badge": "Проверяем...",
        "status.pending.title": "Анализируем активную вкладку",
        "status.pending.hint": "Сравниваем адрес с актуальным каталогом доверенных сайтов.",
        "status.pending.risk": "ожидание данных",
        "status.pending.recommendations.0": "Убедитесь, что вкладка, которую нужно проверить, активна.",
        "status.pending.recommendations.1": "Подождите пару секунд, пока завершится анализ.",
        "status.trusted.badge": "Доверенный сайт",
        "status.trusted.title": "Сайт {domain} подтверждён",
        "status.trusted.hint": "Домен найден в локальном списке доверенных ресурсов.",
        "status.trusted.risk": "низкий риск",
        "status.trusted.recommendations.0": "Всегда проверяйте адрес вручную перед вводом данных.",
        "status.trusted.recommendations.1": "Используйте менеджер паролей и двухфакторную аутентификацию.",
        "status.untrusted.badge": "Подозрительный сайт",
        "status.untrusted.title": "Сайт {domain} не найден в каталоге",
        "status.untrusted.hint": "Это может быть новая площадка или потенциальный фишинг.",
        "status.untrusted.risk": "высокий риск",
        "status.untrusted.recommendations.0": "Не вводите личные данные до подтверждения подлинности сайта.",
        "status.untrusted.recommendations.1": "Сверьте адрес с официальным доменом организации.",
        "status.untrusted.recommendations.2": "Поищите отзывы и упоминания домена {domain} в открытых источниках.",
        "status.untrusted.spoofWarning": "Похоже на {spoofTarget}. Возможный спуфинг.",
        "status.unsupported.badge": "Нельзя проверить",
        "status.unsupported.title": "Поддерживаются только сайты HTTP/HTTPS",
        "status.unsupported.hint": "Системные страницы браузера и локальные файлы пропускаются.",
        "status.unsupported.risk": "не определено",
        "status.unsupported.recommendations.0": "Перейдите на веб-сайт в браузере и повторите проверку.",
        "status.unsupported.recommendations.1": "Закройте окно и активируйте нужную вкладку.",
        "status.error.badge": "Ошибка проверки",
        "status.error.title": "Что-то пошло не так",
        "status.error.hint": "Не удалось выполнить проверку. {error}",
        "status.error.risk": "неизвестно",
        "status.error.recommendations.0": "Перезапустите расширение или обновите страницу.",
        "status.error.recommendations.1": "Убедитесь, что файл trusted.json не повреждён.",
        "recommendations.title": "Рекомендации",
        "recommendations.initial": "Держите вкладку открытой, чтобы мы могли её проанализировать.",
        "recommendations.empty": "Рекомендации отсутствуют.",
        "quickActions.title": "Дополнительно",
        "ml.title": "ML-анализ",
        "ml.description": "В ближайшем обновлении CorgPhish подключит модель машинного обучения для анализа поведенческих признаков фишинга.",
        "ml.button": "Смоделировать анализ",
        "ml.note": "ML-модуль пока недоступен. Используем локальный список доверенных доменов.",
        "ml.status.running": "Запрашиваем результаты у ML-модуля...",
        "ml.status.safe": "ML-модуль (эмуляция) не нашёл подозрительных признаков.",
        "ml.status.alert": "ML-модуль (эмуляция) рекомендует проявить осторожность.",
        "footer.note": "CorgPhish проверяет только сайты по протоколам HTTP/HTTPS и работает локально.",
        "history.title": "История проверок",
        "history.subtitle": "Последние результаты анализа",
        "history.sectionTitle": "Последние проверки",
        "history.empty": "Пока нет данных. Проверьте сайт.",
        "history.clear": "Очистить",
        "history.note": "Хранится не более 50 последних проверок. Данные локальны.",
        "history.badge.trusted": "Доверенный",
        "history.badge.alert": "Опасно",
        "settings.title": "Настройки",
        "settings.subtitle": "Управляйте поведением CorgPhish",
        "settings.options": "Опции защиты",
        "settings.language.title": "Язык интерфейса",
        "settings.language.desc": "Переключайте русский и английский языки.",
        "settings.theme.title": "Тема интерфейса",
        "settings.theme.desc": "Переключайте светлый и тёмный режимы.",
        "settings.autoCheck.title": "Автопроверка при открытии",
        "settings.autoCheck.desc": "Автоматически запускать анализ при появлении попапа.",
        "settings.alerts.title": "Уведомления о рисках",
        "settings.alerts.desc": "Показывать предупреждение при подозрительном сайте.",
        "settings.status.default": "Изменения сохраняются автоматически.",
        "settings.status.saved": "Настройки сохранены.",
        "whitelist.title": "Ваш белый список",
        "whitelist.add": "Добавить",
        "whitelist.placeholder": "example.com",
        "whitelist.note": "Добавленные домены проверяются вместе с локальным списком trusted.json.",
        "whitelist.empty": "Белый список пуст.",
        "whitelist.status.invalid": "Введите корректный домен.",
        "whitelist.status.exists": "Домен уже в белом списке.",
        "whitelist.status.added": "Добавлен {domain}.",
        "whitelist.status.removed": "Удалён {domain}.",
        "alerts.untrusted": "CorgPhish предупреждает: сайт {domain} не найден в списке доверенных.",
        "errors.activeTab": "Невозможно получить ссылку активной вкладки.",
        "errors.loadTrusted": "Не удалось загрузить trusted.json.",
        "errors.invalidTrusted": "Файл trusted.json содержит неверный формат."
    },
    en: {
        "main.subtitle": "Protection dashboard",
        "actions.refresh": "Rescan",
        "actions.settings": "Settings",
        "actions.history": "Scan history",
        "actions.back": "Back",
        "status.domainLabel": "Domain",
        "status.sourceLabel": "Source",
        "status.lastCheck": "Last check:",
        "status.pending.badge": "Scanning...",
        "status.pending.title": "Analyzing active tab",
        "status.pending.hint": "Comparing the address against the trusted domain catalog.",
        "status.pending.risk": "waiting for data",
        "status.pending.recommendations.0": "Make sure the tab you want to check is active.",
        "status.pending.recommendations.1": "Give us a second to finish the analysis.",
        "status.trusted.badge": "Trusted site",
        "status.trusted.title": "Site {domain} is trusted",
        "status.trusted.hint": "The domain is present in the local trusted list.",
        "status.trusted.risk": "low risk",
        "status.trusted.recommendations.0": "Always double-check the address before entering data.",
        "status.trusted.recommendations.1": "Use a password manager and enable MFA.",
        "status.untrusted.badge": "Suspicious site",
        "status.untrusted.title": "Site {domain} is not in the catalog",
        "status.untrusted.hint": "It may be a new service or a phishing attempt.",
        "status.untrusted.risk": "high risk",
        "status.untrusted.recommendations.0": "Do not enter personal data until the site is verified.",
        "status.untrusted.recommendations.1": "Compare the address with the official domain.",
        "status.untrusted.recommendations.2": "Search for reviews or mentions of {domain} online.",
        "status.untrusted.spoofWarning": "Looks similar to {spoofTarget}. Possible spoofing.",
        "status.unsupported.badge": "Cannot scan",
        "status.unsupported.title": "Only HTTP/HTTPS sites are supported",
        "status.unsupported.hint": "Browser pages and local files are skipped.",
        "status.unsupported.risk": "not defined",
        "status.unsupported.recommendations.0": "Open the desired website in the browser and try again.",
        "status.unsupported.recommendations.1": "Close the popup and activate the needed tab.",
        "status.error.badge": "Scan error",
        "status.error.title": "Something went wrong",
        "status.error.hint": "We could not finish the scan. {error}",
        "status.error.risk": "unknown",
        "status.error.recommendations.0": "Reload the extension or refresh the page.",
        "status.error.recommendations.1": "Make sure the trusted.json file is valid.",
        "recommendations.title": "Recommendations",
        "recommendations.initial": "Keep the tab open so we can analyze it.",
        "recommendations.empty": "No recommendations available.",
        "quickActions.title": "Quick actions",
        "ml.title": "ML analysis",
        "ml.description": "An upcoming release will connect a machine-learning model to detect phishing behavior patterns.",
        "ml.button": "Simulate analysis",
        "ml.note": "The ML module is not available yet. Using the local trusted list.",
        "ml.status.running": "Requesting ML engine response...",
        "ml.status.safe": "The simulated ML module found no suspicious indicators.",
        "ml.status.alert": "The simulated ML module suggests extra caution.",
        "footer.note": "CorgPhish only scans HTTP/HTTPS sites and works locally.",
        "history.title": "Scan history",
        "history.subtitle": "Latest results",
        "history.sectionTitle": "Recent scans",
        "history.empty": "No scans yet. Please run a check.",
        "history.clear": "Clear",
        "history.note": "Up to 50 scans are stored locally.",
        "history.badge.trusted": "Trusted",
        "history.badge.alert": "Alert",
        "settings.title": "Settings",
        "settings.subtitle": "Control CorgPhish behaviour",
        "settings.options": "Protection options",
        "settings.language.title": "Interface language",
        "settings.language.desc": "Switch between Russian and English.",
        "settings.theme.title": "Interface theme",
        "settings.theme.desc": "Toggle light and dark modes.",
        "settings.autoCheck.title": "Auto scan on open",
        "settings.autoCheck.desc": "Launch the analysis when the popup appears.",
        "settings.alerts.title": "Risk alerts",
        "settings.alerts.desc": "Show a warning when a suspicious site is detected.",
        "settings.status.default": "Changes are saved automatically.",
        "settings.status.saved": "Settings saved.",
        "whitelist.title": "Your whitelist",
        "whitelist.add": "Add",
        "whitelist.placeholder": "example.com",
        "whitelist.note": "Added domains are checked together with trusted.json.",
        "whitelist.empty": "Whitelist is empty.",
        "whitelist.status.invalid": "Enter a valid domain.",
        "whitelist.status.exists": "The domain is already on the whitelist.",
        "whitelist.status.added": "Added {domain}.",
        "whitelist.status.removed": "Removed {domain}.",
        "alerts.untrusted": "CorgPhish warns: {domain} is not in the trusted list.",
        "errors.activeTab": "Cannot read the active tab URL.",
        "errors.loadTrusted": "Failed to load trusted.json.",
        "errors.invalidTrusted": "trusted.json has an invalid format."
    }
};

const HISTORY_LIMIT = 50;
const CUSTOM_WHITELIST_KEY = "customTrustedDomains";

// Конфигурации состояний попапа / Popup state configuration
const VIEW_STATES = {
    pending: {
        theme: "pending",
        badgeKey: "status.pending.badge",
        titleKey: "status.pending.title",
        hintKey: "status.pending.hint",
        riskKey: "status.pending.risk",
        recommendationsKeys: ["status.pending.recommendations.0", "status.pending.recommendations.1"]
    },
    trusted: {
        theme: "trusted",
        badgeKey: "status.trusted.badge",
        titleKey: "status.trusted.title",
        hintKey: "status.trusted.hint",
        riskKey: "status.trusted.risk",
        recommendationsKeys: ["status.trusted.recommendations.0", "status.trusted.recommendations.1"]
    },
    untrusted: {
        theme: "untrusted",
        badgeKey: "status.untrusted.badge",
        titleKey: "status.untrusted.title",
        hintKey: "status.untrusted.hint",
        riskKey: "status.untrusted.risk",
        recommendationsKeys: [
            "status.untrusted.recommendations.0",
            "status.untrusted.recommendations.1",
            "status.untrusted.recommendations.2"
        ]
    },
    unsupported: {
        theme: "warning",
        badgeKey: "status.unsupported.badge",
        titleKey: "status.unsupported.title",
        hintKey: "status.unsupported.hint",
        riskKey: "status.unsupported.risk",
        recommendationsKeys: [
            "status.unsupported.recommendations.0",
            "status.unsupported.recommendations.1"
        ]
    },
    error: {
        theme: "error",
        badgeKey: "status.error.badge",
        titleKey: "status.error.title",
        hintKey: "status.error.hint",
        riskKey: "status.error.risk",
        recommendationsKeys: [
            "status.error.recommendations.0",
            "status.error.recommendations.1"
        ]
    }
};

// Кэши и коллекции / Runtime caches and collections
let trustedCache = null;
let currentSettings = { ...DEFAULT_SETTINGS };
let customWhitelist = [];

const getLocale = () => (currentSettings.language === "en" ? "en-US" : "ru-RU");

const translate = (key, params = {}) => {
    const lang = currentSettings.language || DEFAULT_SETTINGS.language;
    const dictionary = translations[lang] || translations.ru;
    const fallback = translations.ru[key] ?? key;
    const template = dictionary[key] ?? fallback;
    return template.replace(/\{(\w+)\}/g, (_, token) => params[token] ?? "");
};

// Переключение темы / Apply selected theme data attribute
const applyTheme = (theme) => {
    const resolved = theme === "light" ? "light" : "dark";
    document.body.dataset.theme = resolved;
};

// Применение перевода к статике / Apply translation to DOM
const applyLanguage = () => {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.dataset.i18n;
        el.textContent = translate(key);
    });
    if (dom.whitelistInput) {
        dom.whitelistInput.placeholder = translate("whitelist.placeholder");
    }
    if (dom.mlStatus) {
        dom.mlStatus.textContent = translate("ml.note");
    }
};

// Нормализация домена и поиск похожих / Normalize domain and detect look-alikes
const normalizeHost = (hostname = "") =>
    hostname.trim().replace(/^www\./i, "").replace(/\.$/, "").toLowerCase();

const levenshteinDistance = (a = "", b = "") => {
    if (a === b) return 0;
    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

    for (let i = 0; i < rows; i++) matrix[i][0] = i;
    for (let j = 0; j < cols; j++) matrix[0][j] = j;

    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < cols; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return matrix[rows - 1][cols - 1];
};

const findSpoofCandidate = (target, trustedList) => {
    let closest = null;
    let distance = Infinity;
    trustedList.forEach((domain) => {
        if (Math.abs(target.length - domain.length) > 2) {
            return;
        }
        const currentDistance = levenshteinDistance(target, domain);
        if (currentDistance < distance) {
            distance = currentDistance;
            closest = domain;
        }
    });

    if (distance <= 2) {
        return closest;
    }
    return null;
};

const formatTime = (date) =>
    date?.toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" }) ?? "—";

const updateRecommendations = (items = []) => {
    dom.recommendationsList.innerHTML = "";

    (items.length ? items : [translate("recommendations.empty")]).forEach((text) => {
        if (!text) {
            return;
        }
        const li = document.createElement("li");
        li.textContent = text;
        dom.recommendationsList.appendChild(li);
    });
};

const applyState = (stateKey, context = {}) => {
    const config = VIEW_STATES[stateKey] ?? VIEW_STATES.pending;
    dom.app.dataset.state = config.theme;

    dom.statusBadge.textContent = translate(config.badgeKey, context);
    dom.statusTitle.textContent = translate(config.titleKey, context);
    dom.statusHint.textContent = translate(config.hintKey, context);
    dom.riskLevel.textContent = translate(config.riskKey, context);
    dom.domainValue.textContent = context.domain ?? "—";
    dom.checkedAt.textContent = context.checkedAt ? formatTime(context.checkedAt) : "—";

    const recKeys = config.recommendationsKeys || [];
    const recItems = recKeys.map((key) => translate(key, context));
    if (stateKey === "untrusted" && context.spoofTarget) {
        recItems.unshift(translate("status.untrusted.spoofWarning", context));
    }
    updateRecommendations(recItems);
};

const switchView = (view) => {
    if (view === "settings") {
        dom.app.dataset.view = "settings";
        updateSettingsControls();
        return;
    }
    if (view === "history") {
        dom.app.dataset.view = "history";
        refreshHistory();
        return;
    }
    dom.app.dataset.view = "main";
};

// Загрузка локального trusted.json / Load trusted domains file
const loadTrustedList = async () => {
    if (trustedCache) {
        return trustedCache;
    }

    const response = await fetch(chrome.runtime.getURL("trusted.json"));
    if (!response.ok) {
        throw new Error(translate("errors.loadTrusted"));
    }

    const payload = await response.json();
    if (!Array.isArray(payload?.trusted)) {
        throw new Error(translate("errors.invalidTrusted"));
    }

    trustedCache = payload.trusted.map((domain) => normalizeHost(domain)).filter(Boolean);
    return trustedCache;
};

// Чтение настроек из sync storage / Read settings from sync storage
const loadSettings = () =>
    new Promise((resolve) => {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
            resolve({ ...DEFAULT_SETTINGS, ...settings });
        });
    });

// Сохранение настроек в sync storage / Persist settings to sync storage
const saveSettings = (settings) =>
    new Promise((resolve) => {
        chrome.storage.sync.set(settings, () => resolve(settings));
    });

// Получение пользовательского белого списка / Read user whitelist
const loadWhitelist = () =>
    new Promise((resolve) => {
        chrome.storage.local.get({ [CUSTOM_WHITELIST_KEY]: [] }, (result) => {
            resolve(Array.isArray(result[CUSTOM_WHITELIST_KEY]) ? result[CUSTOM_WHITELIST_KEY] : []);
        });
    });

// Сохранение пользовательского whitelist / Persist custom whitelist
const saveWhitelist = (domains) =>
    new Promise((resolve) => {
        chrome.storage.local.set({ [CUSTOM_WHITELIST_KEY]: domains }, resolve);
    });

// Тост в настройках / Inline toast for settings status
const showSettingsStatus = (key, params = {}, isError = false) => {
    if (!dom.settingsStatus) {
        return;
    }
    dom.settingsStatus.textContent = translate(key, params);
    dom.settingsStatus.style.color = isError ? "#f87171" : "#6ee7b7";
    clearTimeout(showSettingsStatus.timer);
    showSettingsStatus.timer = setTimeout(() => {
        dom.settingsStatus.style.color = "";
        dom.settingsStatus.textContent = translate("settings.status.default");
    }, 2500);
};

// Отрисовка списка whitelist / Render whitelist list
const renderWhitelist = (domains = []) => {
    if (!dom.whitelistList) {
        return;
    }

    dom.whitelistList.innerHTML = "";

    if (!domains.length) {
        const li = document.createElement("li");
        li.className = "empty-state";
        li.textContent = translate("whitelist.empty");
        dom.whitelistList.appendChild(li);
        return;
    }

    domains.forEach((domain) => {
        const li = document.createElement("li");
        li.className = "whitelist-item";
        li.dataset.domain = domain;
        li.innerHTML = `<span>${domain}</span>`;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "whitelist-remove";
        removeBtn.dataset.domain = domain;
        removeBtn.textContent = "✕";

        li.appendChild(removeBtn);
        dom.whitelistList.appendChild(li);
    });
};

const refreshWhitelist = async () => {
    const stored = await loadWhitelist();
    customWhitelist = stored.map((domain) => normalizeHost(domain)).filter(Boolean);
    renderWhitelist(customWhitelist);
};

const updateWhitelistStorage = async (domains) => {
    customWhitelist = domains.map((domain) => normalizeHost(domain)).filter(Boolean);
    await saveWhitelist(customWhitelist);
    renderWhitelist(customWhitelist);
};

const addDomainToWhitelist = async (rawDomain) => {
    const clean = normalizeHost(rawDomain);
    if (!clean) {
        showSettingsStatus("whitelist.status.invalid", {}, true);
        return;
    }
    if (customWhitelist.includes(clean)) {
        showSettingsStatus("whitelist.status.exists", {}, true);
        return;
    }
    await updateWhitelistStorage([...customWhitelist, clean]);
    showSettingsStatus("whitelist.status.added", { domain: clean });
};

const removeDomainFromWhitelist = async (domain) => {
    const clean = normalizeHost(domain);
    await updateWhitelistStorage(customWhitelist.filter((entry) => entry !== clean));
    showSettingsStatus("whitelist.status.removed", { domain: clean });
};

const loadHistory = () =>
    new Promise((resolve) => {
        chrome.storage.local.get({ scanHistory: [] }, (result) => {
            resolve(Array.isArray(result.scanHistory) ? result.scanHistory : []);
        });
    });

const renderHistory = (items = []) => {
    if (!dom.historyList || !dom.historyEmpty) {
        return;
    }

    dom.historyList.innerHTML = "";
    if (!items.length) {
        dom.historyEmpty.hidden = false;
        return;
    }
    dom.historyEmpty.hidden = true;

    items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "history-item";

        const info = document.createElement("div");
        info.className = "history-item__info";

        const title = document.createElement("h4");
        title.textContent = item.domain ?? "—";
        const subtitle = document.createElement("p");
        subtitle.textContent = new Date(item.checkedAt).toLocaleString(getLocale(), {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit"
        });

        info.appendChild(title);
        info.appendChild(subtitle);

        const badge = document.createElement("span");
        badge.className = `chip ${item.verdict === "trusted" ? "chip--trusted" : "chip--untrusted"}`;
        badge.textContent =
            item.verdict === "trusted"
                ? translate("history.badge.trusted")
                : translate("history.badge.alert");

        li.appendChild(info);
        li.appendChild(badge);
        dom.historyList.appendChild(li);
    });
};

const refreshHistory = async () => {
    const items = await loadHistory();
    renderHistory(items.slice(0, HISTORY_LIMIT));
};

const clearHistory = () =>
    new Promise((resolve) => {
        chrome.storage.local.set({ scanHistory: [] }, resolve);
    });

// Сохранение результата проверки / Persist scan result history
const recordHistory = (entry) =>
    new Promise((resolve) => {
        chrome.storage.local.get({ scanHistory: [] }, (result) => {
            const history = Array.isArray(result.scanHistory) ? result.scanHistory : [];
            const next = [entry, ...history].slice(0, HISTORY_LIMIT);
            chrome.storage.local.set({ scanHistory: next }, resolve);
        });
    });

// Комбинированный список trusted + custom / Merge lists for fast lookup
const getTrustedDomains = async () => {
    const base = await loadTrustedList();
    return [...new Set([...base, ...customWhitelist])];
};

// Предупреждение об опасном домене / Alert user about untrusted site
const warnAboutUntrusted = (domain) => {
    if (!currentSettings.warnOnUntrusted) {
        return;
    }
    alert(translate("alerts.untrusted", { domain }));
};

// Эмуляция работы ML-модуля / Simulate ML engine response
const simulateMlCheck = async () => {
    if (!dom.mlStatus || !dom.mlCheckBtn) {
        return;
    }

    dom.mlStatus.textContent = translate("ml.status.running");
    dom.mlCheckBtn.disabled = true;
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const verdict = Math.random() > 0.5 ? "safe" : "alert";
    dom.mlStatus.textContent =
        verdict === "safe" ? translate("ml.status.safe") : translate("ml.status.alert");
    dom.mlCheckBtn.disabled = false;
};

// Главная проверка активной вкладки / Main active tab scan
const checkActiveTab = async () => {
    applyState("pending");
    dom.refreshBtn.disabled = true;

    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab || !activeTab.url) {
            throw new Error(translate("errors.activeTab"));
        }

        if (!/^https?:\/\//i.test(activeTab.url)) {
            applyState("unsupported");
            return;
        }

        const url = new URL(activeTab.url);
        const hostname = url.hostname;
        const trustedList = await getTrustedDomains();
        const cleanDomain = normalizeHost(hostname);
        const isTrusted = trustedList.some(
            (domain) => cleanDomain === domain || cleanDomain.endsWith(`.${domain}`)
        );
        const spoofTarget = !isTrusted ? findSpoofCandidate(cleanDomain, trustedList) : null;
        const verdict = isTrusted ? "trusted" : "untrusted";

        applyState(verdict, {
            domain: cleanDomain,
            checkedAt: new Date(),
            spoofTarget
        });
        await recordHistory({ domain: cleanDomain, verdict, checkedAt: Date.now(), spoofTarget });

        if (verdict === "untrusted") {
            warnAboutUntrusted(cleanDomain);
        }
    } catch (error) {
        console.error("Ошибка во время проверки", error);
        applyState("error", { error: error?.message || "" });
    } finally {
        dom.refreshBtn.disabled = false;
    }
};

// Синхронизация чекбоксов/селектов / Sync inputs with stored settings
const updateSettingsControls = () => {
    if (dom.autoCheckInput) {
        dom.autoCheckInput.checked = currentSettings.autoCheckOnOpen;
    }
    if (dom.alertInput) {
        dom.alertInput.checked = currentSettings.warnOnUntrusted;
    }
    if (dom.themeToggle) {
        dom.themeToggle.checked = currentSettings.theme === "light";
    }
    if (dom.languageSelect) {
        dom.languageSelect.value = currentSettings.language;
    }
};

// Обработка изменений настроек / Handle settings change
const handleSettingsChange = async () => {
    const nextSettings = {
        autoCheckOnOpen: dom.autoCheckInput?.checked ?? DEFAULT_SETTINGS.autoCheckOnOpen,
        warnOnUntrusted: dom.alertInput?.checked ?? DEFAULT_SETTINGS.warnOnUntrusted,
        theme: dom.themeToggle?.checked ? "light" : "dark",
        language: dom.languageSelect?.value ?? DEFAULT_SETTINGS.language
    };
    currentSettings = await saveSettings(nextSettings);
    applyTheme(currentSettings.theme);
    applyLanguage();
    if (dom.app.dataset.view === "history") {
        refreshHistory();
    }
    showSettingsStatus("settings.status.saved");
};

// Обработка формы whitelist / Handle whitelist form submit
const handleWhitelistSubmit = async (event) => {
    event.preventDefault();
    if (!dom.whitelistInput) {
        return;
    }
    await addDomainToWhitelist(dom.whitelistInput.value);
    dom.whitelistInput.value = "";
};

// Удаление домена из whitelist / Handle whitelist remove button
const handleWhitelistListClick = async (event) => {
    const target = event.target.closest(".whitelist-remove");
    if (!target || !target.dataset.domain) {
        return;
    }
    await removeDomainFromWhitelist(target.dataset.domain);
};

// Безопасная подписка на события / Safe event binding helper
const safeAddEvent = (element, event, handler) => {
    if (!element) {
        return;
    }
    element.addEventListener(event, handler);
};

safeAddEvent(dom.refreshBtn, "click", () => {
    checkActiveTab();
});

safeAddEvent(dom.openHistoryBtn, "click", () => switchView("history"));
safeAddEvent(dom.closeHistoryBtn, "click", () => switchView("main"));
safeAddEvent(dom.openSettingsBtn, "click", () => switchView("settings"));
safeAddEvent(dom.closeSettingsBtn, "click", () => switchView("main"));
safeAddEvent(dom.clearHistoryBtn, "click", async () => {
    await clearHistory();
    refreshHistory();
});

safeAddEvent(dom.autoCheckInput, "change", handleSettingsChange);
safeAddEvent(dom.alertInput, "change", handleSettingsChange);
safeAddEvent(dom.themeToggle, "change", handleSettingsChange);
safeAddEvent(dom.languageSelect, "change", handleSettingsChange);
safeAddEvent(dom.whitelistForm, "submit", handleWhitelistSubmit);
safeAddEvent(dom.whitelistList, "click", handleWhitelistListClick);
safeAddEvent(dom.mlCheckBtn, "click", simulateMlCheck);

const init = async () => {
    currentSettings = await loadSettings();
    applyTheme(currentSettings.theme);
    applyLanguage();
    await refreshWhitelist();
    updateSettingsControls();

    if (currentSettings.autoCheckOnOpen) {
        checkActiveTab();
    } else {
        applyState("pending");
    }
};

init();
