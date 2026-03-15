// RU: Page-world guard для SPA/JS-форм. Слушает состояние от content script и режет submit/fetch/XHR/beacon.
// EN: Page-world guard for SPA/JS forms. Receives state from content script and blocks submit/fetch/XHR/beacon.
(() => {
  if (window.__corgphishPageGuardInstalled) return;
  window.__corgphishPageGuardInstalled = true;

  const UPDATE_EVENT = "corgphish:page-guard-state";
  const BLOCKED_EVENT = "corgphish:page-guard-blocked";
  const SUBMIT_INTENT_WINDOW_MS = 2500;
  const BLOCK_SIGNAL_THROTTLE_MS = 1200;
  const guardRoot = document.documentElement;
  const state = {
    blockForms: false,
    submitIntentUntil: 0,
    lastBlockedAt: 0
  };

  if (guardRoot) {
    guardRoot.dataset.corgphishPageGuardInstalled = "1";
  }

  const armSubmitIntent = (source, extra = {}) => {
    if (!state.blockForms) return;
    state.submitIntentUntil = Date.now() + SUBMIT_INTENT_WINDOW_MS;
    console.info("CorgPhish form guard debug", {
      source,
      href: window.location.href,
      blockForms: state.blockForms,
      ...extra
    });
  };

  const signalBlocked = (source, extra = {}) => {
    const now = Date.now();
    if (now - state.lastBlockedAt < BLOCK_SIGNAL_THROTTLE_MS) {
      return;
    }
    state.lastBlockedAt = now;
    state.submitIntentUntil = 0;
    console.info("CorgPhish form guard debug", {
      source,
      href: window.location.href,
      ...extra
    });
    document.dispatchEvent(
      new CustomEvent(BLOCKED_EVENT, {
        detail: { kind: "form", source, ...extra }
      })
    );
  };

  const shouldBlockRequest = (method, body) => {
    if (!state.blockForms) return false;
    if (Date.now() > state.submitIntentUntil) return false;
    const cleanMethod = String(method || "GET").toUpperCase();
    return body != null || !["GET", "HEAD", "OPTIONS"].includes(cleanMethod);
  };

  const isSubmitLikeControl = (node) => {
    const control = node?.closest?.("button,input,[role='button']");
    if (!control) return false;
    if (control.matches?.('input[type="submit"], input[type="image"], input[type="button"]')) {
      return true;
    }
    if (control.matches?.('button, [role="button"]')) {
      return true;
    }
    return false;
  };

  document.addEventListener(
    UPDATE_EVENT,
    (event) => {
      state.blockForms = Boolean(event?.detail?.blockForms);
      console.info("CorgPhish form guard debug", {
        source: "state-update",
        blockForms: state.blockForms,
        href: window.location.href
      });
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!state.blockForms) return;
      const target = event.target;
      if (!target) return;
      if (target.closest?.("form") || isSubmitLikeControl(target)) {
        armSubmitIntent("click-intent");
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (!state.blockForms) return;
      if (event.key !== "Enter") return;
      if (!event.target?.closest?.("form")) return;
      armSubmitIntent("keydown-intent");
    },
    true
  );

  document.addEventListener(
    "submit",
    (event) => {
      if (!state.blockForms) return;
      armSubmitIntent("submit-intent");
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
      signalBlocked("submit-event");
    },
    true
  );

  const nativeSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function patchedSubmit(...args) {
    if (state.blockForms) {
      signalBlocked("native-submit");
      return;
    }
    return nativeSubmit.apply(this, args);
  };

  if (typeof HTMLFormElement.prototype.requestSubmit === "function") {
    const nativeRequestSubmit = HTMLFormElement.prototype.requestSubmit;
    HTMLFormElement.prototype.requestSubmit = function patchedRequestSubmit(...args) {
      if (state.blockForms) {
        signalBlocked("request-submit");
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
        signalBlocked("fetch", {
          method: String(method || "GET").toUpperCase()
        });
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
      signalBlocked("xhr", {
        method: String(this.__corgphishMethod || "GET").toUpperCase()
      });
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
        signalBlocked("sendBeacon");
        return false;
      }
      return nativeBeacon.call(this, url, data);
    };
  }
})();
