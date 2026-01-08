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

export const isIpDomain = (domain = "") => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(domain);

export const isLikelyDomain = (domain = "") => {
  const normalized = normalizeHost(domain);
  if (!normalized) return false;
  if (isIpDomain(normalized)) return false;
  const labels = normalized.split(".").filter(Boolean);
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  if (tld.length < 2 || tld.length > 24) return false;
  if (!/^[a-z0-9-]+$/i.test(tld)) return false;
  return labels.every(
    (label) =>
      /^[a-z0-9-]+$/i.test(label) && !label.startsWith("-") && !label.endsWith("-")
  );
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

const PUBLIC_SUFFIXES = new Set(["co.uk", "ac.uk", "gov.uk", "org.uk", "net.uk"]);

const getRegistrableDomain = (domain) => {
  const labels = normalizeHost(domain).split(".").filter(Boolean);
  if (labels.length < 2) return normalizeHost(domain);
  const tail = labels.slice(-2).join(".");
  const index = PUBLIC_SUFFIXES.has(tail) && labels.length >= 3 ? labels.length - 3 : labels.length - 2;
  return labels.slice(index).join(".");
};

const getRegistrableLabel = (domain) => {
  const labels = normalizeHost(domain).split(".").filter(Boolean);
  if (labels.length < 2) return "";
  const tail = labels.slice(-2).join(".");
  const index = PUBLIC_SUFFIXES.has(tail) && labels.length >= 3 ? labels.length - 3 : labels.length - 2;
  return labels[index] || "";
};

const splitTokens = (label = "") => label.split(/[^a-z0-9]+/i).filter(Boolean);

const isBrandTokenSpoof = (targetLabel, brandToken) => {
  if (!targetLabel || !brandToken) return false;
  if (brandToken.length < 3) return false;
  if (targetLabel === brandToken) return false;
  const tokens = splitTokens(targetLabel);
  if (tokens.length > 1 && tokens.includes(brandToken)) return true;
  if (targetLabel.includes(brandToken)) {
    const rest = targetLabel.replace(brandToken, "");
    if (/\d/.test(rest)) return true;
    if (targetLabel.includes("-") || targetLabel.includes("_")) return true;
  }
  return false;
};

export const findSpoofCandidate = (target, trustedList) => {
  const cleanTarget = normalizeHost(target);
  if (!cleanTarget) return null;
  const targetLabel = getRegistrableLabel(cleanTarget);
  const targetBase = getRegistrableDomain(cleanTarget);
  let closest = null;
  let distance = Infinity;
  let closestLabel = null;
  let labelDistance = Infinity;
  let brandMatch = null;
  trustedList.forEach((domain) => {
    const cleanDomain = normalizeHost(domain);
    if (!cleanDomain) return;
    const trustedBase = getRegistrableDomain(cleanDomain);
    if (trustedBase && targetBase && trustedBase === targetBase) return;
    if (Math.abs(cleanTarget.length - cleanDomain.length) <= 2) {
      const currentDistance = levenshteinDistance(cleanTarget, cleanDomain);
      if (currentDistance < distance) {
        distance = currentDistance;
        closest = cleanDomain;
      }
    }
    const trustedLabel = getRegistrableLabel(cleanDomain);
    if (trustedLabel && targetLabel && Math.abs(targetLabel.length - trustedLabel.length) <= 2) {
      const currentDistance = levenshteinDistance(targetLabel, trustedLabel);
      if (currentDistance < labelDistance) {
        labelDistance = currentDistance;
        closestLabel = cleanDomain;
      }
    }
    if (!brandMatch) {
      if (isBrandTokenSpoof(targetLabel, trustedLabel)) {
        brandMatch = cleanDomain;
      }
    }
  });
  if (distance <= 2 && closest) return closest;
  const labelLimit = targetLabel.length >= 6 ? 2 : 1;
  if (labelDistance <= labelLimit && closestLabel) return closestLabel;
  return brandMatch;
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
