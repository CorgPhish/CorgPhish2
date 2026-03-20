// RU: Работа с данными: trusted.json, настройки, история, белый/чёрный списки.
// EN: Data layer: trusted.json, settings, history, white/black lists.
import {
  CUSTOM_BLACKLIST_KEY,
  CUSTOM_WHITELIST_KEY,
  DEFAULT_SETTINGS,
  HISTORY_LIMIT
} from "./config.js";
import { buildHistorySnapshot, pruneHistoryByRetention } from "./history-core.js";
import { isLikelyDomain, normalizeHost } from "./utils.js";

let trustedCache = null;
const BLOCK_TOGGLE_MIRROR_KEY = "corgphish.blockOnUntrusted";
const normalizeDomainList = (domains = []) =>
  domains.map((domain) => normalizeHost(domain)).filter(Boolean);
const normalizeTrustedList = (domains = []) => normalizeDomainList(domains).filter(isLikelyDomain);
const settingsQuery = Object.fromEntries(
  Object.keys(DEFAULT_SETTINGS).map((key) => [key, undefined])
);
const pickKnownSettings = (source = {}) =>
  Object.fromEntries(
    Object.keys(DEFAULT_SETTINGS)
      .filter(
        (key) =>
          Object.prototype.hasOwnProperty.call(source || {}, key) && source[key] !== undefined
      )
      .map((key) => [key, source[key]])
  );

export const __resetDataCachesForTests = () => {
  trustedCache = null;
};

const readBlockToggleMirror = () => {
  try {
    const raw = window.localStorage.getItem(BLOCK_TOGGLE_MIRROR_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch (error) {
    // ignore localStorage failures in popup
  }
  return undefined;
};

const writeBlockToggleMirror = (value) => {
  try {
    window.localStorage.setItem(BLOCK_TOGGLE_MIRROR_KEY, String(Boolean(value)));
  } catch (error) {
    // ignore localStorage failures in popup
  }
};

// RU: Загружаем trusted через service worker.
// EN: Load trusted domains via service worker.
const loadFromBackground = () =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "getTrustedDomains" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve([]);
        return;
      }
      const list = Array.isArray(response?.trusted) ? response.trusted : [];
      resolve(list.map((domain) => String(domain || "").trim().toLowerCase()).filter(Boolean));
    });
    setTimeout(() => resolve([]), 1000);
  });

// RU: Загружаем trusted.json с кешированием.
// EN: Load trusted.json with caching.
export const loadTrustedList = async () => {
  if (trustedCache) {
    return trustedCache;
  }
  const viaSw = normalizeTrustedList(await loadFromBackground());
  if (viaSw.length) {
    trustedCache = viaSw;
    return trustedCache;
  }
  try {
    const response = await fetch(chrome.runtime.getURL("trusted.json"));
    if (!response.ok) {
      throw new Error("errors.loadTrusted");
    }
    const payload = await response.json();
    if (!Array.isArray(payload?.trusted)) {
      throw new Error("errors.invalidTrusted");
    }
    trustedCache = normalizeTrustedList(payload.trusted);
    return trustedCache;
  } catch (error) {
    console.warn("CorgPhish: failed to fetch trusted.json in popup", error);
    throw error;
  }
};

export const getTrustedDomains = async (customWhitelist = []) => {
  const base = await loadTrustedList();
  const safeWhitelist = normalizeTrustedList(customWhitelist);
  return [...new Set([...base, ...safeWhitelist])];
};

