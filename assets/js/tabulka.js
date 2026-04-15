// tabulka.js — simplified single standings table (Z, V-R-P only)
import { loadTeams, teamHrefById } from "./teams-store.js";

const VYSLEDKY_URL = new URL("../../data/vysledky.json", import.meta.url).toString();
const LS_VYSLEDKY_KEY = "mcr_u15_vysledky_cache_v1";

// Game IDs that count for standings (QF matches only)
const STANDINGS_GAME_IDS = ["G01", "G02", "G03", "G04"];

async function fetchJson(url) {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function loadCache(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}

function saveCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data })); } catch {}
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function initTeam(name) {
  return { name, Z: 0, V: 0, R: 0, P: 0 };
}

function getPoints(s) {
  return s.V * 3 + s.R * 1;
}

function parseScore(raw) {
  const m = String(raw ?? "").match(/(\d+)\s*[:\-]\s*(\d+)/);
  if (!m) return null;
  return { a: +m[1], b: +m[2] };
}

function seedNum(seed) {
  const m = String(seed || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 999;
}

function renderTable(tableEl, teams, statsMap) {
  if (!tableEl) return;

  // Sort: body (V*3+R*1), pak výhry, pak prohry, pak seed
  const sorted = [...teams].sort((ta, tb) => {
    const a = statsMap.get(ta.name) || initTeam(ta.name);
    const b = statsMap.get(tb.name) || initTeam(tb.name);
    const pa = getPoints(a), pb = getPoints(b);
    if (pb !== pa) return pb - pa;
    if (b.V !== a.V) return b.V - a.V;
    if (a.P !== b.P) return a.P - b.P;
    return seedNum(ta.seed) - seedNum(tb.seed);
  });

  const rows = sorted.map((team, idx) => {
    const s = statsMap.get(team.name) || initTeam(team.name);
    const href = teamHrefById(team.id);
    const seedLabel = seedNum(team.seed) !== 999 ? seedNum(team.seed) : idx + 1;
    return `
      <tr>
        <td>${seedLabel}</td>
        <td><a class="teamlink" href="${href}">${escapeHtml(team.name)}</a></td>
        <td>${s.Z}</td>
        <td>${s.V}–${s.R}–${s.P}</td>
        <td><strong>${getPoints(s)}</strong></td>
      </tr>
    `;
  }).join("");

  tableEl.innerHTML = `
    <thead>
      <tr><th>#</th><th>Tým</th><th>Z</th><th>V–R–P</th><th>B</th></tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="5">Žádné týmy.</td></tr>`}
    </tbody>
  `;
}

function renderGroupTables(teams, statsMap) {
  // Rozděl týmy do skupin
  const groups = new Map();
  for (const t of teams) {
    const g = t.group || "—";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }

  // Seřaď skupiny abecedně (A, B, ...)
  const sortedGroups = [...groups.keys()].sort((a, b) => a.localeCompare(b, "cs"));

  const container = document.getElementById("standings-groups");
  if (!container) return;

  container.innerHTML = "";

  for (const groupKey of sortedGroups) {
    const groupTeams = groups.get(groupKey);
    const title = groupKey !== "—" ? `Skupina ${groupKey}` : "Týmy";

    const wrapper = document.createElement("div");
    wrapper.className = "standings-group";
    wrapper.innerHTML = `
      <h2 class="standings-group__title">${title}</h2>
      <table class="standings-table" id="tbl-group-${groupKey}">
        <thead>
          <tr><th>#</th><th>Tým</th><th>Z</th><th>V–R–P</th><th>B</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    `;
    container.appendChild(wrapper);

    renderTable(wrapper.querySelector("table"), groupTeams, statsMap);
  }
}

async function init() {
  const updatedEl = document.getElementById("updated");

  // Load teams
  let teams = [];
  try {
    teams = await loadTeams();
  } catch (e) {
    if (tableEl) tableEl.innerHTML = `<tr><td colspan="4">Nepodařilo se načíst týmy.</td></tr>`;
    return;
  }

  // Render empty tables immediately
  const emptyStats = new Map(teams.map(t => [t.name, initTeam(t.name)]));
  renderGroupTables(teams, emptyStats);

  // Load vysledky
  let vysledky = null;
  try {
    vysledky = await fetchJson(VYSLEDKY_URL);
    saveCache(LS_VYSLEDKY_KEY, vysledky);
  } catch {
    const cached = loadCache(LS_VYSLEDKY_KEY);
    vysledky = cached?.data || null;
  }

  if (!vysledky?.games) {
    if (updatedEl) updatedEl.textContent = "—";
    return;
  }

  if (updatedEl && vysledky.updated) {
    const d = new Date(vysledky.updated);
    updatedEl.textContent = isNaN(d) ? vysledky.updated :
      d.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" }) + " " +
      d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
  }

  // Build stats from QF results
  // We need to know which team played which game — get that from rozpis.json
  let rozpis = null;
  try {
    const rozpisUrl = new URL("../../data/rozpis.json", import.meta.url).toString();
    rozpis = await fetchJson(rozpisUrl);
  } catch {}

  const statsMap = new Map(teams.map(t => [t.name, initTeam(t.name)]));
  const seedMap = new Map(teams.filter(t => t.seed).map(t => [t.seed.toUpperCase(), t.name]));

  function resolveToken(token) {
    const up = String(token || "").trim().toUpperCase();
    return seedMap.get(up) || token;
  }

  if (rozpis) {
    const allRows = [...(rozpis.patek || []), ...(rozpis.sobota || [])];
    for (const row of allRows) {
      if (!STANDINGS_GAME_IDS.includes(row.id)) continue;
      const game = vysledky.games[row.id];
      if (!game || game.stav !== "FIN" && game.stav !== "FINAL") continue;

      const score = parseScore(game.skore);
      if (!score) continue;

      const parts = String(row.zapas || "").split(/\s*[–—-]\s*/);
      if (parts.length < 2) continue;

      const nameA = resolveToken(parts[0].trim());
      const nameB = resolveToken(parts[1].trim());

      if (!statsMap.has(nameA)) statsMap.set(nameA, initTeam(nameA));
      if (!statsMap.has(nameB)) statsMap.set(nameB, initTeam(nameB));

      const a = statsMap.get(nameA);
      const b = statsMap.get(nameB);

      a.Z++; b.Z++;

      if (score.a > score.b) { a.V++; b.P++; }
      else if (score.a < score.b) { b.V++; a.P++; }
      else { a.R++; b.R++; }
    }
  }

  renderGroupTables(teams, statsMap);
}

init();