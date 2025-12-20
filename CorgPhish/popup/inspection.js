// RU: Проверка домена: trusted/whitelist → легитимный, похожие → подозрительные, остальное через ML.
// EN: Domain inspection: trusted/whitelist → trusted, similar → suspicious, otherwise ML.
import { getTrustedDomains, loadBlacklist } from "./data.js";
import { findSpoofCandidate, normalizeHost } from "./utils.js";
import { predictUrl } from "./model.js";

const CACHE_TTL_MS = 5000;
let lastInspection = null;

export const inspectDomain = async (hostname, customWhitelist = [], fullUrl = "") => {
  const trustedList = await getTrustedDomains(customWhitelist);
  const blacklist = await loadBlacklist();
  const cleanDomain = normalizeHost(hostname);
  if (!cleanDomain) {
    throw new Error("errors.invalidDomain");
  }

  const cacheKey = `${fullUrl || cleanDomain}::${customWhitelist.join("|")}::${blacklist.join("|")}`;
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
      checkedAt: Date.now(),
      detectionSource: "status.sourceValue.blacklist",
      cached: false
    };
    lastInspection = { key: cacheKey, ts: Date.now(), result };
    return result;
  }

  const isTrusted = trustedList.some(
    (domain) => cleanDomain === domain || cleanDomain.endsWith(`.${domain}`)
  );
  if (isTrusted) {
    const result = {
      domain: cleanDomain,
      verdict: "trusted",
      spoofTarget: null,
      isTrusted: true,
      mlVerdict: null,
      mlStatus: "skipped",
      checkedAt: Date.now(),
      detectionSource: "status.sourceValue.list",
      cached: false
    };
    lastInspection = { key: cacheKey, ts: Date.now(), result };
    return result;
  }

  const spoofTarget = findSpoofCandidate(cleanDomain, trustedList);
  const mlResult = fullUrl ? await predictUrl(fullUrl) : { verdict: null, status: "error" };
  const mlStatus = mlResult?.status || "error";
  const mlVerdict = mlResult?.verdict ?? null;

  const hasSpoof = Boolean(spoofTarget);
  let verdict = "suspicious";
  let sourceKey = hasSpoof ? "status.sourceValue.levenshtein" : "status.sourceValue.ml";

  if (mlStatus === "ok" || mlStatus === "fallback") {
    if (mlVerdict === "phishing") {
      verdict = "phishing";
      sourceKey = "status.sourceValue.ml";
    } else if (mlVerdict === "trusted" && !hasSpoof) {
      verdict = "trusted";
      sourceKey = "status.sourceValue.ml";
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
    checkedAt: Date.now(),
    detectionSource: sourceKey,
    cached: false
  };
  lastInspection = { key: cacheKey, ts: Date.now(), result };
  return result;
};
