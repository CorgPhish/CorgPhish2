// Точка входа попапа: собирает UI, данные и проверки доменов.
import { DEFAULT_SETTINGS } from "./config.js";
import { dom, safeAddEvent } from "./dom.js";
import { translate as baseTranslate } from "./i18n.js";
import { inspectDomain } from "./inspection.js";
import {
  clearHistory,
  loadHistory,
  loadSettings,
  loadWhitelist,
  recordHistory,
  saveSettings,
  saveWhitelist,
  loadBlacklist,
  saveBlacklist
} from "./data.js";
import {
  applyLanguage,
  applyState,
  applyTheme,
  renderHistory,
  renderWhitelist,
  renderBlacklist,
  setManualHint,
  updateStats
} from "./ui.js";
import { getLocale, normalizeHost, resolveHostname } from "./utils.js";

let currentSettings = { ...DEFAULT_SETTINGS };
let customWhitelist = [];
let customBlacklist = [];
let lastHistory = [];
let historyQuery = "";
let historyFilter = "all";
let settingsTab = "options";

const getTranslator = () => (key, params) => baseTranslate(currentSettings.language, key, params);


const showSettingsStatus = (key, params = {}, isError = false) => {
  if (!dom.settingsStatus) return;
  const t = getTranslator();
  dom.settingsStatus.textContent = t(key, params);
  dom.settingsStatus.style.color = isError ? "#f87171" : "#6ee7b7";
  clearTimeout(showSettingsStatus.timer);
  showSettingsStatus.timer = setTimeout(() => {
    dom.settingsStatus.style.color = "";
    dom.settingsStatus.textContent = t("settings.status.default");
  }, 2500);
};

const setStatusMessage = (text = "", tone = "info") => {
  if (!dom.statusBanner) return;
  if (!text) {
    dom.statusBanner.textContent = "";
    dom.statusBanner.classList.add("is-hidden");
    dom.statusBanner.removeAttribute("data-tone");
    return;
  }
  dom.statusBanner.textContent = text;
  dom.statusBanner.dataset.tone = tone;
  dom.statusBanner.classList.remove("is-hidden");
};

// RU: Получаем активную вкладку.
// EN: Fetch active tab.
const queryActiveTab = () =>
  new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || "errors.activeTab"));
        return;
      }
      resolve(tabs || []);
    });
  });

const queryAllTabs = () =>
  new Promise((resolve, reject) => {
    chrome.tabs.query({ windowType: "normal" }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || "errors.activeTab"));
        return;
      }
      resolve(tabs || []);
    });
  });

const fetchPageSignals = (tabId) =>
  new Promise((resolve) => {
    if (!tabId) {
      resolve(null);
      return;
    }
    chrome.tabs.sendMessage(tabId, { type: "getPageSignals" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response?.ok ? response.signals : null);
    });
    setTimeout(() => resolve(null), 600);
  });

const getInspectOptions = () => ({ strictMode: currentSettings.strictMode });

const filterHistoryItems = (items = []) => {
  const query = historyQuery.trim().toLowerCase();
  return items.filter((item) => {
    const matchesQuery =
      !query ||
      [item.domain, item.spoofTarget]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    if (!matchesQuery) return false;
    switch (historyFilter) {
      case "trusted":
        return item.verdict === "trusted";
      case "alert":
        return item.verdict !== "trusted";
      case "suspicious":
        return item.verdict === "suspicious";
      case "phishing":
        return item.verdict === "phishing";
      case "blacklisted":
        return item.verdict === "blacklisted";
      default:
        return true;
    }
  });
};

const renderHistoryView = () => {
  const t = getTranslator();
  const filtered = filterHistoryItems(lastHistory);
  const hasFilter = historyFilter !== "all" || Boolean(historyQuery.trim());
  const emptyText = hasFilter ? t("history.emptyFiltered") : t("history.empty");
  renderHistory(dom, t, filtered, getLocale(currentSettings.language), emptyText);
};

// RU: Переключение представления попапа.
// EN: Switch popup view.
const switchView = (view) => {
  if (view === "settings") {
    dom.app.dataset.view = "settings";
    updateSettingsControls();
    setSettingsTab(settingsTab);
    return;
  }
  if (view === "history") {
    dom.app.dataset.view = "history";
    refreshHistory();
    return;
  }
  dom.app.dataset.view = "main";
};

