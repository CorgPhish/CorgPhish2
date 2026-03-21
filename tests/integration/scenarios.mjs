import fs from "node:fs/promises";

const readJson = async (name) =>
  JSON.parse(await fs.readFile(new URL(`./data/${name}`, import.meta.url), "utf8"));

const environmentMap = (environments) => new Map(environments.map((entry) => [entry.id, entry]));

const makeSafeScenario = (sample, environment) => {
  const falsePositive = (sample.falsePositiveEnvIds || []).includes(environment.id);
  const customWhitelist =
    sample.mode === "whitelist" || (sample.mode === "neutral" && !falsePositive)
      ? [sample.hostname]
      : [];
  return {
    id: `${sample.id}-${environment.id}`,
    family: "safe",
    sourceType: "safe_url",
    hostname: sample.hostname,
    fullUrl: sample.fullUrl,
    environment,
    baseTrusted: sample.mode === "trusted" ? [sample.hostname] : [],
    customWhitelist,
    blacklist: [],
    signals: falsePositive ? sample.falsePositiveSignals || {} : {},
    options: {},
    predictResult: { status: "ok", verdict: "trusted" },
    observedMs: 65,
    expectFallback: false,
    passesOverall: !falsePositive,
    defectSeverity: falsePositive ? "minor" : null
  };
};

const makePhishingScenario = (sample, environment) => {
  const warningOnly = (sample.warningOnlyEnvIds || []).includes(environment.id);
  return {
    id: `${sample.id}-${environment.id}`,
    family: "phishing",
    sourceType: "phishing_url",
    hostname: sample.hostname,
    fullUrl: sample.fullUrl,
    environment,
    baseTrusted: sample.baseTrusted || ["google.com", "paypal.com", "gosuslugi.ru"],
    customWhitelist: [],
    blacklist: [],
    signals: warningOnly ? sample.warningSignals || {} : sample.signals || {},
    options: {},
    predictResult: warningOnly ? sample.warningPredictResult || { status: "ok", verdict: "trusted" } : sample.predictResult,
    observedMs: 65,
    expectFallback: false,
    passesOverall: true,
    defectSeverity: null
  };
};

const makeSyntheticScenario = (sample, environment) => ({
  id: `${sample.id}-${environment.id}`,
  family: "synthetic",
  sourceType: "synthetic_url",
  hostname: sample.hostname,
  fullUrl: sample.fullUrl,
  environment,
  baseTrusted: sample.baseTrusted || ["google.com", "microsoft.com", "gosuslugi.ru"],
  customWhitelist: sample.customWhitelist || [],
  blacklist: sample.blacklist || [],
  signals: sample.signals || {},
  options: sample.options || {},
  predictResult: sample.predictResult || { status: "ok", verdict: "trusted" },
  observedMs: 65,
  expectFallback: Boolean(sample.expectFallback),
  passesOverall: sample.passesOverall ?? true,
  defectSeverity: sample.defectSeverity || null
});

const makeManualScenario = (sample, environment) => ({
  id: `${sample.id}-${environment.id}`,
  family: "manual",
  sourceType: "manual_ui",
  hostname: sample.hostname,
  fullUrl: sample.fullUrl,
  environment,
  baseTrusted: ["google.com", "telegram.org", "gosuslugi.ru"],
  customWhitelist: [],
  blacklist: [],
  signals: {},
  options: {},
  predictResult: { status: "ok", verdict: sample.verdict || "phishing" },
  observedMs: 65,
  expectFallback: false,
  passesOverall: true,
  defectSeverity: null,
  uiAction: sample.uiAction
});

export const buildIntegrationScenarios = async () => {
  const [environments, safeUrls, phishingUrls, syntheticCases, manualUiScenarios] = await Promise.all([
    readJson("environments.json"),
    readJson("safe-urls.json"),
    readJson("phishing-urls.json"),
    readJson("synthetic-cases.json"),
    readJson("manual-ui-scenarios.json")
  ]);

  const environmentsById = environmentMap(environments);
  const scenarios = [];

  for (const sample of safeUrls) {
    for (const environment of environments) {
      scenarios.push(makeSafeScenario(sample, environment));
    }
  }

  for (const sample of phishingUrls) {
    for (const environment of environments.slice(0, 5)) {
      scenarios.push(makePhishingScenario(sample, environment));
    }
  }

  for (const sample of syntheticCases) {
    for (const environmentId of sample.envIds || []) {
      const environment = environmentsById.get(environmentId);
      if (!environment) {
        throw new Error(`Unknown integration environment: ${environmentId}`);
      }
      scenarios.push(makeSyntheticScenario(sample, environment));
    }
  }

  for (const sample of manualUiScenarios) {
    for (const environmentId of sample.envIds || []) {
      const environment = environmentsById.get(environmentId);
      if (!environment) {
        throw new Error(`Unknown manual integration environment: ${environmentId}`);
      }
      scenarios.push(makeManualScenario(sample, environment));
    }
  }

  return scenarios;
};
