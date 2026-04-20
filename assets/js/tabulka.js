// tabulka.js — play-off pavouk (P1/P2/V1/V2 → M5/M7/M3/FIN)

import { buildTeamIndex, teamHrefById, normKey } from "./teams-store.js";

const ROZPIS_URL   = "../../data/rozpis.json";
const VYSLEDKY_URL = "../../data/vysledky.json";

let TEAM_BY_NAME = new Map();

async function fetchJson(url) {
  const sep = url.includes("?") ? "&" : "?";
  const r = await fetch(`${url}${sep}v=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function parseScore(raw) {
  const m = String(raw ?? "").match(/(\d+)\s*[:\-]\s*(\d+)/);
  return m ? { a: +m[1], b: +m[2] } : null;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
  );
}

function teamHtml(name) {
  if (!name) return `<span class="brk-ph">—</span>`;
  const t = TEAM_BY_NAME.get(normKey(name));
  if (!t) return `<span>${esc(name)}</span>`;
  return `<a class="teamlink" href="${teamHrefById(t.id)}">${esc(t.name)}</a>`;
}

async function init() {
  try {
    const { byName } = await buildTeamIndex();
    TEAM_BY_NAME = byName;
  } catch {}

  const updatedEl = document.getElementById("updated");
  const container = document.getElementById("standings-groups");
  if (!container) return;
  container.innerHTML = `<p class="muted">Načítám…</p>`;

  let rozpis, vysledky;
  try {
    [rozpis, vysledky] = await Promise.all([
      fetchJson(ROZPIS_URL),
      fetchJson(VYSLEDKY_URL)
    ]);
  } catch {
    container.innerHTML = `<p class="muted">Data se nepodařilo načíst.</p>`;
    return;
  }

  if (updatedEl) {
    const raw = vysledky.updated || rozpis.updated;
    const d = raw ? new Date(raw) : null;
    updatedEl.textContent = d && !isNaN(d)
      ? d.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })
        + " " + d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })
      : (raw || "—");
  }

  // Mapa id → row z rozpisu
  const rowMap = {};
  for (const r of [...(rozpis.patek || []), ...(rozpis.sobota || []), ...(rozpis.nedele || [])]) {
    rowMap[r.id] = r;
  }
  const gdata = vysledky.games || {};

  // Rozloží "Tým A – Tým B" na [home, away]
  function rowTeams(id) {
    const row = rowMap[id];
    if (!row) return ["?", "?"];
    const parts = String(row.zapas || "").split(/\s*[–—\-]\s*/);
    return [parts[0]?.trim() || "?", parts[1]?.trim() || "?"];
  }

  // Přeloží "W G01" / "L G01" na jméno týmu, pokud je výsledek znám
  function resolve(token) {
    const s = String(token || "").trim();

    const wm = s.match(/^W\s+([A-Z0-9]+)$/i);
    if (wm) {
      const sc = parseScore(gdata[wm[1].toUpperCase()]?.skore);
      if (!sc) return null;
      const [h, a] = rowTeams(wm[1].toUpperCase());
      return sc.a > sc.b ? h : sc.a < sc.b ? a : null;
    }

    const lm = s.match(/^L\s+([A-Z0-9]+)$/i);
    if (lm) {
      const sc = parseScore(gdata[lm[1].toUpperCase()]?.skore);
      if (!sc) return null;
      const [h, a] = rowTeams(lm[1].toUpperCase());
      return sc.a < sc.b ? h : sc.a > sc.b ? a : null;
    }

    return s; // prostý název týmu
  }

  // Data pro jeden zápas
  function buildCard(id) {
    const row = rowMap[id] || {};
    const g   = gdata[id]  || {};
    const [rawH, rawA] = rowTeams(id);

    const home = resolve(rawH);
    const away = resolve(rawA);

    const sc   = parseScore(g.skore);
    const stav = String(g.stav || "SCHEDULED").toUpperCase();
    const fin  = stav === "FIN" || stav === "FINAL";
    const live = stav === "LIVE";

    return {
      home, away, sc, fin, live,
      cas: row.cas || "",
      winHome: fin && sc ? sc.a > sc.b : false,
      winAway: fin && sc ? sc.b > sc.a : false,
    };
  }

  // HTML karta zápasu
  function card(id, label) {
    const g = buildCard(id);

    const rootCls = [
      "brk-card",
      g.fin  ? "brk-card--fin"  :
      g.live ? "brk-card--live" : "brk-card--sched"
    ].join(" ");

    const hCls = "brk-card__team" + (g.winHome ? " brk-card__team--win" : "");
    const aCls = "brk-card__team" + (g.winAway ? " brk-card__team--win" : "");

    const homeHtml = g.home ? teamHtml(g.home) : `<span class="brk-ph">zatím neznámo</span>`;
    const awayHtml = g.away ? teamHtml(g.away) : `<span class="brk-ph">zatím neznámo</span>`;

    const score = g.sc ? `${g.sc.a} : ${g.sc.b}` : "—";

    return `
      <div class="${rootCls}">
        <div class="brk-card__head">
          <span class="brk-card__label">${esc(label)}</span>
          ${g.cas ? `<span class="brk-card__time">${esc(g.cas)}</span>` : ""}
        </div>
        <div class="${hCls}">${homeHtml}</div>
        <div class="${aCls}">${awayHtml}</div>
        <div class="brk-card__score">${score}</div>
      </div>
    `;
  }

  // Connector HTML
  const conn = `
    <div class="brk__conn-row brk__conn-row--win">
      <span class="brk__conn-label">vítěz →</span>
    </div>
    <div class="brk__conn-row brk__conn-row--lose">
      <span class="brk__conn-label">poražený →</span>
    </div>
  `;

  // Sekce
  function section(title, satCards, sunCards) {
    return `
      <div class="brk__section">
        <p class="brk__section-title">${esc(title)}</p>
        <div class="brk__grid">
          <div class="brk__col">
            <p class="brk__day">Sobota</p>
            ${satCards}
          </div>
          <div class="brk__conn">${conn}</div>
          <div class="brk__col">
            <p class="brk__day">Neděle</p>
            ${sunCards}
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="brk">
      ${section(
        "Vítězná větev",
        card("V1", "Vítězové") + card("V2", "Vítězové"),
        card("FIN", "Finále") + card("M3", "O 3. místo")
      )}
      ${section(
        "Poražená větev",
        card("P1", "Prohrávající") + card("P2", "Prohrávající"),
        card("M5", "O 5. místo") + card("M7", "O 7. místo")
      )}
    </div>
  `;
}

init();