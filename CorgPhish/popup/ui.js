// RU: UI-утилиты popup: тема, локализация, рендер состояний, история и списки.
// EN: Popup UI helpers: theme, locale, state rendering, history and lists.
import { VIEW_STATES } from "./config.js";
import { formatTime } from "./utils.js";

// Тема и плотность интерфейса задаются через data-атрибуты body.
export const applyTheme = (theme, compactMode = false) => {
  const resolved = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = resolved;
  document.body.dataset.density = compactMode ? "compact" : "cozy";
};

// Центрально обновляем тексты интерфейса, чтобы переключение языка не ломало текущее состояние.
export const applyLanguage = (dom, translate, language) => {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    el.textContent = translate(key);
  });
  if (dom.whitelistInput) {
    dom.whitelistInput.placeholder = translate("whitelist.placeholder");
  }
  if (dom.blacklistInput) {
    dom.blacklistInput.placeholder = translate("blacklist.placeholder");
  }
  if (dom.manualInput) {
    dom.manualInput.placeholder = translate("manual.placeholder");
  }
  if (dom.manualHint) {
    dom.manualHint.textContent = translate("manual.hint.default");
  }
  if (dom.sourceValue) {
    dom.sourceValue.textContent = translate("status.sourceValue");
  }
  if (dom.historySearchInput) {
    dom.historySearchInput.placeholder = translate("history.search.placeholder");
  }
};

export const updateRecommendations = (dom, items = []) => {
  if (!dom.recommendationsList) return;
  dom.recommendationsList.innerHTML = "";
  (items.length ? items : []).forEach((text) => {
    if (!text) return;
    const li = document.createElement("li");
    li.textContent = text;
    dom.recommendationsList.appendChild(li);
  });
};

export const renderReasonTrace = (dom, translate, steps = []) => {
  if (!dom.reasonTraceList || !dom.reasonTraceEmpty) return;
  dom.reasonTraceList.innerHTML = "";
  if (!steps.length) {
    dom.reasonTraceEmpty.hidden = false;
    dom.reasonTraceEmpty.textContent = translate("reasonTrace.empty");
    return;
  }
  dom.reasonTraceEmpty.hidden = true;
  steps.forEach((step, index) => {
    const li = document.createElement("li");

    const bullet = document.createElement("span");
    bullet.className = "reason-trace__bullet";
    bullet.textContent = String(index + 1);

    const text = document.createElement("span");
    text.className = "reason-trace__text";
    text.textContent = translate(step.key, step.params || {});

    li.appendChild(bullet);
    li.appendChild(text);
    dom.reasonTraceList.appendChild(li);
  });
};

export const setQuickAddState = (dom, domain, isTrusted) => {
  if (!dom.quickAddBtn) return;
  const hidden = !domain || isTrusted;
  dom.quickAddBtn.disabled = hidden;
  dom.quickAddBtn.dataset.domain = hidden ? "" : domain;
  dom.quickAddBtn.classList.toggle("is-hidden", hidden);
};

export const setBlacklistState = (dom, domain, canBlacklist) => {
  if (!dom.blacklistBtn) return;
  const hidden = !domain || !canBlacklist;
  dom.blacklistBtn.disabled = hidden;
  dom.blacklistBtn.dataset.domain = hidden ? "" : domain;
  dom.blacklistBtn.classList.toggle("is-hidden", hidden);
};

export const setReportState = (dom, domain, canReport, details = {}) => {
  if (!dom.reportPhishingBtn) return;
  const hidden = !domain || !canReport;
  dom.reportPhishingBtn.disabled = hidden;
  dom.reportPhishingBtn.dataset.domain = hidden ? "" : domain;
  dom.reportPhishingBtn.dataset.url = hidden ? "" : details.url || "";
  dom.reportPhishingBtn.dataset.verdict = hidden ? "" : details.verdict || "";
  dom.reportPhishingBtn.dataset.source = hidden ? "" : details.sourceKey || "";
  dom.reportPhishingBtn.classList.toggle("is-hidden", hidden);
};

export const setManualHint = (dom, text, isError = false) => {
  if (!dom.manualHint) return;
  dom.manualHint.textContent = text;
  dom.manualHint.style.color = isError ? "#f87171" : "var(--color-muted-strong)";
};

const renderDomainList = (listEl, translate, domains = [], emptyKey, options = {}) => {
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!domains.length) {
    const li = document.createElement("li");
    li.className = "empty-state";
    li.textContent = translate(emptyKey);
    listEl.appendChild(li);
    return;
  }
  domains.forEach((domain) => {
    const li = document.createElement("li");
    li.className = "whitelist-item";
    li.dataset.domain = domain;
    li.innerHTML = `<span>${domain}</span>`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "whitelist-remove";
    removeBtn.dataset.domain = domain;
    removeBtn.textContent = "✕";
    if (options.disableRemove) {
      removeBtn.disabled = true;
    }

    li.appendChild(removeBtn);
    listEl.appendChild(li);
  });
};

export const renderBlacklist = (dom, translate, domains = []) => {
  renderDomainList(dom.blacklistList, translate, domains, "blacklist.empty");
};

