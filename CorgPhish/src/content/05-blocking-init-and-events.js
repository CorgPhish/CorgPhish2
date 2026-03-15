  // RU: Модуль 5. Финальная защита: блокировка действий, редирект на blocked.html и init listeners.
  // EN: Module 5. Final guard: interaction blocking, redirect to blocked.html and event wiring.
  // RU: Создаём блокирующий оверлей с кнопками действий.
  // EN: Create blocking overlay with action buttons.
  // Оверлей остаётся запасным вариантом. Основной сценарий сейчас — быстрый редирект на blocked.html.
  const createOverlay = (domain, onExit, onBlacklist, onAllow) => {
    const overlayHost = document.createElement("div");
    const shadow = overlayHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; }
      button { all: unset; font: inherit; }
    `;
    const overlayEl = document.createElement("div");
    overlayEl.style.position = "fixed";
    overlayEl.style.inset = "0";
    overlayEl.style.zIndex = "2147483647";
    overlayEl.style.background = `radial-gradient(circle at 15% 20%, rgba(242,154,74,0.16), transparent 38%), radial-gradient(circle at 80% 20%, rgba(217,119,44,0.18), transparent 32%), ${BRAND_COLORS.overlay}`;
    overlayEl.style.backdropFilter = "blur(4px)";
    overlayEl.style.display = "flex";
    overlayEl.style.flexDirection = "column";
    overlayEl.style.alignItems = "center";
    overlayEl.style.justifyContent = "center";
    overlayEl.style.gap = "12px";
    overlayEl.style.fontFamily = '"Nunito","Manrope","Inter",system-ui,-apple-system,sans-serif';
    overlayEl.style.color = BRAND_COLORS.text;
    overlayEl.style.padding = "24px";
    overlayEl.style.textAlign = "center";

    const card = document.createElement("div");
    card.style.background = `${BRAND_COLORS.surface}`;
    card.style.border = `1px solid ${BRAND_COLORS.border}`;
    card.style.borderRadius = "18px";
    card.style.padding = "18px 20px";
    card.style.minWidth = "280px";
    card.style.maxWidth = "420px";
    card.style.boxShadow = "0 14px 40px rgba(43,42,40,0.14), inset 0 1px 0 rgba(255,255,255,0.65)";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "6px";

    const badge = document.createElement("div");
    badge.textContent = "CorgPhish — защита";
    badge.style.display = "inline-flex";
    badge.style.alignItems = "center";
    badge.style.justifyContent = "center";
    badge.style.alignSelf = "center";
    badge.style.padding = "6px 12px";
    badge.style.borderRadius = "999px";
    badge.style.fontSize = "12px";
    badge.style.letterSpacing = "0.04em";
    badge.style.textTransform = "uppercase";
    badge.style.fontWeight = "800";
    badge.style.background = "#F7DEDE";
    badge.style.color = BRAND_COLORS.bad;
    badge.style.border = `1px solid ${BRAND_COLORS.bad}20`;

    const title = document.createElement("h2");
    title.textContent = "Этот сайт может быть фишинговым";
    title.style.margin = "2px 0 4px";
    title.style.color = BRAND_COLORS.text;

    const subtitle = document.createElement("p");
    subtitle.textContent = domain;
    subtitle.style.margin = "0 0 6px";
    subtitle.style.fontWeight = "700";
    subtitle.style.color = BRAND_COLORS.accentStrong;

    const hint = document.createElement("p");
    hint.textContent = "Данные, формы и загрузки заблокированы.";
    hint.style.margin = "0 0 14px";
    hint.style.color = BRAND_COLORS.muted;

    const buttons = document.createElement("div");
    buttons.style.display = "flex";
    buttons.style.gap = "10px";
    buttons.style.justifyContent = "center";
    buttons.style.flexWrap = "wrap";

    const exitBtn = document.createElement("button");
    exitBtn.textContent = "Выйти";
    exitBtn.style.padding = "10px 14px";
    exitBtn.style.borderRadius = "12px";
    exitBtn.style.border = "none";
    exitBtn.style.cursor = "pointer";
    exitBtn.style.background = `linear-gradient(120deg, ${BRAND_COLORS.accent}, ${BRAND_COLORS.accentStrong})`;
    exitBtn.style.color = BRAND_COLORS.text;
    exitBtn.style.fontWeight = "800";
    exitBtn.style.boxShadow = "0 10px 26px rgba(242,154,74,0.28)";

    const blacklistBtn = document.createElement("button");
    blacklistBtn.textContent = "Добавить в ЧС";
    blacklistBtn.style.padding = "10px 14px";
    blacklistBtn.style.borderRadius = "12px";
    blacklistBtn.style.border = `1px solid ${BRAND_COLORS.border}`;
    blacklistBtn.style.background = BRAND_COLORS.surfaceAlt;
    blacklistBtn.style.color = BRAND_COLORS.text;
    blacklistBtn.style.cursor = "pointer";

    const allowBtn = document.createElement("button");
    allowBtn.textContent = "Разрешить на 5 минут";
    allowBtn.style.padding = "10px 14px";
    allowBtn.style.borderRadius = "12px";
    allowBtn.style.border = `1px solid ${BRAND_COLORS.accent}50`;
    allowBtn.style.background = `${BRAND_COLORS.accent}14`;
    allowBtn.style.color = BRAND_COLORS.accentStrong;
    allowBtn.style.cursor = "pointer";

    buttons.appendChild(exitBtn);
    buttons.appendChild(blacklistBtn);
    buttons.appendChild(allowBtn);
    card.appendChild(badge);
    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(hint);
    card.appendChild(buttons);
    overlayEl.appendChild(card);
    shadow.appendChild(style);
    shadow.appendChild(overlayEl);
    document.documentElement.appendChild(overlayHost);

    exitBtn.addEventListener("click", () => onExit?.());
    blacklistBtn.addEventListener("click", () => onBlacklist?.());
    allowBtn.addEventListener("click", () => onAllow?.());

    return { overlay: overlayHost, hint, subtitle, allowBtn, title, badge };
  };

  const PAGE_GUARD_STATE_EVENT = "corgphish:page-guard-state";
  const PAGE_GUARD_BLOCKED_EVENT = "corgphish:page-guard-blocked";

  // Перехват fetch/XHR/beacon надо ставить в page world, но без inline-скрипта:
  // страницы с жёстким CSP режут script.textContent.
  const installPageWorldFormGuard = (onBlockedAction) => {
    const relayBlockedAction = (event) => {
      if (event?.detail?.kind !== "form") return;
      console.info("CorgPhish form guard debug", {
        source: "content-relay",
        detail: event.detail,
        href: window.location.href
      });
      onBlockedAction?.("form");
    };

    document.addEventListener(PAGE_GUARD_BLOCKED_EVENT, relayBlockedAction, true);
    let latestBlockForms = false;
    let injectionPromise = null;

    const dispatchGuardState = () => {
      document.dispatchEvent(
        new CustomEvent(PAGE_GUARD_STATE_EVENT, {
          detail: { blockForms: latestBlockForms }
        })
      );
    };

    const ensureGuardScript = () => {
      if (document.documentElement?.dataset.corgphishPageGuardInstalled === "1") {
        return Promise.resolve(true);
      }
      if (injectionPromise) {
        return injectionPromise;
      }
      const scriptUrl = safeRuntimeGetUrl("page-form-guard.js");
      if (!scriptUrl) {
        return Promise.resolve(false);
      }
      injectionPromise = new Promise((resolve) => {
        const existing = document.getElementById("corgphish-page-guard-script");
        if (existing) {
          resolve(false);
          return;
        }
        const script = document.createElement("script");
        script.id = "corgphish-page-guard-script";
        script.src = scriptUrl;
        script.async = false;
        const finish = (ok) => {
          script.remove();
          resolve(ok);
        };
        script.addEventListener(
          "load",
          () => {
            finish(document.documentElement?.dataset.corgphishPageGuardInstalled === "1");
          },
          { once: true }
        );
        script.addEventListener(
          "error",
          () => {
            console.warn("CorgPhish: failed to load page-form-guard.js");
            finish(false);
          },
          { once: true }
        );
        (document.documentElement || document.head || document).appendChild(script);
      }).finally(() => {
        injectionPromise = null;
      });
      return injectionPromise;
    };

    return {
      sync(blockForms) {
        latestBlockForms = Boolean(blockForms);
        ensureGuardScript().then((installed) => {
          console.info("CorgPhish form guard debug", {
            source: "content-sync",
            installed,
            blockForms: latestBlockForms,
            href: window.location.href
          });
          if (installed) {
            dispatchGuardState();
          }
        });
      },
      teardown() {
        document.removeEventListener(PAGE_GUARD_BLOCKED_EVENT, relayBlockedAction, true);
      }
    };
  };

  // RU: Блокируем формы и скачивания, пока блокировка активна.
  // EN: Block forms and downloads while blocking is active.
  const blockInteractions = ({ isFormBlocked, isDownloadBlocked, onBlockedAction }) => {
    const stopEvent = (event, kind) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
      if ("returnValue" in event) {
        event.returnValue = false;
      }
      if ("cancelBubble" in event) {
        event.cancelBubble = true;
      }
      onBlockedAction?.(kind);
    };

    const resolveUrl = (rawValue = "") => {
      if (!rawValue) return "";
      try {
        return new URL(rawValue, window.location.href).toString();
      } catch (error) {
        return String(rawValue || "");
      }
    };

    const isDownloadTarget = (node) => {
      const link = node?.closest?.("a[href]");
      if (link) {
        const href = resolveUrl(link.getAttribute("href") || "");
        return Boolean(link.hasAttribute("download") || BLOCKED_FILE_EXT.test(href));
      }
      const button = node?.closest?.("button,[role=\"button\"],[data-download],[data-href],[data-url]");
      if (!button) return false;
      const hintedUrl =
        button.getAttribute?.("data-download") ||
        button.getAttribute?.("data-href") ||
        button.getAttribute?.("data-url") ||
        "";
      return Boolean(BLOCKED_FILE_EXT.test(resolveUrl(hintedUrl)));
    };

    const isSubmitControl = (node) => {
      const control = node?.closest?.("button,input");
      if (!control) return false;
      if (control.matches('input[type="submit"], input[type="image"]')) return true;
      if (control.matches('button:not([type]), button[type="submit"]')) return true;
      return false;
    };

    const onSubmit = (event) => {
      if (!isFormBlocked()) return;
      stopEvent(event, "form");
    };
    const onClick = (event) => {
      const target = event.target;
      if (isFormBlocked() && isSubmitControl(target)) {
        stopEvent(event, "form");
        return;
      }
      if (isDownloadBlocked() && isDownloadTarget(target)) {
        stopEvent(event, "download");
      }
    };
    const onBeforeRequest = (event) => {
      if (!isDownloadBlocked()) return;
      const url = event?.target?.url || "";
      if (BLOCKED_FILE_EXT.test(url)) {
        stopEvent(event, "download");
      }
    };
    const onFileInput = (event) => {
      if (!isFormBlocked()) return;
      const input = event.target?.closest?.('input[type="file"]');
      if (input) {
        event.preventDefault?.();
        event.stopPropagation?.();
        event.stopImmediatePropagation?.();
        input.value = "";
        onBlockedAction?.("form");
      }
    };
    const onKeyDown = (event) => {
      if (!isFormBlocked()) return;
      if (event.key !== "Enter") return;
      const target = event.target;
      if (!target?.closest?.("form")) return;
      stopEvent(event, "form");
    };

    const nativeSubmit = HTMLFormElement.prototype.submit;
    const nativeRequestSubmit = HTMLFormElement.prototype.requestSubmit;
    const nativeAnchorClick = HTMLAnchorElement.prototype.click;
    const nativeButtonClick = HTMLButtonElement.prototype.click;
    const nativeInputClick = HTMLInputElement.prototype.click;
    HTMLFormElement.prototype.submit = function patchedSubmit(...args) {
      if (isFormBlocked()) {
        onBlockedAction?.("form");
        return;
      }
      return nativeSubmit.apply(this, args);
    };
    if (typeof nativeRequestSubmit === "function") {
      HTMLFormElement.prototype.requestSubmit = function patchedRequestSubmit(...args) {
        if (isFormBlocked()) {
          onBlockedAction?.("form");
          return;
        }
        return nativeRequestSubmit.apply(this, args);
      };
    }
    HTMLAnchorElement.prototype.click = function patchedAnchorClick(...args) {
      if (isDownloadBlocked() && isDownloadTarget(this)) {
        onBlockedAction?.("download");
        return;
      }
      return nativeAnchorClick.apply(this, args);
    };
    HTMLButtonElement.prototype.click = function patchedButtonClick(...args) {
      if (isFormBlocked() && isSubmitControl(this)) {
        onBlockedAction?.("form");
        return;
      }
      if (isDownloadBlocked() && isDownloadTarget(this)) {
        onBlockedAction?.("download");
        return;
      }
      return nativeButtonClick.apply(this, args);
    };
    HTMLInputElement.prototype.click = function patchedInputClick(...args) {
      if (this.matches?.('input[type="file"]') && isFormBlocked()) {
        onBlockedAction?.("form");
        return;
      }
      if (isFormBlocked() && isSubmitControl(this)) {
        onBlockedAction?.("form");
        return;
      }
      return nativeInputClick.apply(this, args);
    };
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("beforeload", onBeforeRequest, true);
    document.addEventListener("change", onFileInput, true);
    document.addEventListener("click", onFileInput, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("beforeload", onBeforeRequest, true);
      document.removeEventListener("change", onFileInput, true);
      document.removeEventListener("click", onFileInput, true);
      document.removeEventListener("keydown", onKeyDown, true);
      HTMLFormElement.prototype.submit = nativeSubmit;
      if (typeof nativeRequestSubmit === "function") {
        HTMLFormElement.prototype.requestSubmit = nativeRequestSubmit;
      }
      HTMLAnchorElement.prototype.click = nativeAnchorClick;
      HTMLButtonElement.prototype.click = nativeButtonClick;
      HTMLInputElement.prototype.click = nativeInputClick;
    };
  };

  const hostname = resolveHostname(window.location.href);
  if (!hostname || !/^https?:/i.test(window.location.href)) return;

  const state = { active: false, domain: hostname };
  let blockOnUntrustedEnabled = SETTINGS_DEFAULTS.blockOnUntrusted;
  let temporarilyAllowedPage = false;
  const syncRuntimeGuards = () => {
    pageWorldFormGuard?.sync(shouldBlockForms());
    safeRuntimeSendMessage({
      type: "syncPageGuard",
      domain: hostname,
      url: window.location.href,
      verdict: pageRiskVerdict,
      blockDownloads: shouldBlockDownloads()
    });
  };
  const refreshTemporaryAllowState = async () => {
    temporarilyAllowedPage = await isTemporarilyAllowed(hostname);
    syncRuntimeGuards();
    return temporarilyAllowedPage;
  };
  const shouldBlockForms = () =>
    state.active || (blockOnUntrustedEnabled && pageRiskVerdict !== "trusted" && !temporarilyAllowedPage);
  const shouldBlockDownloads = () =>
    state.active || (blockOnUntrustedEnabled && pageRiskVerdict !== "trusted" && !temporarilyAllowedPage);
  const setPageRiskVerdict = (verdict = "trusted") => {
    pageRiskVerdict = verdict || "trusted";
    syncRuntimeGuards();
    if (antiScamBannerEnabled && !state.active) {
      scheduleAntiScamScan();
    }
  };

  const redirectToBlockedPage = (reason = "phishing", details = {}) => {
    const blockedDomain = normalizeHost(details.domain || hostname);
    const blockedUrl = details.url || window.location.href;
    const params = new URLSearchParams();
    params.set("domain", blockedDomain || hostname);
    params.set("reason", reason);
    params.set("url", blockedUrl);
    if (details.officialDomain) {
      params.set("official", details.officialDomain);
    }
    const blockedPageUrl = safeRuntimeGetUrl("blocked.html");
    if (!blockedPageUrl) return;
    const targetUrl = `${blockedPageUrl}?${params.toString()}`;
    try {
      if (document.documentElement) {
        document.documentElement.style.visibility = "hidden";
      }
    } catch (error) {
      // ignore
    }
    console.info("CorgPhish inspect debug", {
      stage: "content-redirectToBlockedPage",
      reason,
      domain: blockedDomain || hostname,
      url: blockedUrl,
      href: window.location.href
    });
    safeRuntimeSendMessage({
      type: "openBlockedPage",
      domain: blockedDomain || hostname,
      reason,
      url: blockedUrl,
      officialDomain: details.officialDomain || ""
    }).then((response) => {
      if (response?.ok) {
        return;
      }
      if (window.location.href !== targetUrl) {
        window.location.replace(targetUrl);
      }
    });
  };

  function handleBlockedInteraction(kind = "form") {
    if (state.active || temporarilyAllowedPage) return;
    console.info("CorgPhish form guard debug", {
      source: "blocked-interaction",
      kind,
      verdict: pageRiskVerdict,
      blockOnUntrustedEnabled,
      temporarilyAllowedPage,
      href: window.location.href
    });
    redirectToBlockedPage(kind === "download" ? "guardDownload" : "guardForm", {
      domain: hostname,
      url: window.location.href
    });
  }

  const pageWorldFormGuard = installPageWorldFormGuard(handleBlockedInteraction);
  const detachInteractionGuards = blockInteractions({
    isFormBlocked: shouldBlockForms,
    isDownloadBlocked: shouldBlockDownloads,
    onBlockedAction: handleBlockedInteraction
  });

  const inspectCurrentPage = async (signals = {}, options = {}) => {
    for (const retryDelay of [0, 250, 900]) {
      if (retryDelay) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
      const backgroundResponse = await safeRuntimeSendMessage({
        type: "inspectPageBg",
        hostname,
        url: window.location.href,
        signals,
        options
      });
      if (backgroundResponse?.ok && backgroundResponse.result) {
        console.info("CorgPhish inspect debug", {
          stage: "content-background",
          hostname,
          verdict: backgroundResponse.result.verdict,
          mlStatus: backgroundResponse.result.mlStatus,
          detectionSource: backgroundResponse.result.detectionSource,
          href: window.location.href
        });
        return backgroundResponse.result;
      }
      if (backgroundResponse?.error) {
        console.info("CorgPhish inspect debug", {
          stage: "content-background-error",
          hostname,
          error: backgroundResponse.error,
          href: window.location.href
        });
      }
    }

    const inspectDomain = await getInspectDomainFn();
    if (!inspectDomain) return null;
    const whitelist = await loadWhitelist();
    const result = await inspectDomain(
      hostname,
      whitelist,
      window.location.href,
      signals,
      options
    );
    console.info("CorgPhish inspect debug", {
      stage: "content-fallback-module",
      hostname,
      verdict: result?.verdict || null,
      mlStatus: result?.mlStatus || null,
      detectionSource: result?.detectionSource || null,
      href: window.location.href
    });
    return result;
  };

  // RU: Блокируем страницу и перенаправляем на экран блокировки.
  // EN: Block the page and redirect to the warning screen.
  const activateBlock = async (reason = "phishing", details = {}) => {
    if (state.active) return;
    state.active = true;
    syncRuntimeGuards();
    clearAntiScamBanner();
    stopAntiScamObserver();
    redirectToBlockedPage(reason, details);
  };

  const navigateToLink = (url, sourceLink) => {
    const href = url.toString();
    const target = (sourceLink?.target || "").toLowerCase();
    if (target === "_blank") {
      window.open(href, "_blank", "noopener");
      return;
    }
    window.location.assign(href);
  };

  const handlePreClickNavigation = () => {
    const shouldSkip = (event, link) => {
      if (state.active) return true;
      if (!link) return true;
      if (event.defaultPrevented) return true;
      if (event.button !== 0) return true;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;
      if (link.hasAttribute("download")) return true;
      return false;
    };

    const toLinkUrl = (link) => {
      const rawHref = link?.getAttribute?.("href") || "";
      if (!rawHref || rawHref.startsWith("#")) return null;
      if (/^(mailto|tel|javascript|data|file|about|chrome|edge):/i.test(rawHref)) return null;
      try {
        const resolved = new URL(rawHref, window.location.href);
        if (!/^https?:$/i.test(resolved.protocol)) return null;
        return resolved;
      } catch (error) {
        return null;
      }
    };

    const formatSuspiciousPrompt = (targetHost, chainHosts = []) => {
      const hasChain = Array.isArray(chainHosts) && chainHosts.length > 1;
      if (getLinkLanguage() === "en") {
        const chainText = hasChain ? `\nRedirect chain: ${chainHosts.join(" -> ")}` : "";
        return `Suspicious link: ${targetHost}.${chainText}\nOpen anyway?`;
      }
      const chainText = hasChain ? `\nЦепочка редиректов: ${chainHosts.join(" -> ")}` : "";
      return `Подозрительная ссылка: ${targetHost}.${chainText}\nОткрыть всё равно?`;
    };

    const onClick = (event) => {
      const link = event.target?.closest?.("a[href]");
      if (shouldSkip(event, link)) return;
      const targetUrl = toLinkUrl(link);
      if (!targetUrl) return;

      event.preventDefault();
      event.stopPropagation();

      (async () => {
        const targetHost = normalizeHost(targetUrl.hostname || "");
        if (!targetHost) return;
        if (await isTemporarilyAllowed(targetHost)) {
          navigateToLink(targetUrl, link);
          return;
        }
        const analysis = await evaluateNavigationRisk(targetUrl);
        if (analysis.verdict === "blacklisted" || analysis.verdict === "phishing") {
          const isRedirectHit =
            analysis.riskyHost &&
            analysis.riskyHost !== targetHost &&
            Array.isArray(analysis.chainHosts) &&
            analysis.chainHosts.length > 1;
          redirectToBlockedPage(
            isRedirectHit ? "redirectPhishing" : analysis.verdict === "blacklisted" ? "linkBlacklist" : "linkPhishing",
            {
              domain: analysis.riskyHost || targetHost,
              url: targetUrl.toString(),
              officialDomain: analysis.riskyResult?.officialDomain
            }
          );
          return;
        }
        if (analysis.verdict === "suspicious") {
          const proceed = window.confirm(
            formatSuspiciousPrompt(targetHost, analysis.chainHosts || [])
          );
          if (!proceed) return;
        }
        navigateToLink(targetUrl, link);
      })();
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  };

  // RU: Инициализация: автоинспекция, учёт временных разрешений и ЧС.
  // EN: Init: auto inspection, temp allow handling, blacklist check.
  const init = async () => {
    handlePreClickNavigation();
    const settings = await loadSyncSettings();
    applyLinkHighlightSetting(settings.linkHighlightEnabled);
    applyAntiScamSetting(settings.antiScamBannerEnabled);
    blockOnUntrustedEnabled = Boolean(settings.blockOnUntrusted);
    const strictModeEnabled = Boolean(settings.strictMode);
    console.info("CorgPhish sensitive guard debug", {
      stage: "init-settings-loaded",
      blockOnUntrustedEnabled,
      strictModeEnabled,
      antiScamBannerEnabled: settings.antiScamBannerEnabled,
      linkHighlightEnabled: settings.linkHighlightEnabled,
      href: window.location.href
    });
    setupSensitiveDataGuard();
    await refreshTemporaryAllowState();
    const blacklist = await loadBlacklist();
    if (blacklist.includes(hostname)) {
      setPageRiskVerdict("blacklisted");
      if (!temporarilyAllowedPage) {
        activateBlock("blacklist");
      }
      return;
    }
    try {
      const initial = await inspectCurrentPage({}, { strictMode: strictModeEnabled });
      if (!initial) return;
      setPageRiskVerdict(initial.verdict);
      await refreshTemporaryAllowState();
      if (initial.verdict === "phishing" || initial.verdict === "blacklisted") {
        if (!temporarilyAllowedPage) {
          activateBlock(initial.verdict === "blacklisted" ? "blacklist" : "phishing", {
            officialDomain: initial.officialDomain
          });
        }
        return;
      }
      const signals = await collectPageSignals({ waitForDom: true });
      const result = await inspectCurrentPage(signals, { strictMode: strictModeEnabled });
      if (!result) return;
      setPageRiskVerdict(result.verdict);
      await refreshTemporaryAllowState();
      if (result.verdict === "phishing" || result.verdict === "blacklisted") {
        if (!temporarilyAllowedPage) {
          activateBlock(result.verdict === "blacklisted" ? "blacklist" : "phishing", {
            officialDomain: result.officialDomain
          });
        }
      }
    } catch (error) {
      console.warn("CorgPhish: auto inspect failed in content", error);
    } finally {
      startLinkObserver();
      startAntiScamObserver();
    }
  };

  // RU: Слушаем сообщения о фишинге от попапа и блокируем сразу.
  // EN: Listen for phishing messages from popup and block instantly.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "getPageSignals") {
      (async () => {
        const signals = await collectPageSignals();
        sendResponse?.({ ok: true, signals, url: window.location.href });
      })();
      return true;
    }
    if (message?.type === "phishingBlock" && normalizeHost(message.domain) === hostname) {
      refreshTemporaryAllowState().then((allowed) => {
        setPageRiskVerdict("phishing");
        if (!allowed) {
          activateBlock("phishing", { officialDomain: message.officialDomain });
        }
      });
      sendResponse?.({ ok: true });
      return true;
    }
    return false;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    const isSettingsArea = area === "sync" || area === "local";
    if (isSettingsArea && Object.prototype.hasOwnProperty.call(changes, "linkHighlightEnabled")) {
      const nextValue = changes.linkHighlightEnabled?.newValue;
      applyLinkHighlightSetting(
        nextValue === undefined ? SETTINGS_DEFAULTS.linkHighlightEnabled : nextValue
      );
    }
    if (isSettingsArea && Object.prototype.hasOwnProperty.call(changes, "antiScamBannerEnabled")) {
      const nextValue = changes.antiScamBannerEnabled?.newValue;
      applyAntiScamSetting(
        nextValue === undefined ? SETTINGS_DEFAULTS.antiScamBannerEnabled : nextValue
      );
    }
    if (isSettingsArea && Object.prototype.hasOwnProperty.call(changes, "blockOnUntrusted")) {
      const nextValue = changes.blockOnUntrusted?.newValue;
      blockOnUntrustedEnabled =
        nextValue === undefined ? SETTINGS_DEFAULTS.blockOnUntrusted : Boolean(nextValue);
      syncRuntimeGuards();
    }
    if (isSettingsArea && Object.prototype.hasOwnProperty.call(changes, "strictMode")) {
      preClickCache.clear();
      linkDomainCache.clear();
    }
    if (area === "local" && Object.prototype.hasOwnProperty.call(changes, TEMP_ALLOW_KEY)) {
      const map = changes[TEMP_ALLOW_KEY]?.newValue;
      const expiry = Number((map && typeof map === "object" ? map[hostname] : 0) || 0);
      temporarilyAllowedPage = expiry > Date.now();
      syncRuntimeGuards();
    }
    if (area === "local" || area === "sync") {
      preClickCache.clear();
      linkDomainCache.clear();
    }
  });

  window.addEventListener("beforeunload", () => {
    pageWorldFormGuard?.teardown?.();
    detachInteractionGuards?.();
  });

  init();
})();
