console.log("rozpis.js loaded");

import { buildTeamIndex, teamHrefById, normKey } from "./teams-store.js";

let TEAM_BY_NAME = new Map();

async function initTeamLinks(){
  const { byName } = await buildTeamIndex();
  TEAM_BY_NAME = byName;
}

function teamLink(name){
  if (!TEAM_BY_NAME || !name) return escapeHtml(name ?? "—");

  const t = TEAM_BY_NAME.get(normKey(name));
  if (!t) return escapeHtml(name);

  return `<a class="teamlink" href="${teamHrefById(t.id)}">${escapeHtml(name)}</a>`;
}

const ROZPIS_URL = "../../data/rozpis.json";
const ROZPIS_BACKUP_URL = "../../data/backup/rozpis.backup.json";
const DEBUG_MODE = new URLSearchParams(window.location.search).get("debug") === "1";
let DEBUG_TIME = null;
const LS_KEY = "mcr_u15_rozpis_cache_v1";
let originalData = null;
let currentFilter = ""; // "" = Všechny týmy
const TEAM_FILTER_KEY = "mcr_u15_team_filter_v1";
const CHANGES_KEY = "mcr_u15_rozpis_time_changes_v1";
  const TEAM_IGNORE_PREFIXES = [
  "Vítěz",
  "Poražený",
  "Winner",
  "Loser"
];
const DAY_DATE = {
  patek: "2026-04-24",
  sobota: "2026-04-25",
  nedele: "2026-04-26",
};
let ACTIVE_DAY = null;
const LIVE_WINDOW_MIN = 120;  // jak dlouho po startu bereme zápas jako "live"
const NEXT_WINDOW_MIN = 60;  // jak dlouho dopředu bereme zápas jako "next"

function setStatus(msg, type = "info") {
  const el = document.getElementById("data-status");
  if (!el) return;

  el.style.display = "block";
  el.textContent = msg;

  // jednoduchý barvy bez závislosti na theme systému
  const styles = {
    ok:   { bg: "rgba(16,185,129,.12)", bd: "rgba(16,185,129,.35)" },
    warn: { bg: "rgba(245,158,11,.14)", bd: "rgba(245,158,11,.40)" },
    err:  { bg: "rgba(239,68,68,.12)",  bd: "rgba(239,68,68,.35)"  },
    info: { bg: "rgba(59,130,246,.10)", bd: "rgba(59,130,246,.28)" }
  };

  const s = styles[type] || styles.info;
  el.style.background = s.bg;
  el.style.border = `1px solid ${s.bd}`;
}

function isValidRozpis(data) {
  if (!data || typeof data !== "object") return false;
  return ["patek", "sobota", "nedele"].every((k) => Array.isArray(data[k]));
}

