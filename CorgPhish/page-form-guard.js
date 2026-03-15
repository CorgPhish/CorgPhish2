// RU: Page-world guard для SPA/JS-форм. Слушает состояние от content script и режет submit/fetch/XHR/beacon.
// EN: Page-world guard for SPA/JS forms. Receives state from content script and blocks submit/fetch/XHR/beacon.
(() => {
  if (window.__corgphishPageGuardInstalled) return;
  window.__corgphishPageGuardInstalled = true;

  const UPDATE_EVENT = "corgphish:page-guard-state";
  const BLOCKED_EVENT = "corgphish:page-guard-blocked";
  const guardRoot = document.documentElement;
  const state = { blockForms: false };

  if (guardRoot) {
    guardRoot.dataset.corgphishPageGuardInstalled = "1";
  }

  const signalBlocked = () => {
    document.dispatchEvent(new CustomEvent(BLOCKED_EVENT, { detail: { kind: "form" } }));
  };

  const shouldBlockRequest = (method, body) => {
    if (!state.blockForms) return false;
    const cleanMethod = String(method || "GET").toUpperCase();
    return body != null || !["GET", "HEAD", "OPTIONS"].includes(cleanMethod);
  };

  document.addEventListener(
    UPDATE_EVENT,
    (event) => {
      state.blockForms = Boolean(event?.detail?.blockForms);
    },
    true
  );

  const nativeSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function patchedSubmit(...args) {
    if (state.blockForms) {
      signalBlocked();
      return;
    }
    return nativeSubmit.apply(this, args);
  };

  if (typeof HTMLFormElement.prototype.requestSubmit === "function") {
    const nativeRequestSubmit = HTMLFormElement.prototype.requestSubmit;
    HTMLFormElement.prototype.requestSubmit = function patchedRequestSubmit(...args) {
      if (state.blockForms) {
        signalBlocked();
        return;
      }
      return nativeRequestSubmit.apply(this, args);
    };
  }

  if (typeof window.fetch === "function") {
    const nativeFetch = window.fetch;
    window.fetch = function patchedFetch(input, init = {}) {
      let method = init?.method;
      let body = init?.body;
      if (typeof Request !== "undefined" && input instanceof Request) {
        method = method || input.method;
        body = body ?? input.body;
      }
      if (shouldBlockRequest(method, body)) {
        signalBlocked();
        return Promise.reject(new Error("corgphish_blocked_request"));
      }
      return nativeFetch.apply(this, arguments);
    };
  }

  const nativeXhrOpen = XMLHttpRequest.prototype.open;
  const nativeXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    this.__corgphishMethod = method;
    return nativeXhrOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function patchedSend(body) {
    if (shouldBlockRequest(this.__corgphishMethod, body)) {
      signalBlocked();
      try {
        this.abort();
      } catch (error) {
        // noop
      }
      return;
    }
    return nativeXhrSend.call(this, body);
  };

  if (typeof navigator.sendBeacon === "function") {
    const nativeBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function patchedSendBeacon(url, data) {
      if (state.blockForms && data != null) {
        signalBlocked();
        return false;
      }
      return nativeBeacon.call(this, url, data);
    };
  }
})();
