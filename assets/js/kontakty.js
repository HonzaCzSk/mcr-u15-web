(async () => {
  const grid = document.getElementById("contacts-grid");
  const statusEl = document.getElementById("contacts-status");
  const updatedEl = document.getElementById("contacts-updated");

  try {
    const res = await fetch("../../data/info.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`info.json fetch failed: ${res.status}`);
    const data = await res.json();

    if (statusEl) statusEl.textContent = "Načteno.";
    if (updatedEl && data.updated) {
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
    if (statusEl) statusEl.textContent = "Nepodařilo se načíst kontakty.";
    grid.innerHTML = `
      <div class="card">
        <h2 class="h2">Kontakty</h2>
        <p class="mini">Data se nepodařilo načíst. Zkontroluj cestu k ../assets/data/info.json</p>
      </div>
    `;
  }

  function renderCard(c) {
    const label = esc(c.label || "Kontakt");
    const name = c.name ? ` <span class="mini">(${esc(c.name)})</span>` : "";
    const value = esc(c.value || "");
    const href = esc(c.href || "#");
    const icon = iconFor(c.type);

    // externí odkazy (IG apod.) otevřít do nové karty
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
    if (type === "instagram") return "📸";
    return "🔗";
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }
})();