const setSettingsTab = (tabKey) => {
  settingsTab = tabKey || "options";
  if (dom.settingsTabButtons?.length) {
    dom.settingsTabButtons.forEach((btn) => {
      const isActive = btn.dataset.settingsTab === settingsTab;
      btn.classList.toggle("is-active", isActive);
    });
  }
  if (dom.settingsPanels?.length) {
    dom.settingsPanels.forEach((panel) => {
      const isActive = panel.dataset.settingsPanel === settingsTab;
      panel.classList.toggle("is-active", isActive);
    });
  }
};

// RU: Обновляем whitelist в UI/сторидже.
// EN: Refresh whitelist in UI/storage.
const refreshWhitelist = async () => {
  const stored = await loadWhitelist();
  customWhitelist = stored.map((domain) => normalizeHost(domain)).filter(Boolean);
  renderWhitelist(dom, getTranslator(), customWhitelist);
  updateStats(dom, lastHistory, customWhitelist);
};

// RU: Обновляем blacklist в UI/сторидже.
// EN: Refresh blacklist in UI/storage.
const refreshBlacklist = async () => {
  const stored = await loadBlacklist();
  customBlacklist = stored.map((domain) => normalizeHost(domain)).filter(Boolean);
  renderBlacklist(dom, getTranslator(), customBlacklist);
};

// RU: Добавить домен в ЧС с валидацией.
// EN: Add domain to blacklist with validation.
const addDomainToBlacklist = async (rawDomain) => {
  const clean = normalizeHost(rawDomain);
  if (!clean) {
    showSettingsStatus("blacklist.status.invalid", {}, true);
    return;
  }
  if (customBlacklist.includes(clean)) {
    showSettingsStatus("blacklist.status.exists", {}, true);
    return;
  }
  await updateBlacklistStorage([...customBlacklist, clean]);
  showSettingsStatus("blacklist.status.added", { domain: clean });
};

// RU: Сохранить whitelist и обновить UI/статистику.
// EN: Save whitelist and refresh UI/stats.
const updateWhitelistStorage = async (domains) => {
  customWhitelist = domains.map((domain) => normalizeHost(domain)).filter(Boolean);
  await saveWhitelist(customWhitelist);
  renderWhitelist(dom, getTranslator(), customWhitelist);
  updateStats(dom, lastHistory, customWhitelist);
};

// RU: Сохранить blacklist и обновить UI.
// EN: Save blacklist and refresh UI.
const updateBlacklistStorage = async (domains) => {
  customBlacklist = domains.map((domain) => normalizeHost(domain)).filter(Boolean);
  await saveBlacklist(customBlacklist);
  renderBlacklist(dom, getTranslator(), customBlacklist);
};

// RU: Добавить домен в whitelist.
// EN: Add domain to whitelist.
const addDomainToWhitelist = async (rawDomain) => {
  const clean = normalizeHost(rawDomain);
  if (!clean) {
    showSettingsStatus("whitelist.status.invalid", {}, true);
    return;
  }
  if (customWhitelist.includes(clean)) {
    showSettingsStatus("whitelist.status.exists", {}, true);
    return;
  }
  await updateWhitelistStorage([...customWhitelist, clean]);
  showSettingsStatus("whitelist.status.added", { domain: clean });
};

const removeDomainFromWhitelist = async (domain) => {
  const clean = normalizeHost(domain);
  await updateWhitelistStorage(customWhitelist.filter((entry) => entry !== clean));
  showSettingsStatus("whitelist.status.removed", { domain: clean });
};

// RU: Удалить домен из blacklist.
// EN: Remove domain from blacklist.
const removeDomainFromBlacklist = async (domain) => {
  const clean = normalizeHost(domain);
  await updateBlacklistStorage(customBlacklist.filter((entry) => entry !== clean));
  showSettingsStatus("blacklist.status.removed", { domain: clean });
};

// RU: Обновляем историю и статистику.
// EN: Refresh history and stats.
const refreshHistory = async () => {
  const items = await loadHistory(currentSettings.historyRetentionDays);
  lastHistory = items;
  renderHistoryView();
  updateStats(dom, items, customWhitelist);
};

const sendPhishingBlock = (tabId, domain, verdict) => {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, { type: "phishingBlock", domain, verdict }, () => {
    if (chrome.runtime.lastError) {
      const msg = chrome.runtime.lastError?.message || "";
      // Мягко игнорируем отсутствие content script (например, сервисные страницы/другой контекст).
      if (!/Receiving end does not exist/i.test(msg)) {
        console.warn("CorgPhish: failed to send block message", msg);
      }
    }
  });
};

