// RU: Локальный инференс ONNX-модели (onnxruntime-web, wasm) с бинарным вердиктом.
// EN: Local ONNX inference (onnxruntime-web, wasm) with binary verdict only.
import { HEURISTIC_THRESHOLD, MODEL_THRESHOLD } from "./config.js";
import { FEATURE_COLUMNS, extractFeatures, heuristicVerdict } from "./model-core.js";

const MODEL_PATH = chrome.runtime.getURL("models/hybrid_tfidf_num.onnx");
const ORT_BASE = chrome.runtime.getURL("vendor/ort/");
const DEFAULT_THRESHOLD = MODEL_THRESHOLD;
const FALLBACK_THRESHOLD = HEURISTIC_THRESHOLD ?? DEFAULT_THRESHOLD;

let ortScriptPromise = null;
let sessionPromise = null;
let ortDisabled = false;

// RU: загрузка onnxruntime скрипта (классический `<script>`, чтобы глобально появился `ort`).
// EN:  onnxruntime via classic `<script>` so `ort` lands on global scope.
const loadOrt = () => {
  if (globalThis.ort) {
    return Promise.resolve(globalThis.ort);
  }
  if (!ortScriptPromise) {
    const waitForOrt = (timeoutMs = 8000) =>
      new Promise((resolve, reject) => {
        const started = Date.now();
        const tick = () => {
          if (globalThis.ort) {
            resolve(globalThis.ort);
            return;
          }
          if (Date.now() - started > timeoutMs) {
            reject(new Error("ort_load_failed"));
            return;
          }
          setTimeout(tick, 50);
        };
        tick();
      });

    ortScriptPromise = (async () => {
      // 1) Пробуем динамический import модуля (без eval).
      try {
        const mod = await import(chrome.runtime.getURL("vendor/ort/ort.module.js"));
        if (mod?.default || globalThis.ort) {
          return mod.default || globalThis.ort;
        }
      } catch (error) {
        // ignore, попробуем резервный путь
      }

      const url = chrome.runtime.getURL("vendor/ort/ort.min.js");

      // 2) Пытаемся просто подключить как <script src="chrome-extension://..."> (CSP страницы часто разрешает расширение).
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = url;
          script.async = true;
          script.onload = resolve;
          script.onerror = () => reject(new Error("ort_load_failed"));
          document.head.appendChild(script);
        });
        return waitForOrt();
      } catch (error) {
        // ignore, попробуем blob если разрешено
      }

      // 3) Фоллбек: blob + <script> (может быть заблокирован CSP, но лучше попытаться как последний вариант).
      const response = await fetch(url);
      if (!response.ok) throw new Error("ort_load_failed");
      const code = await response.text();
      const blob = new Blob([code], { type: "text/javascript" });
      const blobUrl = URL.createObjectURL(blob);
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = blobUrl;
        script.async = true;
        script.onload = () => {
          URL.revokeObjectURL(blobUrl);
          resolve();
        };
        script.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          reject(new Error("ort_load_failed"));
        };
        document.head.appendChild(script);
      });
      return waitForOrt();
    })();
  }
  return ortScriptPromise;
};

// RU: Создаём/кешируем сессию ORT.
// EN: Create/cache ORT session.
const ensureSession = async () => {
  if (sessionPromise) {
    return sessionPromise;
  }
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

// background — основной путь предсказания, потому что он не зависит от CSP открытого сайта.
const predictViaBackground = (rawUrl, threshold) =>
  new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        { type: "predictUrlBg", url: rawUrl, threshold },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          if (response?.ok) {
            resolve(response.result);
          } else {
            reject(new Error(response?.error || "bg_predict_failed"));
          }
        }
      );
    } catch (err) {
      reject(err);
    }
  });

// RU: Предсказать вердикт (trusted|phishing) по URL.
// EN: Predict verdict (trusted|phishing) for URL.
export const predictUrl = async (rawUrl, threshold = DEFAULT_THRESHOLD) => {
  // 1) Сначала пробуем предсказание в сервис-воркере (не зависит от CSP страницы).
  try {
    const bgResult = await predictViaBackground(rawUrl, threshold);
    if (bgResult?.verdict) {
      return { ...bgResult, status: bgResult.status || "ok" };
    }
  } catch (error) {
    console.warn("CorgPhish: bg predict failed", error);
  }

  if (ortDisabled) {
    try {
      const { url, features } = extractFeatures(rawUrl);
      if (!url) throw new Error("invalid_url");
      const fallback = heuristicVerdict(features, FALLBACK_THRESHOLD, { includeBrandPenalty: true });
      return { status: "fallback", verdict: fallback.verdict, probability: fallback.probability, error: "ort_disabled" };
    } catch (inner) {
      return {
        status: "error",
        verdict: null,
        error: "ort_disabled"
      };
    }
  }

  // 2) Если background не помог, пробуем локальный ORT прямо в popup.
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
      verdict,
      probability,
      threshold
    };
  } catch (error) {
    console.warn("ML predict failed", error);
    const message = String(error?.message || error || "");
    // Известные падения ORT отключают повторные попытки, чтобы не спамить одними и теми же ошибками.
    if (
      /NormalizerNorm/i.test(message) ||
      /tensor\(float\).*tensor\(double\)/i.test(message) ||
      /ort_load_failed/i.test(message)
    ) {
      ortDisabled = true;
    }
    try {
      const { url, features } = extractFeatures(rawUrl);
      if (!url) throw new Error("invalid_url");
      const fallback = heuristicVerdict(features, FALLBACK_THRESHOLD, { includeBrandPenalty: true });
      return { status: "fallback", verdict: fallback.verdict, probability: fallback.probability, error: error?.message || String(error) };
    } catch (inner) {
      return {
        status: "error",
        verdict: null,
        error: error?.message || String(error)
      };
    }
  }
};

// RU: Проверка готовности модели.
// EN: Check model readiness.
export const getModelStatus = async () => {
  try {
    await ensureSession();
    return "ready";
  } catch (error) {
    return "error";
  }
};
