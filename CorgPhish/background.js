// RU: Сервис-воркер: системные уведомления, кэш trusted.json, закрытие вкладок.
// EN: Service worker: system notifications, trusted.json cache, close tabs.
const DEFAULT_SETTINGS = {
  systemNotifyOnRisk: false
};

const TRUSTED_STORAGE_KEY = "builtinTrustedDomains";
const DEFAULT_THRESHOLD = 0.7;

// Lightweight heuristic predictor (без ORT) прямо в background.
const FEATURE_COLUMNS = [
  "length_url",
  "qty_dot_url",
  "qty_hyphen_url",
  "qty_underline_url",
  "qty_slash_url",
  "qty_questionmark_url",
  "qty_equal_url",
  "qty_at_url",
  "qty_and_url",
  "qty_exclamation_url",
  "qty_space_url",
  "qty_tilde_url",
  "qty_comma_url",
  "qty_plus_url",
  "qty_asterisk_url",
  "qty_hashtag_url",
  "qty_dollar_url",
  "qty_percent_url",
  "domain_length",
  "qty_dot_domain",
  "qty_hyphen_domain",
  "qty_underline_domain",
  "domain_in_ip"
];

const isIpDomain = (domain = "") => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(domain);

const safeUrl = (input = "") => {
  if (!input) return "";
  try {
    return new URL(input.includes("://") ? input : `https://${input}`).toString();
  } catch (error) {
    return "";
  }
};

const extractFeatures = (rawUrl = "") => {
  const url = safeUrl(rawUrl);
  const features = {};
  FEATURE_COLUMNS.forEach((col) => {
    features[col] = 0;
  });
  if (!url) {
    return { url: "", features };
  }
  const domain = (() => {
    try {
      return new URL(url).hostname || "";
    } catch (error) {
      return "";
    }
  })();

  const count = (ch) => (url.match(new RegExp(`\\${ch}`, "g")) || []).length;

  features.length_url = url.length;
  features.qty_dot_url = count(".");
  features.qty_hyphen_url = count("-");
  features.qty_underline_url = count("_");
  features.qty_slash_url = count("/");
  features.qty_questionmark_url = count("?");
  features.qty_equal_url = count("=");
  features.qty_at_url = count("@");
  features.qty_and_url = count("&");
  features.qty_exclamation_url = count("!");
  features.qty_space_url = count(" ");
  features.qty_tilde_url = count("~");
  features.qty_comma_url = count(",");
  features.qty_plus_url = count("+");
  features.qty_asterisk_url = count("*");
  features.qty_hashtag_url = count("#");
  features.qty_dollar_url = count("$");
  features.qty_percent_url = count("%");

  features.domain_length = domain.length;
  features.qty_dot_domain = (domain.match(/\./g) || []).length;
  features.qty_hyphen_domain = (domain.match(/-/g) || []).length;
  features.qty_underline_domain = (domain.match(/_/g) || []).length;
  features.domain_in_ip = isIpDomain(domain) ? 1 : 0;

  return { url, features };
};

const heuristicVerdict = (features, threshold = DEFAULT_THRESHOLD) => {
  const riskyChars =
    features.qty_at_url +
    features.qty_questionmark_url +
    features.qty_equal_url +
    features.qty_percent_url +
    features.qty_hashtag_url +
    features.qty_dollar_url +
    features.qty_exclamation_url +
    features.qty_space_url;
  const lenScore = Math.min(features.length_url / 160, 2);
  const hyphenScore = features.qty_hyphen_domain * 0.2;
  const dotScore = features.qty_dot_domain * 0.12;
  const ipScore = features.domain_in_ip ? 3 : 0;
  const raw = riskyChars * 0.25 + lenScore + hyphenScore + dotScore + ipScore;
  const probability = 1 / (1 + Math.exp(-raw));
  const verdict = probability >= threshold ? "phishing" : "trusted";
  return { verdict, probability };
};

const cacheTrustedList = async () => {
  try {
    const response = await fetch(chrome.runtime.getURL("trusted.json"));
    if (!response.ok) return [];
    const payload = await response.json();
    const list = Array.isArray(payload?.trusted) ? payload.trusted : [];
    chrome.storage.local.set({ [TRUSTED_STORAGE_KEY]: list });
    return list;
  } catch (error) {
    console.warn("CorgPhish: failed to preload trusted.json", error);
    return [];
  }
};

const loadSettings = () =>
  new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      resolve({ ...DEFAULT_SETTINGS, ...settings });
    });
  });

// RU: Обрабатываем сообщения попапа/контента.
// EN: Handle messages from popup/content.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
if (!message) return;

  if (message.type === "predictUrlBg") {
    (async () => {
      try {
        const { url, features } = extractFeatures(message.url);
        if (!url) {
          sendResponse?.({ ok: false, error: "invalid_url" });
          return;
        }
        const result = heuristicVerdict(features, message.threshold || DEFAULT_THRESHOLD);
        sendResponse?.({ ok: true, result: { ...result, status: "ok", threshold: message.threshold } });
      } catch (error) {
        sendResponse?.({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  if (message.type === "riskNotification") {
    loadSettings().then((settings) => {
      if (!settings.systemNotifyOnRisk) {
        sendResponse?.({ ok: false });
        return;
      }
      const id = `corgphish-${Date.now()}`;
      chrome.notifications.create(
        id,
        {
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: "CorgPhish: подозрительный сайт",
          message: `${message.domain ?? "Сайт"} может быть фишингом`,
          contextMessage: message.url ?? ""
        },
        () => sendResponse?.({ ok: true })
      );
    });
    return true;
  }

  if (message.type === "getTrustedDomains") {
    (async () => {
      try {
        const stored = await new Promise((resolve) =>
          chrome.storage.local.get({ [TRUSTED_STORAGE_KEY]: [] }, (res) =>
            resolve(Array.isArray(res[TRUSTED_STORAGE_KEY]) ? res[TRUSTED_STORAGE_KEY] : [])
          )
        );
        const list = stored.length ? stored : await cacheTrustedList();
        sendResponse?.({ ok: true, trusted: list });
      } catch (error) {
        console.warn("CorgPhish: failed to serve trusted.json", error);
        sendResponse?.({ ok: false, trusted: [] });
      }
    })();
    return true;
  }

  if (message.type === "closeTab" && sender?.tab?.id) {
    chrome.tabs.remove(sender.tab.id);
    sendResponse?.({ ok: true });
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  cacheTrustedList();
});

chrome.runtime.onStartup.addListener(() => {
  cacheTrustedList();
});
