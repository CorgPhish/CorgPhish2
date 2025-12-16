// Lightweight predictor for service worker/offscreen/worker contexts (no DOM).
const DEFAULT_THRESHOLD = 0.5;

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


const normalizeHost = (hostname = "") =>
  hostname.trim().replace(/^www\./i, "").replace(/\.$/, "").toLowerCase();

const safeUrl = (input = "") => {
  if (!input) return "";
  try {
    return new URL(input.includes("://") ? input : `https://${input}`).toString();
  } catch (error) {
    return "";
  }
};

const isIpDomain = (domain = "") => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(domain);

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

const heuristicVerdict = (features) => {
  const riskyChars =
    features.qty_at_url +
    features.qty_questionmark_url +
    features.qty_equal_url +
    features.qty_percent_url +
    features.qty_hashtag_url +
    features.qty_dollar_url +
    features.qty_exclamation_url +
    features.qty_space_url;
  const lenScore = Math.min(features.length_url / 120, 2);
  const hyphenScore = features.qty_hyphen_domain * 0.4;
  const dotScore = features.qty_dot_domain * 0.25;
  const ipScore = features.domain_in_ip ? 2.5 : 0;
  const raw = riskyChars * 0.35 + lenScore + hyphenScore + dotScore + ipScore;
  const probability = 1 / (1 + Math.exp(-raw)); // sigmoid
  return { verdict: probability >= DEFAULT_THRESHOLD ? "phishing" : "trusted", probability };
};

const predictUrlWorker = async (rawUrl, threshold = DEFAULT_THRESHOLD) => {
  const { url, features } = extractFeatures(rawUrl);
  if (!url) {
    throw new Error("invalid_url");
  }
  // Worker без ORT: используем эвристику, чтобы всегда вернуть вердикт.
  const fallback = heuristicVerdict(features);
  const probability = fallback.verdict === "phishing" ? 0.8 : 0.2;
  return { status: "fallback", verdict: fallback.verdict, probability, threshold };
};

// expose to global
globalThis.predictUrlWorker = predictUrlWorker;
