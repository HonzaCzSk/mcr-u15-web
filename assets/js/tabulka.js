/* =========================
   TABULKA – skupiny + nasazení
   ========================= */

const DEBUG = false;
const MODE = "groups"; // v neděli přepni na "playoff", jinak "groups"

// Paths (tabulka.html je v /pages/)
const ROZPIS_URL = "../data/rozpis.json";
const ROZPIS_BACKUP_URL = "../data/rozpis.backup.json";

const VYSLEDKY_URL = "../data/vysledky.json";
const VYSLEDKY_BACKUP_URL = "../data/vysledky.backup.json";

const LS_ROZPIS_KEY = "mcr_u15_rozpis_cache_v1";
const LS_VYSLEDKY_KEY = "mcr_u15_vysledky_cache_v1";

const DAY_DATE = {
  patek: "2026-04-24",
  sobota: "2026-04-25",
  nedele: "2026-04-26",
};

/* ---------- Loader (web -> cache -> backup) ---------- */

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
    (
      (data.games && typeof data.games === "object") ||
      Array.isArray(data.zapasy)
    )
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

/* ---------- Helpers ---------- */

function makeMatchId({ date, dayKey, cas, hala, phase }) {
  const d = date || (dayKey && DAY_DATE[dayKey]) || "0000-00-00";
  const t = (cas || "").replace(":", "-");
  const h = (hala || "").toString().trim().toLowerCase().replace(/\s+/g, "");
  const p = (phase || "").toString().trim().toLowerCase().replace(/\s+/g, "");
  return [d, t || "xx-xx", h || "hala", p || "x"].join("_");
}

function normalizeStav(stav) {
  return String(stav || "").trim().toUpperCase();
}

function parseTeamsFromZapas(zapasStr) {
  if (!zapasStr) return null;

  // Normalize various dashes to a single hyphen
  const s = String(zapasStr)
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  // Accept "A1 - A2", "A1-A2", "A1  -  A2"
  const m = s.match(/^(.+?)\s*-\s*(.+?)$/);
  if (!m) return null;

  const left = m[1].trim();
  const right = m[2].trim();
  if (!left || !right) return null;
  return { teamA: left, teamB: right };
}

