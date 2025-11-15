const dom = {
    app: document.getElementById("app"),
    statusBadge: document.getElementById("statusBadge"),
    statusTitle: document.getElementById("statusTitle"),
    statusHint: document.getElementById("statusHint"),
    domainValue: document.getElementById("domainValue"),
    checkedAt: document.getElementById("checkedAt"),
    recommendationsList: document.getElementById("recommendationsList"),
    riskLevel: document.getElementById("riskLevel"),
    refreshBtn: document.getElementById("refreshBtn"),
    viewListBtn: document.getElementById("viewListBtn")
};

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

const normalizeHost = (hostname = "") =>
    hostname.trim().replace(/^www\./i, "").replace(/\.$/, "").toLowerCase();

const formatTime = (date) =>
    date?.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) ?? "—";

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

    trustedCache = payload.trusted
        .map((domain) => normalizeHost(domain))
        .filter(Boolean);

    return trustedCache;
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

dom.refreshBtn.addEventListener("click", () => {
    checkActiveTab();
});

dom.viewListBtn.addEventListener("click", () => {
    openTrustedCatalog();
});

checkActiveTab();
