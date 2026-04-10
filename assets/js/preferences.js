(() => {
  const KEY = "mcr_cookie_consent_v1";

  function hasConsent() {
    try { return localStorage.getItem(KEY) === "granted"; } catch { return true; }
  }

  function grant() {
    try { localStorage.setItem(KEY, "granted"); } catch {}
    const el = document.getElementById("cookie-banner");
    if (el) el.remove();
  }

  function show() {
    if (document.getElementById("cookie-banner")) return;

    const el = document.createElement("div");
    el.id = "cookie-banner";
    el.innerHTML = `
      <div class="cookie-banner__inner">
        <div class="cookie-banner__icon">🍪</div>
        <div class="cookie-banner__text">
          <strong>Tento web ukládá vaše preference</strong>
          <span>Používáme <em>localStorage</em> pouze pro uložení zvoleného barevného motivu. Žádná osobní data neshromažďujeme.</span>
        </div>
        <div class="cookie-banner__actions">
          <button class="cookie-btn--accept" id="cookie-accept" type="button">Rozumím</button>
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