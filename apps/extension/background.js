// RU: Сервис-воркер: кэш trusted.json, ML/offscreen, защита загрузок и закрытие вкладок.
// EN: Service worker: trusted.json cache, ML/offscreen, download guard, and tab closing.
import {
  createGuardedTabEntry,
  matchGuardedDownload,
  pruneGuardedTabEntries
} from "./background-download-guard.js";
import {
  CUSTOM_BLACKLIST_KEY,
  CUSTOM_WHITELIST_KEY,
  HEURISTIC_THRESHOLD,
  MODEL_THRESHOLD
} from "./popup/config.js";
import { resolveInspection } from "./popup/inspection-core.js";
import { extractFeatures, heuristicVerdict } from "./popup/model-core.js";
import { isLikelyDomain, normalizeHost } from "./popup/utils.js";

const TRUSTED_STORAGE_KEY = "builtinTrustedDomains";
const TEMP_ALLOW_KEY = "tempAllowDomains";
const DEFAULT_THRESHOLD = MODEL_THRESHOLD;
const FALLBACK_THRESHOLD = HEURISTIC_THRESHOLD ?? DEFAULT_THRESHOLD;
const guardedTabs = new Map();
const normalizeDomainList = (domains = []) =>
  domains.map((domain) => normalizeHost(domain)).filter(Boolean);
const normalizeTrustedList = (domains = []) => normalizeDomainList(domains).filter(isLikelyDomain);
const isExpectedMlFailure = (message = "") =>
  /offscreen_failed/i.test(message) ||
  /ort_load_failed/i.test(message) ||
  /NormalizerNorm/i.test(message) ||
  /tensor\(float\).*tensor\(double\)/i.test(message);

const loadLocalStorage = (defaults = {}) =>
  new Promise((resolve) => {
    chrome.storage.local.get(defaults, (result) => {
      resolve(result || defaults);
    });
  });

const buildBlockedPageUrl = ({ domain = "", reason = "phishing", url = "", officialDomain = "" } = {}) => {
  const params = new URLSearchParams();
  if (domain) params.set("domain", domain);
  if (reason) params.set("reason", reason);
  if (url) params.set("url", url);
  if (officialDomain) params.set("official", officialDomain);
  return `${chrome.runtime.getURL("blocked.html")}?${params.toString()}`;
};

const isTemporarilyAllowed = async (domain = "") => {
  const cleanDomain = normalizeHost(domain);
  if (!cleanDomain) return false;
  const result = await loadLocalStorage({ [TEMP_ALLOW_KEY]: {} });
  const map =
    result[TEMP_ALLOW_KEY] && typeof result[TEMP_ALLOW_KEY] === "object"
      ? result[TEMP_ALLOW_KEY]
      : {};
  const expiry = Number(map[cleanDomain] || 0);
  return expiry > Date.now();
};

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
    const tabId = Number(match.entry.tabId);
    if (Number.isFinite(tabId) && tabId > 0) {
      const blockedUrl = buildBlockedPageUrl({
        domain: match.entry.domain || match.entry.urlHost || "",
        reason: "guardDownload",
        url: match.entry.pageUrl || downloadItem.referrer || "",
        officialDomain: ""
      });
      chrome.tabs.update(tabId, { url: blockedUrl }, () => {
        const updateError = chrome.runtime.lastError?.message || "";
        if (updateError) {
          console.warn("CorgPhish: failed to open guarded download block page", updateError);
          return;
        }
        console.info("CorgPhish inspect debug", {
          stage: "background-download-block-page",
          tabId,
          domain: match.entry.domain || match.entry.urlHost || "",
          reason: "guardDownload"
        });
      });
    }
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

const persistRuntimeSetting = (key, value) =>
  new Promise((resolve) => {
    const patch = { [key]: value };
    let pending = 2;
    const finish = () => {
      pending -= 1;
      if (pending <= 0) {
        console.info("CorgPhish settings debug", {
          stage: "background-persistRuntimeSetting",
          key,
          value
        });
        resolve(true);
      }
    };
    chrome.storage.local.set(patch, finish);
    chrome.storage.sync.set(patch, finish);
  });

const ensureOffscreenDocument = async () => {
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

const requestOffscreenPrediction = (url, threshold) =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "predictOffscreen", url, threshold },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        if (response?.ok && response.result) {
          resolve(response.result);
          return;
        }
        reject(new Error(response?.error || "offscreen_failed"));
      }
    );
  });

const predictUrlInBackground = async (rawUrl, threshold = DEFAULT_THRESHOLD) => {
  let result = null;
  try {
    await ensureOffscreenDocument();
    result = await requestOffscreenPrediction(rawUrl, threshold);
  } catch (offscreenError) {
    const message = String(offscreenError?.message || offscreenError || "");
    if (!isExpectedMlFailure(message)) {
      console.warn("CorgPhish: offscreen predict failed", message);
    }
  }

  if (result) {
    return result;
  }

  const { url, features } = extractFeatures(rawUrl);
  if (!url) {
    throw new Error("invalid_url");
  }
  const fallback = heuristicVerdict(features, FALLBACK_THRESHOLD, {
    includeBrandPenalty: true
  });
  return { ...fallback, status: "fallback", threshold };
};

