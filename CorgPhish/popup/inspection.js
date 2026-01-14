// RU: Проверка домена: trusted/whitelist → легитимный, похожие → подозрительные, остальное через ML.
// EN: Domain inspection: trusted/whitelist → trusted, similar → suspicious, otherwise ML.
import { loadBlacklist, loadTrustedList } from "./data.js";
import { findSpoofCandidate, isLikelyDomain, normalizeHost } from "./utils.js";
import { predictUrl } from "./model.js";

const CACHE_TTL_MS = 5000;
let lastInspection = null;

export const inspectDomain = async (
  hostname,
  customWhitelist = [],
  fullUrl = "",
  signals = {},
  options = {}
) => {
  let baseTrusted = [];
  try {
    baseTrusted = await loadTrustedList();
  } catch (error) {
    baseTrusted = [];
  }
  const safeWhitelist = (customWhitelist || [])
    .map((domain) => normalizeHost(domain))
    .filter(isLikelyDomain);
  const trustedList = [...new Set([...baseTrusted, ...safeWhitelist])];
  const hasListData = baseTrusted.length > 0 || safeWhitelist.length > 0;
  const blacklist = await loadBlacklist();
  const cleanDomain = normalizeHost(hostname);
  if (!cleanDomain) {
    throw new Error("errors.invalidDomain");
  }

  const strictMode = Boolean(options?.strictMode);
  const brandDomain = normalizeHost(signals?.brand?.domain || "");
  const formRisk = signals?.form || null;
  const signalKey = JSON.stringify({
    brand: brandDomain,
    form: normalizeHost(formRisk?.actionHost || ""),
    formReason: formRisk?.reason || "",
    strict: strictMode
  });
  const cacheKey = `${fullUrl || cleanDomain}::${customWhitelist.join("|")}::${blacklist.join("|")}::${signalKey}`;
  if (lastInspection && lastInspection.key === cacheKey && Date.now() - lastInspection.ts < CACHE_TTL_MS) {
    return { ...lastInspection.result, cached: true };
  }

  const inBlacklist = blacklist.some(
    (domain) => cleanDomain === domain || cleanDomain.endsWith(`.${domain}`)
  );
  if (inBlacklist) {
    const result = {
      domain: cleanDomain,
      verdict: "blacklisted",
      spoofTarget: null,
      isTrusted: false,
      mlVerdict: null,
      mlStatus: "skipped",
      officialDomain: null,
      checkedAt: Date.now(),
      detectionSource: "status.sourceValue.blacklist",
      cached: false
    };
    lastInspection = { key: cacheKey, ts: Date.now(), result };
    return result;
  }

  const matchDomain = (list) =>
    list.find((domain) => cleanDomain === domain || cleanDomain.endsWith(`.${domain}`)) || null;
  const whitelistMatch = matchDomain(safeWhitelist);
  const trustedMatch = whitelistMatch ? null : matchDomain(baseTrusted);
  const matchedDomain = whitelistMatch || trustedMatch;
  const isTrusted = Boolean(matchedDomain);
  if (isTrusted && formRisk?.actionHost) {
    const result = {
      domain: cleanDomain,
      verdict: "suspicious",
      spoofTarget: null,
      isTrusted: false,
      mlVerdict: null,
      mlStatus: "skipped",
      suspicionKey: "status.suspicious.form",
      suspicionParams: { host: formRisk.actionHost },
      formRisk,
      officialDomain: null,
      matchedDomain: null,
      checkedAt: Date.now(),
      detectionSource: "status.sourceValue.form",
      cached: false
    };
    lastInspection = { key: cacheKey, ts: Date.now(), result };
    return result;
  }
  if (isTrusted) {
    const result = {
      domain: cleanDomain,
      verdict: "trusted",
      spoofTarget: null,
      isTrusted: true,
      mlVerdict: null,
      mlStatus: "skipped",
      officialDomain: null,
      matchedDomain,
      checkedAt: Date.now(),
      detectionSource: whitelistMatch
        ? "status.sourceValue.whitelist"
        : "status.sourceValue.list",
      cached: false
    };
    lastInspection = { key: cacheKey, ts: Date.now(), result };
    return result;
  }

  const spoofTarget = hasListData ? brandDomain || findSpoofCandidate(cleanDomain, trustedList) : brandDomain;
  const officialDomain = spoofTarget || null;
  const mlResult = fullUrl ? await predictUrl(fullUrl) : { verdict: null, status: "error" };
  const mlStatus = mlResult?.status || "error";
  const mlVerdict = mlResult?.verdict ?? null;

  const contentRisk = signals?.content || null;
  const hasContentSignal = contentRisk?.level === "medium" || contentRisk?.level === "high";
  const hasSpoof = Boolean(spoofTarget);
  const hasSignals = Boolean(brandDomain || formRisk || hasContentSignal);
  let suspicionKey = null;
  let suspicionParams = null;
  if (brandDomain) {
    suspicionKey = "status.suspicious.brand";
    suspicionParams = { brand: brandDomain };
  } else if (formRisk?.actionHost) {
    suspicionKey = "status.suspicious.form";
    suspicionParams = { host: formRisk.actionHost };
  } else if (contentRisk?.primaryReason) {
    suspicionKey = contentRisk.primaryReason;
    suspicionParams = {};
  }
  let verdict = "suspicious";
  let sourceKey = "status.sourceValue.ml";
  if (brandDomain) {
    sourceKey = "status.sourceValue.brand";
  } else if (formRisk?.actionHost) {
    sourceKey = "status.sourceValue.form";
  } else if (hasSpoof) {
    sourceKey = "status.sourceValue.levenshtein";
  }

  if (mlStatus === "ok" || mlStatus === "fallback") {
    if (mlVerdict === "phishing") {
      verdict = "phishing";
      sourceKey = mlStatus === "fallback" ? "status.sourceValue.heuristic" : "status.sourceValue.ml";
    } else if (mlVerdict === "trusted" && !hasSpoof && !hasSignals) {
      verdict = "suspicious";
      if (!suspicionKey) {
        suspicionKey = hasListData ? "status.suspicious.unlisted" : "status.suspicious.listMissing";
        suspicionParams = {};
      }
      sourceKey = hasListData
        ? mlStatus === "fallback"
          ? "status.sourceValue.heuristic"
          : "status.sourceValue.ml"
        : "status.sourceValue.listMissing";
    }
  }
  if (mlStatus === "fallback" && sourceKey === "status.sourceValue.ml") {
    sourceKey = "status.sourceValue.heuristic";
  }
  const hasRiskyForm = Boolean(
    formRisk?.actionHost &&
      (formRisk.hasSensitive || formRisk.reason === "ip" || formRisk.reason === "http")
  );
  if (verdict !== "phishing" && (hasSpoof || hasRiskyForm)) {
    verdict = "phishing";
    if (hasRiskyForm) {
      sourceKey = "status.sourceValue.form";
    } else if (hasSpoof) {
      sourceKey = "status.sourceValue.levenshtein";
    }
  }
  if (contentRisk?.level === "high" && verdict !== "phishing") {
    verdict = "phishing";
    sourceKey = "status.sourceValue.content";
  } else if (contentRisk?.level === "medium" && verdict === "suspicious") {
    if (sourceKey === "status.sourceValue.ml") {
      sourceKey = "status.sourceValue.content";
    }
  }
  if (strictMode && verdict === "trusted") {
    verdict = "suspicious";
    sourceKey = "status.sourceValue.strict";
    if (!suspicionKey) {
      suspicionKey = "status.suspicious.strict";
      suspicionParams = {};
    }
  }

  const result = {
    domain: cleanDomain,
    verdict,
    spoofTarget,
    isTrusted: false,
    mlVerdict,
    mlStatus,
    mlError: mlResult?.error,
    suspicionKey,
    suspicionParams,
    formRisk,
    officialDomain,
    matchedDomain: null,
    checkedAt: Date.now(),
    detectionSource: sourceKey,
    cached: false
  };
  lastInspection = { key: cacheKey, ts: Date.now(), result };
  return result;
};
