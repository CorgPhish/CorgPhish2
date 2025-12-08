// Локальный инференс ONNX-модели (onnxruntime-web, wasm) без процентов и скорингов.
const MODEL_PATH = chrome.runtime.getURL("models/hybrid_tfidf_num.onnx");
const ORT_BASE = chrome.runtime.getURL("vendor/ort/");
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

let ortScriptPromise = null;
let sessionPromise = null;

const loadOrt = () => {
  if (globalThis.ort) {
    return Promise.resolve(globalThis.ort);
  }
  if (!ortScriptPromise) {
    ortScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("vendor/ort/ort.min.js");
      script.async = true;
      script.onload = () => resolve(globalThis.ort);
      script.onerror = () => reject(new Error("ort_load_failed"));
      document.head.appendChild(script);
    });
  }
  return ortScriptPromise;
};

const ensureSession = async () => {
  if (sessionPromise) {
    return sessionPromise;
  }
  sessionPromise = (async () => {
    const ort = await loadOrt();
    ort.env.wasm.wasmPaths = ORT_BASE;
    ort.env.wasm.numThreads = 1;
    return ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "disabled",
      preferredOutputType: "float32"
    });
  })();
  sessionPromise = sessionPromise.catch((error) => {
    sessionPromise = null;
    throw error;
  });
  return sessionPromise;
};

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
  return probability >= DEFAULT_THRESHOLD ? "phishing" : "trusted";
};

export const predictUrl = async (rawUrl, threshold = DEFAULT_THRESHOLD) => {
  try {
    const { url, features } = extractFeatures(rawUrl);
    if (!url) {
      throw new Error("invalid_url");
    }
    const ort = await loadOrt();
    const session = await ensureSession();

    const feeds = {
      url: new ort.Tensor("string", [url], [1, 1])
    };
    FEATURE_COLUMNS.forEach((name) => {
      const value = Number(features[name]) || 0;
      feeds[name] = new ort.Tensor("float32", new Float32Array([value]), [1, 1]);
    });

    const output = await session.run(feeds);
    const ordered = Object.values(output || {});
    const probTensor =
      output.probabilities || output.proba || output.output_probability || ordered.find((t) => t?.data);
    const labelTensor =
      output.label || output.output_label || ordered.find((t, idx) => idx !== ordered.indexOf(probTensor));

    let probability = null;
    if (probTensor?.data?.length) {
      const data = probTensor.data;
      probability = data.length >= 2 ? Number(data[data.length - 1]) : Number(data[0]);
    }

    let verdict = null;
    if (probability !== null && !Number.isNaN(probability)) {
      verdict = probability >= threshold ? "phishing" : "trusted";
    } else if (typeof labelTensor?.data?.[0] === "number") {
      verdict = Number(labelTensor.data[0]) === 1 ? "phishing" : "trusted";
    }

    return {
      status: "ok",
      verdict
    };
  } catch (error) {
    console.warn("ML predict failed", error);
    try {
      const { url, features } = extractFeatures(rawUrl);
      if (!url) throw new Error("invalid_url");
      const verdict = heuristicVerdict(features);
      return { status: "fallback", verdict, error: error?.message || String(error) };
    } catch (inner) {
      return {
        status: "error",
        verdict: null,
        error: error?.message || String(error)
      };
    }
  }
};

export const getModelStatus = async () => {
  try {
    await ensureSession();
    return "ready";
  } catch (error) {
    return "error";
  }
};
