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
        <div class="place">Hala Eliščino nábřeží / TJ Sokol Hradec Králové</div>
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
      ? `MHD: ${mhdParts.join("")}.`
      : null;

    // auto necháme jako třetí položku (pokud existuje), ale sjednotíme prefix
    let autoText = null;
    if (t[2]) {
      autoText = t[2].startsWith("Auto:")
        ? `Auto: ${t[2]}`
        : `Auto: ${t[2]}`;
    }
    
    // sestavíme finální seznam (max 2 položky)
    const transportLines = [mhdText, autoText].filter(Boolean);

    cards.push(cardHTML(
      data.transport.title,
      `<ul class="list transport-list">
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
        .map(p => `<p>${linkifyHTML(p)}</p>`)
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
          ${linkifyHTML(p)}
        </p>`
      )
      .join("");

    cards.push(cardHTML(data.tickets.title, ticketsBody));

    // 5) Organizační info
    cards.push(cardHTML(
      data.org.title,
      `<p>${linkifyHTML(data.org.text)}</p>`
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

  // Převede [text](url) a holé https:// URL na klikatelné odkazy.
  // Vše ostatní je stále escapováno přes escapeHTML.
  function linkifyHTML(s) {
    const result = [];
    const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s<>"']+)/g;
    let last = 0;
    let m;
    while ((m = linkRe.exec(String(s))) !== null) {
      result.push(escapeHTML(s.slice(last, m.index)));
      if (m[1] && m[2]) {
        // Markdown styl: [text](url)
        result.push(`<a class="link" href="${escapeHTML(m[2])}" target="_blank" rel="noopener">${escapeHTML(m[1])}</a>`);
      } else {
        // Holá URL
        result.push(`<a class="link" href="${escapeHTML(m[3])}" target="_blank" rel="noopener">${escapeHTML(m[3])}</a>`);
      }
      last = m.index + m[0].length;
    }
    result.push(escapeHTML(s.slice(last)));
    return result.join("");
  }
})();