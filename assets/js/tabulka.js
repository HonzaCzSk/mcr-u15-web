// assets/js/tabulka.js
// Tabulky skupin A/B z vysledky.json (jen FINAL)
// Body: výhra 3, remíza 1, prohra 0
// Play-off: placeholder (zatím)

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const [vysledky, rozpis] = await Promise.all([
      fetchJson("../data/vysledky.json"),
      fetchJson("../data/rozpis.json"),
    ]);

    // "Poslední aktualizace" – manuální z JSON (prefer vysledky, fallback rozpis)
    const updatedValue =
      (vysledky?.updated || vysledky?.update) ||
      (rozpis?.updated || rozpis?.update) ||
      null;

    setText("updated", formatUpdatedHuman(updatedValue));

    // Zápasy skupin (A/B) a pouze FINAL
    const finals = extractGroupFinals(vysledky);

    const groupA = finals.filter((m) => m.skupina === "A");
    const groupB = finals.filter((m) => m.skupina === "B");

    const teamsA = extractTeamsFromMatches(groupA);
    const teamsB = extractTeamsFromMatches(groupB);

    const standingsA = buildStandings(teamsA, groupA);
    const standingsB = buildStandings(teamsB, groupB);

    renderStandingsTable("tbl-standings-a", standingsA);
    renderStandingsTable("tbl-standings-b", standingsB);
  } catch (err) {
    console.error(err);
    setText("updated", "—");
    setTableError("tbl-standings-a", "Nepodařilo se načíst tabulku.");
    setTableError("tbl-standings-b", "");
    setHtml("playoff-section", `<p class="muted">Play-off: zatím bez dat.</p>`);
  }
}

/* ---------------- Fetch / DOM utils ---------------- */

async function fetchJson(url) {
  // cache-busting, aby se nebrala stará verze JSONu
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text ?? "";
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html ?? "";
}

function setTableError(tableId, msg) {
  const tbl = document.getElementById(tableId);
  if (!tbl) return;
  tbl.innerHTML = msg
    ? `<tbody><tr><td class="muted" style="padding:10px;">${escapeHtml(msg)}</td></tr></tbody>`
    : "";
}

/* ---------------- Updated formatting ---------------- */

