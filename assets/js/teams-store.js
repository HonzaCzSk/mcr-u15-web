// assets/js/teams-store.js
// SOURCE OF TRUTH = /data/tymy.json

function dataUrl(filename){
  // teams-store.js je v /assets/js/ -> do /data je to ../../data
  return new URL(`../../data/${filename}`, import.meta.url).toString();
}

export async function loadTeams(){
  const res = await fetch(dataUrl("tymy.json") + "?v=" + Date.now(), { cache:"no-store" });
  if(!res.ok) throw new Error("Nejde načíst tymy.json");
  return await res.json();
}

export function teamId(t){
  return "team-" + t.id;
}

export function teamHrefById(id){
  return "tymy.html#team-" + id;
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