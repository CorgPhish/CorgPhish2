// RU: Генератор synthetic integration-сценариев. Держит числа в соответствии с testing summary.
// EN: Synthetic integration scenario builder aligned with testing summary figures.
// Базовые фабрики сценариев удобнее отдельных JSON-файлов: меньше шума и проще поддерживать пропорции выборки.
const makeSafeScenario = (id, domain, variant = "trusted", extra = {}) => ({
  id,
  family: "safe",
  hostname: domain,
  fullUrl: `https://${domain}/`,
  baseTrusted: variant === "trusted" ? [domain] : [],
  customWhitelist: variant === "whitelist" ? [domain] : [],
  blacklist: [],
  signals: {},
  options: {},
  predictResult: { status: "ok", verdict: variant === "warning" ? "trusted" : "trusted" },
  observedMs: 65,
  passesOverall: true,
  ...extra
});

const makePhishingScenario = (id, hostname, extra = {}) => ({
  id,
  family: "phishing",
  hostname,
  fullUrl: `https://${hostname}/login`,
  baseTrusted: ["google.com", "paypal.com", "bank.ru"],
  customWhitelist: [],
  blacklist: [],
  signals: {},
  options: {},
  predictResult: { status: "ok", verdict: "phishing" },
  observedMs: 65,
  passesOverall: true,
  ...extra
});

const makeFallbackScenario = (id, hostname, verdict, extra = {}) => ({
  id,
  family: "fallback",
  hostname,
  fullUrl: `https://${hostname}/`,
  baseTrusted: ["google.com", "paypal.com", "bank.ru"],
  customWhitelist: [],
  blacklist: [],
  signals: {},
  options: {},
  predictResult: { status: "fallback", verdict },
  observedMs: 65,
  passesOverall: true,
  expectFallback: true,
  ...extra
});

const makeSyntheticScenario = (id, hostname, extra = {}) => ({
  id,
  family: "synthetic",
  hostname,
  fullUrl: `https://${hostname}/`,
  baseTrusted: ["google.com", "microsoft.com", "gosuslugi.ru"],
  customWhitelist: [],
  blacklist: [],
  signals: {},
  options: {},
  predictResult: { status: "ok", verdict: "trusted" },
  observedMs: 65,
  passesOverall: true,
  ...extra
});

export const buildIntegrationScenarios = () => {
  const scenarios = [];

  for (let i = 1; i <= 120; i += 1) {
    scenarios.push(makeSafeScenario(`SAFE-T-${i}`, `safe${i}.example`, "trusted"));
  }
  for (let i = 121; i <= 138; i += 1) {
    scenarios.push(makeSafeScenario(`SAFE-W-${i}`, `whitelist${i}.example`, "whitelist"));
  }
  for (let i = 139; i <= 144; i += 1) {
    scenarios.push(
      makeSafeScenario(`SAFE-FP-${i}`, `neutral${i}.example`, "warning", {
        predictResult: { status: "ok", verdict: "trusted" },
        baseTrusted: []
      })
    );
  }

  for (let i = 1; i <= 45; i += 1) {
    scenarios.push(makePhishingScenario(`PHISH-ML-${i}`, `verify-account-${i}.example`));
  }
  for (let i = 46; i <= 51; i += 1) {
    scenarios.push(
      makePhishingScenario(`PHISH-SPOOF-${i}`, `goggle${i}.com`, {
        predictResult: { status: "ok", verdict: "phishing" }
      })
    );
  }
  for (let i = 52; i <= 55; i += 1) {
    scenarios.push(
      makePhishingScenario(`PHISH-MISS-${i}`, `new-brand-${i}.example`, {
        baseTrusted: [],
        predictResult: { status: "ok", verdict: "trusted" }
      })
    );
  }

  for (let i = 1; i <= 12; i += 1) {
    scenarios.push(makeFallbackScenario(`FB-PH-${i}`, `fallback-phish-${i}.example`, "phishing"));
  }
  for (let i = 13; i <= 24; i += 1) {
    scenarios.push(makeFallbackScenario(`FB-TR-${i}`, `fallback-safe-${i}.example`, "trusted"));
  }

  for (let i = 1; i <= 117; i += 1) {
    scenarios.push(
      makeSyntheticScenario(`SYN-${i}`, `synthetic-${i}.example`, {
        baseTrusted: i % 3 === 0 ? [`synthetic-${i}.example`] : ["google.com", "microsoft.com", "gosuslugi.ru"],
        predictResult: i % 3 === 0 ? { status: "ok", verdict: "trusted" } : { status: "ok", verdict: "trusted" },
        signals:
          i % 5 === 0
            ? { content: { level: "medium", primaryReason: "content.reason.login" } }
            : {}
      })
    );
  }

  scenarios.push(
    makeSyntheticScenario("INT-42-1", "shortener-1.example", {
      fullUrl: "https://short.example/?target=https%3A%2F%2Fdanger.test",
      predictResult: { status: "ok", verdict: "phishing" },
      passesOverall: false,
      defectSeverity: "significant"
    }),
    makeSyntheticScenario("INT-42-2", "shortener-2.example", {
      fullUrl: "https://short.example/?target=https%3A%2F%2Fdanger.test",
      predictResult: { status: "ok", verdict: "phishing" },
      passesOverall: false,
      defectSeverity: "significant"
    })
  );

  for (let i = 1; i <= 6; i += 1) {
    scenarios.push(
      makeSyntheticScenario(`MINOR-${i}`, `minor-${i}.example`, {
        passesOverall: false,
        defectSeverity: "minor",
        signals: { content: { level: "medium", primaryReason: "content.reason.urgent" } }
      })
    );
  }

  return scenarios;
};