// RU: Применяем результат инспекции к UI и истории.
// EN: Apply inspection result to UI and history.
const applyInspectionResult = async (result, options = {}) => {
  const { shouldAlert = false, source = "active", tabId } = options;
  const t = getTranslator();
  const isRisk = result.verdict === "phishing" || result.verdict === "blacklisted";
  const mlUnavailable = result.mlStatus === "error";
  const fromCache = Boolean(result.cached);
  applyState(dom, t, result.verdict, {
    domain: result.domain,
    checkedAt: result.checkedAt ? new Date(result.checkedAt) : new Date(),
    spoofTarget: result.spoofTarget,
    language: currentSettings.language,
    isTrusted: result.isTrusted,
    mlVerdict: result.mlVerdict,
    sourceKey: result.detectionSource,
    match: result.matchedDomain || "",
    suspicionKey: result.suspicionKey,
    suspicionParams: result.suspicionParams,
    officialDomain: result.officialDomain
  });
  if (!fromCache) {
    await recordHistory(
      {
        domain: result.domain,
        verdict: result.verdict,
        checkedAt: result.checkedAt ?? Date.now(),
        spoofTarget: result.spoofTarget,
        source,
        detectionSource: result.detectionSource,
        mlVerdict: result.mlVerdict,
        mlStatus: result.mlStatus
      },
      currentSettings.historyRetentionDays
    );
  }
  if (isRisk) {
    sendPhishingBlock(tabId, result.domain, result.verdict);
  }
  if (!fromCache && shouldAlert && isRisk && currentSettings.warnOnUntrusted) {
    setStatusMessage(t("status.phishing.hint"), "warn");
    console.warn("CorgPhish: high risk verdict", { domain: result.domain, verdict: result.verdict });
  } else if (mlUnavailable) {
    setStatusMessage(t("status.ml.unavailable"), "warn");
    if (result.mlError) {
      console.warn("CorgPhish: ML unavailable", result.mlError);
    }
  } else {
    setStatusMessage("");
  }
  if (!fromCache) {
    refreshHistory();
  }
};

const checkActiveTab = async () => {
  const t = getTranslator();
  setStatusMessage("");
  applyState(dom, t, "pending", { language: currentSettings.language });
  dom.refreshBtn.disabled = true;
  try {
    const [activeTab] = await queryActiveTab();
    if (!activeTab || !activeTab.url) {
      throw new Error(t("errors.activeTab"));
    }
    if (!/^https?:\/\//i.test(activeTab.url)) {
      applyState(dom, t, "unsupported", { language: currentSettings.language });
      return;
    }
    const url = new URL(activeTab.url);
    const signals = await fetchPageSignals(activeTab.id);
    const result = await inspectDomain(
      url.hostname,
      customWhitelist,
      activeTab.url,
      signals || {},
      getInspectOptions()
    );
    await applyInspectionResult(result, { shouldAlert: true, source: "active", tabId: activeTab.id });
  } catch (error) {
    console.error("Ошибка во время проверки", error);
    const errorKey = error?.message;
    const errorText =
      errorKey && baseTranslate(currentSettings.language, errorKey) !== errorKey
        ? baseTranslate(currentSettings.language, errorKey)
        : error?.message || "";
    applyState(dom, t, "error", { error: errorText, language: currentSettings.language });
    setStatusMessage(errorText || t("status.error.title"), "error");
  } finally {
    dom.refreshBtn.disabled = false;
  }
};

const handleManualSubmit = async (event) => {
  event.preventDefault();
  if (!dom.manualInput) return;
  const t = getTranslator();
  const rawInput = dom.manualInput.value;
  const hostname = resolveHostname(rawInput);
  if (!hostname) {
    setManualHint(dom, t("manual.hint.invalid"), true);
    return;
  }
  setStatusMessage("");
  try {
    const result = await inspectDomain(hostname, customWhitelist, rawInput, {}, getInspectOptions());
    await applyInspectionResult(result, { shouldAlert: false, source: "manual" });
    setManualHint(dom, t("manual.hint.success", { domain: result.domain }));
  } catch (error) {
    const translated = baseTranslate(currentSettings.language, error?.message) || t("manual.hint.invalid");
    setManualHint(dom, translated, true);
  }
};

const handleWhitelistSubmit = async (event) => {
  event.preventDefault();
  if (!dom.whitelistInput) return;
  await addDomainToWhitelist(dom.whitelistInput.value);
  dom.whitelistInput.value = "";
};

const handleWhitelistListClick = async (event) => {
  const target = event.target.closest(".whitelist-remove");
  if (!target || !target.dataset.domain) return;
  await removeDomainFromWhitelist(target.dataset.domain);
};

