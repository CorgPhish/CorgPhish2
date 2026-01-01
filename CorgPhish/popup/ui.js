// UI-утилиты: темы, языки, состояния, рендер списков.
import { VIEW_STATES } from "./config.js";
import { formatTime } from "./utils.js";

export const applyTheme = (theme, compactMode = false) => {
  const resolved = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = resolved;
  document.body.dataset.density = compactMode ? "compact" : "cozy";
};

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
  if (dom.officialSiteBtn && dom.officialSiteBtn.dataset.domain) {
    dom.officialSiteBtn.textContent = translate("actions.official.open", {
      domain: dom.officialSiteBtn.dataset.domain
    });
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

export const setOfficialSiteState = (dom, domain, translate) => {
  if (!dom.officialSiteBtn) return;
  const hidden = !domain;
  dom.officialSiteBtn.disabled = hidden;
  dom.officialSiteBtn.dataset.domain = hidden ? "" : domain;
  dom.officialSiteBtn.classList.toggle("is-hidden", hidden);
  if (!hidden && translate) {
    dom.officialSiteBtn.textContent = translate("actions.official.open", { domain });
  }
};

export const setManualHint = (dom, text, isError = false) => {
  if (!dom.manualHint) return;
  dom.manualHint.textContent = text;
  dom.manualHint.style.color = isError ? "#f87171" : "var(--color-muted-strong)";
};

export const renderBlacklist = (dom, translate, domains = []) => {
  if (!dom.blacklistList) return;
  dom.blacklistList.innerHTML = "";
  if (!domains.length) {
    const li = document.createElement("li");
    li.className = "empty-state";
    li.textContent = translate("blacklist.empty");
    dom.blacklistList.appendChild(li);
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

    li.appendChild(removeBtn);
    dom.blacklistList.appendChild(li);
  });
};

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
  dom.statusHint.textContent = translate(config.hintKey, context);
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
  const isTrustedState = stateKey === "trusted";
  const canBlacklist = stateKey === "phishing" || stateKey === "suspicious";
  setQuickAddState(dom, context.domain, isTrustedState || stateKey === "blacklisted");
  setBlacklistState(dom, context.domain, canBlacklist);
  setOfficialSiteState(dom, context.officialDomain, translate);

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
  if (!dom.whitelistList) return;
  dom.whitelistList.innerHTML = "";
  if (!domains.length) {
    const li = document.createElement("li");
    li.className = "empty-state";
    li.textContent = translate("whitelist.empty");
    dom.whitelistList.appendChild(li);
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

    li.appendChild(removeBtn);
    dom.whitelistList.appendChild(li);
  });
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
