const statusEl = document.getElementById("status");

const setStatus = (text, variant) => {
    statusEl.textContent = text;
    statusEl.classList.remove("trusted", "untrusted", "error");
    if (variant) {
        statusEl.classList.add(variant);
    }
};

const loadTrustedList = async () => {
    const response = await fetch(chrome.runtime.getURL("trusted.json"));
    if (!response.ok) {
        throw new Error("Не удалось загрузить список доверенных сайтов");
    }

    const payload = await response.json();
    if (!Array.isArray(payload?.trusted)) {
        throw new Error("Неверный формат trusted.json");
    }

    return payload.trusted;
};

const normalizeHost = (hostname) => hostname.replace(/^www\./i, "").toLowerCase();

const isTrustedDomain = (hostname, trustedList) => {
    const cleanHost = normalizeHost(hostname);
    return trustedList.some((domain) => {
        const trustedDomain = domain.toLowerCase();
        return cleanHost === trustedDomain || cleanHost.endsWith(`.${trustedDomain}`);
    });
};

const getActiveTab = () =>
    new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const [tab] = tabs || [];

            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }

            resolve(tab);
        });
    });

const init = async () => {
    try {
        const activeTab = await getActiveTab();

        if (!activeTab || !activeTab.url || !/^https?:\/\//.test(activeTab.url)) {
            setStatus("Можно проверять только сайты по HTTP/HTTPS", "error");
            return;
        }

        const url = new URL(activeTab.url);
        const hostname = url.hostname;
        const trustedList = await loadTrustedList();

        if (isTrustedDomain(hostname, trustedList)) {
            setStatus(`Сайт ${normalizeHost(hostname)} в списке доверенных ✔`, "trusted");
        } else {
            setStatus(`Сайт ${normalizeHost(hostname)} не найден в списке доверенных ✖`, "untrusted");
        }
    } catch (error) {
        console.error("Ошибка проверки доверенного сайта", error);
        setStatus("Что-то пошло не так. Попробуйте снова.", "error");
    }
};

init();
