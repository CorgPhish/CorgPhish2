// RU: Проверяет низкоуровневые утилиты работы с доменами, похожестью и временем.
// EN: Covers low-level domain normalization and similarity helpers.
import test from "node:test";
import assert from "node:assert/strict";

import {
  findSpoofCandidate,
  formatTime,
  getLocale,
  isIpDomain,
  isLikelyDomain,
  levenshteinDistance,
  normalizeHost,
  resolveHostname
} from "../../apps/extension/popup/utils.js";

// Эти кейсы собраны вокруг граничных строк, которые чаще всего ломают нормализацию.
const cases = [
  ["normalize strips protocol", () => assert.equal(normalizeHost("https://Example.com"), "example.com")],
  ["normalize strips www", () => assert.equal(normalizeHost("www.bank.ru"), "bank.ru")],
  ["normalize strips trailing dot", () => assert.equal(normalizeHost("example.com."), "example.com")],
  ["normalize handles path", () => assert.equal(normalizeHost("example.com/login"), "example.com")],
  ["normalize lowercases hostname", () => assert.equal(normalizeHost("MAIL.Google.COM"), "mail.google.com")],
  ["normalize empty string", () => assert.equal(normalizeHost(""), "")],
  ["normalize invalid hostname keeps sanitized raw value", () => assert.equal(normalizeHost("bad host"), "bad host")],
  ["resolveHostname delegates to normalizeHost", () => assert.equal(resolveHostname("https://test.ru/a"), "test.ru")],
  ["ip domains detected", () => assert.equal(isIpDomain("192.168.0.1"), true)],
  ["non-ip domains not detected as ip", () => assert.equal(isIpDomain("example.com"), false)],
  ["isLikelyDomain accepts common domain", () => assert.equal(isLikelyDomain("example.com"), true)],
  ["isLikelyDomain rejects ip", () => assert.equal(isLikelyDomain("10.0.0.1"), false)],
  ["isLikelyDomain rejects single label", () => assert.equal(isLikelyDomain("localhost"), false)],
  ["isLikelyDomain rejects short tld", () => assert.equal(isLikelyDomain("example.c"), false)],
  ["isLikelyDomain rejects invalid tld chars", () => assert.equal(isLikelyDomain("example.c_m"), false)],
  ["isLikelyDomain rejects labels starting with hyphen", () => assert.equal(isLikelyDomain("-bad.example"), false)],
  ["levenshtein equal strings", () => assert.equal(levenshteinDistance("bank", "bank"), 0)],
  ["levenshtein single replacement", () => assert.equal(levenshteinDistance("bank", "bonk"), 1)],
  ["levenshtein insertion", () => assert.equal(levenshteinDistance("bank", "banks"), 1)],
  ["levenshtein deletion", () => assert.equal(levenshteinDistance("banks", "bank"), 1)],
  ["find spoof candidate by full domain distance", () => assert.equal(findSpoofCandidate("goggle.com", ["google.com"]), "google.com")],
  ["find spoof candidate by label distance", () => assert.equal(findSpoofCandidate("paypa1.com", ["paypal.com"]), "paypal.com")],
  ["find spoof candidate by token spoofing", () => assert.equal(findSpoofCandidate("google-login-security.net", ["google.com"]), "google.com")],
  ["locale and time formatting use language", () => {
    assert.equal(getLocale("en"), "en-US");
    assert.match(formatTime(new Date("2026-01-01T10:05:00Z"), "ru"), /^\d{2}:\d{2}/);
  }]
];

for (const [name, fn] of cases) {
  test(name, fn);
}
