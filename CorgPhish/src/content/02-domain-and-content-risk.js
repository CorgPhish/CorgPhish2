  // RU: Модуль 2. Доменная аналитика, похожесть на бренды и оценка риска по DOM-сигналам.
  // EN: Module 2. Domain analytics, brand similarity and DOM-based risk scoring.
  // RU: Нормализуем хостнейм (URL/пути → домен, без www/точек, в нижний регистр).
  // EN: Normalize hostname (URL/paths → domain, strip www/trailing dot, lowercase).
  const normalizeHost = (hostname = "") => {
    const trimmed = hostname.trim();
    if (!trimmed) return "";
    try {
      const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
      return url.hostname.replace(/^www\./i, "").replace(/\.$/, "").toLowerCase();
    } catch (error) {
      return trimmed.replace(/^www\./i, "").replace(/\.$/, "").toLowerCase();
    }
  };

  // RU: Безопасно получаем hostname из URL или строки.
  // EN: Safely extract hostname from URL or plain string.
  const resolveHostname = (input = "") => normalizeHost(input);
  const isIpDomain = (domain = "") => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(domain);
  const isLikelyDomain = (domain = "") => {
    const normalized = normalizeHost(domain);
    if (!normalized) return false;
    if (isIpDomain(normalized)) return false;
    const labels = normalized.split(".").filter(Boolean);
    if (labels.length < 2) return false;
    const tld = labels[labels.length - 1];
    if (tld.length < 2 || tld.length > 24) return false;
    if (!/^[a-z0-9-]+$/i.test(tld)) return false;
    return labels.every(
      (label) =>
        /^[a-z0-9-]+$/i.test(label) && !label.startsWith("-") && !label.endsWith("-")
    );
  };
  const getRegistrableDomain = (domain = "") => {
    const labels = normalizeHost(domain).split(".").filter(Boolean);
    if (labels.length < 2) return normalizeHost(domain);
    const tail = labels.slice(-2).join(".");
    const index = PUBLIC_SUFFIXES.has(tail) && labels.length >= 3 ? labels.length - 3 : labels.length - 2;
    const base = labels.slice(index).join(".");
    return base;
  };
  const getRegistrableLabel = (domain = "") => {
    const labels = normalizeHost(domain).split(".").filter(Boolean);
    if (labels.length < 2) return "";
    const tail = labels.slice(-2).join(".");
    const index = PUBLIC_SUFFIXES.has(tail) && labels.length >= 3 ? labels.length - 3 : labels.length - 2;
    return labels[index] || "";
  };
  const extractTokens = (text = "") => {
    const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) || [];
    const seen = new Set();
    const tokens = [];
    matches.forEach((token) => {
      if (!seen.has(token)) {
        seen.add(token);
        tokens.push(token);
      }
    });
    return tokens;
  };
  const getTextSamples = () => {
    const samples = [];
    if (document.title) samples.push(document.title);
    const metaNames = [
      'meta[property="og:site_name"]',
      'meta[property="og:title"]',
      'meta[name="application-name"]',
      'meta[name="apple-mobile-web-app-title"]',
      'meta[name="twitter:title"]'
    ];
    metaNames.forEach((selector) => {
      const node = document.querySelector(selector);
      if (node?.content) samples.push(node.content);
    });
    const headings = Array.from(document.querySelectorAll("h1, h2")).slice(0, 3);
    headings.forEach((node) => {
      if (node?.textContent) samples.push(node.textContent);
    });
    const buttons = Array.from(document.querySelectorAll("button")).slice(0, 5);
    buttons.forEach((node) => {
      if (node?.textContent) samples.push(node.textContent);
    });
    const labels = Array.from(document.querySelectorAll("label")).slice(0, 5);
    labels.forEach((node) => {
      if (node?.textContent) samples.push(node.textContent);
    });
    const inputs = Array.from(document.querySelectorAll("input, textarea")).slice(0, 8);
    inputs.forEach((node) => {
      if (node?.placeholder) samples.push(node.placeholder);
      if (node?.getAttribute?.("aria-label")) samples.push(node.getAttribute("aria-label"));
    });
    return samples;
  };

  const analyzeFormInputs = () => {
    const forms = Array.from(document.forms || []).slice(0, 5);
    let passwordField = false;
    let otpField = false;
    let cardField = false;
    let hiddenCount = 0;
    forms.forEach((form) => {
      const elements = Array.from(form.elements || []).slice(0, 40);
      elements.forEach((el) => {
        if (!el) return;
        const type = (el.getAttribute?.("type") || el.type || "").toLowerCase();
        const name = `${el.name || ""} ${el.id || ""} ${el.autocomplete || ""} ${el.placeholder || ""}`.toLowerCase();
        if (type === "hidden") hiddenCount += 1;
        if (type === "password" || /passw|парол/.test(name)) passwordField = true;
        if (/otp|2fa|mfa|code|sms|token|подтверд|код|смс/.test(name)) otpField = true;
        if (/card|cvc|cvv|pan|iban|карта|счет|сч[её]т|expiry|exp/.test(name)) cardField = true;
      });
    });
    return { passwordField, otpField, cardField, hiddenCount };
  };

  const detectContentRisk = (hostname, formRisk, brandSignal) => {
    const samples = getTextSamples();
    const text = samples.join(" ").toLowerCase();
    const formInputs = analyzeFormInputs();
    const isFreeHost = FREE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
    const reasons = [];
    const scored = [];
    const add = (weight, key) => {
      if (!reasons.includes(key)) {
        reasons.push(key);
        scored.push({ key, weight });
      }
    };

    if (formInputs.passwordField) add(2.0, "content.reason.password");
    if (formInputs.otpField) add(2.0, "content.reason.otp");
    if (formInputs.cardField) add(2.0, "content.reason.card");
    if (formInputs.hiddenCount >= 3) add(0.5, "content.reason.hiddenInputs");
    if (CONTENT_PATTERNS.login.test(text)) add(1.0, "content.reason.login");
    if (CONTENT_PATTERNS.payment.test(text)) add(1.5, "content.reason.payment");
    if (CONTENT_PATTERNS.urgent.test(text)) add(1.0, "content.reason.urgent");
    if (formRisk?.reason === "external") add(1.5, "content.reason.externalForm");
    if (formRisk?.reason === "http") add(2.0, "content.reason.insecureForm");
    if (formRisk?.reason === "ip") add(2.5, "content.reason.ipForm");
    if (brandSignal?.domain) add(2.0, "content.reason.brandMention");
    if (
      isFreeHost &&
      (formInputs.passwordField || formInputs.cardField || CONTENT_PATTERNS.login.test(text))
    ) {
      add(1.5, "content.reason.freeHost");
    }

    const score = scored.reduce((sum, item) => sum + item.weight, 0);
    const level = score >= 4 ? "high" : score >= 2 ? "medium" : "low";
    if (!reasons.length) {
      return null;
    }
    const primaryReason =
      scored.sort((a, b) => b.weight - a.weight)[0]?.key || reasons[0];
    return { score, level, reasons, primaryReason };
  };
