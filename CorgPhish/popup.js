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
    viewListBtn: document.getElementById("viewListBtn"),
    openHistoryBtn: document.getElementById("openHistoryBtn"),
    openSettingsBtn: document.getElementById("openSettingsBtn"),
    closeHistoryBtn: document.getElementById("closeHistoryBtn"),
    closeSettingsBtn: document.getElementById("closeSettingsBtn"),
    historyList: document.getElementById("historyList"),
    historyEmpty: document.getElementById("historyEmpty"),
    clearHistoryBtn: document.getElementById("clearHistoryBtn"),
    autoCheckInput: document.getElementById("autoCheckInput"),
    alertInput: document.getElementById("alertInput"),
    settingsStatus: document.getElementById("settingsStatus")
};

const DEFAULT_SETTINGS = {
    autoCheckOnOpen: true,
    warnOnUntrusted: true
};

const HISTORY_LIMIT = 50;

const VIEW_STATES = {
    pending: {
        theme: "pending",
        badge: "Проверяем...",
        title: () => "Анализируем активную вкладку",
        hint: () => "Сравниваем адрес с актуальным каталогом доверенных сайтов.",
        risk: "ожидание данных",
        recommendations: () => [
            "Убедитесь, что вкладка, которую нужно проверить, активна.",
            "Подождите пару секунд, пока завершится анализ."
        ]
    },
    trusted: {
        theme: "trusted",
        badge: "Доверенный сайт",
        title: ({ domain }) => `Сайт ${domain ?? "—"} подтверждён`,
        hint: () => "Домен найден в локальном списке доверенных ресурсов.",
        risk: "низкий риск",
        recommendations: () => [
            "Всегда проверяйте адрес вручную перед вводом данных.",
            "Используйте менеджер паролей и двухфакторную аутентификацию."
        ]
    },
    untrusted: {
        theme: "untrusted",
        badge: "Подозрительный сайт",
        title: ({ domain }) => `Сайт ${domain ?? "—"} не найден в каталоге`,
        hint: () => "Это может быть новая площадка или потенциальный фишинг.",
        risk: "высокий риск",
        recommendations: ({ domain }) => [
            "Не вводите личные данные до подтверждения подлинности сайта.",
            "Сверьте адрес с официальным доменом организации.",
            domain ? `Поищите отзывы и упоминания домена ${domain} в открытых источниках.` : "Поищите отзывы и упоминания домена в открытых источниках."
        ]
    },
    unsupported: {
        theme: "warning",
        badge: "Нельзя проверить",
        title: () => "Поддерживаются только сайты HTTP/HTTPS",
        hint: () => "Системные страницы браузера и локальные файлы пропускаются.",
        risk: "не определено",
        recommendations: () => [
            "Перейдите на веб-сайт в браузере и повторите проверку.",
            "Закройте всплывающее окно и попробуйте снова на нужной вкладке."
        ]
    },
    error: {
        theme: "error",
        badge: "Ошибка проверки",
        title: () => "Что-то пошло не так",
        hint: ({ error }) => error ?? "Не удалось выполнить проверку. Попробуйте позже.",
        risk: "неизвестно",
        recommendations: () => [
            "Перезапустите расширение или обновите страницу.",
            "Убедитесь, что файл trusted.json не повреждён."
        ]
    }
};

let trustedCache = null;
let currentSettings = { ...DEFAULT_SETTINGS };

const normalizeHost = (hostname = "") =>
    hostname.trim().replace(/^www\./i, "").replace(/\.$/, "").toLowerCase();

const formatTime = (date) =>
    date?.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) ?? "—";

const formatDateTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "—";
    }
    return `${date.toLocaleDateString("ru-RU")} · ${date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit"
    })}`;
};

const updateRecommendations = (items = []) => {
    dom.recommendationsList.innerHTML = "";

    (items.length ? items : ["Нет рекомендаций"]).forEach((text) => {
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

    dom.statusBadge.textContent = config.badge;
    dom.statusTitle.textContent = typeof config.title === "function" ? config.title(context) : config.title;
    dom.statusHint.textContent = typeof config.hint === "function" ? config.hint(context) : config.hint;
    dom.riskLevel.textContent = config.risk;
    dom.domainValue.textContent = context.domain ?? "—";

    dom.checkedAt.textContent = context.checkedAt ? formatTime(context.checkedAt) : "—";
    updateRecommendations(typeof config.recommendations === "function" ? config.recommendations(context) : config.recommendations);
};

const switchView = (view) => {
    dom.app.dataset.view = view;
    if (view === "history") {
        refreshHistory();
    } else if (view === "settings") {
        updateSettingsControls();
    }
};

const safeAddEvent = (element, event, handler) => {
    if (!element) {
        console.warn(`Элемент для события "${event}" не найден.`);
        return;
    }
    element.addEventListener(event, handler);
};

const loadTrustedList = async () => {
    if (trustedCache) {
        return trustedCache;
    }

    const response = await fetch(chrome.runtime.getURL("trusted.json"));
    if (!response.ok) {
        throw new Error("Не удалось загрузить trusted.json");
    }

    const payload = await response.json();
    if (!Array.isArray(payload?.trusted)) {
        throw new Error("Файл trusted.json содержит неверный формат");
    }

    trustedCache = payload.trusted.map((domain) => normalizeHost(domain)).filter(Boolean);

    return trustedCache;
};

const loadSettings = () =>
    new Promise((resolve) => {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
            resolve({ ...DEFAULT_SETTINGS, ...settings });
        });
    });

