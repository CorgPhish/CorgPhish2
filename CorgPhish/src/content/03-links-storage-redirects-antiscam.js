  // RU: Модуль 3. До-кликовая защита: ссылки, редиректы, local storage и anti-scam баннеры.
  // EN: Module 3. Pre-click protection: links, redirects, local storage and anti-scam banners.
  // Частые DOM-изменения группируем, чтобы не сканировать страницу на каждый mutation.
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

  // Сканируем ограниченное число ссылок и проверяем их батчами, чтобы не подвесить страницу.
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
      safeRuntimeSendMessage({ type: "getTrustedDomains" }).then((response) => {
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
      safeStorageGet("local", { [BLACKLIST_KEY]: [] }).then((result) => {
        const list = Array.isArray(result[BLACKLIST_KEY]) ? result[BLACKLIST_KEY] : [];
        resolve(list.map((d) => normalizeHost(d)).filter(isLikelyDomain));
      });
    });

  // RU: Сохраняем чёрный список.
  // EN: Persist blacklist.
  const saveBlacklist = (domains) =>
    new Promise((resolve) => {
      safeStorageSet("local", { [BLACKLIST_KEY]: domains }).then(resolve);
    });

  // RU: Загружаем временные разрешения (домены, разблокированные на N минут).
  // EN: Load temporary allow map (domains unblocked for N minutes).
  const loadTempAllow = () =>
    new Promise((resolve) => {
      safeStorageGet("local", { [TEMP_ALLOW_KEY]: {} }).then((result) => {
        const map = result[TEMP_ALLOW_KEY] && typeof result[TEMP_ALLOW_KEY] === "object" ? result[TEMP_ALLOW_KEY] : {};
        resolve(map);
      });
    });

  // RU: Сохраняем временные разрешения.
  // EN: Persist temporary allow map.
  const saveTempAllow = (map) =>
    new Promise((resolve) => {
      safeStorageSet("local", { [TEMP_ALLOW_KEY]: map }).then(resolve);
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
      safeStorageGet("local", { customTrustedDomains: [] }).then((result) => {
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

  const getAntiScamDict = () => {
    const lang = getLinkLanguage();
    return ANTI_SCAM_I18N[lang] || ANTI_SCAM_I18N.ru;
  };

  const detectAntiScamSignals = () => {
    const baseSamples = getTextSamples();
    const paragraphSamples = Array.from(document.querySelectorAll("p, [role='alert'], [class*='alert' i], [class*='warning' i]"))
      .slice(0, 6)
      .map((node) => node?.textContent || "")
      .filter(Boolean)
      .map((text) => text.trim().slice(0, 220));
    const mergedText = [...baseSamples, ...paragraphSamples].join(" ").toLowerCase();
    if (!mergedText.trim()) {
      return { score: 0, reasons: [], shouldWarn: false, signature: "" };
    }

    const reasons = Object.entries(ANTI_SCAM_PATTERNS)
      .filter(([, pattern]) => pattern.test(mergedText))
      .map(([key]) => key);

    let score = reasons.length;
    if (reasons.includes("pressure") && reasons.includes("credentials")) score += 1;
    if (reasons.includes("pressure") && reasons.includes("payment")) score += 1;
    if (reasons.includes("messenger") && reasons.includes("authority")) score += 1;
    if (reasons.includes("messenger") && (reasons.includes("credentials") || reasons.includes("payment"))) score += 1;
    if (reasons.includes("lure") && (reasons.includes("credentials") || reasons.includes("payment"))) score += 1;

    const trustedPage = pageRiskVerdict === "trusted";
    const hasSensitiveAsk = reasons.includes("credentials") || reasons.includes("payment");
    const hasEscalation = reasons.includes("messenger") || reasons.includes("lure");
    const hasPressureAuthority = reasons.includes("pressure") && reasons.includes("authority");
    const shouldWarn = trustedPage
      ? score >= 5 && hasSensitiveAsk && (hasEscalation || hasPressureAuthority)
      : score >= 3 && (hasSensitiveAsk || hasEscalation);
    const signature = `${score}:${reasons.sort().join("|")}:${trustedPage ? "t" : "r"}`;
    return { score, reasons, shouldWarn, signature };
  };

  const clearAntiScamBanner = () => {
    const existing = document.getElementById("corgphish-anti-scam-banner");
    existing?.remove?.();
    lastAntiScamSignature = "";
  };

  const showAntiScamBanner = (signal) => {
    if (!antiScamBannerEnabled || antiScamDismissed || !signal?.shouldWarn || state.active) {
      clearAntiScamBanner();
      return;
    }
    if (lastAntiScamSignature === signal.signature) return;
    lastAntiScamSignature = signal.signature;
    const dict = getAntiScamDict();

    let banner = document.getElementById("corgphish-anti-scam-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "corgphish-anti-scam-banner";
      banner.style.position = "fixed";
      banner.style.left = "16px";
      banner.style.right = "16px";
      banner.style.top = "12px";
      banner.style.zIndex = "2147483646";
      banner.style.display = "flex";
      banner.style.alignItems = "flex-start";
      banner.style.gap = "10px";
      banner.style.padding = "12px 14px";
      banner.style.borderRadius = "12px";
      banner.style.background = "rgba(191, 66, 66, 0.97)";
      banner.style.color = "#fff";
      banner.style.fontFamily = '"Nunito","Manrope","Inter",system-ui,-apple-system,sans-serif';
      banner.style.boxShadow = "0 12px 28px rgba(0,0,0,0.24)";
      banner.style.backdropFilter = "blur(6px)";
      banner.style.maxWidth = "920px";
      banner.style.margin = "0 auto";
      banner.style.pointerEvents = "auto";
      document.documentElement.appendChild(banner);
    }
    const reasonsText = signal.reasons
      .map((reason) => dict.reasonMap?.[reason] || reason)
      .join(", ");
    banner.innerHTML = "";
    const body = document.createElement("div");
    body.style.flex = "1";
    const title = document.createElement("div");
    title.textContent = dict.title;
    title.style.fontSize = "14px";
    title.style.fontWeight = "800";
    title.style.marginBottom = "4px";
    const text = document.createElement("div");
    text.textContent = `${dict.text}${reasonsText ? ` (${reasonsText})` : ""}`;
    text.style.fontSize = "13px";
    text.style.lineHeight = "1.35";
    body.appendChild(title);
    body.appendChild(text);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = dict.dismiss;
    closeBtn.style.border = "1px solid rgba(255,255,255,0.38)";
    closeBtn.style.background = "rgba(255,255,255,0.16)";
    closeBtn.style.color = "#fff";
    closeBtn.style.borderRadius = "8px";
    closeBtn.style.padding = "6px 10px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontWeight = "700";
    closeBtn.addEventListener("click", () => {
      antiScamDismissed = true;
      clearAntiScamBanner();
    });

    banner.appendChild(body);
    banner.appendChild(closeBtn);
  };

  const runAntiScamScan = () => {
    if (!antiScamBannerEnabled || antiScamDismissed) return;
    const signal = detectAntiScamSignals();
    if (!signal.shouldWarn) {
      clearAntiScamBanner();
      return;
    }
    showAntiScamBanner(signal);
  };

  const scheduleAntiScamScan = () => {
    if (!antiScamBannerEnabled || antiScamDismissed) return;
    if (antiScamTimer) return;
    antiScamTimer = setTimeout(() => {
      antiScamTimer = null;
      runAntiScamScan();
    }, 900);
  };

  const startAntiScamObserver = () => {
    if (antiScamObserver || !antiScamBannerEnabled) return;
    const root = document.documentElement;
    if (!root) return;
    scheduleAntiScamScan();
    antiScamObserver = new MutationObserver(() => {
      scheduleAntiScamScan();
    });
    antiScamObserver.observe(root, { childList: true, subtree: true, characterData: true });
  };

  const stopAntiScamObserver = () => {
    if (!antiScamObserver) return;
    antiScamObserver.disconnect();
    antiScamObserver = null;
  };

  const applyAntiScamSetting = (enabled) => {
    antiScamBannerEnabled = Boolean(enabled);
    if (!antiScamBannerEnabled) {
      stopAntiScamObserver();
      clearAntiScamBanner();
      return;
    }
    antiScamDismissed = false;
    startAntiScamObserver();
    scheduleAntiScamScan();
  };

  const getInspectDomainFn = async () => {
    if (!inspectDomainFnPromise) {
      inspectDomainFnPromise = safeImportRuntimeModule("popup/inspection.js")
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
