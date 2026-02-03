console.log("vysledky.js loaded (rozpis + vysledky json)");

// Paths (vysledky.html is in /pages/)
const ROZPIS_URL = "../data/rozpis.json";
const ROZPIS_BACKUP_URL = "../data/rozpis.backup.json";

const VYSLEDKY_URL = "../data/vysledky.json";
const VYSLEDKY_BACKUP_URL = "../data/vysledky.backup.json";

const LS_ROZPIS_KEY = "mcr_u15_rozpis_cache_v1";
const LS_VYSLEDKY_KEY = "mcr_u15_vysledky_cache_v1";

function $(id){ return document.getElementById(id); }

function getMatchFromUrl(){
  return new URLSearchParams(location.search).get("match");
}

function safeArray(x){ return Array.isArray(x) ? x : []; }

function formatUpdatedHuman(dateInput) {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (!isNaN(d)) {
    return d.toLocaleString("cs-CZ", {
      day: "numeric", month: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }
  return String(dateInput);
}

function setUpdated(text) {
  const el = $("updated");
  if (el) el.textContent = text ?? "—";
}

function renderScoreBlock(game){
  const skore = game.skore ?? "—";
  const qs = Array.isArray(game.quarters) ? game.quarters : [];

  let quartersHtml = "";

  if (qs.length) {
    const labels = qs.map((_, i) => `Q${i+1}`).join("</th><th>");
    const rowA = qs.map(q => q[0]).join("</td><td>");
    const rowB = qs.map(q => q[1]).join("</td><td>");

    quartersHtml = `
      <table class="quarters">
        <thead>
          <tr><th>${labels}</th></tr>
        </thead>
        <tbody>
          <tr><td>${rowA}</td></tr>
          <tr><td>${rowB}</td></tr>
        </tbody>
      </table>
    `;
  }

  return `
    ${quartersHtml}
    <div class="score-main">${skore}</div>
  `;
}

function renderFinalScoreBold(skore){
  const m = String(skore ?? "").match(/(\d+)\s*:\s*(\d+)/);
  if (!m) return scoreHtml(skore);
  const a = Number(m[1]), b = Number(m[2]);
  if (a === b) return `${a} : ${b}`;
  return a > b ? `<strong>${a}</strong> : ${b}` : `${a} : <strong>${b}</strong>`;
}

function renderQuarterGrid(quarters){
  const qs = Array.isArray(quarters) ? quarters : [];
  if (!qs.length) return "";

  const labels = qs.map((_, i) => `Q${i + 1}`).join("</th><th>");
  const rowA = qs.map(q => (typeof q?.[0] === "number" ? q[0] : "—")).join("</td><td>");
  const rowB = qs.map(q => (typeof q?.[1] === "number" ? q[1] : "—")).join("</td><td>");

  return `
    <table class="qgrid" aria-label="Stavy po čtvrtinách">
      <thead>
        <tr><th>${labels}</th></tr>
      </thead>
      <tbody>
        <tr><td>${rowA}</td></tr>
        <tr><td>${rowB}</td></tr>
      </tbody>
    </table>
  `;
}

function finalScoreFromQuarters(quarters){
  const qs = Array.isArray(quarters) ? quarters : [];
  if (!qs.length) return null;
  const last = qs[qs.length - 1];
  const a = last?.[0], b = last?.[1];
  if (typeof a !== "number" || typeof b !== "number") return null;
  return `${a} : ${b}`;
}

function pillHtml(hala) {
  const s = String(hala ?? "").trim();
  const n = Number(s);
  if (n === 1) return '<span class="pill pill--h1">Hala 1</span>';
  if (n === 2) return '<span class="pill pill--h2">Hala 2</span>';
  if (s.toUpperCase() === "A") return '<span class="pill">Hala A</span>';
  if (s.toUpperCase() === "B") return '<span class="pill">Hala B</span>';
  return `<span class="pill">Hala ${s || "—"}</span>`;
}

function badgeHtml(stavRaw) {
  const s = String(stavRaw ?? "").trim().toUpperCase();
  if (s === "FIN" || s === "FINAL") return '<span class="badge badge--fin">FIN</span>';
  if (s === "LIVE") return '<span class="badge badge--live">LIVE</span>';
  if (s === "POSTPONED") return '<span class="badge badge--warn">POSTPONED</span>';
  return '<span class="badge">SCHEDULED</span>';
}

function scoreHtml(skore) {
  const s = String(skore ?? "").trim();
  return s && s !== "" ? s : "—";
}

async function fetchJsonNoStore(url) {
  const res = await fetch(url + "?v=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} for ${url}`);
  return await res.json();
}

function loadCache(key){
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch(e){ return null; }
}

function saveCache(key, data){
  try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data })); } catch(e){}
}

function isValidRozpis(data){
  return data && typeof data === "object"
    && Array.isArray(data.patek) && Array.isArray(data.sobota) && Array.isArray(data.nedele);
}

function isValidVysledky(data){
  return data && typeof data === "object" && data.games && typeof data.games === "object";
}

