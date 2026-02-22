// Контент-скрипт: реагирует на вердикт ML/ЧС, блокирует страницу, формы и загрузки.
(() => {
  const BLACKLIST_KEY = "customBlockedDomains";
  const TEMP_ALLOW_KEY = "tempAllowDomains";
  const EXIT_ALERT = "Вы вышли с потенциально опасного сайта";
  const FORM_ALERT = "Не вводите личные данные: сайт может быть фишинговым.";
  const DOWNLOAD_ALERT = "Загрузка файлов заблокирована: сайт может быть фишинговым.";
  const BLOCKED_FILE_EXT = /\.((exe)|(msi)|(scr)|(zip)|(rar)|(7z)|(tar)|(gz)|(dmg)|(apk))$/i;
  const BRAND_COLORS = {
    bg: "#FFF8F1",
    surface: "#FFFFFF",
    surfaceAlt: "#F7EFE6",
    border: "#E7D7C7",
    text: "#2B2A28",
    muted: "#6B645C",
    accent: "#F29A4A",
    accentStrong: "#D9772C",
    bad: "#D65A5A",
    overlay: "rgba(43, 42, 40, 0.45)"
  };
  const FREE_HOST_SUFFIXES = [
    "wixsite.com",
    "wordpress.com",
    "blogspot.com",
    "tilda.ws",
    "site123.me",
    "ucoz.ru",
    "ucoz.com",
    "weebly.com",
    "webflow.io",
    "github.io",
    "pages.dev",
    "netlify.app",
    "vercel.app"
  ];
  const CONTENT_PATTERNS = {
    login:
      /(login|sign in|log in|password|passcode|account|verify|verification|confirm|auth|authorize|secure|security|вход|войти|логин|парол|аккаунт|подтверд|провер|авторизац|верифиц)/i,
    payment:
      /(payment|pay|card|bank|wallet|invoice|transfer|pin|cvv|cvc|iban|crypto|оплат|платеж|карта|банк|кошелек|счет|перевод|смс|код)/i,
    urgent:
      /(urgent|immediately|suspend|blocked|disable|limited|expire|risk|срочно|немедленно|заблок|огранич|истек|риск|под угрозой)/i
  };
  const LINK_SCAN = {
    maxLinks: 220,
    maxDomains: 50,
    batchSize: 6,
    delayMs: 200,
    cacheTtlMs: 5 * 60 * 1000
  };
  const LINK_HINTS = {
    ru: {
      phishing: "Опасная ссылка: возможный фишинг.",
      suspicious: "Подозрительная ссылка: домен требует проверки.",
      blacklisted: "Опасная ссылка: домен в чёрном списке.",
      "status.suspicious.brand": "Упоминается бренд, но домен другой.",
      "status.suspicious.form": "Форма отправляет данные на другой домен.",
      "status.suspicious.unlisted": "Домен не найден в доверенных списках.",
      "status.suspicious.listMissing": "trusted.json недоступен, проверьте домен вручную.",
      "status.suspicious.strict": "Домен не в списке доверенных.",
      "content.reason.password": "Форма содержит поле пароля.",
      "content.reason.otp": "Запрашивается одноразовый код.",
      "content.reason.card": "Запрошены данные карты.",
      "content.reason.hiddenInputs": "Много скрытых полей.",
      "content.reason.login": "Запрашивается вход или подтверждение.",
      "content.reason.payment": "Запрошены платежные данные.",
      "content.reason.urgent": "Есть признаки срочного требования.",
      "content.reason.externalForm": "Форма отправляет данные на другой домен.",
      "content.reason.insecureForm": "Форма отправляет данные по HTTP.",
      "content.reason.ipForm": "Форма отправляет данные на IP-адрес.",
      "content.reason.freeHost": "Сайт на публичном хостинге.",
      "content.reason.brandMention": "На странице упоминается известный бренд."
    },
    en: {
      phishing: "Dangerous link: possible phishing.",
      suspicious: "Suspicious link: needs verification.",
      blacklisted: "Dangerous link: domain is blacklisted.",
      "status.suspicious.brand": "Brand mentioned, but the domain differs.",
      "status.suspicious.form": "The form submits data to another domain.",
      "status.suspicious.unlisted": "The domain is not in trusted lists.",
      "status.suspicious.listMissing": "trusted.json unavailable, verify manually.",
      "status.suspicious.strict": "The domain is not on the trusted list.",
      "content.reason.password": "The form contains a password field.",
      "content.reason.otp": "One-time code is requested.",
      "content.reason.card": "Card details are requested.",
      "content.reason.hiddenInputs": "Too many hidden fields.",
      "content.reason.login": "Sign-in or confirmation is requested.",
      "content.reason.payment": "Payment details are requested.",
      "content.reason.urgent": "Urgent or threatening language detected.",
      "content.reason.externalForm": "The form submits data to another domain.",
      "content.reason.insecureForm": "The form submits data over HTTP.",
      "content.reason.ipForm": "The form submits data to an IP address.",
      "content.reason.freeHost": "Hosted on a public platform.",
      "content.reason.brandMention": "A known brand is mentioned."
    }
  };
  const SETTINGS_DEFAULTS = {
    linkHighlightEnabled: true
  };
  const REDIRECT_PARAM_KEYS = [
    "url",
    "target",
    "redirect",
    "redirect_url",
    "redirect_uri",
    "redir",
    "redirect_to",
    "return",
    "return_url",
    "next",
    "continue",
    "destination",
    "dest",
    "to",
    "r",
    "u",
    "go"
  ];
  const REDIRECT_ANALYSIS_LIMIT = 6;
  const PRECLICK_CACHE_TTL = 2 * 60 * 1000;
  const SENSITIVE_WARN_COOLDOWN_MS = 12 * 1000;
  const VERDICT_PRIORITY = {
    trusted: 0,
    suspicious: 1,
    phishing: 2,
    blacklisted: 3
  };
  const SENSITIVE_FIELD_RE =
    /(pass|password|pwd|otp|2fa|mfa|token|sms|code|pin|card|cvv|cvc|iban|account|email|phone|login|парол|код|смс|карт|счет|аккаунт|почт|тел)/i;
  const SENSITIVE_DATA_RE = {
    card: /(?:\d[ -]*?){13,19}/,
    email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
    phone: /\+?\d[\d\s()\-]{8,}\d/,
    otp: /\b\d{4,8}\b/
  };
  const SENSITIVE_HINTS = {
    ru: {
      field:
        "Осторожно: сайт не доверенный. Не вводите пароль, код подтверждения и данные карты.",
      paste:
        "Обнаружены признаки чувствительных данных во вставке. Проверьте домен перед отправкой."
    },
    en: {
      field:
        "Caution: this site is not trusted. Avoid entering passwords, OTP codes, and card details.",
      paste:
        "Sensitive data patterns detected in pasted text. Verify the domain before submitting."
    }
  };
  const linkDomainCache = new Map();
  const preClickCache = new Map();
  let linkScanTimer = null;
  let linkHighlightEnabled = SETTINGS_DEFAULTS.linkHighlightEnabled;
  let linkObserver = null;
  let inspectDomainFnPromise = null;
  let pageRiskVerdict = "trusted";
  let sensitiveWarnAt = 0;
  let sensitiveGuardTeardown = () => {};
  const PUBLIC_SUFFIXES = new Set(["co.uk", "ac.uk", "gov.uk", "org.uk", "net.uk"]);
  const TRUSTED_CACHE_TTL = 60 * 1000;
  let trustedCache = { list: null, ts: 0 };

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

  const scheduleLinkScan = () => {
    if (!linkHighlightEnabled) return;
    if (linkScanTimer) return;
    linkScanTimer = setTimeout(() => {
      linkScanTimer = null;
      scanLinkTargets();
    }, 500);
  };

  const startLinkObserver = () => {
    if (linkObserver || !linkHighlightEnabled) return;
    const root = document.documentElement;
    if (!root) return;
    scheduleLinkScan();
    linkObserver = new MutationObserver(() => {
      scheduleLinkScan();
    });
    linkObserver.observe(root, { childList: true, subtree: true });
  };

  const stopLinkObserver = () => {
    if (!linkObserver) return;
    linkObserver.disconnect();
    linkObserver = null;
  };

  const clearLinkHighlights = () => {
    const links = document.querySelectorAll(".corgphish-link");
    links.forEach((link) => {
      link.classList.remove(
        "corgphish-link",
        "corgphish-link--phishing",
        "corgphish-link--blacklisted",
        "corgphish-link--suspicious"
      );
      restoreLinkTitle(link);
      delete link.dataset.corgphishState;
      delete link.dataset.corgphishHref;
    });
    const style = document.getElementById("corgphish-link-style");
    style?.remove?.();
  };

  const applyLinkHighlightSetting = (enabled) => {
    linkHighlightEnabled = Boolean(enabled);
    if (!linkHighlightEnabled) {
      stopLinkObserver();
      clearLinkHighlights();
      return;
    }
    ensureLinkStyles();
    startLinkObserver();
  };

  const markLinkState = (link, state, hint, href) => {
    if (!link) return;
    link.classList.add("corgphish-link");
    link.classList.toggle("corgphish-link--phishing", state === "phishing");
    link.classList.toggle("corgphish-link--blacklisted", state === "blacklisted");
    link.classList.toggle("corgphish-link--suspicious", state === "suspicious");
    if (state === "trusted" || state === "safe") {
      link.classList.remove(
        "corgphish-link--phishing",
        "corgphish-link--blacklisted",
        "corgphish-link--suspicious"
      );
      restoreLinkTitle(link);
    } else if (hint) {
      rememberLinkTitle(link);
      link.title = hint;
    } else {
      restoreLinkTitle(link);
    }
    link.dataset.corgphishState = state;
    if (href) {
      link.dataset.corgphishHref = href;
    }
  };

  const scanLinkTargets = async () => {
    if (!linkHighlightEnabled) return;
    ensureLinkStyles();
    const links = Array.from(document.querySelectorAll("a[href]")).slice(0, LINK_SCAN.maxLinks);
    if (!links.length) return;
    const trustedList = await loadTrustedDomains();
    const whitelist = await loadWhitelist();
    const domainToLinks = new Map();

    const shouldSkip = (href) => {
      if (!href) return true;
      if (/^(javascript|mailto|tel|about|chrome|edge|file|data):/i.test(href)) return true;
      return false;
    };

    links.forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (shouldSkip(href)) return;
      const resolved = (() => {
        try {
          return new URL(href, window.location.href);
        } catch (error) {
          return null;
        }
      })();
      if (!resolved || !/^https?:/i.test(resolved.protocol)) return;
      const domain = normalizeHost(resolved.hostname || "");
      if (!domain) return;
      const resolvedHref = resolved.toString();
      if (link.dataset.corgphishHref === resolvedHref && link.dataset.corgphishState) {
        return;
      }
      const base = getRegistrableBase(domain);
      const currentBase = getRegistrableBase(hostname);
      if (currentBase && base === currentBase) return;

      const match = matchDomain(domain, whitelist) || matchDomain(domain, trustedList);
      if (match) {
        markLinkState(link, "trusted", null, resolvedHref);
        return;
      }

      const cached = linkDomainCache.get(domain);
      if (cached && Date.now() - cached.ts < LINK_SCAN.cacheTtlMs) {
        markLinkState(link, cached.result.verdict, buildLinkHint(cached.result), resolvedHref);
        return;
      }

      if (!domainToLinks.has(domain)) {
        domainToLinks.set(domain, []);
      }
      domainToLinks.get(domain).push({ link, url: resolvedHref });
    });

    const domains = Array.from(domainToLinks.keys()).slice(0, LINK_SCAN.maxDomains);
    if (!domains.length) return;

    const inspectDomainFn = await getInspectDomainFn();
    if (!inspectDomainFn) return;

    let index = 0;
    const processBatch = async () => {
      const batch = domains.slice(index, index + LINK_SCAN.batchSize);
      if (!batch.length) return;
      await Promise.all(
        batch.map(async (domain) => {
          const entries = domainToLinks.get(domain) || [];
          if (!entries.length) return;
          const sampleUrl = entries[0]?.url || domain;
          try {
            const result = await inspectDomainFn(domain, whitelist, sampleUrl, {});
            linkDomainCache.set(domain, { result, ts: Date.now() });
            entries.forEach((entry) =>
              markLinkState(entry.link, result.verdict, buildLinkHint(result), entry.url)
            );
          } catch (error) {
            console.warn("CorgPhish: link scan failed", error);
          }
        })
      );
      index += LINK_SCAN.batchSize;
      if (index < domains.length) {
        setTimeout(processBatch, LINK_SCAN.delayMs);
      }
    };
    processBatch();
  };
  const loadTrustedDomains = () =>
    new Promise((resolve) => {
      if (trustedCache.list && Date.now() - trustedCache.ts < TRUSTED_CACHE_TTL) {
        resolve(trustedCache.list);
        return;
      }
      chrome.runtime.sendMessage({ type: "getTrustedDomains" }, (response) => {
        if (chrome.runtime.lastError) {
          resolve([]);
          return;
        }
        const list = Array.isArray(response?.trusted) ? response.trusted : [];
        const normalized = list.map((domain) => normalizeHost(domain)).filter(isLikelyDomain);
        trustedCache = { list: normalized, ts: Date.now() };
        resolve(normalized);
      });
      setTimeout(() => resolve([]), 800);
    });

  // RU: Читаем чёрный список из local storage.
  // EN: Load blacklist from local storage.
  const loadBlacklist = () =>
    new Promise((resolve) => {
      chrome.storage.local.get({ [BLACKLIST_KEY]: [] }, (result) => {
        const list = Array.isArray(result[BLACKLIST_KEY]) ? result[BLACKLIST_KEY] : [];
        resolve(list.map((d) => normalizeHost(d)).filter(isLikelyDomain));
      });
    });

  // RU: Сохраняем чёрный список.
  // EN: Persist blacklist.
  const saveBlacklist = (domains) =>
    new Promise((resolve) => {
      chrome.storage.local.set({ [BLACKLIST_KEY]: domains }, resolve);
    });

  // RU: Загружаем временные разрешения (домены, разблокированные на N минут).
  // EN: Load temporary allow map (domains unblocked for N minutes).
  const loadTempAllow = () =>
    new Promise((resolve) => {
      chrome.storage.local.get({ [TEMP_ALLOW_KEY]: {} }, (result) => {
        const map = result[TEMP_ALLOW_KEY] && typeof result[TEMP_ALLOW_KEY] === "object" ? result[TEMP_ALLOW_KEY] : {};
        resolve(map);
      });
    });

  // RU: Сохраняем временные разрешения.
  // EN: Persist temporary allow map.
  const saveTempAllow = (map) =>
    new Promise((resolve) => {
      chrome.storage.local.set({ [TEMP_ALLOW_KEY]: map }, resolve);
    });

  // RU: Проверяем, разрешён ли домен временно.
  // EN: Check if domain is temporarily allowed.
  const isTemporarilyAllowed = async (domain) => {
    const map = await loadTempAllow();
    const expiry = Number(map[domain] || 0);
    if (expiry > Date.now()) {
      return true;
    }
    if (expiry) {
      delete map[domain];
      await saveTempAllow(map);
    }
    return false;
  };

  // RU: Разрешаем домен на заданное количество минут.
  // EN: Temporarily allow domain for given minutes.
  const allowTemporarily = async (domain, minutes = 5) => {
    const map = await loadTempAllow();
    map[domain] = Date.now() + minutes * 60 * 1000;
    await saveTempAllow(map);
  };

  // RU: Добавляем домен в чёрный список (если его там нет).
  // EN: Add domain to blacklist if not present.
  const addToBlacklist = async (domain) => {
    const current = await loadBlacklist();
    if (current.includes(domain)) return;
    await saveBlacklist([...current, domain]);
  };

  // RU: Читаем пользовательский whitelist (для автоинспекции на странице).
  // EN: Read user whitelist for on-page auto inspection.
  const loadWhitelist = () =>
    new Promise((resolve) => {
      chrome.storage.local.get({ customTrustedDomains: [] }, (result) => {
        const list = Array.isArray(result.customTrustedDomains) ? result.customTrustedDomains : [];
        resolve(list.map((d) => normalizeHost(d)).filter(Boolean));
      });
    });

  const getRegistrableBase = (domain) => getRegistrableDomain(domain);

  const matchDomain = (domain, list) =>
    list.find((entry) => domain === entry || domain.endsWith(`.${entry}`)) || null;

  const getLinkLanguage = () =>
    navigator?.language?.toLowerCase().startsWith("ru") ? "ru" : "en";

  const buildLinkHint = (result) => {
    const lang = getLinkLanguage();
    const dict = LINK_HINTS[lang] || LINK_HINTS.ru;
    if (result.verdict === "blacklisted") return dict.blacklisted;
    if (result.suspicionKey && dict[result.suspicionKey]) {
      return dict[result.suspicionKey];
    }
    if (result.verdict === "phishing") return dict.phishing;
    return dict.suspicious;
  };

  const getSensitiveHints = () => {
    const lang = getLinkLanguage();
    return SENSITIVE_HINTS[lang] || SENSITIVE_HINTS.ru;
  };

  const getInspectDomainFn = async () => {
    if (!inspectDomainFnPromise) {
      inspectDomainFnPromise = import(chrome.runtime.getURL("popup/inspection.js"))
        .then((module) => module?.inspectDomain || null)
        .catch((error) => {
          inspectDomainFnPromise = null;
          console.warn("CorgPhish: inspection import failed", error);
          return null;
        });
    }
    return inspectDomainFnPromise;
  };

  const parseHttpUrl = (value, base = window.location.href) => {
    if (!value) return null;
    const variants = [String(value).trim()];
    try {
      const decoded = decodeURIComponent(variants[0]);
      if (decoded && decoded !== variants[0]) variants.push(decoded.trim());
    } catch (error) {
      // ignore malformed URI
    }
    for (const candidate of variants) {
      if (!candidate) continue;
      let url = null;
      try {
        url = new URL(candidate, base);
      } catch (error) {
        if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#]|$)/i.test(candidate)) {
          try {
            url = new URL(`https://${candidate}`);
          } catch (nestedError) {
            url = null;
          }
        }
      }
      if (!url) continue;
      if (!/^https?:$/i.test(url.protocol)) continue;
      return url;
    }
    return null;
  };

  const extractNextRedirectUrl = (url) => {
    for (const key of REDIRECT_PARAM_KEYS) {
      const raw = url.searchParams.get(key);
      const parsed = parseHttpUrl(raw, url.toString());
      if (parsed && parsed.toString() !== url.toString()) {
        return parsed;
      }
    }
    if (url.hash && url.hash.length > 1) {
      const hashCandidate = url.hash.slice(1);
      const parsed = parseHttpUrl(hashCandidate, url.toString());
      if (parsed && parsed.toString() !== url.toString()) {
        return parsed;
      }
    }
    return null;
  };

  const analyzeRedirectChain = (rawUrl) => {
    const first = parseHttpUrl(rawUrl, window.location.href);
    if (!first) return [];
    const chain = [first];
    const seen = new Set([first.toString()]);
    let current = first;
    for (let i = 0; i < REDIRECT_ANALYSIS_LIMIT; i += 1) {
      const next = extractNextRedirectUrl(current);
      if (!next) break;
      const serialized = next.toString();
      if (seen.has(serialized)) break;
      seen.add(serialized);
      chain.push(next);
      current = next;
    }
    return chain;
  };

  const isRiskVerdict = (verdict = "") => verdict === "phishing" || verdict === "blacklisted";

  const pickWorseVerdict = (left = "trusted", right = "trusted") =>
    (VERDICT_PRIORITY[right] || 0) > (VERDICT_PRIORITY[left] || 0) ? right : left;

  const evaluateNavigationRisk = async (targetUrl) => {
    const normalizedTarget = targetUrl.toString();
    const cached = preClickCache.get(normalizedTarget);
    if (cached && Date.now() - cached.ts < PRECLICK_CACHE_TTL) {
      return cached.result;
    }

    const chain = analyzeRedirectChain(normalizedTarget);
    if (!chain.length) {
      const fallback = { verdict: "trusted", chainHosts: [], riskyHost: "", riskyResult: null };
      preClickCache.set(normalizedTarget, { ts: Date.now(), result: fallback });
      return fallback;
    }

    const inspectDomain = await getInspectDomainFn();
    if (!inspectDomain) {
      const fallback = { verdict: "trusted", chainHosts: [], riskyHost: "", riskyResult: null };
      preClickCache.set(normalizedTarget, { ts: Date.now(), result: fallback });
      return fallback;
    }

    const whitelist = await loadWhitelist();
    let verdict = "trusted";
    let riskyHost = "";
    let riskyResult = null;
    const chainHosts = [];

    for (const hop of chain) {
      const host = normalizeHost(hop.hostname || "");
      if (!host) continue;
      chainHosts.push(host);
      if (await isTemporarilyAllowed(host)) {
        continue;
      }
      try {
        const result = await inspectDomain(host, whitelist, hop.toString(), {});
        verdict = pickWorseVerdict(verdict, result.verdict || "trusted");
        if (!riskyResult || isRiskVerdict(result.verdict) || result.verdict === "suspicious") {
          riskyHost = host;
          riskyResult = result;
        }
        if (isRiskVerdict(result.verdict)) {
          break;
        }
      } catch (error) {
        console.warn("CorgPhish: pre-click inspection failed", error);
      }
    }

    const analysis = { verdict, chainHosts, riskyHost, riskyResult };
    preClickCache.set(normalizedTarget, { ts: Date.now(), result: analysis });
    return analysis;
  };

  const createSensitiveBanner = () => {
    const existing = document.getElementById("corgphish-sensitive-banner");
    if (existing) return existing;
    const banner = document.createElement("div");
    banner.id = "corgphish-sensitive-banner";
    banner.style.position = "fixed";
    banner.style.right = "16px";
    banner.style.bottom = "16px";
    banner.style.zIndex = "2147483646";
    banner.style.maxWidth = "360px";
    banner.style.padding = "12px 14px";
    banner.style.borderRadius = "12px";
    banner.style.background = "rgba(214, 90, 90, 0.96)";
    banner.style.color = "#fff";
    banner.style.fontFamily = '"Nunito","Manrope","Inter",system-ui,-apple-system,sans-serif';
    banner.style.fontSize = "13px";
    banner.style.lineHeight = "1.35";
    banner.style.fontWeight = "700";
    banner.style.boxShadow = "0 14px 30px rgba(0,0,0,0.26)";
    banner.style.opacity = "0";
    banner.style.transform = "translateY(8px)";
    banner.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    banner.style.pointerEvents = "none";
    document.documentElement.appendChild(banner);
    return banner;
  };

  const showSensitiveWarning = (hintType = "field") => {
    if (state.active || pageRiskVerdict === "trusted") return;
    const now = Date.now();
    if (now - sensitiveWarnAt < SENSITIVE_WARN_COOLDOWN_MS) return;
    sensitiveWarnAt = now;
    const hints = getSensitiveHints();
    const banner = createSensitiveBanner();
    banner.textContent = hints[hintType] || hints.field;
    banner.style.opacity = "1";
    banner.style.transform = "translateY(0)";
    clearTimeout(showSensitiveWarning.timer);
    showSensitiveWarning.timer = setTimeout(() => {
      banner.style.opacity = "0";
      banner.style.transform = "translateY(8px)";
    }, 3800);
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

  const loadSyncSettings = () =>
    new Promise((resolve) => {
      chrome.storage.sync.get(SETTINGS_DEFAULTS, (result) => {
        resolve({ ...SETTINGS_DEFAULTS, ...result });
      });
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

  // RU: Создаём блокирующий оверлей с кнопками действий.
  // EN: Create blocking overlay with action buttons.
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

  // RU: Блокируем формы и скачивания, пока блокировка активна.
  // EN: Block forms and downloads while blocking is active.
  const blockInteractions = (state) => {
    const onSubmit = (event) => {
      if (!state.active) return;
      event.preventDefault();
      event.stopPropagation();
      alert(FORM_ALERT);
    };
    const onClick = (event) => {
      if (!state.active) return;
      const target = event.target;
      const link = target?.closest?.("a");
      const href = link?.getAttribute?.("href") || "";
      const downloadLink =
        link && (link.hasAttribute("download") || BLOCKED_FILE_EXT.test(href));
      if (downloadLink) {
        event.preventDefault();
        event.stopPropagation();
        alert(DOWNLOAD_ALERT);
      }
    };
    const onBeforeRequest = (event) => {
      if (!state.active) return;
      const url = event?.target?.url || "";
      if (BLOCKED_FILE_EXT.test(url)) {
        event.preventDefault?.();
        alert(DOWNLOAD_ALERT);
      }
    };
    const onFileInput = (event) => {
      if (!state.active) return;
      const input = event.target?.closest?.('input[type="file"]');
      if (input) {
        event.preventDefault();
        event.stopPropagation();
        input.value = "";
        alert(DOWNLOAD_ALERT);
      }
    };

    const nativeSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function patchedSubmit(...args) {
      if (state.active) {
        alert(FORM_ALERT);
        return;
      }
      return nativeSubmit.apply(this, args);
    };
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("beforeload", onBeforeRequest, true);
    document.addEventListener("change", onFileInput, true);
    document.addEventListener("click", onFileInput, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("beforeload", onBeforeRequest, true);
      document.removeEventListener("change", onFileInput, true);
      document.removeEventListener("click", onFileInput, true);
      HTMLFormElement.prototype.submit = nativeSubmit;
    };
  };

  const hostname = resolveHostname(window.location.href);
  if (!hostname || !/^https?:/i.test(window.location.href)) return;

  const state = { active: false, domain: hostname };
  let teardown = () => {};
  const setPageRiskVerdict = (verdict = "trusted") => {
    pageRiskVerdict = verdict || "trusted";
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
    const targetUrl = `${chrome.runtime.getURL("blocked.html")}?${params.toString()}`;
    try {
      if (document.documentElement) {
        document.documentElement.style.visibility = "hidden";
      }
    } catch (error) {
      // ignore
    }
    if (window.location.href !== targetUrl) {
      window.location.replace(targetUrl);
    }
  };

  // RU: Блокируем страницу и перенаправляем на экран блокировки.
  // EN: Block the page and redirect to the warning screen.
  const activateBlock = async (reason = "phishing", details = {}) => {
    if (state.active) return;
    state.active = true;
    redirectToBlockedPage(reason, details);
    teardown = blockInteractions(state);
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
    setupSensitiveDataGuard();
    const settings = await loadSyncSettings();
    applyLinkHighlightSetting(settings.linkHighlightEnabled);
    if (await isTemporarilyAllowed(hostname)) {
      setPageRiskVerdict("trusted");
      return;
    }
    const blacklist = await loadBlacklist();
    if (blacklist.includes(hostname)) {
      setPageRiskVerdict("blacklisted");
      activateBlock("blacklist");
      return;
    }
    try {
      const inspectDomain = await getInspectDomainFn();
      if (!inspectDomain) return;
      const whitelist = await loadWhitelist();
      const initial = await inspectDomain(hostname, whitelist, window.location.href, {});
      setPageRiskVerdict(initial.verdict);
      if (await isTemporarilyAllowed(hostname)) {
        setPageRiskVerdict("trusted");
        return;
      }
      if (initial.verdict === "phishing" || initial.verdict === "blacklisted") {
        activateBlock(initial.verdict === "blacklisted" ? "blacklist" : "phishing", {
          officialDomain: initial.officialDomain
        });
        return;
      }
      const signals = await collectPageSignals({ waitForDom: true });
      const result = await inspectDomain(hostname, whitelist, window.location.href, signals);
      setPageRiskVerdict(result.verdict);
      if (await isTemporarilyAllowed(hostname)) {
        setPageRiskVerdict("trusted");
        return;
      }
      if (result.verdict === "phishing" || result.verdict === "blacklisted") {
        activateBlock(result.verdict === "blacklisted" ? "blacklist" : "phishing", {
          officialDomain: result.officialDomain
        });
      }
    } catch (error) {
      console.warn("CorgPhish: auto inspect failed in content", error);
    } finally {
      startLinkObserver();
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
      isTemporarilyAllowed(hostname).then((allowed) => {
        if (!allowed) {
          setPageRiskVerdict("phishing");
          activateBlock("phishing", { officialDomain: message.officialDomain });
        }
      });
      sendResponse?.({ ok: true });
      return true;
    }
    return false;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && Object.prototype.hasOwnProperty.call(changes, "linkHighlightEnabled")) {
      const nextValue = changes.linkHighlightEnabled?.newValue;
      applyLinkHighlightSetting(
        nextValue === undefined ? SETTINGS_DEFAULTS.linkHighlightEnabled : nextValue
      );
    }
    if (area === "local" || area === "sync") {
      preClickCache.clear();
      linkDomainCache.clear();
    }
  });

  init();
})();