const handleSettingsChange = async () => {
  const nextSettings = {
    autoCheckOnOpen: dom.autoCheckInput?.checked ?? DEFAULT_SETTINGS.autoCheckOnOpen,
    warnOnUntrusted: dom.alertInput?.checked ?? DEFAULT_SETTINGS.warnOnUntrusted,
    strictMode: dom.strictModeToggle?.checked ?? DEFAULT_SETTINGS.strictMode,
    theme: dom.themeToggle?.checked ? "light" : "dark",
    language: dom.languageSelect?.value ?? DEFAULT_SETTINGS.language,
    blockOnUntrusted: dom.blockInputToggle?.checked ?? DEFAULT_SETTINGS.blockOnUntrusted,
    systemNotifyOnRisk: dom.systemNotifyToggle?.checked ?? DEFAULT_SETTINGS.systemNotifyOnRisk,
    historyRetentionDays:
      Number(dom.historyRetentionSelect?.value) || DEFAULT_SETTINGS.historyRetentionDays,
    compactMode: dom.compactModeToggle?.checked ?? DEFAULT_SETTINGS.compactMode
  };
  currentSettings = await saveSettings(nextSettings);
  applyTheme(currentSettings.theme, currentSettings.compactMode);
  applyLanguage(dom, getTranslator(), currentSettings.language);
  updateSettingsControls();
  refreshHistory();
  showSettingsStatus("settings.status.saved");
};

const updateSettingsControls = () => {
  if (dom.autoCheckInput) {
    dom.autoCheckInput.checked = currentSettings.autoCheckOnOpen;
  }
  if (dom.alertInput) {
    dom.alertInput.checked = currentSettings.warnOnUntrusted;
  }
  if (dom.strictModeToggle) {
    dom.strictModeToggle.checked = currentSettings.strictMode;
  }
  if (dom.themeToggle) {
    dom.themeToggle.checked = currentSettings.theme === "light";
  }
  if (dom.languageSelect) {
    dom.languageSelect.value = currentSettings.language;
  }
  if (dom.blockInputToggle) {
    dom.blockInputToggle.checked = currentSettings.blockOnUntrusted;
  }
  if (dom.systemNotifyToggle) {
    dom.systemNotifyToggle.checked = currentSettings.systemNotifyOnRisk;
  }
  if (dom.historyRetentionSelect) {
    dom.historyRetentionSelect.value = String(currentSettings.historyRetentionDays);
  }
  if (dom.compactModeToggle) {
    dom.compactModeToggle.checked = currentSettings.compactMode;
  }
};

const handleQuickAddClick = async () => {
  const domain = dom.quickAddBtn?.dataset.domain;
  if (!domain) return;
  await addDomainToWhitelist(domain);
  const result = await inspectDomain(domain, customWhitelist, domain, {}, getInspectOptions());
  await applyInspectionResult(result, { shouldAlert: false, source: "manual" });
};

function handleBlacklistClick() {
  (async () => {
    const domain = dom.blacklistBtn?.dataset.domain;
  if (!domain) return;
  await addDomainToBlacklist(domain);
  const result = await inspectDomain(domain, customWhitelist, domain, {}, getInspectOptions());
  await applyInspectionResult(result, { shouldAlert: true, source: "manual" });
  try {
    const [tab] = await queryActiveTab();
    if (tab?.id) {
      chrome.tabs.remove(tab.id);
    }
  } catch (error) {
    console.warn("CorgPhish: failed to close tab after blacklist", error);
  }
})();
}

const handleOfficialSiteClick = () => {
  const domain = dom.officialSiteBtn?.dataset.domain;
  if (!domain) return;
  const url = domain.includes("://") ? domain : `https://${domain}`;
  chrome.tabs.create({ url });
};

const handleHistorySearch = (event) => {
  historyQuery = event.target?.value || "";
  renderHistoryView();
};

const handleHistoryFilter = (event) => {
  historyFilter = event.target?.value || "all";
  renderHistoryView();
};

