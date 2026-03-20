// RU: Проверяет, что browser-level защита загрузок отменяет скачивания только для рискованных вкладок.
// EN: Covers the pure matching logic behind browser-level download cancellation.
import test from "node:test";
import assert from "node:assert/strict";

import {
  DOWNLOAD_GUARD_TTL_MS,
  createGuardedTabEntry,
  matchGuardedDownload,
  pruneGuardedTabEntries,
  resolveDownloadHost
} from "../../apps/extension/background/download-guard.js";

test("resolveDownloadHost normalizes regular URLs", () => {
  assert.equal(resolveDownloadHost("https://WWW.BadSite.com/file.exe"), "badsite.com");
});

test("createGuardedTabEntry skips non-blocking payloads", () => {
  assert.equal(
    createGuardedTabEntry({ tabId: 7, domain: "badsite.com", blockDownloads: false }),
    null
  );
});

test("createGuardedTabEntry keeps normalized hosts", () => {
  const entry = createGuardedTabEntry({
    tabId: 3,
    domain: "https://WWW.BadSite.com/login",
    url: "https://badsite.com/login",
    verdict: "phishing",
    blockDownloads: true
  });
  assert.equal(entry.domain, "badsite.com");
  assert.equal(entry.urlHost, "badsite.com");
  assert.equal(entry.verdict, "phishing");
});

test("pruneGuardedTabEntries drops stale entries", () => {
  const now = 1_000_000;
  const entries = [
    { tabId: 1, domain: "badsite.com", urlHost: "badsite.com", updatedAt: now },
    {
      tabId: 2,
      domain: "old.bad",
      urlHost: "old.bad",
      updatedAt: now - DOWNLOAD_GUARD_TTL_MS - 1
    }
  ];
  const active = pruneGuardedTabEntries(entries, now);
  assert.deepEqual(active.map((entry) => entry.tabId), [1]);
});

test("matchGuardedDownload matches by referrer first", () => {
  const entry = createGuardedTabEntry({
    tabId: 9,
    domain: "phish.example",
    url: "https://phish.example/login",
    verdict: "phishing",
    blockDownloads: true
  });
  const match = matchGuardedDownload(
    {
      url: "https://cdn.example/file.zip",
      referrer: "https://phish.example/account"
    },
    [entry]
  );
  assert.equal(match?.matchedBy, "referrer");
  assert.equal(match?.entry.tabId, 9);
});

test("matchGuardedDownload falls back to file host when referrer is missing", () => {
  const entry = createGuardedTabEntry({
    tabId: 12,
    domain: "downloads.bad",
    url: "https://downloads.bad/home",
    verdict: "suspicious",
    blockDownloads: true
  });
  const match = matchGuardedDownload(
    {
      url: "https://downloads.bad/file.zip"
    },
    [entry]
  );
  assert.equal(match?.matchedBy, "downloadHost");
  assert.equal(match?.matchedHost, "downloads.bad");
});

test("matchGuardedDownload ignores unrelated safe downloads", () => {
  const entry = createGuardedTabEntry({
    tabId: 21,
    domain: "blocked.example",
    url: "https://blocked.example",
    verdict: "blacklisted",
    blockDownloads: true
  });
  const match = matchGuardedDownload(
    {
      url: "https://safe.example/file.zip",
      referrer: "https://safe.example/account"
    },
    [entry]
  );
  assert.equal(match, null);
});