function guessGroupFromTeams(teamA, teamB) {
  const a = String(teamA || "").trim().toUpperCase();
  const b = String(teamB || "").trim().toUpperCase();
  // Typicky A1/B3 atd. → skupina podle prvního znaku
  const ga = a[0];
  const gb = b[0];
  if (ga === "A" && gb === "A") return "A";
  if (ga === "B" && gb === "B") return "B";
  return null;
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function parseScoreFromString(str) {
  if (!str) return null;
  const s = String(str);
  // "50 : 49", "50:49", "50-49"
  const m = s.match(/(\d{1,3})\s*[:\-]\s*(\d{1,3})/);
  if (!m) return null;
  const a = safeNum(m[1]);
  const b = safeNum(m[2]);
  if (a === null || b === null) return null;
  return { scoreA: a, scoreB: b };
}

function parseScoreFromQuarters(game) {
  const q = game?.quarters;
  if (!q) return null;

  // quarters může být:
  // - array stringů ["12:10", "10:12", "50:49"]
  // - array objektů [{a:12,b:10}, ...]
  // - nebo objekt se součty (různé feedy)
  if (Array.isArray(q) && q.length) {
    const last = q[q.length - 1];

    // string
    if (typeof last === "string") {
      return parseScoreFromString(last);
    }

    // object with a/b or home/away or scoreA/scoreB
    if (last && typeof last === "object") {
      const candidates = [
        { a: last.a, b: last.b },
        { a: last.A, b: last.B },
        { a: last.home, b: last.away },
        { a: last.h, b: last.a }, // sometimes h/a
        { a: last.scoreA, b: last.scoreB },
        { a: last.pf, b: last.pa },
      ];

      for (const c of candidates) {
        const aa = safeNum(c.a);
        const bb = safeNum(c.b);
        if (aa !== null && bb !== null) return { scoreA: aa, scoreB: bb };
      }

      // If object has any "X:Y" somewhere
      for (const v of Object.values(last)) {
        if (typeof v === "string") {
          const p = parseScoreFromString(v);
          if (p) return p;
        }
      }
    }
  }

  // quarters sometimes is a string
  if (typeof q === "string") return parseScoreFromString(q);

  return null;
}

function parseFinalScore(game) {
  // 1) quarters (preferred)
  const q = parseScoreFromQuarters(game);
  if (q) return q;

  // 2) common fields
  const candidates = [
    game?.score,
    game?.skore,
    game?.vysledek,
    game?.result,
    game?.finalScore,
    game?.fulltime,
    game?.ft,
  ];

  for (const c of candidates) {
    const p = parseScoreFromString(c);
    if (p) return p;
  }

  // 3) nested possible places
  const nested = [
    game?.score?.text,
    game?.score?.final,
    game?.result?.text,
    game?.final?.text,
  ];
  for (const c of nested) {
    const p = parseScoreFromString(c);
    if (p) return p;
  }

  return null;
}

/* ---------- Standings ---------- */

function initTeam(team) {
  return {
    team,
    Z: 0,
    V: 0,
    R: 0,
    P: 0,
    body: 0,
    PF: 0,
    PA: 0,
    diff: 0,
  };
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

function sortStandingsWithH2H(teamsArr, allMatches) {
  // teamsArr: array of team names
  // allMatches: array {teamA, teamB, scoreA, scoreB} only within same group, only FINAL

  // Precompute global stats for tie-break fallback
  const global = new Map();
  for (const t of teamsArr) global.set(t, initTeam(t));
  for (const m of allMatches) applyMatch(global, m.teamA, m.teamB, m.scoreA, m.scoreB);

  // Group by points
  const groups = new Map();
  for (const t of teamsArr) {
    const pts = global.get(t)?.body ?? 0;
    if (!groups.has(pts)) groups.set(pts, []);
    groups.get(pts).push(t);
  }

  const ptsSorted = Array.from(groups.keys()).sort((a, b) => b - a);
  const out = [];

  for (const pts of ptsSorted) {
    const tied = groups.get(pts);

    if (tied.length === 1) {
      out.push(tied[0]);
      continue;
    }

    // mini-table from mutual matches
    const mini = new Map();
    for (const t of tied) mini.set(t, initTeam(t));

    const mutual = allMatches.filter(
      (m) => tied.includes(m.teamA) && tied.includes(m.teamB)
    );

    for (const m of mutual) applyMatch(mini, m.teamA, m.teamB, m.scoreA, m.scoreB);

    // sort by mini: points -> diff -> PF
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

      // fallback to global rules
      const ga = global.get(t1);
      const gb = global.get(t2);

      if ((ga?.diff ?? 0) !== (gb?.diff ?? 0)) return (gb?.diff ?? 0) - (ga?.diff ?? 0);
      if ((ga?.PF ?? 0) !== (gb?.PF ?? 0)) return (gb?.PF ?? 0) - (ga?.PF ?? 0);

      return String(t1).localeCompare(String(t2), "cs");
    });

    out.push(...tied);
  }

  return { globalStats: global, order: out };
}

/* ---------- Render ---------- */