// RU: Читаем настройки из sync storage.
// EN: Read settings from sync storage.
export const loadSettings = async () => {
  const [localSettings, syncSettings] = await Promise.all([
    new Promise((resolve) => {
      chrome.storage.local.get(settingsQuery, (settings) => {
        resolve(pickKnownSettings(settings));
      });
    }),
    new Promise((resolve) => {
      chrome.storage.sync.get(settingsQuery, (settings) => {
        resolve(pickKnownSettings(settings));
      });
    })
  ]);
  const mirrorValue = readBlockToggleMirror();
  const merged = {
    ...DEFAULT_SETTINGS,
    ...syncSettings,
    ...localSettings,
    ...(mirrorValue === undefined ? {} : { blockOnUntrusted: mirrorValue })
  };
  console.info("CorgPhish settings debug", {
    stage: "loadSettings",
    syncBlockOnUntrusted: syncSettings.blockOnUntrusted,
    localBlockOnUntrusted: localSettings.blockOnUntrusted,
    mirrorBlockOnUntrusted: mirrorValue,
    resolvedBlockOnUntrusted: merged.blockOnUntrusted
  });
  if (
    mirrorValue !== undefined &&
    localSettings.blockOnUntrusted === undefined &&
    syncSettings.blockOnUntrusted === undefined
  ) {
    // Если popup успел сохранить только локальный mirror, восстанавливаем extension storage автоматически.
    chrome.storage.local.set({ blockOnUntrusted: mirrorValue });
    chrome.storage.sync.set({ blockOnUntrusted: mirrorValue });
  }
  return merged;
};

// RU: Сохраняем настройки в sync storage.
// EN: Save settings to sync storage.
export const saveSettings = (settings) =>
  new Promise((resolve) => {
    const normalized = { ...DEFAULT_SETTINGS, ...pickKnownSettings(settings) };
    writeBlockToggleMirror(normalized.blockOnUntrusted);
    console.info("CorgPhish settings debug", {
      stage: "saveSettings",
      blockOnUntrusted: normalized.blockOnUntrusted
    });
    let pending = 2;
    const finish = () => {
      pending -= 1;
      if (pending <= 0) {
        resolve(normalized);
      }
    };
    chrome.storage.sync.set(normalized, finish);
    chrome.storage.local.set(normalized, finish);
  });

// RU: Загружаем whitelist.
// EN: Load whitelist.
export const loadWhitelist = () =>
  new Promise((resolve) => {
    chrome.storage.local.get({ [CUSTOM_WHITELIST_KEY]: [] }, (result) => {
      const list = Array.isArray(result[CUSTOM_WHITELIST_KEY]) ? result[CUSTOM_WHITELIST_KEY] : [];
      resolve(normalizeTrustedList(list));
    });
  });

// RU: Сохраняем whitelist.
// EN: Save whitelist.
export const saveWhitelist = (domains) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [CUSTOM_WHITELIST_KEY]: normalizeTrustedList(domains) }, resolve);
  });

// RU: Загружаем blacklist.
// EN: Load blacklist.
export const loadBlacklist = () =>
  new Promise((resolve) => {
    chrome.storage.local.get({ [CUSTOM_BLACKLIST_KEY]: [] }, (result) => {
      const list = Array.isArray(result[CUSTOM_BLACKLIST_KEY]) ? result[CUSTOM_BLACKLIST_KEY] : [];
      resolve(normalizeDomainList(list));
    });
  });

// RU: Сохраняем blacklist.
// EN: Save blacklist.
export const saveBlacklist = (domains) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [CUSTOM_BLACKLIST_KEY]: normalizeDomainList(domains) }, resolve);
  });

export const loadHistory = (retentionDays) =>
  new Promise((resolve) => {
    chrome.storage.local.get({ scanHistory: [] }, (result) => {
      const history = Array.isArray(result.scanHistory) ? result.scanHistory : [];
      resolve(pruneHistoryByRetention(history, retentionDays));
    });
  });

// RU: Очистить историю.
// EN: Clear history.
export const clearHistory = () =>
  new Promise((resolve) => {
    chrome.storage.local.set({ scanHistory: [] }, resolve);
  });

// RU: Записать новую запись истории с нормализацией.
// EN: Persist new history entry with normalization.
export const recordHistory = (entry, retentionDays) =>
  new Promise((resolve) => {
    chrome.storage.local.get({ scanHistory: [] }, (result) => {
      const history = Array.isArray(result.scanHistory) ? result.scanHistory : [];
      const next = buildHistorySnapshot(history, entry, retentionDays, Date.now(), HISTORY_LIMIT);
      chrome.storage.local.set({ scanHistory: next }, resolve);
    });
  });