(async () => {
  try {
    await initTeamLinks();
    // 1) pokus: načíst z webu
    const url = `../../data/rozpis.json?v=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    const lastMod = res.headers.get("last-modified"); // např. "Sun, 02 Feb 2026 22:25:00 GMT"
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

    const raw = await res.text();
    const data = JSON.parse(raw);
    const contentHash = simpleHash(raw);
    if (!isValidRozpis(data)) throw new Error("Invalid rozpis.json structure");

    // === DIFF ZMĚN ČASŮ (BOD 3) ===
    let prevData = null;
    try {
      const cached = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      prevData = cached?.data || null;
    } catch (e) {}

    const changes = diffTimeChanges(prevData, data);
    if (changes.length) {
      localStorage.setItem(CHANGES_KEY, JSON.stringify({
        at: Date.now(),
        changes
      }));
    }
    renderChangesLine(changes);

    // uložit jako poslední dobrou verzi
    localStorage.setItem(LS_KEY, JSON.stringify({ savedAt: Date.now(), data }));
    originalData = data;
    window.originalData = data;

    const upd = document.getElementById("updated");
    if (upd) {
      const updatedValue = data.updated ?? data.update ?? null;
      if (updatedValue) {
        upd.textContent = formatUpdatedHuman(updatedValue);
      } else if (lastMod) {
        upd.textContent = formatUpdatedHuman(lastMod);
      } else {
        upd.textContent = "—";
      }
    }

    window.originalData = originalData;

    renderRozpis(originalData);

    try {
      const ch = JSON.parse(localStorage.getItem(CHANGES_KEY) || "null");
      renderChangesLine(ch?.changes || []);
    } catch (e) {}

    initTeamFilter(originalData);
    return;

  } catch (err) {
    console.error(err);

    // 2) fallback: poslední uložená verze z localStorage
    try {
      const cached = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      const prevHash = cached?.hash || null;

      let effectiveUpdated = cached?.effectiveUpdated || null;
      if (prevHash !== contentHash) {
        effectiveUpdated = new Date().toLocaleString("cs-CZ"); // změna detekovaná teď
      }

      // uložit cache i s hashem a “effectiveUpdated”
      localStorage.setItem(LS_KEY, JSON.stringify({
        savedAt: Date.now(),
        hash: contentHash,
        effectiveUpdated,
        data
      }));

    if (isValidRozpis(data)) {
      const when = cached?.savedAt ? new Date(cached.savedAt).toLocaleString("cs-CZ") : "dříve";
      setStatus(`Nepodařilo se načíst aktuální rozpis. Zobrazuji poslední uloženou verzi (${when}).`, "warn");

      window.originalData = originalData;

      const upd = document.getElementById("updated");
      if (upd) {
        upd.textContent = formatUpdatedHuman(
          data.updated || data.update || effectiveUpdated
        );
  }

    window.originalData = originalData;
    renderRozpis(originalData);

    try {
      const ch = JSON.parse(localStorage.getItem(CHANGES_KEY) || "null");
      renderChangesLine(ch?.changes || []);
    } catch (e) {}

    initTeamFilter(originalData);
    return;

    }

    } catch (e) {
      // ignore
    }

    // 3) fallback: statický záložní soubor (backup)
    try {
      const resB = await fetch("../../data/rozpis.backup.json?v=" + Date.now(), { cache: "no-store" });
      if (!resB.ok) throw new Error("Backup file missing");
      const backup = await resB.json();

      if (isValidRozpis(backup)) {
        setStatus("Zobrazuji záložní rozpis (backup).", "warn");
        // updated z backupu
        const upd2 = document.getElementById("updated");
        if (upd2) upd2.textContent = formatUpdatedHuman(backup.updated ?? backup.update ?? "—");

      originalData = backup;
      renderRozpis(originalData);

      try {
        const ch = JSON.parse(localStorage.getItem(CHANGES_KEY) || "null");
        renderChangesLine(ch?.changes || []);
      } catch (e) {}

      initTeamFilter(originalData);
      return;


      }
      
    } catch (e) {
      // ignore
    }

    // 4) poslední možnost: zobrazit hlášku (aspoň něco)
    setStatus("Rozpis se nepodařilo načíst. Zkuste obnovit stránku.", "error");
  }
})();

function isMatchLive(timeStr, dateStr, durationMin = 60, nowRef = new Date()) {
  if (!timeStr || !dateStr) return false;

  const [Y, M, D] = dateStr.split("-").map(Number);
  if ([Y, M, D].some(Number.isNaN)) return false;

  const [h, m] = String(timeStr).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;

  const start = new Date(Y, M - 1, D, h, m, 0, 0);
  const end = new Date(start);
  end.setMinutes(start.getMinutes() + durationMin);

  return nowRef >= start && nowRef <= end;
}

function renderRozpis(data) {
  const pillHtml = (hala) => {
    const n = Number(hala);
    if (n === 1) return '<span class="pill pill--h1">Hala 1</span>';
    if (n === 2) return '<span class="pill pill--h2">Hala 2</span>';
    return `<span class="pill">Hala ${hala ?? "—"}</span>`;
  };

const matchHtml = (m) => {
  const text = String(m?.zapas ?? "—").trim();
  const parts = text.split(/\s*[–—-]\s*/);
  if (parts.length < 2) return escapeHtml(text);

  const a = parts[0].trim();
  const b = parts[1].trim();

  // placeholdery nelinkuj
  if (/^\d[AB]$/i.test(a) || /^\d[AB]$/i.test(b)) return escapeHtml(text);
  if (/^[WL]\s+/i.test(a) || /^[WL]\s+/i.test(b)) return escapeHtml(text);
  if (TEAM_IGNORE_PREFIXES.some(p => a.startsWith(p) || b.startsWith(p))) return escapeHtml(text);

  return `${teamLink(a)} <span class="muted">–</span> ${teamLink(b)}`;
};

const fillTable = (tableId, rows, renderRow, focusId) => {
  const tbl = document.getElementById(tableId);
  if (!tbl) return;

  const daySection = tbl.closest("[data-day]");
  const dayKey = daySection?.getAttribute("data-day") || "";
  const dayDate = DAY_DATE[dayKey] || ""; // <- datum dne z mapy

  const tbody = tbl.querySelector("tbody");
  if (!tbody) return;

  const safeRows = Array.isArray(rows) ? rows : [];
  tbody.innerHTML = "";

  if (safeRows.length === 0) {
    const colCount = tbl.querySelectorAll("thead th").length || 1;
    const tr = document.createElement("tr");
    tr.className = "emptyrow";
    tr.innerHTML = `<td colspan="${colCount}">— žádné zápasy —</td>`;
    tbody.appendChild(tr);
    return;
  }

  // "now" podle aktivního dne: vezmeme aktuální čas, ale datum nastavíme na den tabulky
  // reálné datum (ISO) – LIVE jen když jsme ve správném dni turnaje
  // === DEBUG MODE ===
  // debug=1 -> simulujeme den podle tabu
  // normal  -> LIVE jen při reálném dni turnaje

  const realNow = new Date();
  const realIso = new Date(
    realNow.getFullYear(),
    realNow.getMonth(),
    realNow.getDate()
  ).toISOString().slice(0, 10);

  const isRealTournamentDay = dayDate && realIso === dayDate;
  const allowLive = DEBUG_MODE || isRealTournamentDay;
  const nextWindow = allowLive ? NEXT_WINDOW_MIN : 24 * 60; // mimo turnajový den ukaž DALŠÍ kdykoliv v rámci dne

  // referenční čas:
  // - debug: "jako kdyby" byl aktivní den
  // - normal: jen reálný den turnaje, jinak 00:00 (kvůli NEXT)
  let nowRef = realNow;

  if (dayDate) {
    const [Y, M, D] = dayDate.split("-").map(Number);
    if (![Y, M, D].some(Number.isNaN)) {

      if (DEBUG_MODE && DEBUG_TIME) {
        const [h, m] = DEBUG_TIME.split(":").map(Number);
        nowRef = new Date(Y, M - 1, D, h, m, 0, 0);
      } else if (allowLive) {
        nowRef = new Date(Y, M - 1, D, realNow.getHours(), realNow.getMinutes(), 0, 0);
      } else {
        nowRef = new Date(Y, M - 1, D, 0, 0, 0, 0);
      }

    }
  }

  const nowMin = nowRef.getHours() * 60 + nowRef.getMinutes();

  const toMin = (timeStr) => {
    if (!timeStr) return null;
    const [h, m] = String(timeStr).split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  // pokud je v tabulce aspoň jeden LIVE, NEXT nebudeme zvýrazňovat (jen pro aktivní den)
  const hasLive =
    (dayKey === ACTIVE_DAY) &&
    allowLive &&
    safeRows.some(r => isMatchLive(r?.cas, dayDate, LIVE_WINDOW_MIN, nowRef));

  let nextTimeMin = null;
  let bestDelta = Infinity;

  if (dayKey === ACTIVE_DAY) {
    safeRows.forEach((r) => {
      const m = toMin(r?.cas);
      if (m == null) return;

      // ignoruj LIVE
      if (allowLive && isMatchLive(r?.cas, dayDate, LIVE_WINDOW_MIN, nowRef)) return;

      const delta = m - nowMin;
      if (delta > 0 && delta <= nextWindow && delta < bestDelta) {
        bestDelta = delta;
        nextTimeMin = m;
      }
    });
  }

  safeRows.forEach((r, idx) => {
    const tr = document.createElement("tr");

  const rowMin = toMin(r?.cas);

  if (dayKey === ACTIVE_DAY && allowLive && isMatchLive(r?.cas, dayDate, LIVE_WINDOW_MIN, nowRef)) {
    tr.classList.add("is-live");
  } else if (dayKey === ACTIVE_DAY && nextTimeMin != null && rowMin === nextTimeMin) {
    tr.classList.add("is-next");
  } else if (dayKey === ACTIVE_DAY && allowLive && rowMin != null && rowMin < nowMin) {
    tr.classList.add("is-done");
  }

    tr.innerHTML = renderRow(r);
    tbody.appendChild(tr);
  });
};

  // Pátek (skupiny)
  fillTable("tbl-rozpis-patek", data.patek, (r) => {
    const matchId = r?.id || makeMatchId({
      dayKey: "patek",
      cas: r?.cas,
      hala: r?.hala,
    });

    return `
      <td>${r.cas ?? "—"}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${matchHtml(r)}</td>
      <td>${r.skupina ?? "—"}</td>
      <td class="col-links">${renderLinks({ matchId, tvcomUrl: r?.tvcom })}</td>
      <td class="col-score"></td>
    `;
  });

  // Sobota (skupiny)
  fillTable("tbl-rozpis-sobota", data.sobota, (r) => {
    const matchId = r?.id || makeMatchId({
      dayKey: "sobota",
      cas: r?.cas,
      hala: r?.hala,
    });

    return `
      <td>${r.cas ?? "—"}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${matchHtml(r)}</td>
      <td>${r.skupina ?? "—"}</td>
      <td class="col-links">${renderLinks({ matchId, tvcomUrl: r?.tvcom })}</td>
      <td class="col-score"></td>
    `;
  });

  // Neděle (playoff)
  fillTable("tbl-rozpis-nedele", data.nedele, (r) => {
    const matchId = r?.id || makeMatchId({
      dayKey: "nedele",
      cas: r?.cas,
      hala: r?.hala,
      phase: r?.faze,
    });

    return `
      <td>${r.cas ?? "—"}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${r.faze ?? "—"}</td>
      <td>${matchHtml(r)}</td>
      <td class="col-links">${renderLinks({ matchId, tvcomUrl: r?.tvcom })}</td>
      <td class="col-score"></td>
    `;
  });
}

function normalizeTeamName(s) {
  return (s || "").trim();
}

function parseTeamsFromMatchText(matchText) {
  const t = (matchText || "").trim();
  if (!t) return [];
  // bere " – " i " - " i bez mezer
  const parts = t.split(/\s*[–-]\s*/);
  if (parts.length < 2) return [];
  return [normalizeTeamName(parts[0]), normalizeTeamName(parts[1])].filter(Boolean);
}

function extractTeamsFromSchedule(data) {
  const set = new Set();

  // bereme JEN skupinové zápasy (skupina A/B), ne Play-off
  ["patek", "sobota"].forEach((dayKey) => {
  const rows = Array.isArray(data?.[dayKey]) ? data[dayKey] : [];

  rows.forEach((r) => {
    // ✅ jen skupiny A a B
    if (r?.skupina !== "A" && r?.skupina !== "B") return;

    parseTeamsFromMatchText(r?.zapas).forEach((team) => {
      if (TEAM_IGNORE_PREFIXES.some((p) => team.startsWith(p))) return;
      if (/^\d+\s*[AB]$/i.test(team)) return; // 1A, 4B
      if (/^[WL]\s+/i.test(team)) return;     // W QF1, L SF2

      set.add(team);
    });
  });
});

  return Array.from(set);
}

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function setQueryParam(name, value) {
  const url = new URL(window.location.href);
  if (!value) url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  window.history.replaceState({}, "", url.toString());
}

function buildFilteredData(data, selectedTeam) {
  const team = normalizeTeamName(selectedTeam);
  if (!team) return data;

  const filterDay = (rows) =>
    (Array.isArray(rows) ? rows : []).filter((r) => {
      const [t1, t2] = parseTeamsFromMatchText(r?.zapas);
      return t1 === team || t2 === team;
    });

  return {
    ...data,
    patek: filterDay(data.patek),
    sobota: filterDay(data.sobota),
    nedele: filterDay(data.nedele),
  };
}

function updateFilterInfo(selectedTeam, filteredData) {
  const infoEl = document.getElementById("teamFilterInfo");
  if (!infoEl) return;

  const team = normalizeTeamName(selectedTeam);
  if (!team) {
    infoEl.textContent = "";
    return;
  }

  const total =
    (filteredData?.patek?.length || 0) +
    (filteredData?.sobota?.length || 0) +
    (filteredData?.nedele?.length || 0);

  infoEl.textContent =
    total === 0
      ? "Pro vybraný tým nejsou v rozpisu žádné zápasy."
      : `Zobrazeny zápasy: ${team}`;
}

function applyTeamFilter(selectedTeam) {
  if (!originalData) return;

  currentFilter = normalizeTeamName(selectedTeam || "");
  const filtered = buildFilteredData(originalData, currentFilter);

  renderRozpis(filtered);
  updateFilterInfo(currentFilter, filtered);

  // URL parametr pro sdílení
  setQueryParam("team", currentFilter);
}
localStorage.setItem(TEAM_FILTER_KEY, currentFilter);
const saved = localStorage.getItem(TEAM_FILTER_KEY) || "";

function initTeamFilter(data) {
  const select = document.getElementById("teamFilter");
  const resetBtn = document.getElementById("teamFilterReset");
  if (!select) return;

  // naplnit týmy z dat
  let teams = extractTeamsFromSchedule(data);
  teams = addSampleTeamsIfDebug(teams);
  teams.sort((a, b) => a.localeCompare(b, "cs"));


  // vyčisti optiony kromě default
  select.querySelectorAll("option:not([value=''])").forEach((o) => o.remove());

  teams.forEach((team) => {
    const opt = document.createElement("option");
    opt.value = team;
    opt.textContent = team;
    select.appendChild(opt);
  });

  // URL ?team=...
  const fromUrl = getQueryParam("team");
  if (fromUrl) {
    const exact = teams.find((t) => t === fromUrl);
    const ci = teams.find((t) => t.toLowerCase() === fromUrl.toLowerCase());
    currentFilter = exact || ci || "";
  } else {
    currentFilter = saved;
  }

    if (fromUrl && !currentFilter) {
    const infoEl = document.getElementById("teamFilterInfo");
    if (infoEl) infoEl.textContent = "Tým z odkazu nebyl nalezen. Zobrazuji všechny týmy.";
  }

  select.value = currentFilter;

  select.addEventListener("change", () => {
    applyTeamFilter(select.value);
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      select.value = "";
      applyTeamFilter("");
    });
  }

  // první render (včetně URL)
  applyTeamFilter(currentFilter);
}

function addSampleTeamsIfDebug(teams) {
  const dbg = getQueryParam("debug");
  if (dbg !== "1") return teams;

  const samples = ["Tým A1", "Tým A2", "Tým B1", "Tým B2", "Tým C1"];
  const set = new Set([...(teams || []), ...samples]);
  return Array.from(set);
}

function simpleHash(str) {
  // rychlý non-crypto hash na detekci změny
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return String(h);
}

function getRowKey(dayKey, r) {
  // Ideál: stabilní id v rozpis.json
  if (r?.id) return String(r.id);

  // Fallback: klíč z obsahu (méně stabilní, ale funguje bez id)
  return `${dayKey}|${r?.zapas ?? ""}|${r?.hala ?? ""}|${r?.skupina ?? r?.faze ?? ""}`;
}

function buildTimeIndex(data) {
  const idx = new Map();
  ["patek", "sobota", "nedele"].forEach((dayKey) => {
    const rows = Array.isArray(data?.[dayKey]) ? data[dayKey] : [];
    rows.forEach((r) => {
      idx.set(getRowKey(dayKey, r), { dayKey, cas: r?.cas ?? "—", hala: r?.hala ?? "—", zapas: r?.zapas ?? "—" });
    });
  });
  return idx;
}

function diffTimeChanges(prevData, newData) {
  if (!prevData || !newData) return [];

  const a = buildTimeIndex(prevData);
  const b = buildTimeIndex(newData);
  const changes = [];

  for (const [key, nb] of b.entries()) {
    const pa = a.get(key);
    if (!pa) continue;

    if (pa.cas !== nb.cas) {
      changes.push({
        day: nb.dayKey,
        zapas: nb.zapas,
        hala: nb.hala,
        from: pa.cas,
        to: nb.cas
      });
    }
  }
  return changes;
}

function renderChangesLine(changes) {
  const el = document.getElementById("changes");
  if (!el) return;

  if (!changes || changes.length === 0) {
    el.textContent = "bez změn";
    return;
  }

  // max 3 změny do řádku, zbytek jako +N
  const parts = changes.slice(0, 3).map(c => `${c.from}→${c.to} (${c.hala})`);
  const more = changes.length > 3 ? ` +${changes.length - 3}` : "";
  el.textContent = parts.join(", ") + more;
}

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

// --- Day switcher + Live button (robust) ---
(function () {
  const DAY_VALUES = new Set(["patek", "sobota", "nedele"]);

  function setActiveButton(day) {
    ACTIVE_DAY = day; // ✅ JEDINÉ správné místo

    document.querySelectorAll("[data-day-btn]").forEach(btn => {
      const active = btn.getAttribute("data-day-btn") === day;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function showDay(day, { scroll = false } = {}) {
    if (!DAY_VALUES.has(day)) return;

    // 1) nastav aktivní den
    setActiveButton(day);

    // 2) přerenderuj rozpis (LIVE / DALŠÍ se přepočítá)
    if (window.originalData) {
      renderRozpis(window.originalData);
    }

    // 3) zobraz sekce
    const sections = document.querySelectorAll("[data-day]");
    let targetSection = null;

    sections.forEach(sec => {
      const isTarget = sec.getAttribute("data-day") === day;
      sec.style.display = isTarget ? "" : "none";
      if (isTarget) targetSection = sec;
    });

    // 4) scroll
    if (scroll && targetSection) {
      requestAnimationFrame(() => {
        targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function refreshLiveUI() {
    const btn = document.getElementById("btnLive");
    const hint = document.getElementById("liveHint");
    const bar = document.getElementById("liveBar");
    if (!btn) return;

    const liveRow = document.querySelector("tr.is-live");

    if (btn) btn.disabled = !liveRow;
    if (hint) hint.textContent = liveRow ? "Právě probíhá zápas" : "Teď nic neběží";

    if (bar) bar.classList.toggle("is-live", !!liveRow);
  }

  function scrollToLive({ switchDay = true } = {}) {
    const liveRow = document.querySelector("tr.is-live");
    if (!liveRow) {
      refreshLiveUI();
      return false;
    }

    if (switchDay) {
      const sec = liveRow.closest("[data-day]");
      const day = sec?.getAttribute("data-day");
      if (day && DAY_VALUES.has(day)) {
        showDay(day, { scroll: false });
      }
    }

    requestAnimationFrame(() => {
      liveRow.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    refreshLiveUI();
    return true;
  }

  // Kliknutí na den = přepnout + scroll na začátek sekce
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-day-btn]");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const day = btn.getAttribute("data-day-btn");
    if (!DAY_VALUES.has(day)) return;

    showDay(day, { scroll: true });

    const url = new URL(window.location.href);
    url.searchParams.set("day", day);
    history.replaceState({}, "", url);

    // po přepnutí dne aktualizuj live UI (aby se disable/enable chovalo správně)
    refreshLiveUI();
  }, true);

  // Tlačítko "Teď se hraje"
  (function initLiveButton() {
    const btn = document.getElementById("btnLive");
    if (!btn) return;

    refreshLiveUI();

    btn.addEventListener("click", () => {
      scrollToLive({ switchDay: true });
    });
  })();

    // URL ?day=...
  const params = new URLSearchParams(window.location.search);
  const d = (params.get("day") || "").toLowerCase();
  if (DAY_VALUES.has(d)) {
    ACTIVE_DAY = d;
    showDay(d);
  } else {
    ACTIVE_DAY = "patek"; // fallback, nebo klidně null
  }
})();

function makeMatchId({ date, dayKey, cas, hala, phase }) {
  // date preferuj, jinak vem DAY_DATE podle dayKey
  const d = date || (dayKey && DAY_DATE[dayKey]) || "0000-00-00";
  const t = (cas || "").replace(":", "-");
  const h = (hala || "").toString().trim().toLowerCase().replace(/\s+/g, "");
  const p = (phase || "").toString().trim().toLowerCase().replace(/\s+/g, "");
  return [d, t || "xx-xx", h || "hala", p || "x"].join("_");
}

function renderLinks({ matchId, tvcomUrl }) {
  const res = `vysledky.html?match=${encodeURIComponent(matchId)}`;

  const tv = tvcomUrl
    ? `<a href="${tvcomUrl}" target="_blank" rel="noopener" aria-label="TVCOM stream">📺</a>`
    : `<span class="muted" aria-hidden="true">📺</span>`;

  return `
    <span class="matchlinks">
      ${tv}
      <a href="${res}" aria-label="Průběžné výsledky">📊</a>
    </span>
  `;
}

(function () {
  const tbl = document.querySelector("#tbl-rozpis-nedele");
  if (!tbl) return;

  // swap 3rd and 4th cells in each row (FÁZE <-> ZÁPAS)
  function swapCols() {
    tbl.querySelectorAll("tr").forEach(tr => {
      const cells = tr.querySelectorAll("th, td");
      if (cells.length < 4) return;
      const a = cells[2];
      const b = cells[3];
      const aNext = a.nextSibling;
      tr.insertBefore(b, a);
      tr.insertBefore(a, aNext); // keeps order swapped
    });
  }

  // run only for print lifecycle
  window.addEventListener("beforeprint", () => {
    // prevent double swap if browser fires beforeprint twice
    if (tbl.dataset.swapped === "1") return;
    swapCols();
    tbl.dataset.swapped = "1";
  });

  window.addEventListener("afterprint", () => {
    if (tbl.dataset.swapped !== "1") return;
    swapCols(); // swap back
    delete tbl.dataset.swapped;
  });
})();

window.debugNow = function (hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) {
    console.warn("Použij formát HH:MM");
    return;
  }
  DEBUG_TIME = hhmm;
  console.log("[DEBUG] Simulovaný čas:", hhmm);
  renderRozpis(window.originalData);
};

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
