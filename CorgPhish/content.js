(() => {
  const computeFeatures = () => {
    const result = {};
    try {
      const url = window.location.href;
      const urlDomain = window.location.hostname;
      const onlyDomain = urlDomain.replace(/^www\./, "");
      const ipRegex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
      const patt = /(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[0-9]?[0-9])(\.|$){4}/;
      const patt2 = /(0x([0-9][0-9]|[A-F][A-F]|[A-F][0-9]|[0-9][A-F]))(\.|$){4}/;

      // 1. IP Address
      if (ipRegex.test(urlDomain) || patt.test(urlDomain) || patt2.test(urlDomain)) {
        result["IP Address"] = "1";
      } else {
        result["IP Address"] = "-1";
      }

      // 2. URL Length
      if (url.length < 54) {
        result["URL Length"] = "-1";
      } else if (url.length >= 54 && url.length <= 75) {
        result["URL Length"] = "0";
      } else {
        result["URL Length"] = "1";
      }

      // 3. Tiny URL
      result["Tiny URL"] = onlyDomain.length < 7 ? "1" : "-1";

      // 4. @ Symbol
      result["@ Symbol"] = /@/.test(url) ? "1" : "-1";

      // 5. Redirecting using //
      result["Redirecting using //"] = url.lastIndexOf("//") > 7 ? "1" : "-1";

      // 6. (-) Prefix/Suffix in domain
      result["(-) Prefix/Suffix in domain"] = /-/.test(urlDomain) ? "1" : "-1";

      // 7. No. of Sub Domains
      const subDomainCount = (onlyDomain.match(/\./g) || []).length;
      if (subDomainCount === 1) {
        result["No. of Sub Domains"] = "-1";
      } else if (subDomainCount === 2) {
        result["No. of Sub Domains"] = "0";
      } else {
        result["No. of Sub Domains"] = "1";
      }

      // 8. HTTPS
      result["HTTPS"] = /^https:\/\//.test(url) ? "-1" : "1";

      // 9. Domain Registration Length (placeholder as original logic empty)
      result["Domain Reg Len"] = "0";

      // 10. Favicon
      const faviconNodes = document.getElementsByTagName("link");
      let favicon = undefined;
      for (let i = 0; i < faviconNodes.length; i++) {
        const rel = faviconNodes[i].getAttribute("rel");
        if (rel === "icon" || rel === "shortcut icon") {
          favicon = faviconNodes[i].getAttribute("href");
        }
      }
      if (!favicon) {
        result["Favicon"] = "-1";
      } else if (favicon.length === 12) {
        result["Favicon"] = "-1";
      } else if (new RegExp(urlDomain, "g").test(favicon)) {
        result["Favicon"] = "-1";
      } else {
        result["Favicon"] = "1";
      }

      // 11. Port
      result["Port"] = "-1";

      // 12. HTTPS in domain part
      result["HTTPS in URL's domain part"] = /https/.test(onlyDomain) ? "1" : "-1";

      // 13. Request URL (images)
      const imgTags = document.getElementsByTagName("img");
      let phishCount = 0;
      let legitCount = 0;
      const domainRegex = new RegExp(onlyDomain, "g");
      for (let i = 0; i < imgTags.length; i++) {
        const src = imgTags[i].getAttribute("src");
        if (!src) continue;
        if (domainRegex.test(src) || (src.charAt(0) === "/" && src.charAt(1) !== "/")) {
          legitCount++;
        } else {
          phishCount++;
        }
      }
      const totalImg = phishCount + legitCount || 1;
      const requestRatio = (phishCount / totalImg) * 100;
      if (requestRatio < 22) {
        result["Request URL"] = "-1";
      } else if (requestRatio >= 22 && requestRatio < 61) {
        result["Request URL"] = "0";
      } else {
        result["Request URL"] = "1";
      }

      // 14. URL of Anchor
      const anchorTags = document.getElementsByTagName("a");
      phishCount = 0;
      legitCount = 0;
      for (let i = 0; i < anchorTags.length; i++) {
        const href = anchorTags[i].getAttribute("href");
        if (!href) continue;
        if (
          domainRegex.test(href) ||
          href.charAt(0) === "#" ||
          (href.charAt(0) === "/" && href.charAt(1) !== "/")
        ) {
          legitCount++;
        } else {
          phishCount++;
        }
      }
      const totalAnchor = phishCount + legitCount || 1;
      const anchorRatio = (phishCount / totalAnchor) * 100;
      if (anchorRatio < 31) {
        result["Anchor"] = "-1";
      } else if (anchorRatio >= 31 && anchorRatio <= 67) {
        result["Anchor"] = "0";
      } else {
        result["Anchor"] = "1";
      }

      // 15. Links in script and link tags
      const scriptTags = document.getElementsByTagName("script");
      const linkTags = document.getElementsByTagName("link");
      phishCount = 0;
      legitCount = 0;
      for (let i = 0; i < scriptTags.length; i++) {
        const src = scriptTags[i].getAttribute("src");
        if (!src) continue;
        if (domainRegex.test(src) || (src.charAt(0) === "/" && src.charAt(1) !== "/")) {
          legitCount++;
        } else {
          phishCount++;
        }
      }
      for (let i = 0; i < linkTags.length; i++) {
        const href = linkTags[i].getAttribute("href");
        if (!href) continue;
        if (domainRegex.test(href) || (href.charAt(0) === "/" && href.charAt(1) !== "/")) {
          legitCount++;
        } else {
          phishCount++;
        }
      }
      const totalScriptLink = phishCount + legitCount || 1;
      const scriptLinkRatio = (phishCount / totalScriptLink) * 100;
      if (scriptLinkRatio < 17) {
        result["Script & Link"] = "-1";
      } else if (scriptLinkRatio >= 17 && scriptLinkRatio <= 81) {
        result["Script & Link"] = "0";
      } else {
        result["Script & Link"] = "1";
      }

      // 16. Server Form Handler
      const forms = document.getElementsByTagName("form");
      let sfh = "-1";
      for (let i = 0; i < forms.length; i++) {
        const action = forms[i].getAttribute("action");
        if (!action || action === "") {
          sfh = "1";
          break;
        } else if (!(action.charAt(0) === "/" || domainRegex.test(action))) {
          sfh = "0";
        }
      }
      result["SFH"] = sfh;

      // 17. Submitting to mail
      let mailtoFlag = "-1";
      for (let i = 0; i < forms.length; i++) {
        const action = forms[i].getAttribute("action");
        if (action && action.startsWith("mailto")) {
          mailtoFlag = "1";
          break;
        }
      }
      result["mailto"] = mailtoFlag;

      // 23. Using iFrames
      const iframes = document.getElementsByTagName("iframe");
      result["iFrames"] = iframes.length === 0 ? "-1" : "1";
    } catch (error) {
      console.warn("Feature extraction error", error);
    }
    return result;
  };

  const sendFeatures = () => {
    const features = computeFeatures();
    try {
      chrome.runtime.sendMessage({
        type: "pageFeatures",
        features,
        url: window.location.href
      });
    } catch (error) {
      console.warn("Unable to send features", error);
    }
  };

  if (document.readyState === "complete") {
    sendFeatures();
  } else {
    window.addEventListener("load", sendFeatures, { once: true });
  }

  chrome.runtime.onMessage.addListener((request) => {
    if (request?.action === "alert_user") {
      alert("Warning! Potential phishing detected on this page.");
    }
  });
})();
