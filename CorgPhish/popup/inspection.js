// Проверка домена против trusted.json и пользовательского whitelist.
import { getTrustedDomains } from "./data.js";
import { findSpoofCandidate, normalizeHost } from "./utils.js";

export const inspectDomain = async (hostname, customWhitelist = []) => {
  const trustedList = await getTrustedDomains(customWhitelist);
  const cleanDomain = normalizeHost(hostname);
  if (!cleanDomain) {
    throw new Error("errors.invalidDomain");
  }
  const isTrusted = trustedList.some(
    (domain) => cleanDomain === domain || cleanDomain.endsWith(`.${domain}`)
  );
  const spoofTarget = !isTrusted ? findSpoofCandidate(cleanDomain, trustedList) : null;
  return {
    domain: cleanDomain,
    verdict: isTrusted ? "trusted" : "untrusted",
    spoofTarget,
    isTrusted
  };
};
