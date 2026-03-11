// RU: Небольшой in-memory mock Chrome API для unit-тестов data layer.
// EN: Small in-memory Chrome API mock for unit tests.
export const createChromeMock = ({
  local = {},
  sync = {},
  trusted = [],
  lastError = null
} = {}) => {
  const state = {
    local: { ...local },
    sync: { ...sync },
    trusted: [...trusted]
  };

  // Повторяем поведение chrome.storage.get для строк, массивов и объекта с fallback-значениями.
  const read = (store, query) => {
    if (Array.isArray(query)) {
      return Object.fromEntries(query.map((key) => [key, store[key]]));
    }
    if (typeof query === "string") {
      return { [query]: store[query] };
    }
    if (query && typeof query === "object") {
      return Object.fromEntries(
        Object.entries(query).map(([key, fallback]) => [key, key in store ? store[key] : fallback])
      );
    }
    return { ...store };
  };

  const write = (store, patch) => {
    Object.assign(store, patch || {});
  };

  return {
    state,
    runtime: {
      lastError,
      getURL: (path) => `chrome-extension://test/${path}`,
      sendMessage: (message, callback) => {
        if (message?.type === "getTrustedDomains") {
          callback?.({ trusted: [...state.trusted] });
          return;
        }
        callback?.({});
      }
    },
    storage: {
      local: {
        get: (query, callback) => callback(read(state.local, query)),
        set: (patch, callback) => {
          write(state.local, patch);
          callback?.();
        }
      },
      sync: {
        get: (query, callback) => callback(read(state.sync, query)),
        set: (patch, callback) => {
          write(state.sync, patch);
          callback?.();
        }
      }
    }
  };
};
