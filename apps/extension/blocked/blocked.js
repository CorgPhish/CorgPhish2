// Экран блокировки: показывает причину, даёт выйти, временно разрешить домен или отправить репорт.
const BLACKLIST_KEY = "customBlockedDomains";
const TEMP_ALLOW_KEY = "tempAllowDomains";
const WHITELIST_KEY = "customTrustedDomains";

// blocked.html работает отдельно от popup/content, поэтому держит собственные storage-утилиты.
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

const loadWhitelist = () =>
  new Promise((resolve) => {
    chrome.storage.local.get({ [WHITELIST_KEY]: [] }, (result) => {
      const list = Array.isArray(result[WHITELIST_KEY]) ? result[WHITELIST_KEY] : [];
      resolve(list.map((domain) => normalizeHost(domain)).filter(Boolean));
    });
  });

const saveWhitelist = (domains) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [WHITELIST_KEY]: domains }, resolve);
  });

// Добавление в ЧС здесь дублируется локально, потому что blocked page живёт отдельно от popup.
const addToBlacklist = async (domain) => {
  if (!domain) return;
  const current = await loadBlacklist();
  if (current.includes(domain)) return;
  await saveBlacklist([...current, domain]);
};

const removeFromBlacklist = async (domain) => {
  if (!domain) return;
  const current = await loadBlacklist();
  await saveBlacklist(current.filter((entry) => entry !== domain));
};

const addToWhitelist = async (domain) => {
  if (!domain) return;
  const current = await loadWhitelist();
  if (current.includes(domain)) return;
  await saveWhitelist([...current, domain]);
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

// Временное разрешение удобно для ложных срабатываний и ручной перепроверки пользователем.
const allowTemporarily = async (domain, seconds = 30) => {
  if (!domain) return;
  const map = await loadTempAllow();
  map[domain] = Date.now() + seconds * 1000;
  await saveTempAllow(map);
};

// Весь контекст blocked page получает из query-параметров, переданных content script.
const params = new URLSearchParams(window.location.search);
const domain = normalizeHost(params.get("domain") || "");
const reason = params.get("reason") || "phishing";
const originalUrl = params.get("url") || (domain ? `https://${domain}` : "");
const official = normalizeHost(params.get("official") || "");
const showOfficialAction = Boolean(official && official !== domain);

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
const isBlacklistReason = reason === "blacklist" || reason === "linkBlacklist";

const reasonLabels = {
  phishing: "Подозрение на фишинг",
  blacklist: "Домен в чёрном списке",
  linkPhishing: "Опасная ссылка",
  linkBlacklist: "Ссылка на домен из ЧС",
  redirectPhishing: "Опасный редирект",
  guardForm: "Защита ввода",
  guardDownload: "Защита загрузки"
};

// Меняем копирайт и заголовок страницы в зависимости от сценария блокировки.
reasonBadge.textContent = reasonLabels[reason] || reasonLabels.phishing;

if (isBlacklistReason) {
  title.textContent = "Сайт заблокирован";
  subtitle.textContent = "Домен находится в вашем чёрном списке.";
  blacklistBtn.textContent = "Добавить в белый список";
  blacklistBtn.classList.remove("button--danger");
  allowBtn.classList.add("is-hidden");
  allowBtn.disabled = true;
} else if (reason === "redirectPhishing") {
  title.textContent = "Переход заблокирован";
  subtitle.textContent = "В цепочке редиректов обнаружен рискованный домен.";
} else if (reason === "linkPhishing") {
  title.textContent = "Переход заблокирован";
  subtitle.textContent = "Ссылка ведёт на сайт с признаками фишинга.";
} else if (reason === "guardForm") {
  title.textContent = "Отправка формы заблокирована";
  subtitle.textContent = "CorgPhish остановил ввод и отправку данных на подозрительном сайте.";
} else if (reason === "guardDownload") {
  title.textContent = "Загрузка заблокирована";
  subtitle.textContent = "CorgPhish остановил скачивание файла на подозрительном сайте.";
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

if (showOfficialAction) {
  officialBtn.classList.remove("is-hidden");
}

// Если history назад пустой, просим background закрыть текущую вкладку.
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
  if (isBlacklistReason) return;
  if (!domain || !originalUrl) return;
  await allowTemporarily(domain, 30);
  // Возвращаем пользователя именно на исходный URL, а не просто на домен.
  chrome.tabs.update({ url: originalUrl });
});

blacklistBtn.addEventListener("click", async () => {
  if (!domain) return;
  if (isBlacklistReason) {
    await removeFromBlacklist(domain);
    await addToWhitelist(domain);
    if (originalUrl) {
      chrome.tabs.update({ url: originalUrl });
      return;
    }
    closeTab();
    return;
  }
  await addToBlacklist(domain);
  closeTab();
});

officialBtn.addEventListener("click", () => {
  if (!showOfficialAction) return;
  const url = official.includes("://") ? official : `https://${official}`;
  chrome.tabs.create({ url });
});

reportBtn.addEventListener("click", async () => {
  const targetUrl = originalUrl || (domain ? `https://${domain}` : "");
  if (!targetUrl) return;
  // Одновременно готовим текст отчёта для буфера и открываем форму Safe Browsing.
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
  if (reason === "guardForm") {
    note.textContent = "Открывайте сайт только если уверены в нём. Иначе не вводите логины, пароли, SMS-коды и данные карты.";
  } else if (reason === "guardDownload") {
    note.textContent = "Открывайте сайт только если уверены в нём. Иначе не скачивайте файлы с этой страницы.";
  } else {
    note.textContent = "";
  }
}
