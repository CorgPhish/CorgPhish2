// RU: Набор правил для trusted/whitelist/blacklist и основных escalations до suspicious/phishing.
// EN: Tests core verdict decisions for trusted, whitelist, blacklist and spoofing.
import test from "node:test";
import assert from "node:assert/strict";

import { resolveInspection } from "../../apps/extension/popup/inspection-core.js";

const runInspection = (overrides = {}) =>
  resolveInspection({
    hostname: "example.com",
    customWhitelist: [],
    fullUrl: "https://example.com/",
    signals: {},
    options: {},
    baseTrusted: [],
    blacklist: [],
    predict: async () => ({ status: "ok", verdict: "trusted" }),
    now: () => 1000,
    ...overrides
  });

// Табличный формат сохраняет тесты короткими, а покрытие логики — широким.
const tests = [
  ["invalid domain throws", async () => {
    await assert.rejects(() => runInspection({ hostname: "" }), /errors\.invalidDomain/);
  }],
  ["exact blacklist blocks domain", async () => {
    const result = await runInspection({ hostname: "bad.com", blacklist: ["bad.com"] });
    assert.equal(result.verdict, "blacklisted");
    assert.equal(result.reasonTrace.some((step) => step.key === "reasonTrace.step.blacklist"), true);
  }],
  ["blacklist covers subdomains", async () => {
    const result = await runInspection({ hostname: "login.bad.com", blacklist: ["bad.com"] });
    assert.equal(result.verdict, "blacklisted");
  }],
  ["whitelist exact match trusted", async () => {
    const result = await runInspection({ hostname: "safe.com", customWhitelist: ["safe.com"] });
    assert.equal(result.verdict, "trusted");
    assert.equal(result.isTrusted, true);
  }],
  ["whitelist covers subdomains", async () => {
    const result = await runInspection({ hostname: "mail.safe.com", customWhitelist: ["safe.com"] });
    assert.equal(result.verdict, "trusted");
  }],
  ["trusted list exact match trusted", async () => {
    const result = await runInspection({ hostname: "bank.ru", baseTrusted: ["bank.ru"] });
    assert.equal(result.verdict, "trusted");
    assert.equal(result.detectionSource, "status.sourceValue.list");
    assert.equal(result.reasonTrace.some((step) => step.key === "reasonTrace.step.trustedList"), true);
  }],
  ["trusted list covers subdomains", async () => {
    const result = await runInspection({ hostname: "lk.bank.ru", baseTrusted: ["bank.ru"] });
    assert.equal(result.verdict, "trusted");
  }],
  ["trusted domain with external form becomes suspicious", async () => {
    const result = await runInspection({
      hostname: "bank.ru",
      baseTrusted: ["bank.ru"],
      signals: { form: { actionHost: "evil.example", reason: "external", hasSensitive: true } }
    });
    assert.equal(result.verdict, "suspicious");
  }],
  ["spoofed domain escalates to phishing", async () => {
    const result = await runInspection({
      hostname: "goggle.com",
      baseTrusted: ["google.com"]
    });
    assert.equal(result.verdict, "phishing");
    assert.equal(result.spoofTarget, "google.com");
  }],
  ["brand mismatch marks site suspicious", async () => {
    const result = await runInspection({
      hostname: "unknown-site.test",
      signals: { brand: { domain: "paypal.com" } }
    });
    assert.equal(result.verdict, "phishing");
  }],
  ["risky form with ip action escalates to phishing", async () => {
    const result = await runInspection({
      hostname: "landing.test",
      signals: { form: { actionHost: "192.168.0.1", reason: "ip", hasSensitive: true } }
    });
    assert.equal(result.verdict, "phishing");
  }],
  ["risky form with http action escalates to phishing", async () => {
    const result = await runInspection({
      hostname: "landing.test",
      signals: { form: { actionHost: "plain-http.test", reason: "http", hasSensitive: false } }
    });
    assert.equal(result.verdict, "phishing");
  }],
  ["high content signal escalates to phishing", async () => {
    const result = await runInspection({
      signals: { content: { level: "high", primaryReason: "content.reason.payment" } }
    });
    assert.equal(result.verdict, "phishing");
  }],
  ["medium content signal keeps warning state", async () => {
    const result = await runInspection({
      signals: { content: { level: "medium", primaryReason: "content.reason.login" } }
    });
    assert.equal(result.verdict, "suspicious");
    assert.equal(result.detectionSource, "status.sourceValue.content");
  }],
  ["unlisted domain with trusted ml remains suspicious", async () => {
    const result = await runInspection({});
    assert.equal(result.verdict, "suspicious");
  }],
  ["missing trusted list uses listMissing source", async () => {
    const result = await runInspection({ baseTrusted: [] });
    assert.equal(result.detectionSource, "status.sourceValue.listMissing");
  }],
  ["ml phishing verdict blocks domain", async () => {
    const result = await runInspection({
      predict: async () => ({ status: "ok", verdict: "phishing" })
    });
    assert.equal(result.verdict, "phishing");
  }],
  ["checkedAt is sourced from injected clock", async () => {
    const result = await runInspection({ now: () => 424242 });
    assert.equal(result.checkedAt, 424242);
  }]
];

for (const [name, fn] of tests) {
  test(name, fn);
}
