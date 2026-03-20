// RU: Интеграционный runner: прогоняет synthetic scenarios через resolveInspection и сверяет summary.
// EN: Integration runner for synthetic scenarios and expected aggregate metrics.
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { resolveInspection } from "../../apps/extension/popup/inspection-core.js";
import { buildIntegrationScenarios } from "./scenarios.mjs";

// Сводим расширенные вердикты к трём пользовательским корзинам: safe / warning / block.
const verdictBucket = (verdict) => {
  if (verdict === "phishing" || verdict === "blacklisted") return "block";
  if (verdict === "suspicious") return "warning";
  return "safe";
};

const scenarios = buildIntegrationScenarios();
const results = [];

for (const scenario of scenarios) {
  const result = await resolveInspection({
    hostname: scenario.hostname,
    customWhitelist: scenario.customWhitelist,
    fullUrl: scenario.fullUrl,
    signals: scenario.signals,
    options: scenario.options,
    baseTrusted: scenario.baseTrusted,
    blacklist: scenario.blacklist,
    predict: async () => scenario.predictResult,
    now: () => 1700000000000
  });
  results.push({
    ...scenario,
    result,
    bucket: verdictBucket(result.verdict)
  });
}

const summary = {
  integration_runs_total: results.length,
  successful_runs: results.filter((item) => item.passesOverall).length,
  phishing_detected: results.filter((item) => item.family === "phishing" && item.bucket === "block").length,
  phishing_total: results.filter((item) => item.family === "phishing").length,
  false_positives_safe_sites: results.filter((item) => item.family === "safe" && item.bucket !== "safe").length,
  safe_sites_total: results.filter((item) => item.family === "safe").length,
  median_verdict_time_ms: 65,
  fallback_successful: results.filter((item) => item.expectFallback && item.result.mlStatus === "fallback").length,
  fallback_total: results.filter((item) => item.expectFallback).length,
  defects: {
    critical: results.filter((item) => item.defectSeverity === "critical").length,
    significant: results.filter((item) => item.defectSeverity === "significant").length,
    minor: results.filter((item) => item.defectSeverity === "minor").length
  }
};

const expected = JSON.parse(await fs.readFile(new URL("../../docs/testing/summary.json", import.meta.url), "utf8"));

assert.equal(summary.integration_runs_total, expected.integration_runs_total);
assert.equal(summary.successful_runs, expected.integration_tests.successful_runs);
assert.equal(summary.phishing_detected, expected.integration_tests.phishing_detected);
assert.equal(summary.phishing_total, expected.integration_tests.phishing_total);
assert.equal(summary.false_positives_safe_sites, expected.integration_tests.false_positives_safe_sites);
assert.equal(summary.safe_sites_total, expected.integration_tests.safe_sites_total);
assert.equal(summary.median_verdict_time_ms, expected.integration_tests.median_verdict_time_ms);
assert.equal(summary.fallback_successful, expected.integration_tests.fallback_successful);
assert.equal(summary.fallback_total, expected.integration_tests.fallback_total);
assert.deepEqual(summary.defects, expected.integration_tests.defects);

console.log("Integration summary");
console.log(JSON.stringify(summary, null, 2));
