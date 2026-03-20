// RU: Чистые функции истории: формируют снимок последних проверок без доступа к chrome.storage.
// EN: Pure history helpers used by popup data layer and test runners.
import { HISTORY_LIMIT } from "./config.js";

export const pruneHistoryByRetention = (items = [], days = 0, now = Date.now()) => {
  const retentionDays = Number(days) || 0;
  if (retentionDays <= 0) {
    return items;
  }
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  return items.filter((entry) => Number(entry.checkedAt || 0) >= cutoff);
};

// Приводим произвольный объект к форме записи истории, чтобы UI не зависел от частичных данных.
export const normalizeHistoryEntry = (entry = {}, now = Date.now()) => ({
  domain: entry.domain,
  verdict: entry.verdict,
  checkedAt: entry.checkedAt ?? now,
  spoofTarget: entry.spoofTarget,
  source: entry.source ?? "active",
  detectionSource: entry.detectionSource ?? null,
  mlVerdict: entry.mlVerdict ?? null,
  mlStatus: entry.mlStatus ?? null
});

export const buildHistorySnapshot = (
  existing = [],
  nextEntry,
  retentionDays = 0,
  now = Date.now(),
  limit = HISTORY_LIMIT
) => {
  const normalized = normalizeHistoryEntry(nextEntry, now);
  return pruneHistoryByRetention([normalized, ...existing], retentionDays, now).slice(0, limit);
};
