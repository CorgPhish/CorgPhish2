const historyListEl = document.getElementById("historyList");
const emptyStateEl = document.getElementById("historyEmpty");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const backBtn = document.getElementById("backToPopupBtn");

const historyLimit = 50;

const formatDateTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "—";
    }
    return `${date.toLocaleDateString("ru-RU")} · ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
};

const renderHistory = (items = []) => {
    historyListEl.innerHTML = "";
    if (!items.length) {
        emptyStateEl.hidden = false;
        return;
    }
    emptyStateEl.hidden = true;

    items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "history-item";

        const info = document.createElement("div");
        info.className = "history-item__info";
        const title = document.createElement("h4");
        title.textContent = item.domain ?? "Неизвестный домен";
        const meta = document.createElement("p");
        meta.textContent = formatDateTime(item.checkedAt);

        info.appendChild(title);
        info.appendChild(meta);

        const chip = document.createElement("span");
        chip.className = `chip ${item.verdict === "trusted" ? "chip--trusted" : "chip--untrusted"}`;
        chip.textContent = item.verdict === "trusted" ? "Trusted" : "Alert";

        li.appendChild(info);
        li.appendChild(chip);
        historyListEl.appendChild(li);
    });
};

const loadHistory = () =>
    new Promise((resolve) => {
        chrome.storage.local.get({ scanHistory: [] }, (result) => {
            resolve(result.scanHistory.slice(0, historyLimit));
        });
    });

const saveHistory = (next) =>
    new Promise((resolve) => {
        chrome.storage.local.set({ scanHistory: next.slice(0, historyLimit) }, resolve);
    });

const refreshHistory = async () => {
    const items = await loadHistory();
    renderHistory(items);
};

clearHistoryBtn.addEventListener("click", async () => {
    await saveHistory([]);
    renderHistory([]);
});

backBtn.addEventListener("click", () => {
    chrome.tabs.getCurrent((tab) => {
        if (tab?.id) {
            chrome.tabs.remove(tab.id);
        }
    });
});

refreshHistory();
