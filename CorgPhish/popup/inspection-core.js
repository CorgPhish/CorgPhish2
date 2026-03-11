// RU: Чистый решатель итогового вердикта. Не зависит от chrome API и поэтому легко тестируется.
// EN: Pure inspection resolver reused by popup and test runners.
import { findSpoofCandidate, isLikelyDomain, normalizeHost } from "./utils.js";

export const resolveInspection = async ({
  hostname,
  customWhitelist = [],
  fullUrl = "",
  signals = {},
  options = {},
  baseTrusted = [],
  blacklist = [],
  predict = async () => ({ verdict: null, status: "error" }),
  now = Date.now
}) => {
  const reasonTrace = [];
  const pushTrace = (key, params = {}) => {
    reasonTrace.push({ key, params });
  };

  // Собираем единый trusted-набор из встроенного списка и пользовательского whitelist.
  const safeWhitelist = (customWhitelist || [])
    .map((domain) => normalizeHost(domain))
    .filter(isLikelyDomain);
  const trustedList = [...new Set([...(baseTrusted || []), ...safeWhitelist])];
  const hasListData = (baseTrusted || []).length > 0 || safeWhitelist.length > 0;
  const cleanDomain = normalizeHost(hostname);
  if (!cleanDomain) {
    throw new Error("errors.invalidDomain");
  }

  const strictMode = Boolean(options?.strictMode);
  const brandDomain = normalizeHost(signals?.brand?.domain || "");
  const formRisk = signals?.form || null;

  // Сначала отрабатывают жёсткие правила: blacklist и явные trusted-домены.
  const inBlacklist = (blacklist || []).some(
    (domain) => cleanDomain === domain || cleanDomain.endsWith(`.${domain}`)
  );
  if (inBlacklist) {
    pushTrace("reasonTrace.step.blacklist");
    pushTrace("reasonTrace.step.finalBlacklisted");
    return {
      domain: cleanDomain,
      verdict: "blacklisted",
      spoofTarget: null,
      isTrusted: false,
      mlVerdict: null,
      mlStatus: "skipped",
      officialDomain: null,
      reasonTrace,
      checkedAt: now(),
      detectionSource: "status.sourceValue.blacklist",
      cached: false
    };
  }

  const matchDomain = (list) =>
    list.find((domain) => cleanDomain === domain || cleanDomain.endsWith(`.${domain}`)) || null;
  const whitelistMatch = matchDomain(safeWhitelist);
  const trustedMatch = whitelistMatch ? null : matchDomain(baseTrusted || []);
  const matchedDomain = whitelistMatch || trustedMatch;
  const isTrusted = Boolean(matchedDomain);

  if (isTrusted && formRisk?.actionHost) {
    pushTrace(whitelistMatch ? "reasonTrace.step.whitelist" : "reasonTrace.step.trustedList");
    pushTrace("reasonTrace.step.formAction", { host: formRisk.actionHost });
    if (formRisk.hasSensitive) {
      pushTrace("reasonTrace.step.formSensitive");
    }
    pushTrace("reasonTrace.step.finalSuspicious");
    return {
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
      reasonTrace,
      checkedAt: now(),
      detectionSource: "status.sourceValue.form",
      cached: false
    };
  }

  if (isTrusted) {
    pushTrace(whitelistMatch ? "reasonTrace.step.whitelist" : "reasonTrace.step.trustedList");
    pushTrace("reasonTrace.step.finalTrusted");
    return {
      domain: cleanDomain,
      verdict: "trusted",
      spoofTarget: null,
      isTrusted: true,
      mlVerdict: null,
      mlStatus: "skipped",
      officialDomain: null,
      matchedDomain,
      reasonTrace,
      checkedAt: now(),
      detectionSource: whitelistMatch
        ? "status.sourceValue.whitelist"
        : "status.sourceValue.list",
      cached: false
    };
  }

  pushTrace(hasListData ? "reasonTrace.step.unlisted" : "reasonTrace.step.listMissing");

  const spoofTarget = hasListData ? brandDomain || findSpoofCandidate(cleanDomain, trustedList) : brandDomain;
  const officialDomain = spoofTarget || null;
  const targetUrl = fullUrl || (cleanDomain ? `https://${cleanDomain}` : "");
  const mlResult = targetUrl ? await predict(targetUrl) : { verdict: null, status: "error" };
  const mlStatus = mlResult?.status || "error";
  const mlVerdict = mlResult?.verdict ?? null;

  // Затем добавляем мягкие сигналы: бренд, форма, DOM-контент и ML.
  const contentRisk = signals?.content || null;
  const hasContentSignal = contentRisk?.level === "medium" || contentRisk?.level === "high";
  const hasSpoof = Boolean(spoofTarget);
  const hasSignals = Boolean(brandDomain || formRisk || hasContentSignal);
  if (hasSpoof) {
    pushTrace("reasonTrace.step.spoof", { spoofTarget });
  }
  if (brandDomain) {
    pushTrace("reasonTrace.step.brand", { brand: brandDomain });
  }
  if (formRisk?.actionHost) {
    pushTrace("reasonTrace.step.formAction", { host: formRisk.actionHost });
    if (formRisk.hasSensitive) {
      pushTrace("reasonTrace.step.formSensitive");
    }
  }
  if (contentRisk?.primaryReason) {
    pushTrace(contentRisk.primaryReason, {});
  }
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
    if (mlStatus === "ok") {
      pushTrace(
        mlVerdict === "phishing"
          ? "reasonTrace.step.mlPhishing"
          : "reasonTrace.step.mlTrusted"
      );
    } else {
      pushTrace(
        mlVerdict === "phishing"
          ? "reasonTrace.step.mlFallbackPhishing"
          : "reasonTrace.step.mlFallbackTrusted"
      );
    }
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
  if (mlStatus === "error") {
    pushTrace("reasonTrace.step.mlUnavailable");
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
    pushTrace("reasonTrace.step.strict");
    if (!suspicionKey) {
      suspicionKey = "status.suspicious.strict";
      suspicionParams = {};
    }
  }

  if (verdict === "phishing") {
    pushTrace("reasonTrace.step.finalPhishing");
  } else if (verdict === "suspicious") {
    pushTrace("reasonTrace.step.finalSuspicious");
  } else if (verdict === "trusted") {
    pushTrace("reasonTrace.step.finalTrusted");
  }

  // Возвращаем не только verdict, но и диагностические поля для popup/history/tests.
  return {
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
    reasonTrace,
    matchedDomain: null,
    checkedAt: now(),
    detectionSource: sourceKey,
    cached: false
  };
};
