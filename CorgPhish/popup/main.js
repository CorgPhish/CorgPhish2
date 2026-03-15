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
let lastInspectedUrl = "";
let lastRenderedState = {
  stateKey: "pending",
  context: { language: DEFAULT_SETTINGS.language }
};
let lastRenderedTarget = {
  source: null,
  tabId: null,
  domain: ""
};

// Текущий translator строится из активных настроек, поэтому язык можно менять без перезагрузки popup.
const getTranslator = () => (key, params) => baseTranslate(currentSettings.language, key, params);

// Короткие статусы в настройках живут отдельно от главного status banner и автоматически гаснут.
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

// Для кнопки репорта стараемся собрать полноценный URL даже если в результате есть только домен.
const resolveReportUrl = (rawUrl, domain) => {
  const candidate = String(rawUrl || "").trim();
  if (candidate) {
    try {
      const parsed = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
      if (/^https?:$/i.test(parsed.protocol)) {
        return parsed.toString();
      }
    } catch (error) {
      // ignore malformed candidate
    }
  }
  const cleanDomain = normalizeHost(domain);
  return cleanDomain ? `https://${cleanDomain}` : "";
};

const copyReportToClipboard = async (text) => {
  if (!text || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    return false;
  }
};

const renderPopupState = (stateKey, context = {}) => {
  const nextContext = { ...context };
  if (!nextContext.language) {
    nextContext.language = currentSettings.language;
  }
  lastRenderedState = { stateKey, context: nextContext };
  applyState(dom, getTranslator(), stateKey, nextContext);
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
      if (response?.ok) {
        resolve({ signals: response.signals || null, url: response.url || "" });
        return;
      }
      resolve(null);
    });
    setTimeout(() => resolve(null), 1200);
  });

const getInspectOptions = () => ({ strictMode: currentSettings.strictMode });

// Поиск и фильтрация истории идут поверх сохранённых записей без повторной проверки сайтов.
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

// Быстрые remove-хендлеры не читают storage повторно: работают от текущего локального state popup.
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

