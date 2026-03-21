// RU: Проверяет локальное хранение настроек, списков и истории без реального браузера.
// EN: Covers settings/lists/history persistence with a mocked Chrome API.
import test from "node:test";
import assert from "node:assert/strict";

import { createChromeMock } from "../helpers/chrome-mock.mjs";

const chromeMock = createChromeMock();
globalThis.chrome = chromeMock;
const localStorageState = new Map();
globalThis.localStorage = {
  getItem: (key) => (localStorageState.has(key) ? localStorageState.get(key) : null),
  setItem: (key, value) => {
    localStorageState.set(key, String(value));
  },
  removeItem: (key) => {
    localStorageState.delete(key);
  },
  clear: () => {
    localStorageState.clear();
  }
};

const dataModule = await import("../../apps/extension/popup/data.js");
const {
  __resetDataCachesForTests,
  clearHistory,
  getTrustedDomains,
  loadBlacklist,
  loadHistory,
  loadSettings,
  loadWhitelist,
  recordHistory,
  saveBlacklist,
  saveSettings,
  saveWhitelist
} = dataModule;

// Сбрасываем состояние между тестами, чтобы кэш trusted-доменов не протекал между кейсами.
const resetState = () => {
  chromeMock.state.local = {};
  chromeMock.state.sync = {};
  chromeMock.state.trusted = ["google.com", "bank.ru"];
  globalThis.localStorage.clear();
  __resetDataCachesForTests();
};

const tests = [
  ["loadSettings returns defaults", async () => {
    resetState();
    const settings = await loadSettings();
    assert.equal(settings.language, "ru");
    assert.equal(settings.autoCheckOnOpen, true);
  }],
  ["saveSettings persists override", async () => {
    resetState();
    await saveSettings({ language: "en", strictMode: true });
    const settings = await loadSettings();
    assert.equal(settings.language, "en");
    assert.equal(settings.strictMode, true);
    assert.equal(chromeMock.state.local.language, "en");
    assert.equal(chromeMock.state.local.strictMode, true);
  }],
  ["saveSettings mirrors theme and compact mode locally", async () => {
    resetState();
    await saveSettings({ theme: "dark", compactMode: true, autoCheckOnOpen: false });
    const settings = await loadSettings();
    assert.equal(settings.theme, "dark");
    assert.equal(settings.compactMode, true);
    assert.equal(settings.autoCheckOnOpen, false);
  }],
  ["loadSettings falls back to mirrored local settings", async () => {
    resetState();
    chromeMock.state.local.blockOnUntrusted = true;
    chromeMock.state.local.linkHighlightEnabled = false;
    const settings = await loadSettings();
    assert.equal(settings.blockOnUntrusted, true);
    assert.equal(settings.linkHighlightEnabled, false);
  }],
  ["loadSettings prefers local mirror over stale sync values", async () => {
    resetState();
    chromeMock.state.sync.blockOnUntrusted = false;
    chromeMock.state.local.blockOnUntrusted = true;
    const settings = await loadSettings();
    assert.equal(settings.blockOnUntrusted, true);
  }],
  ["loadSettings rehydrates settings from local mirror", async () => {
    resetState();
    globalThis.localStorage.setItem(
      "corgphish.settings",
      JSON.stringify({
        theme: "dark",
        compactMode: true,
        autoCheckOnOpen: false,
        linkHighlightEnabled: false
      })
    );
    const settings = await loadSettings();
    assert.equal(settings.theme, "dark");
    assert.equal(settings.compactMode, true);
    assert.equal(settings.autoCheckOnOpen, false);
    assert.equal(settings.linkHighlightEnabled, false);
    assert.equal(chromeMock.state.local.theme, "dark");
    assert.equal(chromeMock.state.sync.theme, "dark");
  }],
  ["saveWhitelist normalizes entries", async () => {
    resetState();
    await saveWhitelist(["https://WWW.Google.com", "bank.ru"]);
    const list = await loadWhitelist();
    assert.deepEqual(list, ["google.com", "bank.ru"]);
  }],
  ["loadWhitelist filters invalid domains", async () => {
    resetState();
    chromeMock.state.local.customTrustedDomains = ["good.com", "bad host", "1.2.3.4"];
    const list = await loadWhitelist();
    assert.deepEqual(list, ["good.com"]);
  }],
  ["saveBlacklist normalizes entries", async () => {
    resetState();
    await saveBlacklist(["HTTPS://Bad.com/Login", "phish.test"]);
    const list = await loadBlacklist();
    assert.deepEqual(list, ["bad.com", "phish.test"]);
  }],
  ["loadBlacklist keeps raw normalized hosts", async () => {
    resetState();
    chromeMock.state.local.customBlockedDomains = ["www.Bad.com", "bad host"];
    const list = await loadBlacklist();
    assert.deepEqual(list, ["bad.com", "bad host"]);
  }],
  ["recordHistory prepends newest entry", async () => {
    resetState();
    await recordHistory({ domain: "first.test", verdict: "trusted", checkedAt: 100 }, 0);
    await recordHistory({ domain: "second.test", verdict: "phishing", checkedAt: 200 }, 0);
    const history = await loadHistory(0);
    assert.deepEqual(history.map((item) => item.domain), ["second.test", "first.test"]);
  }],
  ["loadHistory respects retention", async () => {
    resetState();
    const now = Date.now();
    chromeMock.state.local.scanHistory = [
      { domain: "fresh.test", verdict: "trusted", checkedAt: now },
      { domain: "old.test", verdict: "trusted", checkedAt: now - 40 * 24 * 60 * 60 * 1000 }
    ];
    const history = await loadHistory(30);
    assert.deepEqual(history.map((item) => item.domain), ["fresh.test"]);
  }],
  ["clearHistory empties storage", async () => {
    resetState();
    chromeMock.state.local.scanHistory = [{ domain: "x", verdict: "trusted", checkedAt: 1 }];
    await clearHistory();
    const history = await loadHistory(0);
    assert.deepEqual(history, []);
  }],
  ["getTrustedDomains merges builtin and whitelist", async () => {
    resetState();
    const domains = await getTrustedDomains(["custom.test", "google.com"]);
    assert.deepEqual(domains, ["google.com", "bank.ru", "custom.test"]);
  }]
];

for (const [name, fn] of tests) {
  test(name, fn);
}
