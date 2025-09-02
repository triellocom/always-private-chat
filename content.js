(() => {
  const LOG = "[Always Temp/Private]";
  let lastClick = 0;
  const COOLDOWN_MS = 1500;

  const rTurnOnTemporary = /\bturn\s*on\s*temporary\b/i;
  const rPrivateAria = /\bswitch\s*to\s*private\b/i;

  const visibleText = (el) => (el?.textContent || "").trim();
  function getAccName(el) {
    if (!el) return "";
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel.trim();
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      return labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((n) => (n.innerText || n.textContent || "").trim())
        .join(" ")
        .trim();
    }
    const title = el.getAttribute("title");
    if (title) return title.trim();
    return visibleText(el);
  }

  function isVisibleEnabled(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0;
    const isDisabled = el.matches(":disabled,[aria-disabled='true']");
    return isVisible && !isDisabled;
  }

  function findChatGPTButton() {
    // Prefer aria-label match (fast path)
    let el =
      document.querySelector('button[aria-label="Turn on temporary chat"]') ||
      document.querySelector('button[aria-label*="Turn on temporary" i]');

    if (el && isVisibleEnabled(el)) return el;

    // Fallback: scan interactive controls and match acc name/text
    const candidates = [
      ...document.querySelectorAll('button, [role="button"], [role="switch"], input[type="checkbox"]')
    ];
    for (const c of candidates) {
      const name = (getAccName(c) + " " + visibleText(c)).trim();
      if (!name) continue;
      // Skip if it looks like already ON (“Turn off temporary”)
      if (/\bturn\s*off\s*temporary\b/i.test(name)) continue;
      if (rTurnOnTemporary.test(name) && isVisibleEnabled(c)) return c;
    }
    return null;
  }

  function findGrokButton() {
    // Primary selector by aria-label
    let el =
      document.querySelector('a[aria-label="Switch to Private Chat"]') ||
      document.querySelector('a[aria-label*="Switch to Private" i]') ||
      document.querySelector('a[href$="#private"]');

    if (!el) return null;

    // Only click if it's not already open (data-state="closed" or missing)
    const state = el.getAttribute("data-state");
    if (state && /open|active|on/i.test(state)) return null;
    return isVisibleEnabled(el) ? el : null;
  }

  function tryEnable() {
    const now = Date.now();
    if (now - lastClick < COOLDOWN_MS) return;

    // Try ChatGPT first
    let target = findChatGPTButton();
    if (!target) {
      // Then Grok
      target = findGrokButton();
    }
    if (!target) return;

    target.click();
    lastClick = now;
    console.debug(LOG, "Clicked to enable:", getAccName(target) || target.tagName);
  }

  const observer = new MutationObserver(() => tryEnable());

  function start() {
    tryEnable();
    setTimeout(tryEnable, 400);
    setTimeout(tryEnable, 1200);
    return;

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });

    // SPA navigations
    const _pushState = history.pushState;
    history.pushState = function () {
      const r = _pushState.apply(this, arguments);
      setTimeout(tryEnable, 50);
      return r;
    };
    window.addEventListener("popstate", () => setTimeout(tryEnable, 50));

    // Fallback heartbeat
    setInterval(tryEnable, 5000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
