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

  if (message.type === "closeTab" && sender?.tab?.id) {
    chrome.tabs.remove(sender.tab.id);
    sendResponse?.({ ok: true });
    return true;
  }

  return false;
});
