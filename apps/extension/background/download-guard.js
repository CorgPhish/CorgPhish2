// RU: Чистые helper-функции для отмены загрузок из рискованных вкладок.
// EN: Pure helpers for canceling downloads initiated from risky tabs.
import { normalizeHost } from "../popup/utils.js";

export const DOWNLOAD_GUARD_TTL_MS = 5 * 60 * 1000;

export const resolveDownloadHost = (rawUrl = "") => {
  const candidate = String(rawUrl || "").trim();
  if (!candidate) return "";
  try {
    return normalizeHost(new URL(candidate).hostname || "");
  } catch (error) {
    return normalizeHost(candidate);
  }
};

export const createGuardedTabEntry = (payload = {}, now = Date.now()) => {
  const domain = normalizeHost(payload.domain || "");
  const urlHost = resolveDownloadHost(payload.url || "");
  const pageUrl = String(payload.url || "").trim();
  const blockDownloads = Boolean(payload.blockDownloads);
  if (!blockDownloads || (!domain && !urlHost)) {
    return null;
  }
  return {
    tabId: Number(payload.tabId),
    domain: domain || urlHost,
    urlHost: urlHost || domain,
    pageUrl,
    verdict: String(payload.verdict || "suspicious"),
    updatedAt: Number(payload.updatedAt || now)
  };
};

export const pruneGuardedTabEntries = (entries = [], now = Date.now()) =>
  entries.filter((entry) => {
    if (!entry) return false;
    if (!entry.domain && !entry.urlHost) return false;
    if (!Number.isFinite(entry.updatedAt)) return false;
    return now - entry.updatedAt <= DOWNLOAD_GUARD_TTL_MS;
  });

export const matchGuardedDownload = (downloadItem = {}, entries = [], now = Date.now()) => {
  const activeEntries = pruneGuardedTabEntries(entries, now);
  if (!activeEntries.length) return null;
  const referrerHost = resolveDownloadHost(downloadItem.referrer || "");
  const fileHost = resolveDownloadHost(downloadItem.finalUrl || downloadItem.url || "");
  for (const entry of activeEntries) {
    const knownHosts = [entry.domain, entry.urlHost].filter(Boolean);
    if (referrerHost && knownHosts.includes(referrerHost)) {
      return {
        entry,
        matchedBy: "referrer",
        matchedHost: referrerHost
      };
    }
    if (!referrerHost && fileHost && knownHosts.includes(fileHost)) {
      return {
        entry,
        matchedBy: "downloadHost",
        matchedHost: fileHost
      };
    }
  }
  return null;
};
