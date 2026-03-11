// RU: Проверяет, как inspection-core ведёт себя при fallback-решении вместо полноценного ML.
// EN: Covers inspection behaviour when ML returns fallback output.
import test from "node:test";
import assert from "node:assert/strict";

import { resolveInspection } from "../../CorgPhish/popup/inspection-core.js";
import { extractFeatures, heuristicVerdict } from "../../CorgPhish/popup/model-core.js";

const runInspection = (overrides = {}) =>
  resolveInspection({
    hostname: "fallback.test",
    customWhitelist: [],
    fullUrl: "https://fallback.test/",
    signals: {},
    options: {},
    baseTrusted: ["google.com"],
    blacklist: [],
    predict: async () => ({ status: "fallback", verdict: "trusted" }),
    now: () => 5000,
    ...overrides
  });

// Каждая запись массива превращается в отдельный node:test кейс.
const tests = [
  ["fallback trusted on unknown domain stays suspicious", async () => {
    const result = await runInspection();
    assert.equal(result.verdict, "suspicious");
    assert.equal(result.mlStatus, "fallback");
  }],
  ["fallback trusted switches source to heuristic", async () => {
    const result = await runInspection();
    assert.equal(result.detectionSource, "status.sourceValue.heuristic");
  }],
  ["fallback phishing blocks domain", async () => {
    const result = await runInspection({ predict: async () => ({ status: "fallback", verdict: "phishing" }) });
    assert.equal(result.verdict, "phishing");
  }],
  ["fallback phishing keeps heuristic source", async () => {
    const result = await runInspection({ predict: async () => ({ status: "fallback", verdict: "phishing" }) });
    assert.equal(result.detectionSource, "status.sourceValue.heuristic");
  }],
  ["fallback trusted with spoof target still blocks", async () => {
    const result = await runInspection({ hostname: "goggle.com" });
    assert.equal(result.verdict, "phishing");
  }],
  ["fallback trusted with risky form still blocks", async () => {
    const result = await runInspection({
      signals: { form: { actionHost: "1.2.3.4", reason: "ip", hasSensitive: true } }
    });
    assert.equal(result.verdict, "phishing");
  }],
  ["fallback trusted with medium content keeps warning", async () => {
    const result = await runInspection({
      signals: { content: { level: "medium", primaryReason: "content.reason.login" } }
    });
    assert.equal(result.verdict, "suspicious");
  }],
  ["fallback trusted with high content blocks", async () => {
    const result = await runInspection({
      signals: { content: { level: "high", primaryReason: "content.reason.payment" } }
    });
    assert.equal(result.verdict, "phishing");
  }],
  ["error status without data keeps suspicious state", async () => {
    const result = await runInspection({ predict: async () => ({ status: "error", verdict: null }) });
    assert.equal(result.verdict, "suspicious");
  }],
  ["heuristic helper marks benign sample trusted", () => {
    const result = heuristicVerdict(extractFeatures("https://example.com").features, 0.7);
    assert.equal(result.verdict, "trusted");
  }],
  ["heuristic helper marks risky sample phishing", () => {
    const result = heuristicVerdict(
      extractFeatures("http://192.168.0.1/login?verify=1&token=999!!!!").features,
      0.6,
      { includeBrandPenalty: true }
    );
    assert.equal(result.verdict, "phishing");
  }],
  ["fallback result preserves mlStatus", async () => {
    const result = await runInspection();
    assert.equal(result.mlStatus, "fallback");
  }],
  ["fallback result carries injected timestamp", async () => {
    const result = await runInspection({ now: () => 777 });
    assert.equal(result.checkedAt, 777);
  }],
  ["fallback trusted without official domain leaves null official", async () => {
    const result = await runInspection({ hostname: "neutral.test", baseTrusted: [] });
    assert.equal(result.officialDomain, null);
  }]
];

for (const [name, fn] of tests) {
  test(name, fn);
}