function renderStandingsTable(tableEl, order, statsMap) {
  if (!tableEl) return;

  if (!order.length) {
    tableEl.innerHTML = `
      <thead>
        <tr>
          <th>#</th><th>Tým</th><th>Z</th><th>V–R–P</th><th>Body</th><th>PF:PA</th><th>+/-</th>
        </tr>
      </thead>
      <tbody>
        <tr><td colspan="7">Zatím bez dohraných zápasů.</td></tr>
      </tbody>
    `;
    return;
  }

  const rows = order
    .map((team, idx) => {
      const s = statsMap.get(team) || initTeam(team);
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(s.team)}</td>
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
      <tr>
        <th>#</th><th>Tým</th><th>Z</th><th>V–R–P</th><th>Body</th><th>PF:PA</th><th>+/-</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}

function renderPlayoffSection(playoffEl, orderA, orderB) {
  if (!playoffEl) return;

  // Pokud nemáme komplet pořadí, dej placeholder
  if (orderA.length < 4 || orderB.length < 4) {
    playoffEl.innerHTML = `
      <h2 class="h2" style="margin-top:0;">Play-off</h2>
      <p class="lead" style="margin-bottom:0;">Play-off pavouk bude dostupný v neděli.</p>
    `;
    return;
  }

  const pairs = [
    ["1A – 4B", orderA[0], orderB[3]],
    ["2A – 3B", orderA[1], orderB[2]],
    ["1B – 4A", orderB[0], orderA[3]],
    ["2B – 3A", orderB[1], orderA[2]],
  ];

  playoffEl.innerHTML = `
    <h2 class="h2" style="margin-top:0;">Nasazení do QF</h2>
    <div class="lead" style="margin-bottom:10px;">Z tabulek po skupinách.</div>
    <div style="display:grid; gap:8px;">
      ${pairs
        .map(
          ([label, a, b]) => `
            <div class="panel" style="padding:10px 12px;">
              <div style="font-weight:700; margin-bottom:4px;">${label}</div>
              <div>${escapeHtml(a)} <span style="opacity:.7;">vs</span> ${escapeHtml(b)}</div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

/* ---------- Mode switch (DOM reorder) ---------- */

function applyMode(mode) {
  const groups = document.getElementById("groups-section");
  const playoff = document.getElementById("playoff-section");
  if (!groups || !playoff) return;

  const parent = groups.parentElement;
  if (!parent) return;

  const first = parent.firstElementChild;

  if (mode === "playoff" && first !== playoff) {
    parent.insertBefore(playoff, first);
  }

  if (mode === "groups" && first !== groups) {
    parent.insertBefore(groups, first);
  }
}

/* ---------- Utils ---------- */

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

/* ---------- Main ---------- */

document.addEventListener("DOMContentLoaded", init);

function debugStandings(groupName, order, statsMap, matches) {
  console.groupCollapsed(`TABULKA DEBUG – Skupina ${groupName}`);

  // základní tabulka v konzoli
  const rows = order.map((t, i) => {
    const s = statsMap.get(t);
    return {
      "#": i + 1,
      tym: t,
      Z: s?.Z ?? 0,
      "V-R-P": `${s?.V ?? 0}-${s?.R ?? 0}-${s?.P ?? 0}`,
      body: s?.body ?? 0,
      PF: s?.PF ?? 0,
      PA: s?.PA ?? 0,
      diff: s?.diff ?? 0,
    };
  });
  console.table(rows);

  // odhal tie skupiny podle bodů
  const byPts = new Map();
  for (const t of order) {
    const pts = statsMap.get(t)?.body ?? 0;
    if (!byPts.has(pts)) byPts.set(pts, []);
    byPts.get(pts).push(t);
  }

  for (const [pts, teams] of byPts.entries()) {
    if (teams.length < 2) continue;

    console.groupCollapsed(`Tie na ${pts} bodech: ${teams.join(", ")}`);

    const mutual = matches.filter(
      (m) => teams.includes(m.teamA) && teams.includes(m.teamB)
    );

    // mini-tab z mutual zápasů
    const mini = new Map();
    for (const t of teams) mini.set(t, initTeam(t));
    for (const m of mutual) applyMatch(mini, m.teamA, m.teamB, m.scoreA, m.scoreB);

    const miniRows = teams.map((t) => {
      const s = mini.get(t);
      return {
        tym: t,
        body: s?.body ?? 0,
        PF: s?.PF ?? 0,
        PA: s?.PA ?? 0,
        diff: s?.diff ?? 0,
      };
    });

    console.log("Vzájemné zápasy:", mutual);
    console.table(miniRows);
    console.groupEnd();
  }

  console.groupEnd();
}

async function init() {
  applyMode(MODE);

  const updatedEl = document.getElementById("updated");
  const playoffEl = document.getElementById("playoff-section");
  const tableA = document.getElementById("tbl-standings-a");
  const tableB = document.getElementById("tbl-standings-b");

  let vysledkyRes, rozpisRes;

  try {
    [vysledkyRes, rozpisRes] = await Promise.all([
      loadWithFallback(VYSLEDKY_URL, VYSLEDKY_BACKUP_URL, LS_VYSLEDKY_KEY, isValidVysledky),
      loadWithFallback(ROZPIS_URL, ROZPIS_BACKUP_URL, LS_ROZPIS_KEY, isValidRozpis),
    ]);
  } catch (e) {
    console.error("TABULKA: nelze načíst data", e);

    // fail-safe render
    if (updatedEl) updatedEl.textContent = "—";
    if (playoffEl) playoffEl.innerHTML = `<p class="lead">Data nejsou dostupná.</p>`;
    renderStandingsTable(tableA, [], new Map());
    renderStandingsTable(tableB, [], new Map());
    return;
  }

  const vysledky = vysledkyRes.data;

  // Normalize vysledky: array -> map by id
    const gamesById = new Map();

    if (Array.isArray(vysledky.zapasy)) {
    for (const g of vysledky.zapasy) {
        if (g?.id) gamesById.set(g.id, g);
    }
    }

  const rozpis = rozpisRes.data;

  // Updated label
  if (updatedEl) {
    const source = vysledkyRes.source === "web" ? "web" : (vysledkyRes.source === "cache" ? "cache" : "backup");
    const ts = vysledkyRes.savedAt || Date.now();
    updatedEl.textContent = `${new Date(ts).toLocaleString("cs-CZ")} (${source})`;
  }

  // 1) build list of group matches from rozpis: pátek + sobota
const groupMatches = [];

for (const dayKey of ["patek", "sobota"]) {
  const rows = Array.isArray(rozpis?.[dayKey]) ? rozpis[dayKey] : [];

  for (const item of rows) {
    if (!item || typeof item !== "object") continue;

    // ✅ fallback id stejně jako rozpis/vysledky
    const matchId =
      item.id ||
      makeMatchId({
        dayKey,
        cas: item?.cas,
        hala: item?.hala,
      });

    const teams = parseTeamsFromZapas(item.zapas || item.match || item.title);
    if (!teams) continue;

    const group =
      item.skupina || item.group || guessGroupFromTeams(teams.teamA, teams.teamB);
    if (group !== "A" && group !== "B") continue;

    groupMatches.push({
      id: matchId,
      group,
      teamA: teams.teamA,
      teamB: teams.teamB,
    });
  }
}

    if (DEBUG) {
    console.log("TABULKA DEBUG – groupMatches", groupMatches.length, groupMatches.slice(0, 5));
    }

    // 2) vezmi skupinové FINAL zápasy přímo z vysledky.json
    const matchesA = [];
    const matchesB = [];

    const zapasy = Array.isArray(vysledky.zapasy) ? vysledky.zapasy : [];

    for (const g of zapasy) {
    const skup = String(g?.skupina || "").trim().toUpperCase();
    if (skup !== "A" && skup !== "B") continue;

    const stav = normalizeStav(g?.stav);
    if (stav !== "FINAL" && stav !== "FIN") continue;

    const teams = parseTeamsFromZapas(g?.zapas);
    if (!teams) continue;

    const score = parseScoreFromString(g?.skore);
    if (!score) continue;

    const record = {
        teamA: teams.teamA,
        teamB: teams.teamB,
        scoreA: score.scoreA,
        scoreB: score.scoreB,
    };

    if (skup === "A") matchesA.push(record);
    else matchesB.push(record);
    }

    if (DEBUG) {
    console.log("TABULKA DEBUG – FINAL A/B", matchesA.length, matchesB.length);
    }


  // 3) compute standings & H2H order
  
  const teamsA = Array.from(new Set(matchesA.flatMap((x) => [x.teamA, x.teamB])));
  const teamsB = Array.from(new Set(matchesB.flatMap((x) => [x.teamA, x.teamB])));
  
  const sortedA = sortStandingsWithH2H(teamsA, matchesA);
  const sortedB = sortStandingsWithH2H(teamsB, matchesB);
  
  if (DEBUG) {
      debugStandings("A", sortedA.order, sortedA.globalStats, matchesA);
      debugStandings("B", sortedB.order, sortedB.globalStats, matchesB);
    }
    
    // 4) render
    renderStandingsTable(tableA, sortedA.order, sortedA.globalStats);
    renderStandingsTable(tableB, sortedB.order, sortedB.globalStats);

    // Expose seeds for playoff bracket (playoff.js)
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
}