const checkAllTabs = async () => {
  if (!dom.checkAllBtn) return;
  const t = getTranslator();
  dom.checkAllBtn.disabled = true;
  try {
    const tabs = await queryAllTabs();
    const candidates = tabs.filter((tab) => tab?.url && /^https?:\/\//i.test(tab.url));
    if (!candidates.length) {
      setStatusMessage(t("status.bulk.empty"), "info");
      return;
    }
    let riskCount = 0;
    for (const tab of candidates) {
      try {
        const url = new URL(tab.url);
        const signals = await fetchPageSignals(tab.id);
        const result = await inspectDomain(
          url.hostname,
          customWhitelist,
          tab.url,
          signals || {},
          getInspectOptions()
        );
        await recordHistory(
          {
            domain: result.domain,
            verdict: result.verdict,
            checkedAt: result.checkedAt ?? Date.now(),
            spoofTarget: result.spoofTarget,
            source: "active",
            detectionSource: result.detectionSource,
            mlVerdict: result.mlVerdict,
            mlStatus: result.mlStatus
          },
          currentSettings.historyRetentionDays
        );
        if (result.verdict === "phishing" || result.verdict === "blacklisted") {
          riskCount += 1;
          sendPhishingBlock(tab.id, result.domain, result.verdict);
        }
      } catch (error) {
        console.warn("CorgPhish: bulk scan failed for tab", error);
      }
    }
    refreshHistory();
    const tone = riskCount ? "warn" : "info";
    setStatusMessage(
      t("status.bulk.result", { total: candidates.length, risk: riskCount }),
      tone
    );
  } catch (error) {
    console.warn("CorgPhish: bulk scan failed", error);
    setStatusMessage(t("status.error.title"), "error");
  } finally {
    dom.checkAllBtn.disabled = false;
  }
};

const init = async () => {
  currentSettings = await loadSettings();
  applyTheme(currentSettings.theme, currentSettings.compactMode);
  applyLanguage(dom, getTranslator(), currentSettings.language);
  if (dom.historyFilterSelect) {
    dom.historyFilterSelect.value = historyFilter;
  }
  if (dom.historySearchInput) {
    dom.historySearchInput.value = historyQuery;
  }
  await refreshWhitelist();
  await refreshBlacklist();
  updateSettingsControls();
  refreshHistory();

  // Всегда запускаем проверку при открытии попапа, чтобы не требовать ручного клика.
  checkActiveTab();
};

safeAddEvent(dom.refreshBtn, "click", checkActiveTab);
safeAddEvent(dom.checkAllBtn, "click", checkAllTabs);
safeAddEvent(dom.openHistoryBtn, "click", () => switchView("history"));
safeAddEvent(dom.closeHistoryBtn, "click", () => switchView("main"));
safeAddEvent(dom.openSettingsBtn, "click", () => switchView("settings"));
safeAddEvent(dom.closeSettingsBtn, "click", () => switchView("main"));
safeAddEvent(dom.clearHistoryBtn, "click", async () => {
  await clearHistory();
  refreshHistory();
});

safeAddEvent(dom.autoCheckInput, "change", handleSettingsChange);
safeAddEvent(dom.alertInput, "change", handleSettingsChange);
safeAddEvent(dom.strictModeToggle, "change", handleSettingsChange);
safeAddEvent(dom.themeToggle, "change", handleSettingsChange);
safeAddEvent(dom.languageSelect, "change", handleSettingsChange);
safeAddEvent(dom.blockInputToggle, "change", handleSettingsChange);
safeAddEvent(dom.systemNotifyToggle, "change", handleSettingsChange);
safeAddEvent(dom.historyRetentionSelect, "change", handleSettingsChange);
safeAddEvent(dom.compactModeToggle, "change", handleSettingsChange);
safeAddEvent(dom.manualForm, "submit", handleManualSubmit);
safeAddEvent(dom.manualInput, "input", () => setManualHint(dom, getTranslator()("manual.hint.default")));
safeAddEvent(dom.whitelistForm, "submit", handleWhitelistSubmit);
safeAddEvent(dom.whitelistList, "click", handleWhitelistListClick);
safeAddEvent(dom.quickAddBtn, "click", handleQuickAddClick);
safeAddEvent(dom.blacklistBtn, "click", handleBlacklistClick);
safeAddEvent(dom.officialSiteBtn, "click", handleOfficialSiteClick);
safeAddEvent(dom.historySearchInput, "input", handleHistorySearch);
safeAddEvent(dom.historyFilterSelect, "change", handleHistoryFilter);
safeAddEvent(dom.blacklistForm, "submit", async (event) => {
  event.preventDefault();
  if (!dom.blacklistInput) return;
  await addDomainToBlacklist(dom.blacklistInput.value);
  dom.blacklistInput.value = "";
});
safeAddEvent(dom.blacklistList, "click", async (event) => {
  const target = event.target.closest(".whitelist-remove");
  if (!target?.dataset.domain) return;
  await removeDomainFromBlacklist(target.dataset.domain);
});
if (dom.settingsTabButtons?.length) {
  dom.settingsTabButtons.forEach((btn) => {
    safeAddEvent(btn, "click", () => setSettingsTab(btn.dataset.settingsTab));
  });
}

init();
