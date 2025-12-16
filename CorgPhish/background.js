// RU: Сервис-воркер: системные уведомления, кэш trusted.json, закрытие вкладок.
// EN: Service worker: system notifications, trusted.json cache, close tabs.
const DEFAULT_SETTINGS = {
  systemNotifyOnRisk: false
};

const TRUSTED_STORAGE_KEY = "builtinTrustedDomains";
let predictorLoaded = false;

const cacheTrustedList = async () => {
  try {
    const response = await fetch(chrome.runtime.getURL("trusted.json"));
    if (!response.ok) return [];
    const payload = await response.json();
    const list = Array.isArray(payload?.trusted) ? payload.trusted : [];
    chrome.storage.local.set({ [TRUSTED_STORAGE_KEY]: list });
    return list;
  } catch (error) {
    console.warn("CorgPhish: failed to preload trusted.json", error);
    return [];
  }
};

const loadSettings = () =>
  new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      resolve({ ...DEFAULT_SETTINGS, ...settings });
    });
  });

// RU: Обрабатываем сообщения попапа/контента.
// EN: Handle messages from popup/content.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
if (!message) return;

  if (message.type === "predictUrlBg") {
    (async () => {
      try {
        if (!predictorLoaded) {
          const workerUrl = chrome.runtime.getURL("worker/predict.js");
          importScripts(workerUrl);
          predictorLoaded = true;
        }
        const result = await globalThis.predictUrlWorker(message.url, message.threshold);
        sendResponse?.({ ok: true, result });
    } catch (error) {
      sendResponse?.({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

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
        const stored = await new Promise((resolve) =>
          chrome.storage.local.get({ [TRUSTED_STORAGE_KEY]: [] }, (res) =>
            resolve(Array.isArray(res[TRUSTED_STORAGE_KEY]) ? res[TRUSTED_STORAGE_KEY] : [])
          )
        );
        const list = stored.length ? stored : await cacheTrustedList();
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

chrome.runtime.onInstalled.addListener(() => {
  cacheTrustedList();
});

chrome.runtime.onStartup.addListener(() => {
  cacheTrustedList();
});
