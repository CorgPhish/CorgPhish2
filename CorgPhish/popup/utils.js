// Утилиты: нормализация доменов, время, похожесть.
// Utilities: domain normalization, time formatting, similarity checks.
import { DEFAULT_SETTINGS } from "./config.js";

// RU: Нормализация доменного имени (поддерживает URL/пути).
// EN: Normalize hostname (supports URL/paths).
export const normalizeHost = (hostname = "") => {
  const trimmed = hostname.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./i, "").replace(/\.$/, "").toLowerCase();
  } catch (error) {
    return trimmed.replace(/^www\./i, "").replace(/\.$/, "").toLowerCase();
  }
};

// RU: Расстояние Левенштейна для похожести доменов.
// EN: Levenshtein distance for domain similarity.
export const levenshteinDistance = (a = "", b = "") => {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
};

export const findSpoofCandidate = (target, trustedList) => {
  let closest = null;
  let distance = Infinity;
  trustedList.forEach((domain) => {
    if (Math.abs(target.length - domain.length) > 2) return;
    const currentDistance = levenshteinDistance(target, domain);
    if (currentDistance < distance) {
      distance = currentDistance;
      closest = domain;
    }
  });
  return distance <= 2 ? closest : null;
};

export const resolveHostname = (input = "") => normalizeHost(input);

export const getLocale = (language) => (language === "en" ? "en-US" : "ru-RU");

// RU: Форматирование времени для UI.
// EN: Format time for UI display.
export const formatTime = (date, language) =>
  date?.toLocaleTimeString(getLocale(language || DEFAULT_SETTINGS.language), {
    hour: "2-digit",
    minute: "2-digit"
  }) ?? "—";
