  // RU: Модуль 4. Сбор page signals и перехват чувствительного ввода.
  // EN: Module 4. Page signal collection and sensitive-input interception.

  // Нижний banner удалён: для чувствительного ввода на рискованной странице используем только full-screen блокировку.
  const showSensitiveWarning = (hintType = "field") => {
    if (state.active || pageRiskVerdict === "trusted") return;
    console.info("CorgPhish sensitive guard debug", {
      stage: "showSensitiveWarning",
      hintType,
      verdict: pageRiskVerdict,
      blockOnUntrustedEnabled,
      temporarilyAllowedPage,
      href: window.location.href
    });
    if (!blockOnUntrustedEnabled || temporarilyAllowedPage) {
      return;
    }
    console.info("CorgPhish form guard debug", {
      source: "sensitive-warning-escalated",
      hintType,
      verdict: pageRiskVerdict,
      blockOnUntrustedEnabled,
      temporarilyAllowedPage,
      href: window.location.href
    });
    redirectToBlockedPage("guardForm", {
      domain: hostname,
      url: window.location.href
    });
  };

  const isSensitiveInput = (element) => {
    if (!element || !(element instanceof HTMLElement)) return false;
    const input = element.closest("input, textarea");
    if (!input) return false;
    const type = (input.getAttribute("type") || input.type || "").toLowerCase();
    const autocomplete = (input.getAttribute("autocomplete") || "").toLowerCase();
    const descriptor = `${input.name || ""} ${input.id || ""} ${input.placeholder || ""} ${autocomplete}`;
    if (type === "password") return true;
    if (["email", "tel"].includes(type)) return true;
    if (/(one-time-code|cc-|current-password|new-password)/.test(autocomplete)) return true;
    return SENSITIVE_FIELD_RE.test(descriptor);
  };

  const detectSensitiveText = (text = "") => {
    if (!text) return false;
    const sample = String(text).trim();
    if (!sample) return false;
    if (sample.length >= 12 && SENSITIVE_DATA_RE.card.test(sample)) return true;
    if (SENSITIVE_DATA_RE.email.test(sample)) return true;
    if (SENSITIVE_DATA_RE.phone.test(sample)) return true;
    if (SENSITIVE_DATA_RE.otp.test(sample) && /\b(code|otp|sms|код|смс)\b/i.test(sample)) return true;
    return false;
  };

  const setupSensitiveDataGuard = () => {
    sensitiveGuardTeardown?.();
    const onInput = (event) => {
      if (pageRiskVerdict === "trusted") return;
      const target = event.target;
      if (!isSensitiveInput(target)) return;
      const value = target?.value;
      if (!value || String(value).trim().length < 2) return;
      showSensitiveWarning("field");
    };
    const onPaste = (event) => {
      if (pageRiskVerdict === "trusted") return;
      const target = event.target;
      if (!isSensitiveInput(target)) return;
      const text = event.clipboardData?.getData("text") || "";
      if (!detectSensitiveText(text)) return;
      showSensitiveWarning("paste");
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("paste", onPaste, true);
    sensitiveGuardTeardown = () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("paste", onPaste, true);
    };
  };

  const runtimeSettingsQuery = Object.fromEntries(
    Object.keys(SETTINGS_DEFAULTS).map((key) => [key, undefined])
  );

  const pickRuntimeSettings = (source = {}) =>
    Object.fromEntries(
      Object.keys(SETTINGS_DEFAULTS)
        .filter(
          (key) =>
            Object.prototype.hasOwnProperty.call(source || {}, key) && source[key] !== undefined
        )
        .map((key) => [key, source[key]])
    );

  const loadSyncSettings = () =>
    new Promise((resolve) => {
      Promise.all([
        safeStorageGet("local", runtimeSettingsQuery),
        safeStorageGet("sync", runtimeSettingsQuery)
      ]).then(
        ([localSettings, syncSettings]) => {
          const merged = {
            ...SETTINGS_DEFAULTS,
            ...pickRuntimeSettings(syncSettings),
            ...pickRuntimeSettings(localSettings)
          };
          console.info("CorgPhish settings debug", {
            stage: "content-loadSyncSettings",
            syncBlockOnUntrusted: syncSettings.blockOnUntrusted,
            localBlockOnUntrusted: localSettings.blockOnUntrusted,
            resolvedBlockOnUntrusted: merged.blockOnUntrusted,
            href: window.location.href
          });
          resolve(merged);
        }
      );
    });

  const rememberLinkTitle = (link) => {
    if (!link) return;
    if (link.dataset.corgphishTitle !== undefined) return;
    const current = link.getAttribute("title");
    link.dataset.corgphishTitle = current ?? "";
  };

  const restoreLinkTitle = (link) => {
    if (!link) return;
    if (link.dataset.corgphishTitle === undefined) return;
    const original = link.dataset.corgphishTitle;
    if (original) {
      link.setAttribute("title", original);
    } else {
      link.removeAttribute("title");
    }
    delete link.dataset.corgphishTitle;
  };

  const ensureLinkStyles = () => {
    if (document.getElementById("corgphish-link-style")) return;
    const style = document.createElement("style");
    style.id = "corgphish-link-style";
    style.textContent = `
      .corgphish-link {
        position: relative;
        border-radius: 4px;
        transition: box-shadow 0.15s ease, background 0.15s ease;
      }
      .corgphish-link--suspicious {
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.8);
        background: rgba(59, 130, 246, 0.12);
      }
      .corgphish-link--phishing,
      .corgphish-link--blacklisted {
        box-shadow: 0 0 0 2px rgba(214, 90, 90, 0.9);
        background: rgba(214, 90, 90, 0.12);
      }
      .corgphish-link--suspicious::after,
      .corgphish-link--phishing::after,
      .corgphish-link--blacklisted::after {
        content: "⚠";
        position: absolute;
        top: -10px;
        right: -10px;
        font-size: 12px;
        background: #fff;
        color: #d65a5a;
        border-radius: 999px;
        padding: 1px 4px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      }
      .corgphish-link--suspicious::after {
        color: #2563eb;
      }
    `;
    document.head.appendChild(style);
  };

  const detectBrandMismatch = async (hostname) => {
    const trustedList = await loadTrustedDomains();
    if (!trustedList.length) return null;
    const currentBase = getRegistrableDomain(hostname);
    const currentLabel = getRegistrableLabel(hostname);
    const tokenToDomain = new Map();
    trustedList.forEach((domain) => {
      const token = getRegistrableLabel(domain);
      if (token && token.length >= 3 && !tokenToDomain.has(token)) {
        tokenToDomain.set(token, getRegistrableDomain(domain));
      }
    });
    const samples = getTextSamples();
    const tokens = samples.flatMap((text) => extractTokens(text));
    for (const token of tokens) {
      const brandDomain = tokenToDomain.get(token);
      if (!brandDomain) continue;
      if (token === currentLabel) continue;
      if (currentBase === brandDomain || hostname.endsWith(`.${brandDomain}`)) continue;
      return { token, domain: brandDomain };
    }
    return null;
  };

  const detectFormRisk = (hostname) => {
    const forms = Array.from(document.forms || []);
    if (!forms.length) return null;
    const currentBase = getRegistrableDomain(hostname);
    for (const form of forms) {
      const actionAttr = form.getAttribute("action");
      let actionUrl = null;
      try {
        actionUrl = actionAttr ? new URL(actionAttr, window.location.href) : new URL(window.location.href);
      } catch (error) {
        continue;
      }
      const actionHost = normalizeHost(actionUrl.hostname || "");
      if (!actionHost) continue;
      const actionBase = getRegistrableDomain(actionHost);
      const isExternal = Boolean(currentBase && actionBase && currentBase !== actionBase);
      const isIp = isIpDomain(actionHost);
      const isHttpDowngrade =
        window.location.protocol === "https:" && actionUrl.protocol === "http:";
      const hasSensitive = Array.from(form.elements || []).some((el) => {
        const type = (el.getAttribute?.("type") || "").toLowerCase();
        const name = `${el.name || ""} ${el.id || ""} ${el.autocomplete || ""}`.toLowerCase();
        if (type === "password") return true;
        return /(otp|code|sms|token|pin|pass)/.test(name);
      });
      if (isIp || isExternal || isHttpDowngrade) {
        const reason = isIp ? "ip" : isHttpDowngrade ? "http" : "external";
        return { actionHost, reason, hasSensitive };
      }
    }
    return null;
  };

  const waitForDomReady = () =>
    new Promise((resolve) => {
      if (document.readyState === "interactive" || document.readyState === "complete") {
        resolve();
        return;
      }
      window.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    });

  const collectPageSignals = async ({ waitForDom = false } = {}) => {
    if (waitForDom) {
      await waitForDomReady();
    }
    const brand = await detectBrandMismatch(hostname);
    const form = detectFormRisk(hostname);
    const content = detectContentRisk(hostname, form, brand);
    return { brand, form, content };
  };