const loadTrustedDomainsForInspection = async () => {
  const result = await loadLocalStorage({ [TRUSTED_STORAGE_KEY]: [] });
  const stored = Array.isArray(result[TRUSTED_STORAGE_KEY]) ? result[TRUSTED_STORAGE_KEY] : [];
  if (stored.length) {
    return normalizeTrustedList(stored);
  }
  return normalizeTrustedList(await cacheTrustedList());
};

const loadInspectionLists = async () => {
  const result = await loadLocalStorage({
    [CUSTOM_WHITELIST_KEY]: [],
    [CUSTOM_BLACKLIST_KEY]: []
  });
  return {
    customWhitelist: normalizeTrustedList(result[CUSTOM_WHITELIST_KEY]),
    blacklist: normalizeDomainList(result[CUSTOM_BLACKLIST_KEY])
  };
};

const inspectPageInBackground = async ({
  hostname,
  fullUrl = "",
  signals = {},
  options = {}
} = {}) => {
  const baseTrusted = await loadTrustedDomainsForInspection();
  const { customWhitelist, blacklist } = await loadInspectionLists();
  return resolveInspection({
    hostname,
    customWhitelist,
    fullUrl,
    signals,
    options,
    baseTrusted,
    blacklist,
    predict: (url) => predictUrlInBackground(url, DEFAULT_THRESHOLD),
    now: Date.now
  });
};

const autoBlockSenderTab = async (sender, result) => {
  const tabId = sender?.tab?.id;
  if (!tabId) return false;
  if (result?.verdict !== "phishing" && result?.verdict !== "blacklisted") {
    return false;
  }
  const allowed = await isTemporarilyAllowed(result.domain);
  if (allowed) {
    return false;
  }
  const targetUrl = buildBlockedPageUrl({
    domain: result.domain,
    reason: result.verdict === "blacklisted" ? "blacklist" : "phishing",
    url: sender?.tab?.url || "",
    officialDomain: result.officialDomain || ""
  });
  await new Promise((resolve) => {
    chrome.tabs.update(tabId, { url: targetUrl }, () => resolve());
  });
  console.info("CorgPhish inspect debug", {
    stage: "background-tab-block",
    tabId,
    domain: result.domain,
    verdict: result.verdict
  });
  return true;
};

// RU: Обрабатываем сообщения попапа/контента.
// EN: Handle messages from popup/content.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;

  // Главный ML-роутинг: popup не тянет модель напрямую, а просит background отдать результат.
  if (message.type === "predictUrlBg") {
    (async () => {
      try {
        const result = await predictUrlInBackground(message.url, message.threshold);
        sendResponse?.({ ok: true, result });
      } catch (error) {
        sendResponse?.({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  // Контент-скрипт использует background-роут, чтобы автопроверка страницы не зависела от popup.
  if (message.type === "inspectPageBg") {
    (async () => {
      try {
        const result = await inspectPageInBackground({
          hostname: message.hostname,
          fullUrl: message.url || "",
          signals: message.signals || {},
          options: message.options || {}
        });
        console.info("CorgPhish inspect debug", {
          stage: "background-inspectPage",
          hostname: result.domain,
          verdict: result.verdict,
          mlStatus: result.mlStatus,
          detectionSource: result.detectionSource
        });
        await autoBlockSenderTab(sender, result);
        sendResponse?.({ ok: true, result });
      } catch (error) {
        sendResponse?.({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  // Content script может попросить service worker принудительно открыть blocked.html в текущей вкладке.
  if (message.type === "openBlockedPage" && sender?.tab?.id) {
    const targetUrl = buildBlockedPageUrl({
      domain: normalizeHost(message.domain || ""),
      reason: message.reason || "phishing",
      url: message.url || sender.tab.url || "",
      officialDomain: normalizeHost(message.officialDomain || "")
    });
    chrome.tabs.update(sender.tab.id, { url: targetUrl }, () => {
      const error = chrome.runtime.lastError?.message || "";
      if (error) {
        sendResponse?.({ ok: false, error });
        return;
      }
      console.info("CorgPhish inspect debug", {
        stage: "background-openBlockedPage",
        tabId: sender.tab.id,
        reason: message.reason || "phishing",
        domain: normalizeHost(message.domain || "")
      });
      sendResponse?.({ ok: true });
    });
    return true;
  }

  if (message.type === "persistRuntimeSetting" && typeof message.key === "string") {
    persistRuntimeSetting(message.key, message.value).then(() => {
      sendResponse?.({ ok: true });
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
