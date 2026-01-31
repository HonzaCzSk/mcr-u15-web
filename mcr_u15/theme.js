(function () {
  const KEY = "theme"; // localStorage: "light" | "dark" | null
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  const mql = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function systemPrefersDark() {
    return !!(mql && mql.matches);
  }

  function getSavedTheme() {
    const v = localStorage.getItem(KEY);
    return (v === "light" || v === "dark") ? v : null;
  }

  function setBtnLabel(activeMode, source) {
    // source: "saved" | "system"
    if (source === "system") btn.textContent = "SYSTEM";
    else btn.textContent = (activeMode === "dark") ? "LIGHT" : "DARK";
  }

  function applyTheme(theme) {
    // theme: "light" | "dark" | null (null = system)
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
      setBtnLabel(theme, "saved");
      return;
    }

    const sys = systemPrefersDark() ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", sys);
    setBtnLabel(sys, "system");
  }

  function cycleTheme() {
    // cyklus: system -> dark -> light -> system ...
    const saved = getSavedTheme(); // null | "dark" | "light"
    const next = (saved === null) ? "dark" : (saved === "dark" ? "light" : null);

    if (next === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);

    applyTheme(next);
  }

  // init
  applyTheme(getSavedTheme());

  // reaguj na změnu systému jen když není uložená volba
  if (mql) {
    mql.addEventListener("change", () => {
      if (getSavedTheme() === null) applyTheme(null);
    });
  }

  // jediný click handler (Shift+klik = reset na systém)
  btn.addEventListener("click", (e) => {
    if (e.shiftKey) {
      localStorage.removeItem(KEY);
      applyTheme(null);
      return;
    }
    cycleTheme();
  });
})();
