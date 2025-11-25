import { createRandomForest } from "./ml/randomForest.js";

const CLASSIFIER_PATH = "ml/classifier.json";
const CLASSIFICATION_PREFIX = "classification:";

const classificationCache = new Map();
let classifierData = null;
let randomForest = null;

const classificationKey = (tabId) => `${CLASSIFICATION_PREFIX}${tabId}`;

const loadClassifierData = async () => {
  if (classifierData) {
    return classifierData;
  }
  try {
    const response = await fetch(chrome.runtime.getURL(CLASSIFIER_PATH));
    if (!response.ok) {
      console.warn("Не удалось загрузить classifier.json", response.statusText);
      return null;
    }
    classifierData = await response.json();
    return classifierData;
  } catch (error) {
    console.warn("Ошибка загрузки classifier.json", error);
    return null;
  }
};

const ensureForest = async () => {
  if (randomForest) {
    return randomForest;
  }
  const data = await loadClassifierData();
  if (!data) {
    return null;
  }
  randomForest = createRandomForest(data);
  return randomForest;
};

const storeClassification = async (tabId, payload) => {
  if (typeof tabId !== "number") {
    return;
  }
  classificationCache.set(tabId, payload);
  await chrome.storage.local.set({ [classificationKey(tabId)]: payload });
};

const getStoredClassification = async (tabId) => {
  if (classificationCache.has(tabId)) {
    return classificationCache.get(tabId);
  }
  const key = classificationKey(tabId);
  const items = await chrome.storage.local.get(key);
  if (items[key]) {
    classificationCache.set(tabId, items[key]);
    return items[key];
  }
  return null;
};

const removeClassification = async (tabId) => {
  classificationCache.delete(tabId);
  await chrome.storage.local.remove(classificationKey(tabId));
};

const summarizeFeatures = (features = {}) => {
  const summary = { legitimate: 0, suspicious: 0, phishing: 0 };
  Object.values(features).forEach((value) => {
    const numericValue = Number.parseInt(value, 10);
    if (numericValue === -1) {
      summary.legitimate += 1;
    } else if (numericValue === 0) {
      summary.suspicious += 1;
    } else if (numericValue === 1) {
      summary.phishing += 1;
    }
  });
  summary.total = summary.legitimate + summary.suspicious + summary.phishing || 1;
  summary.legitimatePercent = (summary.legitimate / summary.total) * 100;
  summary.suspiciousPercent = (summary.suspicious / summary.total) * 100;
  summary.phishingPercent = (summary.phishing / summary.total) * 100;
  summary.heuristicPhish = summary.phishingPercent > 35;
  return summary;
};

const classifyFeatures = async ({ features = {}, url = null, tabId = null }) => {
  const summary = summarizeFeatures(features);
  const featureKeys = Object.keys(features);
  const sample = {};
  featureKeys.forEach((key) => {
    sample[key] = Number.parseInt(features[key], 10) || 0;
  });

  let mlVerdict = null;
  const forest = await ensureForest();
  if (forest) {
    const prediction = forest.predict([sample]);
    if (prediction && prediction[0]) {
      mlVerdict = {
        isPhishing: Boolean(prediction[0][0]),
        confidence: Number(prediction[0][1])
      };
    }
  }

  const verdict = {
    isPhishing: mlVerdict?.isPhishing ?? summary.heuristicPhish,
    confidence: mlVerdict?.confidence ?? summary.phishingPercent,
    source: mlVerdict ? "ml" : "heuristic",
    legitimatePercent: summary.legitimatePercent,
    suspiciousPercent: summary.suspiciousPercent,
    phishingPercent: summary.phishingPercent,
    updatedAt: Date.now(),
    url
  };

  return {
    tabId,
    url,
    verdict,
    features,
    featureKeys,
    vector: featureKeys.map((key) => sample[key])
  };
};

const handleFeatureMessage = async (message, sender) => {
  const payload = await classifyFeatures({
    features: message.features,
    url: message.url,
    tabId: sender?.tab?.id
  });
  if (typeof sender?.tab?.id === "number") {
    await storeClassification(sender.tab.id, payload);
  }
  return payload;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) {
    return;
  }

  if (message.type === "pageFeatures") {
    handleFeatureMessage(message, sender)
      .then((payload) => sendResponse({ status: "ok", classification: payload }))
      .catch((error) => {
        console.error("Ошибка классификации", error);
        sendResponse({ status: "error", error: error?.message });
      });
    return true;
  }

  if (message.type === "getClassification") {
    const tabId = message.tabId ?? sender?.tab?.id ?? null;
    if (typeof tabId !== "number") {
      sendResponse({ classification: null });
      return false;
    }
    getStoredClassification(tabId).then((classification) => {
      sendResponse({ classification });
    });
    return true;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  removeClassification(tabId);
});
