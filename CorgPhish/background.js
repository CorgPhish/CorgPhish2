// Сервис-воркер: показывает системные уведомления и может закрыть вкладку по запросу.
const DEFAULT_SETTINGS = {
  systemNotifyOnRisk: true
};

const loadSettings = () =>
  new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      resolve({ ...DEFAULT_SETTINGS, ...settings });
    });
  });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;

  if (message.type === "riskNotification") {
    loadSettings().then((settings) => {
      if (!settings.systemNotifyOnRisk) {
        sendResponse?.({ ok: false });
        return;
      }
      const id = `corgphish-${Date.now()}`;
      chrome.notifications.create(
        id,
        {
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: "CorgPhish: подозрительный сайт",
          message: `${message.domain ?? "Сайт"} может быть фишингом`,
          contextMessage: message.url ?? ""
        },
        () => sendResponse?.({ ok: true })
      );
    });
    return true;
  }

  if (message.type === "getTrustedDomains") {
    (async () => {
      try {
        const response = await fetch(chrome.runtime.getURL("trusted.json"));
        if (!response.ok) {
          sendResponse?.({ ok: false, trusted: [] });
          return;
        }
        const payload = await response.json();
        const list = Array.isArray(payload?.trusted) ? payload.trusted : [];
        sendResponse?.({ ok: true, trusted: list });
      } catch (error) {
        console.warn("CorgPhish: failed to serve trusted.json", error);
        sendResponse?.({ ok: false, trusted: [] });
      }
    })();
    return true;
  }

  if (message.type === "closeTab" && sender?.tab?.id) {
    chrome.tabs.remove(sender.tab.id);
    sendResponse?.({ ok: true });
    return true;
  }

  return false;
});
