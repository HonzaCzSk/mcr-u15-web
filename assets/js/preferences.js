(() => {
  const CONSENT_KEY = "mcr_cookie_consent_v1";

  function hasConsent() {
    return localStorage.getItem(CONSENT_KEY) === "granted";
  }

  function grantConsent() {
    localStorage.setItem(CONSENT_KEY, "granted");
    hideBanner();
  }

  function hideBanner() {
    const el = document.getElementById("cookie-banner");
    if (!el) return;
    el.classList.add("is-hiding");
    setTimeout(() => el.remove(), 350);
  }

  function showBanner() {
    const banner = document.createElement("div");
    banner.id = "cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Souhlas s cookies");
    banner.innerHTML = `
      <div class="cookie-banner__inner">
        <div class="cookie-banner__icon" aria-hidden="true">🍪</div>
        <div class="cookie-banner__text">
          <strong>Tento web ukládá vaše preference</strong>
          <span>Používáme <em>localStorage</em> pouze pro uložení vašeho zvoleného barevného motivu (tmavý / světlý / systém). Žádná osobní data neshromažďujeme.</span>
        </div>
        <div class="cookie-banner__actions">
          <button class="cookie-btn cookie-btn--accept" id="cookie-accept" type="button">
            Rozumím
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // timeout aby proběhl CSS transition při objevení
    setTimeout(() => banner.classList.add("is-visible"), 50);

    document.getElementById("cookie-accept").addEventListener("click", grantConsent);
  }

  function init() {
    if (hasConsent()) return; // souhlas už byl udělen
    showBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();