// RU: Проверка домена: trusted/whitelist → легитимный, похожие → подозрительные, остальное через ML.
// EN: Domain inspection: trusted/whitelist → trusted, similar → suspicious, otherwise ML.
import { loadBlacklist, loadTrustedList } from "./data.js";
import { resolveInspection } from "./inspection-core.js";
import { normalizeHost } from "./utils.js";
import { predictUrl } from "./model.js";

const CACHE_TTL_MS = 5000;
let lastInspection = null;

// Главный решатель вердикта: объединяет списки, сигналы страницы, похожесть домена и ML.
export const inspectDomain = async (
  hostname,
  customWhitelist = [],
  fullUrl = "",
  signals = {},
  options = {}
) => {
  let baseTrusted = [];
  try {
    baseTrusted = await loadTrustedList();
  } catch (error) {
    baseTrusted = [];
  }
  const blacklist = await loadBlacklist();
  const cleanDomain = normalizeHost(hostname);
  if (!cleanDomain) {
    throw new Error("errors.invalidDomain");
  }

  const strictMode = Boolean(options?.strictMode);
  const brandDomain = normalizeHost(signals?.brand?.domain || "");
  const formRisk = signals?.form || null;
  // Ключ кэша зависит не только от URL, но и от сигналов формы/бренда и strict mode.
  const signalKey = JSON.stringify({
    brand: brandDomain,
    form: normalizeHost(formRisk?.actionHost || ""),
    formReason: formRisk?.reason || "",
    strict: strictMode
  });
  const cacheKey = `${fullUrl || cleanDomain}::${customWhitelist.join("|")}::${blacklist.join("|")}::${signalKey}`;
  if (lastInspection && lastInspection.key === cacheKey && Date.now() - lastInspection.ts < CACHE_TTL_MS) {
    return { ...lastInspection.result, cached: true };
  }

  const result = await resolveInspection({
    hostname: cleanDomain,
    customWhitelist,
    fullUrl,
    signals,
    options,
    baseTrusted,
    blacklist,
    predict: predictUrl,
    now: Date.now
  });
  lastInspection = { key: cacheKey, ts: Date.now(), result };
  return result;
};
