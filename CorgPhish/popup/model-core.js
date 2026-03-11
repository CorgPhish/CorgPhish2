// RU: Чистые функции для URL-feature engineering и fallback-эвристики.
// EN: Pure model helpers reused by popup, background, offscreen and test runners.
import { HEURISTIC_THRESHOLD, MODEL_THRESHOLD } from "./config.js";

export const DEFAULT_MODEL_THRESHOLD = MODEL_THRESHOLD;
export const DEFAULT_HEURISTIC_THRESHOLD = HEURISTIC_THRESHOLD ?? DEFAULT_MODEL_THRESHOLD;

export const FEATURE_COLUMNS = [
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

export const isIpDomain = (domain = "") => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(domain);

// Подготавливает строку URL к инференсу: модель ожидает полный URL, а не только hostname.
export const safeUrl = (input = "") => {
  if (!input) return "";
  try {
    return new URL(input.includes("://") ? input : `https://${input}`).toString();
  } catch (error) {
    return "";
  }
};

// Извлекает числовые признаки, совместимые с ONNX-моделью и heuristic fallback.
export const extractFeatures = (rawUrl = "") => {
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

  const count = (char) => (url.match(new RegExp(`\\${char}`, "g")) || []).length;

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

// Простая интерпретируемая эвристика берёт на себя решение при недоступности ML-слоя.
export const computeHeuristicProbability = (features = {}, options = {}) => {
  const riskyChars =
    (features.qty_at_url || 0) +
    (features.qty_questionmark_url || 0) +
    (features.qty_equal_url || 0) +
    (features.qty_percent_url || 0) +
    (features.qty_hashtag_url || 0) +
    (features.qty_dollar_url || 0) +
    (features.qty_exclamation_url || 0) +
    (features.qty_space_url || 0);
  const lenScore = Math.min((features.length_url || 0) / 160, 2);
  const hyphenScore = (features.qty_hyphen_domain || 0) * 0.2;
  const dotScore = (features.qty_dot_domain || 0) * 0.12;
  const ipScore = features.domain_in_ip ? 3 : 0;
  const brandPenalty = options.includeBrandPenalty && (features.qty_dot_domain || 0) >= 2 ? 0.3 : 0;
  const raw = riskyChars * 0.25 + lenScore + hyphenScore + dotScore + ipScore + brandPenalty;
  return 1 / (1 + Math.exp(-raw));
};

export const heuristicVerdict = (
  features = {},
  threshold = DEFAULT_MODEL_THRESHOLD,
  options = {}
) => {
  const probability = computeHeuristicProbability(features, options);
  return {
    verdict: probability >= threshold ? "phishing" : "trusted",
    probability
  };
};
