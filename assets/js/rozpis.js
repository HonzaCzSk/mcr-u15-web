console.log("rozpis.js loaded");

(async () => {
  try {
    const url = `../data/rozpis.json?v=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();

    const pillHtml = (hala) => {
      const n = Number(hala);
      if (n === 1) return '<span class="pill pill--h1">Hala 1</span>';
      if (n === 2) return '<span class="pill pill--h2">Hala 2</span>';
      return `<span class="pill">Hala ${hala ?? "—"}</span>`;
    };

    const teamLink = (t) => {
      if (!t || !t.name) return "—";
      // když není id, vrať jen text
      if (!t.id) return t.name;
      return `<a href="tymy.html#tym-${t.id}" class="teamlink">${t.name}</a>`;
    };

    const matchHtml = (m) => {
      const vs = `${teamLink(m.home)} <span class="muted">–</span> ${teamLink(m.away)}`;
      const tv = m.tvcom
        ? ` <a class="muted" href="${m.tvcom}" target="_blank" rel="noopener">TVCOM</a>`
        : "";
      return `${vs}${tv}`;
    };

    const fillTable = (tableId, rows, renderRow) => {
      const tbl = document.getElementById(tableId);
      if (!tbl) return;
      const tbody = tbl.querySelector("tbody");
      if (!tbody) return;

      tbody.innerHTML = "";
      (Array.isArray(rows) ? rows : []).forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML = renderRow(r);
        tbody.appendChild(tr);
      });
    };

    // Pátek (skupiny)
    fillTable("tbl-rozpis-patek", data.patek, (r) => `
      <td>${r.cas ?? "—"}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${matchHtml(r)}</td>
      <td>${r.group ?? "—"}</td>
    `);

    // Sobota (skupiny)
    fillTable("tbl-rozpis-sobota", data.sobota, (r) => `
      <td>${r.cas ?? "—"}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${matchHtml(r)}</td>
      <td>${r.group ?? "—"}</td>
    `);

    // Neděle (playoff)
    fillTable("tbl-rozpis-nedele", data.nedele, (r) => `
      <td>${r.cas ?? "—"}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${r.phase ?? "—"}</td>
      <td>${matchHtml(r)}</td>
    `);

  } catch (err) {
    console.error(err);
  }
})();
