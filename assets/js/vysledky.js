console.log("vysledky.js loaded (sheet mode)");

(async () => {
  const updatedEl = document.getElementById("updated");

  // ===== Helpers: safe string / normalize =====
  const norm = (s) =>
    String(s ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[áàäâ]/g, "a")
      .replace(/[éěèëê]/g, "e")
      .replace(/[íìïî]/g, "i")
      .replace(/[óòöô]/g, "o")
      .replace(/[úůùüû]/g, "u")
      .replace(/[ýÿ]/g, "y")
      .replace(/[č]/g, "c")
      .replace(/[ď]/g, "d")
      .replace(/[ň]/g, "n")
      .replace(/[ř]/g, "r")
      .replace(/[š]/g, "s")
      .replace(/[ť]/g, "t")
      .replace(/[ž]/g, "z");

  // den může být "Pátek" nebo klidně Date(...)
  const fmtDen = (x) => {
    if (x == null || x === "") return "";
    const s = String(x).trim();

    // typicky se den zadává textově, takže jen vrátíme
    // kdybys tam omylem měl Date(...), tak to aspoň nepadne:
    if (s.startsWith("Date(")) return s;

    return s;
  };

  const denKey = (r) => norm(fmtDen(r.den));

  // Čas: umí "09:00" i "Date(2026,0,31,9,0,0)"
  const timeHtml = (x) => {
    if (x === null || x === undefined || x === "") return "—";

    const s = String(x).trim();

    // už je to "09:00"
    if (/^\d{1,2}:\d{2}$/.test(s)) return s;

    // Google viz JSON feed: Date(yyyy,mm,dd,hh,mm,ss)
    const m = s.match(/^Date\((\d+),(\d+),(\d+),(\d+),(\d+)(?:,(\d+))?\)$/);
    if (m) {
      const hh = String(m[4]).padStart(2, "0");
      const mm = String(m[5]).padStart(2, "0");
      return `${hh}:${mm}`;
    }

    return "—";
  };

  // Číslo / pomlčka
  const val = (x) => {
    if (x === 0) return "0";
    if (x === null || x === undefined || x === "") return "—";
    return String(x);
  };

  const asNum = (x) => {
    if (x === null || x === undefined || x === "") return NaN;
    const n = Number(String(x).replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };

  const sumNums = (arr) =>
    arr.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);

  // ====== Render helpers (tyhle už nejspíš máš globálně; když ne, nech tady) ======
  // badgeHtml / pillHtml / teamLink / fetchSheetRows musí existovat (máš je jinde v projektu)
  // Pokud je nemáš globálně, dej mi vědět a doplním je taky.

    const tvcomHtml = (r) => {
      if (!r.tvcom) return "";
      return `<a class="tvcomlink" href="${r.tvcom}" target="_blank" rel="noopener">TVCOM</a>`;
    };

    const matchHtml = (r) => {
      const a = teamLink ? teamLink(r.tym_d, r.tym_d_id) : (r.tym_d ?? "Domácí");
      const b = teamLink ? teamLink(r.tym_h, r.tym_h_id) : (r.tym_h ?? "Hosté");
      return `
        <div class="match">
          <div class="match__team">${a}</div>
          <div class="match__team">${b}</div>
        </div>
      `;
    };


  // ===== Skóre: čtvrtiny + total =====
const scoreHtml = (r) => {
  // bezpečný výpis hodnoty
  const val = (x) => {
    if (x === 0) return "0";
    if (x === null || x === undefined || x === "") return "—";
    return String(x);
  };

  const quarters = [
    { label: "Q1", d: val(r.q1d), h: val(r.q1h) },
    { label: "Q2", d: val(r.q2d), h: val(r.q2h) },
    { label: "Q3", d: val(r.q3d), h: val(r.q3h) },
    { label: "Q4", d: val(r.q4d), h: val(r.q4h) },
  ];

  const sum = (arr) =>
    arr.reduce((acc, n) => acc + (Number.isFinite(+n) ? +n : 0), 0);

  const totalD = sum(quarters.map(q => q.d));
  const totalH = sum(quarters.map(q => q.h));

  const any = quarters.some(q => Number.isFinite(+q.d) || Number.isFinite(+q.h));
  if (!any) return "—";

    return `
      <div class="scorewrap scorewrap--stack">
      <div class="scorewrap__quarters">
        <div class="scorewrap__total">${totalD} : ${totalH}</div>
          <div class="qscore">
            <div class="qscore__head">
              ${quarters.map(q => `<span>${q.label}</span>`).join("")}
            </div>

            <div class="qscore__rows">
              <div class="qscore__team">${r.tym_d}</div>
              ${quarters.map(q => `<span class="qscore__box">${q.d}</span>`).join("")}

              <div class="qscore__team">${r.tym_h}</div>
              ${quarters.map(q => `<span class="qscore__box">${q.h}</span>`).join("")}
            </div>
          </div>
        </div>
      </div>
    `;

};

  const fillTable = (tableId, list, renderRow) => {
    const tbl = document.getElementById(tableId);
    if (!tbl) return;
    const tbody = tbl.querySelector("tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    (Array.isArray(list) ? list : []).forEach((r) => {
      const tr = document.createElement("tr");
      if (String(r.stav || "").toUpperCase() === "LIVE") tr.classList.add("is-live");
      tr.innerHTML = renderRow(r);
      tbody.appendChild(tr);
    });
  };

  try {
    const rows = await fetchSheetRows();

    if (updatedEl) updatedEl.textContent = new Date().toLocaleString("cs-CZ");

    const patek = rows.filter((r) => denKey(r) === "patek");
    const sobota = rows.filter((r) => denKey(r) === "sobota");
    const playoff = rows.filter((r) => ["nedele", "playoff"].includes(denKey(r)));

    // Pátek (5 sloupců)
    fillTable("tbl-patek", patek, (r) => `
      <td>${timeHtml(r.cas)}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${matchHtml(r)}</td>
      <td class="score">${scoreHtml(r)}</td>
      <td>
      <div class="statuscell">
        ${badgeHtml(r.stav)}
        ${tvcomHtml(r)}
      </div>
      </td>
    `);

    // Sobota (5 sloupců)
    fillTable("tbl-sobota", sobota, (r) => `
      <td>${timeHtml(r.cas)}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${matchHtml(r)}</td>
      <td class="score">${scoreHtml(r)}</td>
      <td>
        ${badgeHtml(r.stav)}
        ${tvcomHtml(r)}
      </td>
    `);

    // Play-off (6 sloupců: čas, hala, fáze, zápas, skóre, stav)
    fillTable("tbl-playoff", playoff, (r) => `
      <td>${timeHtml(r.cas)}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${r.faze ?? "—"}</td>
      <td>${matchHtml(r)}</td>
      <td class="score">${scoreHtml(r)}</td>
      <td>
        ${badgeHtml(r.stav)}
        ${tvcomHtml(r)}
      </td>
    `);

    // refresh
    setTimeout(() => location.reload(), 15000);

  } catch (err) {
    console.error("SHEET ERROR:", err);
    if (updatedEl) {
      const msg = err?.message ? err.message : String(err);
      updatedEl.textContent = `chyba načtení dat ze Sheetu: ${msg}`;
    }
    setTimeout(() => location.reload(), 30000);
  }
})();
