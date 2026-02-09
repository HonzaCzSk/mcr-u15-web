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
        <div class="place">Hala Eliščino nábřeží</div>
        <div class="kv">
          <div class="k">Adresa</div>
          <div class="v">
            Eliščino nábřeží 777<br>
            Hradec Králové, 500 03
          </div>
        </div>
        <a class="link" href="${data.venue.mapsUrl}" target="_blank" rel="noopener">
          Google Maps →
        </a>
      `
    ));

    // 2) Doprava (MHD + Auto)
    const t = data.transport.items || [];

    // vezmeme první dvě položky jako MHD (pokud existují)
    const mhdParts = [];
    if (t[0]) mhdParts.push(t[0].replace(/\.$/, "")); // bez tečky na konci
    if (t[1]) mhdParts.push(t[1].replace(/\.$/, "")); // bez tečky na konci

    const mhdText = mhdParts.length
      ? `MHD: ${mhdParts.join(". ")}.`
      : null;

    // auto necháme jako třetí položku (pokud existuje), ale sjednotíme prefix
    let autoText = null;
    if (t[2]) {
      autoText = t[2].startsWith("Auto:")
        ? t[2]
        : `Auto: ${t[2]}`;
    }

    // sestavíme finální seznam (max 2 položky)
    const transportLines = [mhdText, autoText].filter(Boolean);

    cards.push(cardHTML(
      data.transport.title,
      `<ul class="list">
        ${transportLines.map(line => {
          // zvýraznění prefixu "MHD:" / "Auto:"
          const safe = escapeHTML(line).replace(/^(MHD|Auto):/, "<strong>$1:</strong>");
          return `<li>${safe}</li>`;
        }).join("")}
      </ul>`
    ));

    // 3) Parkování
    const parkingBadge = data.parking.status === "placeholder"
      ? `<span class="badge badge-muted">Upřesníme</span>`
      : "";

    const parkingBody = `
      ${data.parking.paragraphs
        .map(p => `<p>${escapeHTML(p)}</p>`)
        .join("")}

      ${data.parking.mapUrl ? `
        <a class="link" href="${data.parking.mapUrl}" target="_blank" rel="noopener">
          ${escapeHTML(data.parking.mapLabel || "Mapa parkovacích zón →")}
        </a>
      ` : ""}
    `;

    cards.push(cardHTML(
      `${data.parking.title} ${parkingBadge}`,
      parkingBody
    ));
        
    // 4) Vstupné
    const ticketsBody = data.tickets.paragraphs
      .map((p, i) =>
        `<p class="${i === 0 ? "ticket-main" : i === 1 ? "muted" : ""}">
          ${escapeHTML(p)}
        </p>`
      )
      .join("");

    cards.push(cardHTML(data.tickets.title, ticketsBody));

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
