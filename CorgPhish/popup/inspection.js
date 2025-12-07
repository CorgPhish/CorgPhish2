// Проверка домена против trusted.json и пользовательского whitelist.
import { getTrustedDomains } from "./data.js";
import { findSpoofCandidate, normalizeHost } from "./utils.js";
import { predictUrl } from "./model.js";

const CACHE_TTL_MS = 5000;
let lastInspection = null;

export const inspectDomain = async (hostname, customWhitelist = [], fullUrl = "") => {
  const trustedList = await getTrustedDomains(customWhitelist);
  const cleanDomain = normalizeHost(hostname);
  if (!cleanDomain) {
    throw new Error("errors.invalidDomain");
  }
  const cacheKey = `${fullUrl || cleanDomain}::${customWhitelist.join("|")}`;
  if (lastInspection && lastInspection.key === cacheKey && Date.now() - lastInspection.ts < CACHE_TTL_MS) {
    return { ...lastInspection.result, cached: true };
  }

  const isTrusted = trustedList.some(
    (domain) => cleanDomain === domain || cleanDomain.endsWith(`.${domain}`)
  );
  const mlResult = fullUrl ? await predictUrl(fullUrl) : { probability: null, label: null, status: "skipped" };
  const mlStatus = mlResult?.status || "ok";
  const mlProbability = mlStatus === "ok" ? mlResult?.probability ?? null : null;
  const mlVerdict =
    mlStatus === "ok" && typeof mlResult?.label === "number"
      ? mlResult.label === 1
        ? "risky"
        : "safe"
      : null;

  let verdict = "untrusted";
  let sourceKey = mlStatus === "ok" ? "status.sourceValue" : "status.sourceValue.list";
  if (isTrusted) {
    verdict = "trusted";
    sourceKey = "status.sourceValue.list";
  } else if (mlStatus === "ok" && mlResult?.label === 0 && mlResult?.probability !== null) {
    verdict = "mlSafe";
    sourceKey = "status.sourceValue.ml";
  } else if (mlStatus === "ok" && mlResult?.label === 1) {
    verdict = "mlRisky";
    sourceKey = "status.sourceValue.mlRisk";
  }

  const spoofTarget = verdict === "trusted" ? null : findSpoofCandidate(cleanDomain, trustedList);
  const result = {
    domain: cleanDomain,
    verdict,
    spoofTarget,
    isTrusted,
    mlProbability,
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