const saveSettings = (settings) =>
    new Promise((resolve) => {
        chrome.storage.sync.set(settings, () => resolve(settings));
    });

const showSettingsStatus = (text) => {
    if (!dom.settingsStatus) return;
    dom.settingsStatus.textContent = text;
    dom.settingsStatus.style.color = "#6ee7b7";
    clearTimeout(showSettingsStatus.timer);
    showSettingsStatus.timer = setTimeout(() => {
        dom.settingsStatus.textContent = "Изменения сохраняются автоматически.";
        dom.settingsStatus.style.color = "";
    }, 2500);
};

const isTrustedDomain = (hostname, trustedList) => {
    const cleanHost = normalizeHost(hostname);
    return trustedList.some((domain) => cleanHost === domain || cleanHost.endsWith(`.${domain}`));
};

const getActiveTab = () =>
    new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }

            resolve((tabs || [])[0]);
        });
    });

const recordHistory = (entry) =>
    new Promise((resolve) => {
        chrome.storage.local.get({ scanHistory: [] }, (result) => {
            const history = Array.isArray(result.scanHistory) ? result.scanHistory : [];
            const next = [entry, ...history].slice(0, HISTORY_LIMIT);
            chrome.storage.local.set({ scanHistory: next }, resolve);
        });
    });

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
        title.textContent = item.domain ?? "Неизвестный домен";
        const subtitle = document.createElement("p");
        subtitle.textContent = formatDateTime(item.checkedAt);

        info.appendChild(title);
        info.appendChild(subtitle);

        const badge = document.createElement("span");
        badge.className = `chip ${item.verdict === "trusted" ? "chip--trusted" : "chip--untrusted"}`;
        badge.textContent = item.verdict === "trusted" ? "Trusted" : "Alert";

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

const warnAboutUntrusted = (domain) => {
    if (!currentSettings.warnOnUntrusted) {
        return;
    }

    alert(`CorgPhish предупреждает: сайт ${domain} не найден в списке доверенных.`);
};

const checkActiveTab = async () => {
    applyState("pending");
    dom.refreshBtn.disabled = true;

    try {
        const activeTab = await getActiveTab();
        if (!activeTab || !activeTab.url) {
            throw new Error("Невозможно получить ссылку активной вкладки");
        }

        if (!/^https?:\/\//i.test(activeTab.url)) {
            applyState("unsupported");
            return;
        }

        const url = new URL(activeTab.url);
        const hostname = url.hostname;
        const trustedList = await loadTrustedList();
        const cleanDomain = normalizeHost(hostname);
        const verdict = isTrustedDomain(hostname, trustedList) ? "trusted" : "untrusted";

        applyState(verdict, { domain: cleanDomain, checkedAt: new Date() });
        await recordHistory({ domain: cleanDomain, verdict, checkedAt: Date.now() });

        if (verdict === "untrusted") {
            warnAboutUntrusted(cleanDomain);
        }
    } catch (error) {
        console.error("Ошибка во время проверки", error);
        applyState("error", { error: error?.message });
    } finally {
        dom.refreshBtn.disabled = false;
    }
};

const openTrustedCatalog = () => {
    const trustedUrl = chrome.runtime.getURL("trusted.json");
    chrome.tabs.create({ url: trustedUrl }, () => {
        if (chrome.runtime.lastError) {
            console.error("Не удалось открыть trusted.json", chrome.runtime.lastError);
        }
    });
};
const updateSettingsControls = () => {
    if (!dom.autoCheckInput || !dom.alertInput) {
        return;
    }
    dom.autoCheckInput.checked = currentSettings.autoCheckOnOpen;
    dom.alertInput.checked = currentSettings.warnOnUntrusted;
};

const handleSettingsChange = async () => {
    const nextSettings = {
        autoCheckOnOpen: dom.autoCheckInput?.checked ?? DEFAULT_SETTINGS.autoCheckOnOpen,
        warnOnUntrusted: dom.alertInput?.checked ?? DEFAULT_SETTINGS.warnOnUntrusted
    };
    currentSettings = await saveSettings(nextSettings);
    showSettingsStatus("Настройки сохранены");
};

safeAddEvent(dom.refreshBtn, "click", () => {
    checkActiveTab();
});

safeAddEvent(dom.viewListBtn, "click", () => {
    openTrustedCatalog();
});

safeAddEvent(dom.openHistoryBtn, "click", () => switchView("history"));
safeAddEvent(dom.openSettingsBtn, "click", () => switchView("settings"));
safeAddEvent(dom.closeHistoryBtn, "click", () => switchView("main"));
safeAddEvent(dom.closeSettingsBtn, "click", () => switchView("main"));

safeAddEvent(dom.clearHistoryBtn, "click", async () => {
    await clearHistory();
    renderHistory([]);
});

safeAddEvent(dom.autoCheckInput, "change", handleSettingsChange);
safeAddEvent(dom.alertInput, "change", handleSettingsChange);

const init = async () => {
    currentSettings = await loadSettings();
    updateSettingsControls();

    if (currentSettings.autoCheckOnOpen) {
        checkActiveTab();
    } else {
        applyState("pending");
    }
};

init();