async function loadWithFallback(url, backupUrl, lsKey, validator){
  // 1) web
  try {
    const data = await fetchJsonNoStore(url);
    if (!validator(data)) throw new Error("invalid structure");
    saveCache(lsKey, data);
    return { data, source: "web" };
  } catch (e) {}

  // 2) cache
  const cached = loadCache(lsKey);
  if (cached?.data && validator(cached.data)){
    return { data: cached.data, source: "cache", savedAt: cached.savedAt };
  }

  // 3) backup
  try {
    const data = await fetchJsonNoStore(backupUrl);
    if (!validator(data)) throw new Error("invalid structure");
    return { data, source: "backup" };
  } catch (e) {}

  throw new Error("failed all sources");
}

function fillTable(tableId, rows, renderRow, focusId){
  const tbl = $(tableId);
  if (!tbl) return;
  const tbody = tbl.querySelector("tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  const list = safeArray(rows);

  if (list.length === 0){
    const colCount = tbl.querySelectorAll("thead th").length || 1;
    const tr = document.createElement("tr");
    tr.className = "emptyrow";
    tr.innerHTML = `<td colspan="${colCount}">— zatím bez dat —</td>`;
    tbody.appendChild(tr);
    return;
  }

  list.forEach(r => {
    const tr = document.createElement("tr");
    const st = String(r?.stav ?? "").toUpperCase();
    if (st === "LIVE") tr.classList.add("is-live");
    if (focusId && String(r.id).trim() === String(focusId).trim()) {
      tr.classList.add("is-focus");
      tr.id = "focus-match";
    }
    tr.innerHTML = renderRow(r);
    tbody.appendChild(tr);
  });
}

function buildRowsFromRozpis(rozpis, vysledky){
  const games = (vysledky?.games && typeof vysledky.games === "object") ? vysledky.games : {};

  const patek = safeArray(rozpis.patek).map(r => {
    const q = games[r.id]?.quarters ?? [];
    const autoSkore = finalScoreFromQuarters(q);

    return {
      id: r.id,
      cas: r.cas ?? "—",
      hala: r.hala ?? "—",
      zapas: r.zapas ?? "—",
      quarters: q,
      skore: autoSkore ?? (games[r.id]?.skore ?? "—"),
      stav: games[r.id]?.stav ?? "SCHEDULED"
    };
  });

  const sobota = safeArray(rozpis.sobota).map(r => {
    const q = games[r.id]?.quarters ?? [];
    const autoSkore = finalScoreFromQuarters(q);

    return {
      id: r.id,
      cas: r.cas ?? "—",
      hala: r.hala ?? "—",
      zapas: r.zapas ?? "—",
      quarters: q,
      skore: autoSkore ?? (games[r.id]?.skore ?? "—"),
      stav: games[r.id]?.stav ?? "SCHEDULED"
    };
  });

  const playoff = safeArray(rozpis.playoff).map(r => {
    const q = games[r.id]?.quarters ?? [];
    const autoSkore = finalScoreFromQuarters(q);

    return {
      id: r.id,
      cas: r.cas ?? "—",
      hala: r.hala ?? "—",
      zapas: r.zapas ?? "—",
      quarters: q,
      skore: autoSkore ?? (games[r.id]?.skore ?? "—"),
      stav: games[r.id]?.stav ?? "SCHEDULED"
    };
  });

  return { patek, sobota, playoff };
}

(async () => {
  try {
    const [rozpisRes, vyslRes] = await Promise.all([
      loadWithFallback(ROZPIS_URL, ROZPIS_BACKUP_URL, LS_ROZPIS_KEY, isValidRozpis),
      loadWithFallback(VYSLEDKY_URL, VYSLEDKY_BACKUP_URL, LS_VYSLEDKY_KEY, isValidVysledky)
    ]);

    const rozpis = rozpisRes.data;
    const vysledky = vyslRes.data;

    // Updated: prefer vysledky.updated, fallback rozpis.updated
    setUpdated(formatUpdatedHuman(vysledky.updated || rozpis.updated));

    const rows = buildRowsFromRozpis(rozpis, vysledky);
    const focusId = getMatchFromUrl();

    fillTable("tbl-patek", rows.patek, (r) => `
      <td>${r.cas}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${r.zapas}</td>
      <td class="score">
        ${renderQuarterGrid(r.quarters)}
        <div class="score-main">${scoreHtml(r.skore)}</div>
      </td>
      <td>${badgeHtml(r.stav)}</td>
    `, focusId);

    fillTable("tbl-sobota", rows.sobota, (r) => `
      <td>${r.cas}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${r.zapas}</td>
      <td class="score">
        ${renderQuarterGrid(r.quarters)}
        <div class="score-main">${scoreHtml(r.skore)}</div>
      </td>
      <td>${badgeHtml(r.stav)}</td>
    `, focusId);

    fillTable("tbl-playoff", rows.playoff, (r) => `
      <td>${r.cas}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${r.faze}</td>
      <td>${r.zapas}</td>
      <td class="score">
        ${renderQuarterGrid(r.quarters)}
        <div class="score-main">${scoreHtml(r.skore)}</div>
      </td>
      <td>${badgeHtml(r.stav)}</td>
    `, focusId);

    if (focusId) {
      const el = document.getElementById("focus-match");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

  } catch (err) {
    console.error("Vysledky init failed:", err);
    setUpdated("chyba načtení");
  }
})();