// Главный рендерер карточки статуса в popup.
export const applyState = (dom, translate, stateKey, context = {}) => {
  const resolveTone = (key) => {
    if (key === "phishing" || key === "blacklisted") return "bad";
    if (key === "suspicious" || key === "warning" || key === "error") return "warn";
    if (key === "trusted") return "ok";
    if (key === "pending") return "info";
    return "info";
  };
  const config = VIEW_STATES[stateKey] ?? VIEW_STATES.pending;
  dom.app.dataset.state = config.theme;
  const tone = resolveTone(stateKey);

  dom.statusBadge.textContent = translate(config.badgeKey, context);
  dom.statusBadge.dataset.tone = tone;
  dom.statusTitle.textContent = translate(config.titleKey, context);
  let hintKey = config.hintKey;
  if (stateKey === "trusted") {
    if (context.sourceKey === "status.sourceValue.ml") {
      hintKey = "status.trusted.hint.ml";
    } else if (context.sourceKey === "status.sourceValue.whitelist") {
      hintKey = "status.trusted.hint.whitelist";
    } else if (context.sourceKey === "status.sourceValue.list") {
      hintKey = "status.trusted.hint.list";
    }
  } else if (stateKey === "suspicious" && context.suspicionKey) {
    hintKey = context.suspicionKey;
  }
  dom.statusHint.textContent = translate(hintKey, context);
  const riskText = translate(config.riskKey, context);
  [dom.riskLevel, dom.riskTag].filter(Boolean).forEach((node) => {
    node.textContent = riskText;
    node.dataset.tone = tone;
  });
  if (dom.mlScore) {
    dom.mlScore.classList.add("is-hidden");
  }
  if (dom.domainValue) {
    dom.domainValue.textContent = context.domain ?? "—";
  }
  if (dom.checkedAt) {
    dom.checkedAt.textContent = context.checkedAt
      ? formatTime(context.checkedAt, context.language)
      : "—";
  }
  if (dom.sourceValue) {
    const sourceKey = context.sourceKey || "status.sourceValue";
    dom.sourceValue.textContent = translate(sourceKey, context);
  }
  const fallbackTraceKey = {
    pending: "reasonTrace.pending",
    unsupported: "reasonTrace.unsupported",
    error: "reasonTrace.error"
  }[stateKey];
  const traceSteps = Array.isArray(context.reasonTrace) && context.reasonTrace.length
    ? context.reasonTrace
    : fallbackTraceKey
      ? [{ key: fallbackTraceKey, params: context }]
      : [];
  renderReasonTrace(dom, translate, traceSteps);
  const isTrustedState = Boolean(context.isTrusted);
  const canBlacklist = stateKey === "phishing" || stateKey === "suspicious";
  const canReport = stateKey === "phishing" || stateKey === "suspicious" || stateKey === "blacklisted";
  setQuickAddState(dom, context.domain, isTrustedState || stateKey === "blacklisted");
  setBlacklistState(dom, context.domain, canBlacklist);
  setReportState(dom, context.domain, canReport, {
    url: context.url,
    verdict: stateKey,
    sourceKey: context.sourceKey
  });

  const recKeys = config.recommendationsKeys || [];
  const recItems = recKeys.map((key) => translate(key, context)).filter(Boolean);
  if (context.suspicionKey) {
    const hintParams = { ...context, ...(context.suspicionParams || {}) };
    recItems.unshift(translate(context.suspicionKey, hintParams));
  } else if (stateKey === "suspicious" && context.spoofTarget) {
    recItems.unshift(translate("status.suspicious.hint", context));
  }
  const finalRec = recItems.length ? recItems : [translate("recommendations.empty")];
  updateRecommendations(dom, finalRec);
};

export const renderWhitelist = (dom, translate, domains = []) => {
  renderDomainList(dom.whitelistList, translate, domains, "whitelist.empty");
};


export const renderHistory = (dom, translate, items = [], locale, emptyText = "") => {
  if (!dom.historyList || !dom.historyEmpty) return;
  dom.historyList.innerHTML = "";
  if (!items.length) {
    dom.historyEmpty.textContent = emptyText || translate("history.empty");
    dom.historyEmpty.hidden = false;
    return;
  }
  dom.historyEmpty.hidden = true;

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "history-item";

    const info = document.createElement("div");
    info.className = "history-item__info";

    const title = document.createElement("h4");
    title.textContent = item.domain ?? "—";
    const subtitle = document.createElement("p");
    const dateText = new Date(item.checkedAt).toLocaleString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit"
    });
    const sourceText =
      item.source === "manual" ? translate("history.source.manual") : translate("history.source.active");
    subtitle.textContent = `${dateText} • ${sourceText}${item.spoofTarget ? ` • ${item.spoofTarget}` : ""}`;

    info.appendChild(title);
    info.appendChild(subtitle);

    const badge = document.createElement("span");
    const isTrustedVerdict = item.verdict === "trusted";
    const isAlert =
      item.verdict === "phishing" || item.verdict === "blacklisted" || item.verdict === "suspicious";
    badge.className = `chip ${isTrustedVerdict ? "chip--trusted" : "chip--untrusted"}`;
    badge.textContent = isTrustedVerdict
      ? translate("history.badge.trusted")
      : translate("history.badge.alert");

    li.appendChild(info);
    li.appendChild(badge);
    dom.historyList.appendChild(li);
  });
};

export const updateStats = (dom, items = [], whitelist = []) => {
  if (dom.statsTrusted) {
    dom.statsTrusted.textContent = items.filter((item) => item.verdict === "trusted").length;
  }
  if (dom.statsAlert) {
    dom.statsAlert.textContent = items.filter((item) => item.verdict !== "trusted").length;
  }
  if (dom.statsWhitelist) {
    dom.statsWhitelist.textContent = whitelist.length;
  }
};