const sendPhishingBlock = (tabId, payload) => {
  if (!tabId) return;
  // Popup не блокирует страницу сам, а делегирует это уже загруженному content script.
  chrome.tabs.sendMessage(tabId, { type: "phishingBlock", ...payload }, () => {
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
// Синхронизируем вердикт одновременно в UI, истории и активной вкладке.
const applyInspectionResult = async (result, options = {}) => {
  const { shouldAlert = false, source = "active", tabId, inspectedUrl = "" } = options;
  const t = getTranslator();
  const isRisk = result.verdict === "phishing" || result.verdict === "blacklisted";
  const mlUnavailable = result.mlStatus === "error";
  const mlFallback = result.mlStatus === "fallback";
  const fromCache = Boolean(result.cached);
  const resolvedUrl = inspectedUrl || lastInspectedUrl || "";
  if (inspectedUrl) {
    lastInspectedUrl = inspectedUrl;
  }
  lastRenderedTarget = {
    source,
    tabId: source === "active" ? tabId ?? null : null,
    domain: result.domain
  };
  renderPopupState(result.verdict, {
    domain: result.domain,
    url: resolvedUrl,
    checkedAt: result.checkedAt ? new Date(result.checkedAt) : new Date(),
    spoofTarget: result.spoofTarget,
    language: currentSettings.language,
    isTrusted: result.isTrusted,
    mlVerdict: result.mlVerdict,
    sourceKey: result.detectionSource,
    match: result.matchedDomain || "",
    suspicionKey: result.suspicionKey,
    suspicionParams: result.suspicionParams,
    reasonTrace: result.reasonTrace || [],
    officialDomain: result.officialDomain
  });
  if (!fromCache) {
    // Историю пишем только для новых проверок, чтобы переприменение кэшированного результата не плодило дубли.
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
    // Для phishing/blacklisted шлём отдельную команду content script, чтобы он закрыл форму/скачивание/страницу.
    sendPhishingBlock(tabId, {
      domain: result.domain,
      verdict: result.verdict,
      officialDomain: result.officialDomain
    });
  }
  if (!fromCache && shouldAlert && isRisk && currentSettings.warnOnUntrusted) {
    setStatusMessage(t("status.phishing.hint"), "warn");
  } else if (mlUnavailable) {
    setStatusMessage(t("status.ml.unavailable"), "warn");
    if (result.mlError) {
      console.warn("CorgPhish: ML unavailable", result.mlError);
    }
  } else if (mlFallback) {
    setStatusMessage(t("status.ml.fallback"), "warn");
  } else {
    setStatusMessage("");
  }
  if (!fromCache) {
    refreshHistory();
  }
};

// Основной сценарий popup: читаем текущую вкладку, получаем сигналы content script и считаем вердикт.
const checkActiveTab = async () => {
  const t = getTranslator();
  setStatusMessage("");
  renderPopupState("pending", { language: currentSettings.language });
  dom.refreshBtn.disabled = true;
  try {
    const [activeTab] = await queryActiveTab();
    const signalsPayload = activeTab?.id ? await fetchPageSignals(activeTab.id) : null;
    const tabUrl = activeTab?.url || signalsPayload?.url || "";
    if (!tabUrl) {
      renderPopupState("unsupported", { language: currentSettings.language });
      return;
    }
    if (!/^https?:\/\//i.test(tabUrl)) {
      renderPopupState("unsupported", { language: currentSettings.language });
      return;
    }
    lastInspectedUrl = tabUrl;
    const url = new URL(tabUrl);
    // Popup использует и hostname, и page signals: только по домену многие кейсы были бы слишком грубыми.
    const result = await inspectDomain(
      url.hostname,
      customWhitelist,
      tabUrl,
      signalsPayload?.signals || {},
      getInspectOptions()
    );
    await applyInspectionResult(result, {
      shouldAlert: true,
      source: "active",
      tabId: activeTab?.id,
      inspectedUrl: tabUrl
    });
  } catch (error) {
    console.error("Ошибка во время проверки", error);
    const errorKey = error?.message;
    const errorText =
      errorKey && baseTranslate(currentSettings.language, errorKey) !== errorKey
        ? baseTranslate(currentSettings.language, errorKey)
        : error?.message || "";
    renderPopupState("error", { error: errorText, language: currentSettings.language });
    setStatusMessage(errorText || t("status.error.title"), "error");
  } finally {
    dom.refreshBtn.disabled = false;
  }
};

// Ручная проверка использует тот же инспектор, но без данных активной вкладки и без авто-блокировки.
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
  const inspectedUrl = resolveReportUrl(rawInput, hostname);
  lastInspectedUrl = inspectedUrl;
  setStatusMessage("");
  try {
    const result = await inspectDomain(
      hostname,
      customWhitelist,
      inspectedUrl || rawInput,
      {},
      getInspectOptions()
    );
    await applyInspectionResult(result, {
      shouldAlert: false,
      source: "manual",
      inspectedUrl
    });
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
    linkHighlightEnabled:
      dom.linkHighlightToggle?.checked ?? DEFAULT_SETTINGS.linkHighlightEnabled,
    antiScamBannerEnabled:
      dom.antiScamToggle?.checked ?? DEFAULT_SETTINGS.antiScamBannerEnabled,
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
  // После сохранения сразу пересинхронизируем UI, не дожидаясь нового открытия popup.
  applyTheme(currentSettings.theme, currentSettings.compactMode);
  applyLanguage(dom, getTranslator(), currentSettings.language);
  updateSettingsControls();
  refreshHistory();
  renderPopupState(lastRenderedState.stateKey, {
    ...lastRenderedState.context,
    language: currentSettings.language
  });
  showSettingsStatus("settings.status.saved");
};

// Перекладывает сохранённые настройки обратно в контролы формы.
const updateSettingsControls = () => {
  if (dom.autoCheckInput) {
    dom.autoCheckInput.checked = currentSettings.autoCheckOnOpen;
  }
  if (dom.alertInput) {
    dom.alertInput.checked = currentSettings.warnOnUntrusted;
  }
  if (dom.linkHighlightToggle) {
    dom.linkHighlightToggle.checked = currentSettings.linkHighlightEnabled;
  }
  if (dom.antiScamToggle) {
    dom.antiScamToggle.checked = currentSettings.antiScamBannerEnabled;
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
  // После добавления в whitelist сразу прогоняем домен ещё раз, чтобы popup обновил статус.
  await addDomainToWhitelist(domain);
  const result = await inspectDomain(domain, customWhitelist, domain, {}, getInspectOptions());
  await applyInspectionResult(result, { shouldAlert: false, source: "manual" });
};

function handleBlacklistClick() {
  (async () => {
    const domain = dom.blacklistBtn?.dataset.domain;
  if (!domain) return;
  const shouldCloseCurrentTab =
    lastRenderedTarget.source === "active" &&
    lastRenderedTarget.tabId &&
    normalizeHost(domain) === normalizeHost(lastRenderedTarget.domain);
  const tabIdToClose = shouldCloseCurrentTab ? lastRenderedTarget.tabId : null;
  await addDomainToBlacklist(domain);
  const result = await inspectDomain(domain, customWhitelist, domain, {}, getInspectOptions());
  await applyInspectionResult(result, { shouldAlert: true, source: "manual" });
  if (tabIdToClose) {
    try {
      // Закрываем только ту вкладку, результат которой сейчас реально показан в popup.
      chrome.tabs.remove(tabIdToClose);
    } catch (error) {
      console.warn("CorgPhish: failed to close tab after blacklist", error);
    }
  }
})();
}

const handleReportPhishingClick = async () => {
  const t = getTranslator();
  const domain = dom.reportPhishingBtn?.dataset.domain || dom.domainValue?.textContent || "";
  const reportUrl = resolveReportUrl(dom.reportPhishingBtn?.dataset.url || lastInspectedUrl, domain);
  if (!reportUrl) {
    setStatusMessage(t("status.report.failed"), "error");
    return;
  }
  const verdict = dom.reportPhishingBtn?.dataset.verdict || "suspicious";
  const source = dom.reportPhishingBtn?.dataset.source || "";
  const reportText = [
    "CorgPhish phishing report",
    `URL: ${reportUrl}`,
    `Domain: ${normalizeHost(domain) || "n/a"}`,
    `Verdict: ${verdict}`,
    `Source: ${source}`,
    `Time: ${new Date().toISOString()}`
  ].join("\n");
  const copied = await copyReportToClipboard(reportText);
  const reportPage =
    `https://safebrowsing.google.com/safebrowsing/report_phish/?url=${encodeURIComponent(reportUrl)}`;
  chrome.tabs.create({ url: reportPage });
  setStatusMessage(t(copied ? "status.report.openedCopied" : "status.report.opened"), "warn");
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
    // Массовая проверка идёт последовательно: так проще контролировать ошибки content script по вкладкам.
    for (const tab of candidates) {
      try {
        const signalsPayload = await fetchPageSignals(tab.id);
        const tabUrl = tab.url || signalsPayload?.url || "";
        if (!tabUrl || !/^https?:\/\//i.test(tabUrl)) {
          continue;
        }
        const url = new URL(tabUrl);
        const result = await inspectDomain(
          url.hostname,
          customWhitelist,
          tabUrl,
          signalsPayload?.signals || {},
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
          sendPhishingBlock(tab.id, {
            domain: result.domain,
            verdict: result.verdict,
            officialDomain: result.officialDomain
          });
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

  // Автопроверка зависит от настройки пользователя.
  if (currentSettings.autoCheckOnOpen) {
    checkActiveTab();
  } else {
    renderPopupState("pending", { language: currentSettings.language });
  }
};

// Привязка DOM-событий собрана внизу, чтобы init-логика выше читалась как сценарий, а не как список обработчиков.
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
safeAddEvent(dom.linkHighlightToggle, "change", handleSettingsChange);
safeAddEvent(dom.antiScamToggle, "change", handleSettingsChange);
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
safeAddEvent(dom.reportPhishingBtn, "click", handleReportPhishingClick);
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
