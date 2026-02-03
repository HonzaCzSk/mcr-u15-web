// assets/js/playoff.js
// Play-off pavouk – logika + render (winner highlight funguje i v SF/F)

const ROUND_LABELS = {
  QF: "Čtvrtfinále",
  SF: "Semifinále",
  F: "Finále",
};

document.addEventListener("DOMContentLoaded", initPlayoff);

async function initPlayoff() {
  const container = document.getElementById("playoff-section");
  if (!container) return;

  try {
    const vysledky = await fetchJson("../data/vysledky.json");
    const matches = extractPlayoffMatches(vysledky);

    const bracket = buildBracket(matches);
    renderBracket(container, bracket);
  } catch (e) {
    console.error(e);
    container.innerHTML = `<p class="muted">Play-off pavouk se nepodařilo načíst.</p>`;
  }
}

/* ---------- FETCH ---------- */

async function fetchJson(url) {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

/* ---------- PLAYOFF TEMPLATE ---------- */

const PLAYOFF_TEMPLATE = {
  QF: [
    { id: "QF1", home: "1A", away: "4B" },
    { id: "QF2", home: "2A", away: "3B" },
    { id: "QF3", home: "1B", away: "4A" },
    { id: "QF4", home: "2B", away: "3A" },
  ],
  SF: [
    { id: "SF1", home: "W QF1", away: "W QF2" },
    { id: "SF2", home: "W QF3", away: "W QF4" },
  ],
  F: [{ id: "F", home: "W SF1", away: "W SF2" }],
};

/* ---------- EXTRACT ---------- */

function extractPlayoffMatches(data) {
  const out = [];
  walk(data);
  return out;

  function walk(x) {
    if (!x) return;
    if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x !== "object") return;

    if (x.skupina === "Play-off") out.push(x);
    Object.values(x).forEach(walk);
  }
}

/* ---------- BUILD ---------- */

function buildBracket(matches) {
  const bracket = JSON.parse(JSON.stringify(PLAYOFF_TEMPLATE));

  // 1) zapiš skóre + winnerSide do správných slotů
  matches.forEach((m) => {
    const id = m.id;
    const score = parseScore(m);
    if (!id || !score) return;

    for (const round of Object.values(bracket)) {
      const slot = round.find((r) => r.id === id);
      if (!slot) continue;

      slot.homePts = score.home;
      slot.awayPts = score.away;
      slot.score = `${score.home}:${score.away}`;
      slot.winnerSide = score.home > score.away ? "home" : "away";
    }
  });

  // 2) propagace vítězů QF -> SF -> F
  const winners = new Map();

  // QF
  bracket.QF.forEach((g) => {
    g.homeResolved = g.home;
    g.awayResolved = g.away;

    if (!g.winnerSide) return;
    g.winnerResolved = g.winnerSide === "home" ? g.homeResolved : g.awayResolved;
    winners.set(g.id, g.winnerResolved);
  });

  // SF
  bracket.SF.forEach((g) => {
    g.homeResolved = resolveRef(g.home, winners);
    g.awayResolved = resolveRef(g.away, winners);

    if (!g.winnerSide) return;
    g.winnerResolved = g.winnerSide === "home" ? g.homeResolved : g.awayResolved;
    winners.set(g.id, g.winnerResolved);
  });

  // F
  bracket.F.forEach((g) => {
    g.homeResolved = resolveRef(g.home, winners);
    g.awayResolved = resolveRef(g.away, winners);

    if (!g.winnerSide) return;
    g.winnerResolved = g.winnerSide === "home" ? g.homeResolved : g.awayResolved;
    winners.set(g.id, g.winnerResolved);
  });

  return bracket;
}

function resolveRef(label, winners) {
  const s = String(label || "");
  const mm = s.match(/^W\s+(QF\d|SF\d|F)$/i);
  if (!mm) return s;
  const id = mm[1].toUpperCase();
  return winners.get(id) || s;
}

function parseScore(m) {
  const raw = m.score ?? m.skore ?? m.vysledek;
  if (!raw) return null;
  const mm = String(raw).match(/(\d+)\s*[:\-]\s*(\d+)/);
  if (!mm) return null;
  return { home: +mm[1], away: +mm[2] };
}

/* ---------- RENDER ---------- */

function renderBracket(container, bracket) {
  container.innerHTML = `
    <h2>PLAY-OFF</h2>
    <div class="playoff-grid">
      ${Object.entries(bracket)
        .map(([round, games]) => renderRound(round, games))
        .join("")}
    </div>
  `;
}

function renderRound(name, games) {
  const cls =
    name === "QF"
      ? "round round-qf"
      : name === "SF"
      ? "round round-sf"
      : name === "F"
      ? "round round-f"
      : "round";

  const title = ROUND_LABELS[name] || name;

  return `
    <div class="${cls}">
      <h3>${title}</h3>
      ${games.map(renderGame).join("")}
    </div>
  `;
}

function renderGame(g) {
  const home = g.homeResolved ?? g.home;
  const away = g.awayResolved ?? g.away;

  const winner = g.winnerResolved || null;
  const isPlayed = !!g.score;

  const cls = ["game", isPlayed ? "game-played" : "game-upcoming"].join(" ");

  const homeClass = winner === home ? "teamname winner" : "teamname";
  const awayClass = winner === away ? "teamname winner" : "teamname";

  return `
    <div class="${cls}">
      <div class="teamline"><span class="${homeClass}">${escapeHtml(home)}</span></div>
      <div class="teamline"><span class="${awayClass}">${escapeHtml(away)}</span></div>
      <div class="score">${g.score ?? "—"}</div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
