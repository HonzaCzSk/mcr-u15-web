console.log("rozpis.js loaded");
const LS_KEY = "mcr_u15_rozpis_cache_v1";

function setStatus(msg, kind = "error") {
  const el = document.getElementById("data-status");
  if (!el) return;
  el.style.display = "block";
  el.textContent = msg;

  if (kind === "warn") {
    el.style.background = "rgba(255, 165, 0, .10)";
    el.style.border = "1px solid rgba(255, 165, 0, .25)";
  } else {
    el.style.background = "rgba(255, 0, 0, .08)";
    el.style.border = "1px solid rgba(255, 0, 0, .25)";
  }
}

function isValidRozpis(data) {
  if (!data || typeof data !== "object") return false;
  return ["patek", "sobota", "nedele"].every((k) => Array.isArray(data[k]));
}

function setUpdatedNow() {
  const el = document.getElementById("updated");
  if (!el) return;
  el.textContent = new Date().toLocaleString("cs-CZ");
}

(async () => {
  try {
    // 1) pokus: načíst z webu
    const url = `../data/rozpis.json?v=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

    const data = await res.json();
    if (!isValidRozpis(data)) throw new Error("Invalid rozpis.json structure");

    // uložit jako poslední dobrou verzi
    localStorage.setItem(LS_KEY, JSON.stringify({ savedAt: Date.now(), data }));

    renderRozpis(data);
    const upd = document.getElementById("updated");
    if (upd) upd.textContent = data.updated ?? "—";

  } catch (err) {
    console.error(err);

    // 2) fallback: poslední uložená verze z localStorage
    try {
      const cached = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      const data = cached?.data;

      if (isValidRozpis(data)) {
        const when = cached?.savedAt ? new Date(cached.savedAt).toLocaleString("cs-CZ") : "dříve";
        setStatus(`Nepodařilo se načíst aktuální rozpis. Zobrazuji poslední uloženou verzi (${when}).`, "warn");
        renderRozpis(data);
        return;
      }
    } catch (e) {
      // ignore
    }

    // 3) fallback: statický záložní soubor (backup)
    try {
      const resB = await fetch("../data/rozpis.backup.json?v=" + Date.now(), { cache: "no-store" });
      if (!resB.ok) throw new Error(`Backup fetch failed: ${resB.status}`);
      const backup = await resB.json();

      if (isValidRozpis(backup)) {
        setStatus("Zobrazuji záložní rozpis (backup).", "warn");
        // updated z backupu
        const upd2 = document.getElementById("updated");
        if (upd2) upd2.textContent = backup.updated ?? "—";
        renderRozpis(backup);
        return;
      }
      
    } catch (e) {
      // ignore
    }

    // 4) poslední možnost: zobrazit hlášku (aspoň něco)
    setStatus("Rozpis se nepodařilo načíst. Zkuste obnovit stránku.", "error");
  }
})();

function renderRozpis(data) {
  const pillHtml = (hala) => {
    const n = Number(hala);
    if (n === 1) return '<span class="pill pill--h1">Hala 1</span>';
    if (n === 2) return '<span class="pill pill--h2">Hala 2</span>';
    return `<span class="pill">Hala ${hala ?? "—"}</span>`;
  };

  const teamLink = (t) => {
    if (!t || !t.name) return "—";
    if (!t.id) return t.name;
    return `<a href="tymy.html#tym-${t.id}" class="teamlink">${t.name}</a>`;
  };

  const matchHtml = (m) => {
    // tvůj JSON má přímo text v m.zapas
    const tv = m.tvcom
      ? ` <a class="muted" href="${m.tvcom}" target="_blank" rel="noopener">TVCOM</a>`
      : "";
    return `${m.zapas ?? "—"}${tv}`;
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
    <td>${r.skupina ?? "—"}</td>
  `);

  // Sobota (skupiny)
  fillTable("tbl-rozpis-sobota", data.sobota, (r) => `
    <td>${r.cas ?? "—"}</td>
    <td>${pillHtml(r.hala)}</td>
    <td>${matchHtml(r)}</td>
    <td>${r.skupina ?? "—"}</td>
  `);

  // Neděle (playoff)
  fillTable("tbl-rozpis-nedele", data.nedele, (r) => `
    <td>${r.cas ?? "—"}</td>
    <td>${pillHtml(r.hala)}</td>
    <td>${r.faze ?? "—"}</td>
    <td>${matchHtml(r)}</td>
  `);
}