function formatUpdatedHuman(dateInput) {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (isNaN(d)) return "—";

  const datePart = d.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const timePart = d.toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${datePart} ${timePart}`;
}

/* ---------------- Play-off placeholder ---------------- */

function renderPlayoffPlaceholder(containerId) {
  setHtml(
    containerId,
    `
    <div class="muted">
      <strong>Play-off</strong><br>
      Pavouk bude doplněn později (zatím jen tabulky skupin).
    </div>
  `.trim()
  );
}

/* ---------------- Data extraction ---------------- */

/**
 * Tolerantní parser: vysledky.json může mít různé struktury.
 * Najde objekty, které vypadají jako zápas (mají "zapas" a typicky "skupina" a nějaké skóre).
 */
function extractGroupFinals(vysledky) {
  const all = flattenMatches(vysledky);

  return all
    .filter((m) => m?.skupina === "A" || m?.skupina === "B")
    .filter((m) => String(m?.stav || m?.status || "").toUpperCase() === "FINAL")
    .map(normalizeMatch)
    .filter((m) => isRealTeamName(m.teamHome) && isRealTeamName(m.teamAway))
    .filter((m) => Number.isFinite(m.home) && Number.isFinite(m.away));
}

function flattenMatches(obj) {
  const out = [];
  walk(obj);
  return out;

  function walk(x) {
    if (!x) return;
    if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x !== "object") return;

    if (looksLikeMatch(x)) out.push(x);
    Object.values(x).forEach(walk);
  }

  function looksLikeMatch(m) {
    if (!m || typeof m !== "object") return false;
    const hasZapas = typeof m.zapas === "string" && m.zapas.includes(" - ");
    const hasGroup = typeof m.skupina === "string";
    const hasScore =
      m.score != null || m.skore != null || m.vysledek != null || m.result != null ||
      (m.home != null && m.away != null) ||
      (m.domaci != null && m.hoste != null);
    return hasZapas && (hasGroup || hasScore);
  }
}

function normalizeMatch(m) {
  const [homeTeam, awayTeam] = parseTeamsFromMatchText(m?.zapas || "");
  const { home, away } = parseScore(m);

  return {
    skupina: m.skupina,
    teamHome: homeTeam ?? null,
    teamAway: awayTeam ?? null,
    home,
    away,
  };
}

function parseTeamsFromMatchText(zapasText) {
  const t = String(zapasText || "");
  const parts = t.split(" - ").map((s) => s.trim()).filter(Boolean);
  return parts.length >= 2 ? [parts[0], parts[1]] : [];
}

function parseScore(m) {
  // podporuje: score/skore "78:65" | objekt {home,away} | nebo klíče domaci/hoste apod.
  const raw = m?.score ?? m?.skore ?? m?.vysledek ?? m?.result ?? null;

  if (raw && typeof raw === "object") {
    return { home: toInt(raw.home), away: toInt(raw.away) };
  }

  const s = String(raw ?? "");
  const mm = s.match(/(\d+)\s*[:\-]\s*(\d+)/);
  if (mm) return { home: toInt(mm[1]), away: toInt(mm[2]) };

  // fallback: home/away nebo domaci/hoste
  return {
    home: toInt(m?.home ?? m?.domaci ?? m?.bodyDomaci),
    away: toInt(m?.away ?? m?.hoste ?? m?.bodyHoste),
  };
}

function toInt(x) {
  const n = Number.parseInt(x, 10);
  return Number.isFinite(n) ? n : NaN;
}

/* ---------------- Team filtering (bez play-off placeholderů) ---------------- */

const TEAM_IGNORE_PREFIXES = ["Winner", "Loser", "Vítěz", "Poražený"];

function isRealTeamName(name) {
  if (!name) return false;
  const team = String(name).trim();
  if (!team) return false;

  if (TEAM_IGNORE_PREFIXES.some((p) => team.startsWith(p))) return false;
  if (/^\d+\s*[AB]$/i.test(team)) return false; // 1A, 4B...
  if (/^[WL]\s+/i.test(team)) return false;     // W QF1, L SF2...
  return true;
}

function extractTeamsFromMatches(matches) {
  const set = new Set();
  matches.forEach((m) => {
    if (isRealTeamName(m.teamHome)) set.add(m.teamHome);
    if (isRealTeamName(m.teamAway)) set.add(m.teamAway);
  });
  return Array.from(set);
}

/* ---------------- Standings ---------------- */

function buildStandings(teams, matches) {
  const map = new Map();
  teams.forEach((t) => map.set(t, blankRow(t)));

  matches.forEach((m) => {
    const h = m.teamHome;
    const a = m.teamAway;
    if (!isRealTeamName(h) || !isRealTeamName(a)) return;
    if (!Number.isFinite(m.home) || !Number.isFinite(m.away)) return;

    if (!map.has(h)) map.set(h, blankRow(h));
    if (!map.has(a)) map.set(a, blankRow(a));

    const rh = map.get(h);
    const ra = map.get(a);

    rh.gp++; ra.gp++;
    rh.pf += m.home; rh.pa += m.away;
    ra.pf += m.away; ra.pa += m.home;

    if (m.home > m.away) {
      rh.w++; ra.l++;
      rh.pts += 3;           // výhra 3
    } else if (m.home < m.away) {
      ra.w++; rh.l++;
      ra.pts += 3;           // výhra 3
    } else {
      rh.d++; ra.d++;
      rh.pts += 1;           // remíza 1
      ra.pts += 1;
    }
  });

  const arr = Array.from(map.values()).map((r) => ({
    ...r,
    diff: r.pf - r.pa,
  }));

  // Řazení: body, rozdíl, BF, název
  arr.sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    if (y.diff !== x.diff) return y.diff - x.diff;
    if (y.pf !== x.pf) return y.pf - x.pf;
    return x.team.localeCompare(y.team, "cs");
  });

  return arr;
}

function blankRow(team) {
  return { team, gp: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, pts: 0 };
}

/* ---------------- Render table into existing <table> ---------------- */

function renderStandingsTable(tableId, rows) {
  const tbl = document.getElementById(tableId);
  if (!tbl) return;

  tbl.innerHTML = `
    <thead>
      <tr>
        <th>#</th>
        <th>Tým</th>
        <th>Z</th>
        <th>V</th>
        <th>R</th>
        <th>P</th>
        <th>BF</th>
        <th>BO</th>
        <th>+/-</th>
        <th>B</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map((r, i) => {
          return `
            <tr>
              <td>${i + 1}</td>
              <td class="team">${escapeHtml(r.team)}</td>
              <td>${r.gp}</td>
              <td>${r.w}</td>
              <td>${r.d}</td>
              <td>${r.l}</td>
              <td>${r.pf}</td>
              <td>${r.pa}</td>
              <td>${r.diff}</td>
              <td><strong>${r.pts}</strong></td>
            </tr>
          `.trim();
        })
        .join("")}
    </tbody>
  `.trim();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
