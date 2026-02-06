/* =========================
TABULKA – skupiny + nasazení
========================= */
console.log("TABULKA BUILD 2026-02-05 23:59");
import { loadTeams, teamHrefById } from "./teams-store.js";

// tabulka.html je v /pages/
const ROZPIS_URL = new URL("../../data/rozpis.json", import.meta.url).toString();
const ROZPIS_BACKUP_URL = new URL("../../data/rozpis.backup.json", import.meta.url).toString();
const VYSLEDKY_URL = new URL("../../data/vysledky.json", import.meta.url).toString();
const VYSLEDKY_BACKUP_URL = new URL("../../data/vysledky.backup.json", import.meta.url).toString();

const LS_ROZPIS_KEY = "mcr_u15_rozpis_cache_v1";
const LS_VYSLEDKY_KEY = "mcr_u15_vysledky_cache_v1";

const MODE = "groups"; // "groups" / "playoff"

// ========== loader ==========

async function fetchJsonNoStore(url) {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

function loadCache(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function saveCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {}
}

function isValidRozpis(data) {
  return (
    data &&
    typeof data === "object" &&
    Array.isArray(data.patek) &&
    Array.isArray(data.sobota) &&
    Array.isArray(data.nedele)
  );
}

function isValidVysledky(data) {
  return (
    data &&
    typeof data === "object" &&
    ((data.games && typeof data.games === "object") || Array.isArray(data.zapasy))
  );
}

async function loadWithFallback(url, backupUrl, lsKey, validator) {
  // 1) web
  try {
    const data = await fetchJsonNoStore(url);
    if (!validator(data)) throw new Error("invalid structure");
    saveCache(lsKey, data);
    return { data, source: "web" };
  } catch {}

  // 2) cache
  const cached = loadCache(lsKey);
  if (cached?.data && validator(cached.data)) {
    return { data: cached.data, source: "cache", savedAt: cached.savedAt };
  }

  // 3) backup
  try {
    const data = await fetchJsonNoStore(backupUrl);
    if (!validator(data)) throw new Error("invalid structure");
    return { data, source: "backup" };
  } catch {}

  throw new Error(`failed all sources for ${url}`);
}

// ========== teams (source of truth) ==========

const teams = await loadTeams();

function normKey(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const TEAM_BY_NAME = new Map(
  teams
    .filter((t) => t?.name && t?.id)
    .map((t) => [normKey(t.name), t])
);

function teamCellHtml(name) {
  const t = TEAM_BY_NAME.get(normKey(name));
  if (!t) return escapeHtml(name);
  return `<a class="teamlink" href="${teamHrefById(t.id)}">${escapeHtml(t.name)}</a>`;
}

function seedRank(t) {
  const s = String(t?.seed || "");
  const m = s.match(/^([AB])(\d)$/i);
  return m ? Number(m[2]) : 999;
}

function baseOrder(groupLetter) {
  return teams
    .filter((t) => String(t.group).toUpperCase() === groupLetter)
    .slice()
    .sort((a, b) => seedRank(a) - seedRank(b))
    .map((t) => t.name);
}

// ========== standings ==========

function initTeam(team) {
  return { team, Z: 0, V: 0, R: 0, P: 0, body: 0, PF: 0, PA: 0, diff: 0 };
}

function applyMatch(statsMap, teamA, teamB, scoreA, scoreB) {
  if (!statsMap.has(teamA)) statsMap.set(teamA, initTeam(teamA));
  if (!statsMap.has(teamB)) statsMap.set(teamB, initTeam(teamB));

  const a = statsMap.get(teamA);
  const b = statsMap.get(teamB);

  a.Z += 1;
  b.Z += 1;

  a.PF += scoreA;
  a.PA += scoreB;
  b.PF += scoreB;
  b.PA += scoreA;

  if (scoreA > scoreB) {
    a.V += 1;
    b.P += 1;
    a.body += 3;
  } else if (scoreA < scoreB) {
    b.V += 1;
    a.P += 1;
    b.body += 3;
  } else {
    a.R += 1;
    b.R += 1;
    a.body += 1;
    b.body += 1;
  }

  a.diff = a.PF - a.PA;
  b.diff = b.PF - b.PA;
}

function sortStandingsWithH2H(teamNames, allMatches) {
  const global = new Map();
  for (const t of teamNames) global.set(t, initTeam(t));
  for (const m of allMatches) applyMatch(global, m.teamA, m.teamB, m.scoreA, m.scoreB);

  // group by points
  const byPts = new Map();
  for (const t of teamNames) {
    const pts = global.get(t)?.body ?? 0;
    if (!byPts.has(pts)) byPts.set(pts, []);
    byPts.get(pts).push(t);
  }

  const ptsSorted = Array.from(byPts.keys()).sort((a, b) => b - a);
  const order = [];

  for (const pts of ptsSorted) {
    const tied = byPts.get(pts);

    if (tied.length === 1) {
      order.push(tied[0]);
      continue;
    }

    // mini table for mutual matches
    const mini = new Map();
    for (const t of tied) mini.set(t, initTeam(t));
    const mutual = allMatches.filter((m) => tied.includes(m.teamA) && tied.includes(m.teamB));
    for (const m of mutual) applyMatch(mini, m.teamA, m.teamB, m.scoreA, m.scoreB);

    tied.sort((t1, t2) => {
      const a = mini.get(t1);
      const b = mini.get(t2);

      const p1 = a?.body ?? 0;
      const p2 = b?.body ?? 0;
      if (p1 !== p2) return p2 - p1;

      const d1 = a?.diff ?? 0;
      const d2 = b?.diff ?? 0;
      if (d1 !== d2) return d2 - d1;

      const pf1 = a?.PF ?? 0;
      const pf2 = b?.PF ?? 0;
      if (pf1 !== pf2) return pf2 - pf1;

      // fallback: global diff, global PF
      const ga = global.get(t1);
      const gb = global.get(t2);
      if ((ga?.diff ?? 0) !== (gb?.diff ?? 0)) return (gb?.diff ?? 0) - (ga?.diff ?? 0);
      if ((ga?.PF ?? 0) !== (gb?.PF ?? 0)) return (gb?.PF ?? 0) - (ga?.PF ?? 0);

      return String(t1).localeCompare(String(t2), "cs");
    });

    order.push(...tied);
  }

  return { globalStats: global, order };
}

// ========== parse results ==========

function normalizeStav(stav) {
  return String(stav || "").trim().toUpperCase();
}

function parseTeamsFromZapas(zapasStr) {
  if (!zapasStr) return null;
  const s = String(zapasStr).replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  const m = s.match(/^(.+?)\s*-\s*(.+?)$/);
  if (!m) return null;
  const left = m[1].trim();
  const right = m[2].trim();
  if (!left || !right) return null;
  return { teamA: left, teamB: right };
}

function parseScoreFromString(str) {
  if (!str) return null;
  const s = String(str);
  const m = s.match(/(\d{1,3})\s*[:\-]\s*(\d{1,3})/);
  if (!m) return null;
  return { scoreA: Number(m[1]), scoreB: Number(m[2]) };
}

// ========== render ==========

function renderStandingsTable(tableEl, order, statsMap) {
  if (!tableEl) return;

  const rows = (order || [])
    .map((team, idx) => {
      const s = statsMap.get(team) || initTeam(team);
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${teamCellHtml(s.team)}</td>
          <td>${s.Z}</td>
          <td>${s.V}–${s.R}–${s.P}</td>
          <td>${s.body}</td>
          <td>${s.PF}:${s.PA}</td>
          <td>${formatSigned(s.diff)}</td>
        </tr>
      `;
    })
    .join("");

  tableEl.innerHTML = `
    <thead>
      <tr><th>#</th><th>Tým</th><th>Z</th><th>V–R–P</th><th>Body</th><th>PF:PA</th><th>+/-</th></tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="7">Žádné týmy.</td></tr>`}
    </tbody>
  `;
}

function renderPlayoffSection(playoffEl, orderA, orderB, gamesById) {
  if (!playoffEl) return;

  // když ještě není pořadí, ukaž aspoň placeholder
  if (!orderA?.length || !orderB?.length) {
    playoffEl.innerHTML = `
      <h2>NASAZENÍ DO ČTVRTFINÁLE</h2>
      <p class="muted">Z tabulek po skupinách.</p>
      <div class="qf-list">
        <div class="qf-item">
          <div class="qf-top">
            <div class="qf-label">1A – 4B</div>
            <div class="qf-score">—</div>
          </div>
          <div class="qf-match">
            <span class="qf-team">1A</span><span class="qf-vs">vs</span><span class="qf-team">4B</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const qf = [
    { id: "QF1", label: "1A – 4B", a: orderA[0], b: orderB[3] },
    { id: "QF2", label: "2A – 3B", a: orderA[1], b: orderB[2] },
    { id: "QF3", label: "1B – 4A", a: orderB[0], b: orderA[3] },
    { id: "QF4", label: "2B – 3A", a: orderB[1], b: orderA[2] },
  ];

  const rows = qf
    .map(({ id, label, a, b }) => {
      const g = gamesById?.get(id);
      const score = g?.skore && g.skore !== "—" ? String(g.skore) : null;
      const isFinal = String(g?.stav || "").toUpperCase() === "FINAL" && !!score;

      let win = null;
      if (isFinal) {
        const m = score.match(/(\d+)\s*[:\-]\s*(\d+)/);
        if (m) {
          const sa = +m[1],
            sb = +m[2];
          win = sa > sb ? "a" : sa < sb ? "b" : null;
        }
      }

      return `
        <div class="qf-item ${isFinal ? "is-final" : ""}">
          <div class="qf-top">
            <div class="qf-label">${escapeHtml(label)}</div>
            <div class="qf-score">${escapeHtml(score ?? "—")}</div>
          </div>
          <div class="qf-match">
            <span class="qf-team ${win === "a" ? "winner" : ""}">${escapeHtml(a)}</span>
            <span class="qf-vs">vs</span>
            <span class="qf-team ${win === "b" ? "winner" : ""}">${escapeHtml(b)}</span>
          </div>
        </div>
      `;
    })
    .join("");

  playoffEl.innerHTML = `
    <h2>NASAZENÍ DO ČTVRTFINÁLE</h2>
    <p class="muted">Z tabulek po skupinách.</p>
    <div class="qf-list">
      ${rows}
    </div>
  `;
}

// ========== mode switch ==========

function applyMode(mode) {
  const groups = document.getElementById("groups-section");
  const playoff = document.getElementById("playoff-section");
  if (!groups || !playoff) return;

  const parent = groups.parentElement;
  if (!parent) return;

  const first = parent.firstElementChild;

  if (mode === "playoff" && first !== playoff) parent.insertBefore(playoff, first);
  if (mode === "groups" && first !== groups) parent.insertBefore(groups, first);
}

// ========== utils ==========

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatSigned(n) {
  const v = Number(n) || 0;
  return v > 0 ? `+${v}` : `${v}`;
}

// ========== main ==========

init();

async function init() {
  applyMode(MODE);

  const updatedEl = document.getElementById("updated");
  const playoffEl = document.getElementById("playoff-section");
  const tableA = document.getElementById("tbl-standings-a");
  const tableB = document.getElementById("tbl-standings-b");
  const gamesById = new Map();

  // 0) render base tables ALWAYS (nuly)
  console.log("INIT start", { hasA: !!tableA, hasB: !!tableB });

  const baseA = baseOrder("A");
  const baseB = baseOrder("B");
  console.log("BASE ORDERS", { baseA, baseB });

  renderStandingsTable(tableA, baseA, new Map(baseA.map(n => [n, initTeam(n)])));
  renderStandingsTable(tableB, baseB, new Map(baseB.map(n => [n, initTeam(n)])));

  console.log("AFTER BASE RENDER", { aLen: tableA.innerHTML.length, bLen: tableB.innerHTML.length });

  // 1) load data (vysledky + rozpis) – pokud to selže, nech aspoň nuly
  let vysledkyRes, rozpisRes;
  try {
    [vysledkyRes, rozpisRes] = await Promise.all([
      loadWithFallback(VYSLEDKY_URL, VYSLEDKY_BACKUP_URL, LS_VYSLEDKY_KEY, isValidVysledky),
      loadWithFallback(ROZPIS_URL, ROZPIS_BACKUP_URL, LS_ROZPIS_KEY, isValidRozpis),
    ]);
  } catch (e) {
    if (updatedEl) updatedEl.textContent = "—";
    if (playoffEl) playoffEl.innerHTML = "";
    return;
  }

  // updated label
  if (updatedEl) {
    const source =
      vysledkyRes.source === "web" ? "web" : vysledkyRes.source === "cache" ? "cache" : "backup";
    const ts = vysledkyRes.savedAt || Date.now();
    updatedEl.textContent = `${new Date(ts).toLocaleString("cs-CZ")} (${source})`;
  }

  const vysledky = vysledkyRes.data;

  // 2) collect FINAL matches for groups A/B
  const matchesA = [];
  const matchesB = [];

  const zapasy = Array.isArray(vysledky?.zapasy) ? vysledky.zapasy : [];
  if (vysledky?.games && typeof vysledky.games === "object") {
    for (const [id, g] of Object.entries(vysledky.games)) {
      gamesById.set(id, { id, ...g }); // sjednocení formátu
    }
  }

  for (const g of zapasy) {
    const skup = String(g?.skupina || "").trim().toUpperCase();
    if (skup !== "A" && skup !== "B") continue;

    const stav = normalizeStav(g?.stav);
    if (stav !== "FINAL" && stav !== "FIN") continue;

    const t = parseTeamsFromZapas(g?.zapas);
    if (!t) continue;

    const score = parseScoreFromString(g?.skore);
    if (!score) continue;

    const record = { teamA: t.teamA, teamB: t.teamB, scoreA: score.scoreA, scoreB: score.scoreB };
    if (skup === "A") matchesA.push(record);
    else matchesB.push(record);
  }

  // 3) compute standings
  const sortedA = matchesA.length
    ? sortStandingsWithH2H(baseA, matchesA)
    : { globalStats: new Map(baseA.map((n) => [n, initTeam(n)])), order: baseA };

  const sortedB = matchesB.length
    ? sortStandingsWithH2H(baseB, matchesB)
    : { globalStats: new Map(baseB.map((n) => [n, initTeam(n)])), order: baseB };

  // 4) render
  renderStandingsTable(tableA, sortedA.order, sortedA.globalStats);
  renderStandingsTable(tableB, sortedB.order, sortedB.globalStats);

  // 5) expose seeds for playoff.js
  window.__PLAYOFF_SEEDS__ = {
    "1A": sortedA.order[0] ?? "1A",
    "2A": sortedA.order[1] ?? "2A",
    "3A": sortedA.order[2] ?? "3A",
    "4A": sortedA.order[3] ?? "4A",
    "1B": sortedB.order[0] ?? "1B",
    "2B": sortedB.order[1] ?? "2B",
    "3B": sortedB.order[2] ?? "3B",
    "4B": sortedB.order[3] ?? "4B",
  };

  renderPlayoffSection(playoffEl, sortedA.order, sortedB.order, gamesById);
}
