const BLACKLIST_KEY = "customBlockedDomains";
const TEMP_ALLOW_KEY = "tempAllowDomains";

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

const loadBlacklist = () =>
  new Promise((resolve) => {
    chrome.storage.local.get({ [BLACKLIST_KEY]: [] }, (result) => {
      const list = Array.isArray(result[BLACKLIST_KEY]) ? result[BLACKLIST_KEY] : [];
      resolve(list.map((domain) => normalizeHost(domain)).filter(Boolean));
    });
  });

const saveBlacklist = (domains) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [BLACKLIST_KEY]: domains }, resolve);
  });

const addToBlacklist = async (domain) => {
  if (!domain) return;
  const current = await loadBlacklist();
  if (current.includes(domain)) return;
  await saveBlacklist([...current, domain]);
};

const loadTempAllow = () =>
  new Promise((resolve) => {
    chrome.storage.local.get({ [TEMP_ALLOW_KEY]: {} }, (result) => {
      const map = result[TEMP_ALLOW_KEY] && typeof result[TEMP_ALLOW_KEY] === "object" ? result[TEMP_ALLOW_KEY] : {};
      resolve(map);
    });
  });

const saveTempAllow = (map) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [TEMP_ALLOW_KEY]: map }, resolve);
  });

const allowTemporarily = async (domain, minutes = 5) => {
  if (!domain) return;
  const map = await loadTempAllow();
  map[domain] = Date.now() + minutes * 60 * 1000;
  await saveTempAllow(map);
};

const params = new URLSearchParams(window.location.search);
const domain = normalizeHost(params.get("domain") || "");
const reason = params.get("reason") || "phishing";
const originalUrl = params.get("url") || (domain ? `https://${domain}` : "");
const official = normalizeHost(params.get("official") || "");

const reasonBadge = document.getElementById("reasonBadge");
const title = document.getElementById("title");
const domainEl = document.getElementById("domain");
const subtitle = document.getElementById("subtitle");
const note = document.getElementById("note");
const backBtn = document.getElementById("backBtn");
const allowBtn = document.getElementById("allowBtn");
const blacklistBtn = document.getElementById("blacklistBtn");
const reportBtn = document.getElementById("reportBtn");
const officialBtn = document.getElementById("officialBtn");

const reasonLabels = {
  phishing: "Подозрение на фишинг",
  blacklist: "Домен в чёрном списке",
  linkPhishing: "Опасная ссылка",
  linkBlacklist: "Ссылка на домен из ЧС",
  redirectPhishing: "Опасный редирект"
};

reasonBadge.textContent = reasonLabels[reason] || reasonLabels.phishing;

if (reason === "blacklist" || reason === "linkBlacklist") {
  title.textContent = "Сайт заблокирован";
  subtitle.textContent = "Домен находится в вашем чёрном списке.";
} else if (reason === "redirectPhishing") {
  title.textContent = "Переход заблокирован";
  subtitle.textContent = "В цепочке редиректов обнаружен рискованный домен.";
} else if (reason === "linkPhishing") {
  title.textContent = "Переход заблокирован";
  subtitle.textContent = "Ссылка ведёт на сайт с признаками фишинга.";
} else {
  title.textContent = "Опасный сайт";
  subtitle.textContent = "Обнаружены признаки фишинга. Переход заблокирован.";
}

if (domainEl) {
  domainEl.textContent = domain || "—";
}

if (!domain) {
  allowBtn.disabled = true;
  blacklistBtn.disabled = true;
}

if (official) {
  officialBtn.classList.remove("is-hidden");
}

const closeTab = () => {
  chrome.runtime.sendMessage({ type: "closeTab" });
};

backBtn.addEventListener("click", () => {
  if (history.length > 1) {
    history.back();
  } else {
    closeTab();
  }
});

allowBtn.addEventListener("click", async () => {
  if (!domain || !originalUrl) return;
  await allowTemporarily(domain, 5);
  chrome.tabs.update({ url: originalUrl });
});

blacklistBtn.addEventListener("click", async () => {
  if (!domain) return;
  await addToBlacklist(domain);
  closeTab();
});

officialBtn.addEventListener("click", () => {
  if (!official) return;
  const url = official.includes("://") ? official : `https://${official}`;
  chrome.tabs.create({ url });
});

reportBtn.addEventListener("click", async () => {
  const targetUrl = originalUrl || (domain ? `https://${domain}` : "");
  if (!targetUrl) return;
  const reportText = [
    "CorgPhish phishing report",
    `URL: ${targetUrl}`,
    `Domain: ${domain || "n/a"}`,
    `Reason: ${reason}`,
    `Time: ${new Date().toISOString()}`
  ].join("\n");
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(reportText);
    } catch (error) {
      // ignore clipboard errors
    }
  }
  const reportUrl =
    `https://safebrowsing.google.com/safebrowsing/report_phish/?url=${encodeURIComponent(targetUrl)}`;
  chrome.tabs.create({ url: reportUrl });
});

if (note) {
  note.textContent = "CorgPhish блокирует переход, чтобы вы не успели открыть вредоносную страницу.";
}
