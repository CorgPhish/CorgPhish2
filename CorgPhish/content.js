// Контент-скрипт: ранний чек домена и блокировка ввода/скачиваний на подозрительных сайтах.
(async () => {
  const DEFAULT_SETTINGS = {
    blockOnUntrusted: true,
    systemNotifyOnRisk: true,
    warnOnUntrusted: true
  };

  const normalizeHost = (hostname = "") =>
    hostname.trim().replace(/^www\./i, "").replace(/\.$/, "").toLowerCase();

  const levenshteinDistance = (a = "", b = "") => {
    if (a === b) return 0;
    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));
    for (let i = 0; i < rows; i++) matrix[i][0] = i;
    for (let j = 0; j < cols; j++) matrix[0][j] = j;
    for (let i = 1; i < rows; i++) {
      for (let j = 1; j < cols; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[rows - 1][cols - 1];
  };

  const findSpoofCandidate = (target, trustedList) => {
    let closest = null;
    let distance = Infinity;
    trustedList.forEach((domain) => {
      if (Math.abs(target.length - domain.length) > 2) return;
      const currentDistance = levenshteinDistance(target, domain);
      if (currentDistance < distance) {
        distance = currentDistance;
        closest = domain;
      }
    });
    return distance <= 2 ? closest : null;
  };

  const loadSettings = () =>
    new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
        resolve({ ...DEFAULT_SETTINGS, ...settings });
      });
    });

  const loadWhitelist = () =>
    new Promise((resolve) => {
      chrome.storage.local.get({ customTrustedDomains: [] }, (result) => {
        const list = Array.isArray(result.customTrustedDomains) ? result.customTrustedDomains : [];
        resolve(list.map((d) => normalizeHost(d)).filter(Boolean));
      });
    });

  const loadTrustedList = async () => {
    try {
      const response = await fetch(chrome.runtime.getURL("trusted.json"));
      if (!response.ok) return [];
      const payload = await response.json();
      if (!Array.isArray(payload?.trusted)) return [];
      return payload.trusted.map((d) => normalizeHost(d)).filter(Boolean);
    } catch (error) {
      console.warn("Не удалось загрузить trusted.json", error);
      return [];
    }
  };

  const isTrustedDomain = (domain, trustedList) =>
    trustedList.some((item) => domain === item || domain.endsWith(`.${item}`));

  const resolveHostname = (input = "") => {
    try {
      const url = new URL(input);
      return url.hostname;
    } catch (error) {
      return normalizeHost(input);
    }
  };

  const injectOverlay = (domain, spoofTarget, onAllow, onClose) => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "2147483647";
    overlay.style.background =
      "linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,41,59,0.92))";
    overlay.style.backdropFilter = "blur(3px)";
    overlay.style.color = "#e2e8f0";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "24px";
    overlay.style.textAlign = "center";
    overlay.style.fontFamily = "Inter, system-ui, -apple-system, sans-serif";

    const title = document.createElement("h2");
    title.textContent = "CorgPhish заблокировал страницу";
    title.style.margin = "0 0 12px";
    const subtitle = document.createElement("p");
    subtitle.textContent = `Домен ${domain} не в списке доверенных. Ввод данных и загрузки отключены.`;
    subtitle.style.margin = "0 0 12px";

    const details = document.createElement("p");
    details.textContent = spoofTarget
      ? `Похоже на: ${spoofTarget}`
      : "Если доверяете источнику, разблокируйте на 5 минут.";
    details.style.margin = "0 0 16px";
    details.style.color = "#94a3b8";

    const buttons = document.createElement("div");
    buttons.style.display = "flex";
    buttons.style.gap = "10px";

    const allowBtn = document.createElement("button");
    allowBtn.textContent = "Разблокировать на 5 минут";
    allowBtn.style.padding = "10px 16px";
    allowBtn.style.borderRadius = "12px";
    allowBtn.style.border = "none";
    allowBtn.style.cursor = "pointer";
    allowBtn.style.background = "linear-gradient(120deg, #2563eb, #38bdf8)";
    allowBtn.style.color = "#fff";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Закрыть вкладку";
    closeBtn.style.padding = "10px 16px";
    closeBtn.style.borderRadius = "12px";
    closeBtn.style.border = "1px solid rgba(148,163,184,0.4)";
    closeBtn.style.background = "transparent";
    closeBtn.style.color = "#e2e8f0";
    closeBtn.style.cursor = "pointer";

    allowBtn.addEventListener("click", () => {
      overlay.remove();
      onAllow?.();
    });
    closeBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "closeTab" });
      onClose?.();
    });

    buttons.appendChild(allowBtn);
    buttons.appendChild(closeBtn);

    overlay.appendChild(title);
    overlay.appendChild(subtitle);
    overlay.appendChild(details);
    overlay.appendChild(buttons);
    document.documentElement.appendChild(overlay);
    return overlay;
  };

  const preventDangerousActions = (blockedRef) => {
    const blockEvent = (event) => {
      if (!blockedRef.active) return;
      const target = event.target;
      const isForm = event.type === "submit" || target?.closest?.("form");
      const href = target?.closest?.("a")?.getAttribute?.("href") || "";
      const downloadLink =
        target?.closest &&
        target.closest(
          [
            "a[download]",
            'a[href$=".exe"]',
            'a[href$=".msi"]',
            'a[href$=".scr"]',
            'a[href$=".zip"]',
            'a[href$=".rar"]',
            'a[href$=".7z"]',
            'a[href$=".tar"]',
            'a[href$=".tar.gz"]',
            'a[href$=".gz"]',
            'a[href$=".dmg"]',
            'a[href$=".apk"]'
          ].join(",")
        );
      const looksLikeDownload = downloadLink || /download/i.test(href);
      if (isForm || looksLikeDownload) {
        event.preventDefault();
        event.stopPropagation();
        alert("Ввод и загрузка заблокированы на этом сайте CorgPhish.");
      }
    };
    const blockNavigation = (event) => {
      if (!blockedRef.active) return;
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("submit", blockEvent, true);
    document.addEventListener("click", blockEvent, true);
    window.addEventListener("beforeunload", blockNavigation, true);
    const originalOpen = window.open;
    window.open = (...args) => {
      if (blockedRef.active) {
        alert("Открытие новых вкладок заблокировано CorgPhish для этого сайта.");
        return null;
      }
      return originalOpen.apply(window, args);
    };
    return () => {
      document.removeEventListener("submit", blockEvent, true);
      document.removeEventListener("click", blockEvent, true);
      window.removeEventListener("beforeunload", blockNavigation, true);
      window.open = originalOpen;
    };
  };

  const settings = await loadSettings();
  const hostname = resolveHostname(window.location.href);
  if (!hostname || !/^https?:/i.test(window.location.href)) return;

  const [trustedList, whitelist] = await Promise.all([loadTrustedList(), loadWhitelist()]);
  const merged = [...new Set([...trustedList, ...whitelist])];
  if (!merged.length) return;

  const cleanDomain = normalizeHost(hostname);
  const isTrusted = isTrustedDomain(cleanDomain, merged);
  if (isTrusted) return;

  const spoofTarget = findSpoofCandidate(cleanDomain, merged);
  let blockedState = { active: Boolean(settings.blockOnUntrusted) };
  const teardown = preventDangerousActions(blockedState);

  if (settings.warnOnUntrusted) {
    alert(`Внимание: сайт ${cleanDomain} не в списке доверенных. Не вводите данные и не скачивайте файлы.`);
  }

  if (settings.systemNotifyOnRisk) {
    chrome.runtime.sendMessage({
      type: "riskNotification",
      domain: cleanDomain,
      url: window.location.href
    });
  }

  if (settings.blockOnUntrusted) {
    // Останавливаем загрузку исходной страницы и показываем блокирующий экран.
    try {
      window.stop();
    } catch (e) {
      // ignore
    }
    document.documentElement.innerHTML = "";
    injectOverlay(
      cleanDomain,
      spoofTarget,
      () => {
        blockedState.active = false;
        setTimeout(() => {
          blockedState.active = true;
        }, 5 * 60 * 1000);
        location.reload();
      },
      () => {
        teardown();
      }
    );
  }
})();
