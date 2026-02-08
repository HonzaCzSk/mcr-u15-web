(async () => {
  const cardsEl = document.getElementById("info-cards");
  const ctaEl = document.getElementById("info-cta");

  try {
    const res = await fetch("../../data/info.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`info.json fetch failed: ${res.status}`);
    const data = await res.json();

    const cards = [];

    // 1) Místo konání
    cards.push(cardHTML(
      "Místo konání",
      `
        <div class="kv">
          <div class="k">Adresa</div>
          <div class="v">${escapeHTML(data.venue.address)}</div>
        </div>
        <div class="muted">${escapeHTML(data.venue.note)}</div>
        <a class="link" href="${data.venue.mapsUrl}" target="_blank" rel="noopener">Google Maps →</a>
      `
    ));

    // 2) Doprava
    cards.push(cardHTML(
      data.transport.title,
      `<ul class="list">
        ${data.transport.items.map(x => `<li>${escapeHTML(x)}</li>`).join("")}
      </ul>`
    ));

    // 3) Parkování
    const parkingBadge = data.parking.status === "placeholder"
      ? `<span class="badge badge-muted">Upřesníme</span>`
      : "";
    cards.push(cardHTML(
      `${data.parking.title} ${parkingBadge}`,
      `<p>${escapeHTML(data.parking.text)}</p>`
    ));

    // 4) Vstupné
    cards.push(cardHTML(
      data.tickets.title,
      `<p class="big">${escapeHTML(data.tickets.text)}</p>`
    ));

    // 5) Organizační info
    cards.push(cardHTML(
      data.org.title,
      `<p>${escapeHTML(data.org.text)}</p>`
    ));

    cardsEl.innerHTML = cards.join("");

    // CTA
    ctaEl.innerHTML = `
      <a class="btn" href="${data.venue.mapsUrl}" target="_blank" rel="noopener">
        ${escapeHTML(data.cta.primaryText)}
      </a>
      <a class="btn btn-ghost" href="${escapeHTML(data.cta.contactsHref)}">
        ${escapeHTML(data.cta.secondaryText)}
      </a>
    `;
  } catch (e) {
    console.error(e);
    cardsEl.innerHTML = `<div class="card"><h2>Info</h2><p>Data se nepodařilo načíst.</p></div>`;
  }

  function cardHTML(title, body) {
    return `
      <article class="card">
        <h2>${title}</h2>
        <div class="card-body">${body}</div>
      </article>
    `;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, m => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }
})();
