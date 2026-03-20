// RU: Offscreen-документ запускает ORT вне контекста страницы, чтобы CSP сайта не ломал ML.
// EN: Offscreen document runs ORT outside page context so site CSP does not break ML.
import {
  DEFAULT_HEURISTIC_THRESHOLD,
  DEFAULT_MODEL_THRESHOLD,
  FEATURE_COLUMNS,
  extractFeatures,
  heuristicVerdict
} from "./popup/model-core.js";

const MODEL_PATH = chrome.runtime.getURL("models/hybrid_tfidf_num.onnx");
const ORT_BASE = chrome.runtime.getURL("vendor/ort/");
const DEFAULT_THRESHOLD = DEFAULT_MODEL_THRESHOLD;
const HEURISTIC_THRESHOLD = DEFAULT_HEURISTIC_THRESHOLD;

let ortScriptPromise = null;
let sessionPromise = null;

// Runtime ORT загружаем один раз и переиспользуем между запросами.
const loadOrt = () => {
  if (globalThis.ort) {
    return Promise.resolve(globalThis.ort);
  }
  if (!ortScriptPromise) {
    ortScriptPromise = new Promise((resolve, reject) => {
      const url = chrome.runtime.getURL("vendor/ort/ort.min.js");
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = () => resolve(globalThis.ort);
      script.onerror = () => reject(new Error("ort_load_failed"));
      document.head.appendChild(script);
    });
  }
  return ortScriptPromise;
};

// Сессия модели тяжёлая, поэтому кешируется на весь жизненный цикл offscreen-документа.
const ensureSession = async () => {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const ort = await loadOrt();
    if (!ort?.env?.wasm) {
      throw new Error("ort_env_unavailable");
    }
    ort.env.wasm.wasmPaths = ORT_BASE;
    ort.env.wasm.numThreads = 1;
    return ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "disabled"
    });
  })();
  sessionPromise = sessionPromise.catch((error) => {
    sessionPromise = null;
    throw error;
  });
  return sessionPromise;
};

// Основной сценарий: модель; резервный — эвристика с тем же бинарным вердиктом.
const predictOffscreen = async (rawUrl, threshold = DEFAULT_THRESHOLD) => {
  const { url, features } = extractFeatures(rawUrl);
  if (!url) {
    throw new Error("invalid_url");
  }
  try {
    // URL подаётся как string-тензор, а числовые признаки — отдельными float32 тензорами.
    const ort = await loadOrt();
    const session = await ensureSession();
    const feeds = { url: new ort.Tensor("string", [url], [1, 1]) };
    FEATURE_COLUMNS.forEach((name) => {
      const value = Number(features[name]) || 0;
      feeds[name] = new ort.Tensor("float32", new Float32Array([value]), [1, 1]);
    });
    const output = await session.run(feeds);
    const ordered = Object.values(output || {});
    const probTensor =
      output.probabilities ||
      output.proba ||
      output.output_probability ||
      ordered.find((t) => t?.data);
    const labelTensor =
      output.label || output.output_label || ordered.find((t, idx) => idx !== ordered.indexOf(probTensor));

    // Модель может вернуть либо probabilities, либо только label — поддерживаем оба варианта.
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
    return { status: "ok", verdict, probability, threshold };
  } catch (error) {
    // Любая ошибка ORT/сессии не должна ломать защиту: сразу уходим в локальную эвристику.
    const fallback = heuristicVerdict(features, HEURISTIC_THRESHOLD);
    return {
      status: "fallback",
      verdict: fallback.verdict,
      probability: fallback.probability,
      error: error?.message || String(error)
    };
  }
};

// Единственная внешняя точка входа для background.js.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "predictOffscreen") {
    predictOffscreen(message.url, message.threshold).then(
      (result) => sendResponse?.({ ok: true, result }),
      (err) => sendResponse?.({ ok: false, error: err?.message || String(err) })
    );
    return true;
  }
  return false;
});
