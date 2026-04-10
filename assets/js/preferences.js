(() => {
  const KEY = "mcr_cookie_consent_v1";

  function hasConsent() {
    try { return localStorage.getItem(KEY) === "granted"; } catch { return true; }
  }

  function grant() {
    try { localStorage.setItem(KEY, "granted"); } catch {}
    const el = document.getElementById("site-notice");
    if (el) el.remove();
  }

  function show() {
    if (document.getElementById("site-notice")) return;

    const el = document.createElement("div");
    el.id = "site-notice";
    el.innerHTML = `
      <div class="site-notice__inner">
        <div class="site-notice__icon">🍪</div>
        <div class="site-notice__text">
          <strong>Tento web ukládá vaše preference</strong>
          <span>Používáme <em>localStorage</em> pouze pro uložení zvoleného barevného motivu. Žádná osobní data neshromažďujeme.</span>
        </div>
        <div class="site-notice__actions">
          <button class="notice-btn" id="cookie-accept" type="button">Rozumím</button>
        </div>
      </div>
    `;

    document.body.appendChild(el);

    // force reflow, pak přidej třídu pro transition
    el.getBoundingClientRect();
    el.classList.add("is-visible");

    document.getElementById("cookie-accept").addEventListener("click", grant);
  }

  function init() {
    if (hasConsent()) return;
    show();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();