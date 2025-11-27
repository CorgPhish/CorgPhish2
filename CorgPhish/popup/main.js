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
  saveWhitelist
} from "./data.js";
import {
  applyLanguage,
  applyState,
  applyTheme,
  renderHistory,
  renderWhitelist,
  setManualHint,
  updateStats
} from "./ui.js";
import { getLocale, normalizeHost, resolveHostname } from "./utils.js";

let currentSettings = { ...DEFAULT_SETTINGS };
let customWhitelist = [];
let lastHistory = [];

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

const switchView = (view) => {
  if (view === "settings") {
    dom.app.dataset.view = "settings";
    updateSettingsControls();
    return;
  }
  if (view === "history") {
    dom.app.dataset.view = "history";
    refreshHistory();
    return;
  }
  dom.app.dataset.view = "main";
};

const warnAboutUntrusted = (domain) => {
  if (!currentSettings.warnOnUntrusted) return;
  alert(getTranslator()("alerts.untrusted", { domain }));
};

const refreshWhitelist = async () => {
  const stored = await loadWhitelist();
  customWhitelist = stored.map((domain) => normalizeHost(domain)).filter(Boolean);
  renderWhitelist(dom, getTranslator(), customWhitelist);
  updateStats(dom, lastHistory, customWhitelist);
};

const updateWhitelistStorage = async (domains) => {
  customWhitelist = domains.map((domain) => normalizeHost(domain)).filter(Boolean);
  await saveWhitelist(customWhitelist);
  renderWhitelist(dom, getTranslator(), customWhitelist);
  updateStats(dom, lastHistory, customWhitelist);
};

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

const refreshHistory = async () => {
  const t = getTranslator();
  const items = await loadHistory(currentSettings.historyRetentionDays);
  lastHistory = items;
  renderHistory(dom, t, items.slice(0), getLocale(currentSettings.language));
  updateStats(dom, items, customWhitelist);
};

const applyInspectionResult = async (result, options = {}) => {
  const { shouldAlert = false, source = "active" } = options;
  const t = getTranslator();
  applyState(dom, t, result.verdict, {
    domain: result.domain,
    checkedAt: new Date(),
    spoofTarget: result.spoofTarget,
    language: currentSettings.language
  });
  await recordHistory(
    {
      domain: result.domain,
      verdict: result.verdict,
      checkedAt: Date.now(),
      spoofTarget: result.spoofTarget,
      source
    },
    currentSettings.historyRetentionDays
  );
  if (shouldAlert && result.verdict === "untrusted") {
    warnAboutUntrusted(result.domain);
  }
  refreshHistory();
};

const checkActiveTab = async () => {
  const t = getTranslator();
  applyState(dom, t, "pending", { language: currentSettings.language });
  dom.refreshBtn.disabled = true;
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.url) {
      throw new Error(t("errors.activeTab"));
    }
    if (!/^https?:\/\//i.test(activeTab.url)) {
      applyState(dom, t, "unsupported", { language: currentSettings.language });
      return;
    }
    const url = new URL(activeTab.url);
    const result = await inspectDomain(url.hostname, customWhitelist);
    await applyInspectionResult(result, { shouldAlert: true, source: "active" });
  } catch (error) {
    console.error("Ошибка во время проверки", error);
    const errorKey = error?.message;
    const errorText =
      errorKey && baseTranslate(currentSettings.language, errorKey) !== errorKey
        ? baseTranslate(currentSettings.language, errorKey)
        : error?.message || "";
    applyState(dom, t, "error", { error: errorText, language: currentSettings.language });
  } finally {
    dom.refreshBtn.disabled = false;
  }
};

const handleManualSubmit = async (event) => {
  event.preventDefault();
  if (!dom.manualInput) return;
  const t = getTranslator();
  const hostname = resolveHostname(dom.manualInput.value);
  if (!hostname) {
    setManualHint(dom, t("manual.hint.invalid"), true);
    return;
  }
  try {
    const result = await inspectDomain(hostname, customWhitelist);
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
    theme: dom.themeToggle?.checked ? "light" : "dark",
    language: dom.languageSelect?.value ?? DEFAULT_SETTINGS.language,
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
  if (dom.themeToggle) {
    dom.themeToggle.checked = currentSettings.theme === "light";
  }
  if (dom.languageSelect) {
    dom.languageSelect.value = currentSettings.language;
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
  const result = await inspectDomain(domain, customWhitelist);
  await applyInspectionResult(result, { shouldAlert: false, source: "manual" });
};

const init = async () => {
  currentSettings = await loadSettings();
  applyTheme(currentSettings.theme, currentSettings.compactMode);
  applyLanguage(dom, getTranslator(), currentSettings.language);
  await refreshWhitelist();
  updateSettingsControls();
  refreshHistory();

  if (currentSettings.autoCheckOnOpen) {
    checkActiveTab();
  } else {
    applyState(dom, getTranslator(), "pending", { language: currentSettings.language });
  }
};

safeAddEvent(dom.refreshBtn, "click", checkActiveTab);
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
safeAddEvent(dom.themeToggle, "change", handleSettingsChange);
safeAddEvent(dom.languageSelect, "change", handleSettingsChange);
safeAddEvent(dom.historyRetentionSelect, "change", handleSettingsChange);
safeAddEvent(dom.compactModeToggle, "change", handleSettingsChange);
safeAddEvent(dom.manualForm, "submit", handleManualSubmit);
safeAddEvent(dom.manualInput, "input", () => setManualHint(dom, getTranslator()("manual.hint.default")));
safeAddEvent(dom.whitelistForm, "submit", handleWhitelistSubmit);
safeAddEvent(dom.whitelistList, "click", handleWhitelistListClick);
safeAddEvent(dom.quickAddBtn, "click", handleQuickAddClick);

init();
