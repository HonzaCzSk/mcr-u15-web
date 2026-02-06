// assets/js/teams-store.js
// SOURCE OF TRUTH = /data/tymy.json

function dataUrl(filename){
  // teams-store.js je v /assets/js/ -> do /data je to ../../data
  return new URL(`../../data/${filename}`, import.meta.url).toString();
}

export async function loadTeams(){
  const url = dataUrl("tymy.json");
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Nelze načíst tymy.json (${res.status})`);
  const teams = await res.json();

  // mini validace
  for (const t of teams) {
    if (!t?.id || !t?.name || !t?.seed || !t?.group) {
      throw new Error("Neplatná položka v tymy.json: " + JSON.stringify(t));
    }
  }
  return teams;
}

export function teamId(t){
  return t.id; // bez prefixu
}

export function teamHrefById(id){
  return `tymy.html#${id}`;
}

export function teamHrefByName(teams, name){
  if(!name) return null;
  const key = name.trim().toLowerCase();
  const t = teams.find(x => x.name.toLowerCase() === key);
  return t ? teamHrefById(t.id) : null;
}

export function teamBySeed(teams, seed){
  return teams.find(t => t.seed === seed) || null;
}

export async function buildTeamIndex(){
  const teams = await loadTeams();
  const byId = new Map();
  const byName = new Map();

  for (const t of teams){
    byId.set(t.id, t);
    byName.set(normKey(t.name), t);
  }
  return { teams, byId, byName };
}

export function normKey(s){
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
