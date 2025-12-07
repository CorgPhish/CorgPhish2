// Проверка домена против trusted.json и пользовательского whitelist.
import { getTrustedDomains } from "./data.js";
import { findSpoofCandidate, normalizeHost } from "./utils.js";
import { predictUrl } from "./model.js";

export const inspectDomain = async (hostname, customWhitelist = [], fullUrl = "") => {
  const trustedList = await getTrustedDomains(customWhitelist);
  const cleanDomain = normalizeHost(hostname);
  if (!cleanDomain) {
    throw new Error("errors.invalidDomain");
  }
  const isTrusted = trustedList.some(
    (domain) => cleanDomain === domain || cleanDomain.endsWith(`.${domain}`)
  );
  const mlResult = fullUrl ? await predictUrl(fullUrl) : { probability: null, label: null };

  let verdict = "untrusted";
  let sourceKey = "status.sourceValue";
  if (isTrusted) {
    verdict = "trusted";
    sourceKey = "status.sourceValue.list";
  } else if (mlResult?.label === 0 && mlResult?.probability !== null) {
    verdict = "mlSafe";
    sourceKey = "status.sourceValue.ml";
  } else if (mlResult?.label === 1) {
    verdict = "mlRisky";
    sourceKey = "status.sourceValue.mlRisk";
  }

  const spoofTarget = verdict === "trusted" ? null : findSpoofCandidate(cleanDomain, trustedList);
  return {
    domain: cleanDomain,
    verdict,
    spoofTarget,
    isTrusted,
    mlProbability: mlResult?.probability ?? null,
    detectionSource: sourceKey
  };
};
