// RU: Модуль 1. Общие константы, единое состояние content script и служебные helper-функции.
// EN: Module 1. Shared constants, content-script state and common helpers.
(() => {
  const BLACKLIST_KEY = "customBlockedDomains";
  const TEMP_ALLOW_KEY = "tempAllowDomains";
  const EXIT_ALERT = "Вы вышли с потенциально опасного сайта";
  const FORM_ALERT = "Не вводите личные данные: сайт может быть фишинговым.";
  const DOWNLOAD_ALERT = "Загрузка файлов заблокирована: сайт может быть фишинговым.";
  const BLOCKED_FILE_EXT = /\.((exe)|(msi)|(scr)|(zip)|(rar)|(7z)|(tar)|(gz)|(dmg)|(apk)|(jpg)|(png)|(html)|(txt)|(md))$/i;
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
  // Бесплатные хостинги и конструкторы часто встречаются в фишинговых кампаниях.
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
  // Ограничиваем массовое сканирование ссылок, чтобы не перегружать тяжёлые страницы.
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
    linkHighlightEnabled: true,
    antiScamBannerEnabled: true,
    blockOnUntrusted: false
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
  const ANTI_SCAM_PATTERNS = {
    pressure:
      /(urgent|act now|immediately|suspended|blocked|limited|expire|security alert|срочно|немедленно|заблокир|ограничен|истекает|угроза)/i,
    credentials:
      /(password|passcode|otp|2fa|mfa|verification code|one[- ]time code|парол|код подтверждения|одноразовый код|смс[- ]?код)/i,
    payment:
      /(card|cvv|cvc|bank transfer|wallet|payment|invoice|crypto|карт|оплат|банковск|перевод|кошелек|крипт)/i,
    authority:
      /(security service|bank security|fraud department|tax service|government service|служба безопасности|безопасности банка|сотрудник банка|налогов(ая|ой)|госуслуг[аи]?|полици[яи])/i,
    messenger:
      /(telegram|whatsapp|t\.me\/|wa\.me\/|напишите в телеграм|свяжитесь в whatsapp|перейдите в telegram|напишите в whatsapp)/i,
    lure:
      /(refund|compensation|bonus|prize|lottery|выигрыш|бонус|компенсац|возврат)/i
  };
  const ANTI_SCAM_I18N = {
    ru: {
      title: "Anti-scam: замечены признаки мошенничества",
      text: "Страница использует паттерны социальной инженерии. Не вводите коды, пароли и платежные данные.",
      dismiss: "Скрыть",
      reasonMap: {
        pressure: "давление и срочность",
        credentials: "запрос кодов/паролей",
        payment: "запрос платежных данных",
        authority: "имитация официальной службы",
        messenger: "перевод в мессенджер",
        lure: "обещание выплаты/бонуса"
      }
    },
    en: {
      title: "Anti-scam: suspicious social engineering patterns",
      text: "This page shows scam-like pressure tactics. Avoid entering passwords, OTP codes, or payment details.",
      dismiss: "Dismiss",
      reasonMap: {
        pressure: "urgency and pressure",
        credentials: "credential/OTP request",
        payment: "payment data request",
        authority: "fake official authority",
        messenger: "messenger handoff pattern",
        lure: "bonus/refund bait"
      }
    }
  };
  const linkDomainCache = new Map();
  const preClickCache = new Map();
  let linkScanTimer = null;
  let linkHighlightEnabled = SETTINGS_DEFAULTS.linkHighlightEnabled;
  let antiScamBannerEnabled = SETTINGS_DEFAULTS.antiScamBannerEnabled;
  let linkObserver = null;
  let antiScamObserver = null;
  let antiScamTimer = null;
  let antiScamDismissed = false;
  let lastAntiScamSignature = "";
  let inspectDomainFnPromise = null;
  let pageRiskVerdict = "trusted";
  let sensitiveWarnAt = 0;
  let sensitiveGuardTeardown = () => {};
  const PUBLIC_SUFFIXES = new Set(["co.uk", "ac.uk", "gov.uk", "org.uk", "net.uk"]);
  const TRUSTED_CACHE_TTL = 60 * 1000;
  let trustedCache = { list: null, ts: 0 };
