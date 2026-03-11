// RU: Тесты feature extraction и risk-scoring правил для fallback-эвристики.
// EN: Tests for feature extraction and heuristic scoring rules.
import test from "node:test";
import assert from "node:assert/strict";

import {
  computeHeuristicProbability,
  extractFeatures,
  FEATURE_COLUMNS,
  heuristicVerdict,
  safeUrl
} from "../../CorgPhish/popup/model-core.js";

// Короткие табличные кейсы удобны для покрытия большого числа URL-признаков.
const riskCases = [
  ["safeUrl adds https to raw domain", () => assert.equal(safeUrl("example.com"), "https://example.com/")],
  ["safeUrl keeps valid protocol", () => assert.equal(safeUrl("http://example.com"), "http://example.com/")],
  ["safeUrl rejects malformed url", () => assert.equal(safeUrl("http://"), "")],
  ["extractFeatures returns all feature columns", () => {
    const { features } = extractFeatures("https://example.com");
    assert.deepEqual(Object.keys(features), FEATURE_COLUMNS);
  }],
  ["extractFeatures counts url length", () => {
    const { features, url } = extractFeatures("https://example.com/path");
    assert.equal(features.length_url, url.length);
  }],
  ["extractFeatures counts dots in url", () => assert.equal(extractFeatures("https://a.b.com").features.qty_dot_url > 0, true)],
  ["extractFeatures counts hyphen in url", () => assert.equal(extractFeatures("https://my-bank.com").features.qty_hyphen_url > 0, true)],
  ["extractFeatures counts underscore in url", () => assert.equal(extractFeatures("https://exa_mple.com").features.qty_underline_url > 0, true)],
  ["extractFeatures counts slashes in url", () => assert.equal(extractFeatures("https://example.com/a/b").features.qty_slash_url >= 3, true)],
  ["extractFeatures counts question mark", () => assert.equal(extractFeatures("https://example.com/?a=1").features.qty_questionmark_url, 1)],
  ["extractFeatures counts equals sign", () => assert.equal(extractFeatures("https://example.com/?a=1").features.qty_equal_url, 1)],
  ["extractFeatures counts at sign", () => assert.equal(extractFeatures("https://user@example.com").features.qty_at_url, 1)],
  ["extractFeatures counts ampersand", () => assert.equal(extractFeatures("https://example.com/?a=1&b=2").features.qty_and_url, 1)],
  ["extractFeatures counts exclamation mark", () => assert.equal(extractFeatures("https://example.com/!").features.qty_exclamation_url, 1)],
  ["extractFeatures encodes spaces before counting", () => assert.equal(extractFeatures("https://example.com/a b").features.qty_space_url, 0)],
  ["extractFeatures counts tilde", () => assert.equal(extractFeatures("https://example.com/~user").features.qty_tilde_url, 1)],
  ["extractFeatures counts comma", () => assert.equal(extractFeatures("https://example.com/a,b").features.qty_comma_url, 1)],
  ["extractFeatures counts plus", () => assert.equal(extractFeatures("https://example.com/a+b").features.qty_plus_url, 1)],
  ["extractFeatures counts asterisk", () => assert.equal(extractFeatures("https://example.com/*").features.qty_asterisk_url, 1)],
  ["extractFeatures counts hash", () => assert.equal(extractFeatures("https://example.com/#frag").features.qty_hashtag_url, 1)],
  ["extractFeatures counts dollar", () => assert.equal(extractFeatures("https://example.com/$value").features.qty_dollar_url, 1)],
  ["extractFeatures counts percent", () => assert.equal(extractFeatures("https://example.com/%20").features.qty_percent_url > 0, true)],
  ["extractFeatures counts domain length", () => assert.equal(extractFeatures("https://abc.com").features.domain_length, "abc.com".length)],
  ["extractFeatures counts domain dots", () => assert.equal(extractFeatures("https://a.b.c.com").features.qty_dot_domain, 3)],
  ["extractFeatures marks ip domains", () => assert.equal(extractFeatures("http://192.168.0.1/login").features.domain_in_ip, 1)],
  ["heuristicVerdict keeps simple url trusted", () => assert.equal(heuristicVerdict(extractFeatures("https://example.com").features).verdict, "trusted")],
  ["heuristicVerdict raises obvious phishing url", () => {
    const sample = extractFeatures("http://192.168.0.1/login/verify?token=12345&account=bank-user!!!!");
    assert.equal(heuristicVerdict(sample.features, 0.6, { includeBrandPenalty: true }).verdict, "phishing");
  }],
  ["computeHeuristicProbability grows on riskier sample", () => {
    const safe = computeHeuristicProbability(extractFeatures("https://example.com").features);
    const risky = computeHeuristicProbability(
      extractFeatures("http://192.168.0.1/login/verify?token=12345&account=bank-user!!!!").features,
      { includeBrandPenalty: true }
    );
    assert.ok(risky > safe);
  }]
];

for (const [name, fn] of riskCases) {
  test(name, fn);
}
