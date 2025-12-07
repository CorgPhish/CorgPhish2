// Работа с данными: trusted.json, настройки, история, whitelist.
import { CUSTOM_WHITELIST_KEY, DEFAULT_SETTINGS, HISTORY_LIMIT } from "./config.js";

let trustedCache = null;

const loadFromBackground = () =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "getTrustedDomains" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve([]);
        return;
      }
      const list = Array.isArray(response?.trusted) ? response.trusted : [];
      resolve(list.map((domain) => domain.trim().toLowerCase()).filter(Boolean));
    });
    setTimeout(() => resolve([]), 1000);
  });

export const loadTrustedList = async () => {
  if (trustedCache) {
    return trustedCache;
  }
  const viaSw = await loadFromBackground();
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
    trustedCache = payload.trusted.map((domain) => domain.trim().toLowerCase()).filter(Boolean);
    return trustedCache;
  } catch (error) {
    console.warn("CorgPhish: failed to fetch trusted.json in popup", error);
    throw error;
  }
};

export const getTrustedDomains = async (customWhitelist = []) => {
  const base = await loadTrustedList();
  return [...new Set([...base, ...customWhitelist])];
};

export const loadSettings = () =>
  new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      resolve({ ...DEFAULT_SETTINGS, ...settings });
    });
  });

export const saveSettings = (settings) =>
  new Promise((resolve) => {
    chrome.storage.sync.set(settings, () => resolve(settings));
  });

export const loadWhitelist = () =>
  new Promise((resolve) => {
    chrome.storage.local.get({ [CUSTOM_WHITELIST_KEY]: [] }, (result) => {
      resolve(Array.isArray(result[CUSTOM_WHITELIST_KEY]) ? result[CUSTOM_WHITELIST_KEY] : []);
    });
  });

export const saveWhitelist = (domains) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [CUSTOM_WHITELIST_KEY]: domains }, resolve);
  });

const pruneByRetention = (items = [], days = 0) => {
  const retentionDays = Number(days) || 0;
  if (retentionDays <= 0) {
    return items;
  }
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  return items.filter((entry) => Number(entry.checkedAt || 0) >= cutoff);
};

export const loadHistory = (retentionDays) =>
  new Promise((resolve) => {
    chrome.storage.local.get({ scanHistory: [] }, (result) => {
      const history = Array.isArray(result.scanHistory) ? result.scanHistory : [];
      resolve(pruneByRetention(history, retentionDays));
    });
  });

export const clearHistory = () =>
  new Promise((resolve) => {
    chrome.storage.local.set({ scanHistory: [] }, resolve);
  });

export const recordHistory = (entry, retentionDays) =>
  new Promise((resolve) => {
    chrome.storage.local.get({ scanHistory: [] }, (result) => {
      const history = Array.isArray(result.scanHistory) ? result.scanHistory : [];
      const normalized = {
        domain: entry.domain,
        verdict: entry.verdict,
        checkedAt: entry.checkedAt ?? Date.now(),
        spoofTarget: entry.spoofTarget,
        source: entry.source ?? "active",
        mlProbability:
          typeof entry.mlProbability === "number" && !Number.isNaN(entry.mlProbability)
            ? entry.mlProbability
            : null,
        detectionSource: entry.detectionSource,
        mlVerdict: entry.mlVerdict ?? null,
        mlStatus: entry.mlStatus ?? null
      };
      const next = pruneByRetention([normalized, ...history], retentionDays).slice(0, HISTORY_LIMIT);
      chrome.storage.local.set({ scanHistory: next }, resolve);
    });
  });
