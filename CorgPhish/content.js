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
    return samples;
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
  let overlayRef = null;

  // RU: Включаем блокировку страницы (оверлей + ограничения).
  // EN: Enable page blocking (overlay + restrictions).
  const activateBlock = async (reason = "phishing") => {
    if (state.active) return;
    state.active = true;
    teardown = blockInteractions(state);
    const overlay = createOverlay(
      hostname,
      () => {
        alert(EXIT_ALERT);
        if (history.length > 1) {
          history.back();
        } else {
          chrome.runtime.sendMessage({ type: "closeTab" });
        }
      },
      async () => {
        await addToBlacklist(hostname);
        chrome.runtime.sendMessage({ type: "closeTab" });
      },
      async () => {
        // Разрешаем на 5 минут, убираем оверлей, но блокировка форм/скачивания остаётся активной на этой вкладке.
        await allowTemporarily(hostname, 5);
        if (overlay.overlay) overlay.overlay.remove();
      }
    );
    overlayRef = overlay;
    if (reason === "blacklist") {
      overlay.hint.textContent = "Домен в вашем чёрном списке. Страница заблокирована.";
    } else if (reason === "phishing") {
      overlay.hint.textContent =
        "Модель подтвердила высокий риск. Данные, формы и загрузки заблокированы.";
    }
  };

  // RU: Инициализация: автоинспекция, учёт временных разрешений и ЧС.
  // EN: Init: auto inspection, temp allow handling, blacklist check.
  const init = async () => {
    if (await isTemporarilyAllowed(hostname)) {
      return;
    }
    const blacklist = await loadBlacklist();
    if (blacklist.includes(hostname)) {
      activateBlock("blacklist");
      return;
    }
    try {
      const { inspectDomain } = await import(chrome.runtime.getURL("popup/inspection.js"));
      const whitelist = await loadWhitelist();
      const result = await inspectDomain(hostname, whitelist, window.location.href);
      if (await isTemporarilyAllowed(hostname)) {
        return;
      }
      if (result.verdict === "phishing" || result.verdict === "blacklisted") {
        activateBlock(result.verdict === "blacklisted" ? "blacklist" : "phishing");
      }
    } catch (error) {
      console.warn("CorgPhish: auto inspect failed in content", error);
    }
  };

  // RU: Слушаем сообщения о фишинге от попапа и блокируем сразу.
  // EN: Listen for phishing messages from popup and block instantly.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "getPageSignals") {
      (async () => {
        const brand = await detectBrandMismatch(hostname);
        const form = detectFormRisk(hostname);
        sendResponse?.({ ok: true, signals: { brand, form } });
      })();
      return true;
    }
    if (message?.type === "phishingBlock" && normalizeHost(message.domain) === hostname) {
      isTemporarilyAllowed(hostname).then((allowed) => {
        if (!allowed) {
          activateBlock("phishing");
        }
      });
      sendResponse?.({ ok: true });
      return true;
    }
    return false;
  });

  init();
})();
