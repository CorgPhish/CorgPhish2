// Контент-скрипт: реагирует на вердикт ML/ЧС, блокирует страницу, формы и загрузки.
(() => {
  const BLACKLIST_KEY = "customBlockedDomains";
  const EXIT_ALERT = "Вы вышли с потенциально опасного сайта";
  const FORM_ALERT = "Не вводите личные данные: сайт может быть фишинговым.";
  const DOWNLOAD_ALERT = "Скачивание заблокировано: сайт может быть фишинговым.";

  const normalizeHost = (hostname = "") =>
    hostname.trim().replace(/^www\./i, "").replace(/\.$/, "").toLowerCase();

  const resolveHostname = (input = "") => {
    try {
      const url = new URL(input);
      return url.hostname;
    } catch (error) {
      return normalizeHost(input);
    }
  };

  const loadBlacklist = () =>
    new Promise((resolve) => {
      chrome.storage.local.get({ [BLACKLIST_KEY]: [] }, (result) => {
        const list = Array.isArray(result[BLACKLIST_KEY]) ? result[BLACKLIST_KEY] : [];
        resolve(list.map((d) => normalizeHost(d)).filter(Boolean));
      });
    });

  const saveBlacklist = (domains) =>
    new Promise((resolve) => {
      chrome.storage.local.set({ [BLACKLIST_KEY]: domains }, resolve);
    });

  const addToBlacklist = async (domain) => {
    const current = await loadBlacklist();
    if (current.includes(domain)) return;
    await saveBlacklist([...current, domain]);
  };

  const createOverlay = (domain, onExit, onBlacklist) => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "2147483647";
    overlay.style.background = "rgba(10,16,40,0.9)";
    overlay.style.backdropFilter = "blur(6px)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.gap = "12px";
    overlay.style.fontFamily = "Inter, system-ui, -apple-system, sans-serif";
    overlay.style.color = "#e2e8f0";
    overlay.style.padding = "24px";
    overlay.style.textAlign = "center";

    const card = document.createElement("div");
    card.style.background = "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(59,130,246,0.12))";
    card.style.border = "1px solid rgba(255,255,255,0.08)";
    card.style.borderRadius = "16px";
    card.style.padding = "18px 20px";
    card.style.minWidth = "280px";
    card.style.maxWidth = "420px";
    card.style.boxShadow = "0 25px 45px rgba(0,0,0,0.35)";

    const title = document.createElement("h2");
    title.textContent = "Этот сайт может быть фишинговым";
    title.style.margin = "0 0 8px";

    const subtitle = document.createElement("p");
    subtitle.textContent = domain;
    subtitle.style.margin = "0 0 6px";
    subtitle.style.fontWeight = "600";

    const hint = document.createElement("p");
    hint.textContent = "Данные и скачивания заблокированы.";
    hint.style.margin = "0 0 12px";
    hint.style.color = "#cbd5f5";

    const buttons = document.createElement("div");
    buttons.style.display = "flex";
    buttons.style.gap = "10px";
    buttons.style.justifyContent = "center";

    const exitBtn = document.createElement("button");
    exitBtn.textContent = "Выйти";
    exitBtn.style.padding = "10px 14px";
    exitBtn.style.borderRadius = "12px";
    exitBtn.style.border = "none";
    exitBtn.style.cursor = "pointer";
    exitBtn.style.background = "linear-gradient(120deg, #ef4444, #f97316)";
    exitBtn.style.color = "#fff";

    const blacklistBtn = document.createElement("button");
    blacklistBtn.textContent = "Добавить в ЧС";
    blacklistBtn.style.padding = "10px 14px";
    blacklistBtn.style.borderRadius = "12px";
    blacklistBtn.style.border = "1px solid rgba(255,255,255,0.3)";
    blacklistBtn.style.background = "transparent";
    blacklistBtn.style.color = "#e2e8f0";
    blacklistBtn.style.cursor = "pointer";

    buttons.appendChild(exitBtn);
    buttons.appendChild(blacklistBtn);
    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(hint);
    card.appendChild(buttons);
    overlay.appendChild(card);
    document.documentElement.appendChild(overlay);

    exitBtn.addEventListener("click", () => onExit?.());
    blacklistBtn.addEventListener("click", () => onBlacklist?.());

    return { overlay, hint, subtitle };
  };

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
        link &&
        (link.hasAttribute("download") ||
          /\.((exe)|(msi)|(scr)|(zip)|(rar)|(7z)|(tar)|(gz)|(dmg)|(apk))$/i.test(href));
      if (downloadLink) {
        event.preventDefault();
        event.stopPropagation();
        alert(DOWNLOAD_ALERT);
      }
    };
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
    };
  };

  const hostname = resolveHostname(window.location.href);
  if (!hostname || !/^https?:/i.test(window.location.href)) return;

  const state = { active: false, domain: hostname };
  let teardown = () => {};
  let overlayRef = null;

  const activateBlock = async (reason = "phishing") => {
    if (state.active) return;
    state.active = true;
    teardown = blockInteractions(state);
    const overlay = createOverlay(hostname, () => {
      alert(EXIT_ALERT);
      if (history.length > 1) {
        history.back();
      } else {
        chrome.runtime.sendMessage({ type: "closeTab" });
      }
    }, async () => {
      await addToBlacklist(hostname);
    });
    overlayRef = overlay;
    if (reason === "blacklist") {
      overlay.hint.textContent = "Домен в вашем чёрном списке. Страница заблокирована.";
    }
  };

  const init = async () => {
    const blacklist = await loadBlacklist();
    if (blacklist.includes(hostname)) {
      activateBlock("blacklist");
    }
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "phishingBlock" && normalizeHost(message.domain) === hostname) {
      activateBlock("phishing");
      sendResponse?.({ ok: true });
      return true;
    }
    return false;
  });

  init();
})();
