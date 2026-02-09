(async () => {
  const grid = document.getElementById("contacts-grid");
  const statusEl = document.getElementById("contacts-status");
  const updatedEl = document.getElementById("contacts-updated");

  // Kdyby něco nebylo v DOMu (ať to nespadne potichu)
  if (!grid || !statusEl || !updatedEl) {
    console.error("Kontakty: chybí required elementy v DOMu.");
    return;
  }

  try {
    // Kontakty se berou z info.json (stejně jako dřív)
    const res = await fetch("../../data/info.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`info.json fetch failed: ${res.status}`);

    const data = await res.json();

    statusEl.textContent = "Načteno.";
    if (data.updated) {
      updatedEl.style.display = "";
      updatedEl.textContent = `Aktualizováno: ${data.updated}`;
    }

    const contacts = Array.isArray(data.contacts) ? data.contacts : [];
    if (!contacts.length) {
      grid.innerHTML = `
        <div class="card">
          <h2 class="h2">Kontakty</h2>
          <p class="mini">V info.json zatím nejsou žádné kontakty.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = contacts.map(renderCard).join("");
  } catch (e) {
    console.error(e);
    statusEl.textContent = "Nepodařilo se načíst kontakty.";
    grid.innerHTML = `
      <div class="card">
        <h2 class="h2">Kontakty</h2>
        <p class="mini">Data se nepodařilo načíst. Zkontroluj cestu k ../../data/info.json</p>
      </div>
    `;
  }

function renderCard(c) {
  const type = String(c.type || "").toLowerCase();
  const label = esc(c.label || "Kontakt");
  const name = c.name ? ` <span class="mini">(${esc(c.name)})</span>` : "";
  const value = esc(c.value || "");
  const icon = iconFor(type);

  // EMAIL – kopírování
  if (type === "email") {
    const webmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(c.value)}`;

    return `
      <div class="card">
        <h2 class="h2">${icon} ${label}${name}</h2>

        <div class="linklist">
          <button class="copylink" data-copy="${value}">
            ${value}
          </button>
          <a href="${webmailHref}" target="_blank" rel="noopener">
            Otevřít v Gmailu →
          </a>
        </div>

        <p class="mini copyhint" hidden>Zkopírováno do schránky</p>
      </div>
    `;
  }

  // ostatní typy (telefon, instagram)
  const href = esc(c.href || "#");
  const isExternal = /^https?:\/\//i.test(href);
  const extra = isExternal ? ` target="_blank" rel="noopener"` : "";

  return `
    <div class="card">
      <h2 class="h2">${icon} ${label}${name}</h2>
      <div class="linklist">
        <a href="${href}"${extra}>${value} →</a>
      </div>
      <p class="mini">Klikni pro otevření.</p>
    </div>
  `;
}

  function iconFor(type) {
    if (type === "email") return "✉️";
    if (type === "phone") return "📞";
    if (type === "instagram") return "📷";
    return "🔗";
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  }
})();

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;

  const text = btn.getAttribute("data-copy");
  try {
    await navigator.clipboard.writeText(text);

    const hint = btn.closest(".card").querySelector(".copyhint");
    if (hint) {
      hint.hidden = false;
      setTimeout(() => (hint.hidden = true), 1500);
    }
  } catch (err) {
    console.error("Copy failed", err);
  }
});
