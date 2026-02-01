console.log("rozpis.js loaded");
const LS_KEY = "mcr_u15_rozpis_cache_v1";
let originalData = null;
let currentFilter = ""; // "" = Všechny týmy
const TEAM_FILTER_KEY = "mcr_u15_team_filter_v1";
  const TEAM_IGNORE_PREFIXES = [
  "Vítěz",
  "Poražený",
  "Winner",
  "Loser"
];

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

    originalData = data;

    const upd = document.getElementById("updated");
    if (upd) upd.textContent = data.updated ?? "—";

    initTeamFilter(originalData);
    return;

  } catch (err) {
    console.error(err);

    // 2) fallback: poslední uložená verze z localStorage
    try {
      const cached = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      const data = cached?.data;

    if (isValidRozpis(data)) {
      const when = cached?.savedAt ? new Date(cached.savedAt).toLocaleString("cs-CZ") : "dříve";
      setStatus(`Nepodařilo se načíst aktuální rozpis. Zobrazuji poslední uloženou verzi (${when}).`, "warn");

      originalData = data;

      const upd = document.getElementById("updated");
      if (upd) upd.textContent = data.updated ?? "—";

      initTeamFilter(originalData);
      return;
    }

    } catch (e) {
      // ignore
    }

    // 3) fallback: statický záložní soubor (backup)
    try {
      const resB = await fetch("../data/rozpis.backup.json?v=" + Date.now(), { cache: "no-store" });
      if (!resB.ok) throw new Error("Backup file missing");
      const backup = await resB.json();

      if (isValidRozpis(backup)) {
        setStatus("Zobrazuji záložní rozpis (backup).", "warn");
        // updated z backupu
        const upd2 = document.getElementById("updated");
        if (upd2) upd2.textContent = backup.updated ?? "—";
      originalData = backup;
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

  safeRows.forEach((r) => {
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

  // bereme JEN skupinové dny (pá + so)
  ["patek", "sobota"].forEach((dayKey) => {
    const rows = Array.isArray(data?.[dayKey]) ? data[dayKey] : [];
    rows.forEach((r) => {
      parseTeamsFromMatchText(r?.zapas).forEach((team) => {
        if (TEAM_IGNORE_PREFIXES.some((p) => team.startsWith(p))) return;
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
  //const teams = extractTeamsFromSchedule(data).sort((a, b) => a.localeCompare(b, "cs"));
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