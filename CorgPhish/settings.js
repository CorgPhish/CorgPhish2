const statusMessage = document.getElementById("statusMessage");
const backBtn = document.getElementById("backBtn");
const autoCheckInput = document.getElementById("autoCheckInput");
const alertInput = document.getElementById("alertInput");

const DEFAULT_SETTINGS = {
    autoCheckOnOpen: true,
    warnOnUntrusted: true
};

const getSettings = () =>
    new Promise((resolve) => {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => resolve(settings));
    });

const saveSettings = (settings) =>
    new Promise((resolve) => {
        chrome.storage.sync.set(settings, () => resolve(settings));
    });

const showStatus = (text) => {
    statusMessage.textContent = text;
    statusMessage.style.color = "#6ee7b7";
    clearTimeout(showStatus.timer);
    showStatus.timer = setTimeout(() => {
        statusMessage.style.color = "";
        statusMessage.textContent = "Состояние настроек сохранится автоматически.";
    }, 3000);
};

const load = async () => {
    const settings = await getSettings();
    autoCheckInput.checked = settings.autoCheckOnOpen;
    alertInput.checked = settings.warnOnUntrusted;
};

const handleChange = async () => {
    const settings = {
        autoCheckOnOpen: autoCheckInput.checked,
        warnOnUntrusted: alertInput.checked
    };
    await saveSettings(settings);
    showStatus("Настройки сохранены");
};

backBtn.addEventListener("click", () => {
    chrome.tabs.getCurrent((tab) => {
        if (tab?.id) {
            chrome.tabs.remove(tab.id);
        }
    });
});

autoCheckInput.addEventListener("change", handleChange);
alertInput.addEventListener("change", handleChange);

load();
