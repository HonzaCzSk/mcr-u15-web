import { loadTeams, teamId } from "./teams-store.js";

document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("teams-root");
  if(!root) return;

  const teams = await loadTeams();

  root.innerHTML = teams.map(t => `
    <section class="card team" id="${teamId(t)}">
      <h2 class="h2">${t.name}</h2>
      <p class="muted">Seed ${t.seed} · Skupina ${t.group}</p>
    </section>
  `).join("");
});
