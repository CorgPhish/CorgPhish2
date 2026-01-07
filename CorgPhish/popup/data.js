// RU: Работа с данными: trusted.json, настройки, история, белый/чёрный списки.
// EN: Data layer: trusted.json, settings, history, white/black lists.
import {
  CUSTOM_BLACKLIST_KEY,
  CUSTOM_WHITELIST_KEY,
  DEFAULT_SETTINGS,
  DEFAULT_ENTERPRISE_POLICY,
  ENTERPRISE_POLICY_KEY,
  HISTORY_LIMIT
} from "./config.js";
import { normalizeHost } from "./utils.js";

let trustedCache = null;
const normalizeDomainList = (domains = []) =>
  domains.map((domain) => normalizeHost(domain)).filter(Boolean);

const normalizeEnterprisePolicy = (policy = {}) => {
  const mode = ["off", "warn", "block"].includes(policy?.mode)
    ? policy.mode
    : DEFAULT_ENTERPRISE_POLICY.mode;
  return {
    mode,
    allowlist: normalizeDomainList(policy?.allowlist || []),
    denylist: normalizeDomainList(policy?.denylist || [])
  };
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
      resolve(list.map((domain) => domain.trim().toLowerCase()).filter(Boolean));
    });
    setTimeout(() => resolve([]), 1000);
  });

// RU: Загружаем trusted.json с кешированием.
// EN: Load trusted.json with caching.
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

// RU: Читаем настройки из sync storage.
// EN: Read settings from sync storage.
export const loadSettings = () =>
  new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      resolve({ ...DEFAULT_SETTINGS, ...settings });
    });
  });

// RU: Сохраняем настройки в sync storage.
// EN: Save settings to sync storage.
export const saveSettings = (settings) =>
  new Promise((resolve) => {
    chrome.storage.sync.set(settings, () => resolve(settings));
  });

// RU: Загружаем whitelist.
// EN: Load whitelist.
export const loadWhitelist = () =>
  new Promise((resolve) => {
    chrome.storage.local.get({ [CUSTOM_WHITELIST_KEY]: [] }, (result) => {
      const list = Array.isArray(result[CUSTOM_WHITELIST_KEY]) ? result[CUSTOM_WHITELIST_KEY] : [];
      resolve(normalizeDomainList(list));
    });
  });

// RU: Сохраняем whitelist.
// EN: Save whitelist.
export const saveWhitelist = (domains) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [CUSTOM_WHITELIST_KEY]: normalizeDomainList(domains) }, resolve);
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

const loadEnterprisePolicyFromBackground = () =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "getEnterprisePolicy" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      if (response?.ok && response.policy) {
        resolve({ policy: normalizeEnterprisePolicy(response.policy), managed: Boolean(response.managed) });
        return;
      }
      resolve(null);
    });
    setTimeout(() => resolve(null), 1000);
  });

export const loadEnterprisePolicy = async () => {
  const viaBackground = await loadEnterprisePolicyFromBackground();
  if (viaBackground) return viaBackground;
  return { policy: normalizeEnterprisePolicy(DEFAULT_ENTERPRISE_POLICY), managed: false };
};

export const saveEnterprisePolicy = (policy) =>
  new Promise((resolve) => {
    const normalized = normalizeEnterprisePolicy(policy);
    chrome.storage.local.set({ [ENTERPRISE_POLICY_KEY]: normalized }, () => resolve(normalized));
  });

// RU: Ограничиваем историю по давности.
// EN: Prune history by retention window.
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
      const normalized = {
        domain: entry.domain,
        verdict: entry.verdict,
        checkedAt: entry.checkedAt ?? Date.now(),
        spoofTarget: entry.spoofTarget,
        source: entry.source ?? "active",
        detectionSource: entry.detectionSource ?? null,
        mlVerdict: entry.mlVerdict ?? null,
        mlStatus: entry.mlStatus ?? null
      };
      const next = pruneByRetention([normalized, ...history], retentionDays).slice(0, HISTORY_LIMIT);
      chrome.storage.local.set({ scanHistory: next }, resolve);
    });
  });
