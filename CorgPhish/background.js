// RU: Сервис-воркер: системные уведомления, кэш trusted.json, закрытие вкладок.
// EN: Service worker: system notifications, trusted.json cache, close tabs.
import {
  createGuardedTabEntry,
  matchGuardedDownload,
  pruneGuardedTabEntries
} from "./background-download-guard.js";
import { HEURISTIC_THRESHOLD, MODEL_THRESHOLD } from "./popup/config.js";
import { extractFeatures, heuristicVerdict } from "./popup/model-core.js";

const DEFAULT_SETTINGS = {
  systemNotifyOnRisk: false
};

const TRUSTED_STORAGE_KEY = "builtinTrustedDomains";
const DEFAULT_THRESHOLD = MODEL_THRESHOLD;
const FALLBACK_THRESHOLD = HEURISTIC_THRESHOLD ?? DEFAULT_THRESHOLD;
const guardedTabs = new Map();
const isExpectedMlFailure = (message = "") =>
  /offscreen_failed/i.test(message) ||
  /ort_load_failed/i.test(message) ||
  /NormalizerNorm/i.test(message) ||
  /tensor\(float\).*tensor\(double\)/i.test(message);

const syncGuardedTab = (tabId, payload = {}) => {
  const entry = createGuardedTabEntry({ ...payload, tabId });
  if (!entry) {
    guardedTabs.delete(tabId);
    return;
  }
  guardedTabs.set(tabId, entry);
};

const pruneGuardedTabs = () => {
  const activeEntries = pruneGuardedTabEntries(Array.from(guardedTabs.values()));
  const activeTabIds = new Set(activeEntries.map((entry) => entry.tabId));
  for (const tabId of guardedTabs.keys()) {
    if (!activeTabIds.has(tabId)) {
      guardedTabs.delete(tabId);
    }
  }
  return activeEntries;
};

const cancelGuardedDownload = (downloadItem) => {
  const match = matchGuardedDownload(downloadItem, pruneGuardedTabs());
  if (!match) return;
  chrome.downloads.cancel(downloadItem.id, () => {
    const cancelError = chrome.runtime.lastError?.message || "";
    if (cancelError && !/Invalid operation/i.test(cancelError)) {
      console.warn("CorgPhish: failed to cancel guarded download", cancelError);
      return;
    }
    chrome.downloads.removeFile(downloadItem.id, () => {
      const removeError = chrome.runtime.lastError?.message || "";
      if (removeError && !/not complete|No file|Invalid operation/i.test(removeError)) {
        console.warn("CorgPhish: failed to remove guarded download file", removeError);
      }
    });
    chrome.downloads.erase({ id: downloadItem.id }, () => {
      const eraseError = chrome.runtime.lastError?.message || "";
      if (eraseError && !/No download item/i.test(eraseError)) {
        console.warn("CorgPhish: failed to erase guarded download", eraseError);
      }
    });
    console.info("CorgPhish: guarded download cancelled", {
      url: downloadItem.finalUrl || downloadItem.url || "",
      referrer: downloadItem.referrer || "",
      verdict: match.entry.verdict,
      matchedBy: match.matchedBy,
      matchedHost: match.matchedHost
    });
  });
};

// Кешируем trusted.json в local storage, чтобы popup/content не читали файл повторно.
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

  // Главный ML-роутинг: popup не тянет модель напрямую, а просит background отдать результат.
  if (message.type === "predictUrlBg") {
    (async () => {
      try {
        // Основной путь ML: offscreen-документ с ORT в контексте расширения.
        const ensureOffscreen = async () => {
          const reasons = ["DOM_SCRAPING"];
          const offscreenUrl = chrome.runtime.getURL("offscreen.html");
          const existing = await chrome.offscreen.hasDocument?.();
          if (existing) return;
          await chrome.offscreen.createDocument({
            url: offscreenUrl,
            reasons,
            justification: "Phishing ML inference in extension context (avoid page CSP)"
          });
        };

        let result = null;
        try {
          await ensureOffscreen();
          result = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
              { type: "predictOffscreen", url: message.url, threshold: message.threshold },
              (response) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                  return;
                }
                if (response?.ok && response.result) {
                  resolve(response.result);
                } else {
                  reject(new Error(response?.error || "offscreen_failed"));
                }
              }
            );
          });
        } catch (offscreenError) {
          const message = String(offscreenError?.message || offscreenError || "");
          if (!isExpectedMlFailure(message)) {
            console.warn("CorgPhish: offscreen predict failed", message);
          }
        }

        // Если offscreen не поднялся, всё равно возвращаем бинарный ответ через эвристику.
        // Это важно, чтобы UI и content script не оставались без вердикта.
        if (!result) {
          const { url, features } = extractFeatures(message.url);
          if (!url) {
            sendResponse?.({ ok: false, error: "invalid_url" });
            return;
          }
          const fallback = heuristicVerdict(features, FALLBACK_THRESHOLD, { includeBrandPenalty: true });
          result = { ...fallback, status: "fallback", threshold: message.threshold };
        }
        sendResponse?.({ ok: true, result });
      } catch (error) {
        sendResponse?.({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  // Системные уведомления включаются отдельно в настройках и не мешают базовой защите.
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

  // Content script сообщает, что текущая вкладка находится в режиме блокировки форм/загрузок.
  if (message.type === "syncPageGuard" && sender?.tab?.id) {
    syncGuardedTab(sender.tab.id, {
      domain: message.domain,
      url: message.url || sender.tab.url || "",
      verdict: message.verdict,
      blockDownloads: message.blockDownloads
    });
    sendResponse?.({ ok: true });
    return true;
  }

  // Trusted-список отдаём из local cache, а если кэш пустой — лениво прогружаем из trusted.json.
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

  // blocked.html не всегда может закрыть вкладку сама, поэтому делаем это через background.
  if (message.type === "closeTab" && sender?.tab?.id) {
    chrome.tabs.remove(sender.tab.id);
    sendResponse?.({ ok: true });
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  // На установке заранее прогреваем trusted-кэш, чтобы первая проверка была быстрее.
  cacheTrustedList();
});

chrome.runtime.onStartup.addListener(() => {
  // После рестарта браузера кэш тоже обновляем, чтобы он не зависел от предыдущей сессии.
  cacheTrustedList();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  guardedTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // При переходе на другую страницу старое состояние вкладки больше невалидно.
  if (changeInfo.url || changeInfo.status === "loading") {
    guardedTabs.delete(tabId);
  }
});

if (chrome.downloads?.onCreated) {
  chrome.downloads.onCreated.addListener((downloadItem) => {
    cancelGuardedDownload(downloadItem);
  });
}
