// ../assets/js/tymy.js
import { loadTeams, teamId } from "./teams-store.js";

document.addEventListener("DOMContentLoaded", async () => {
  const quick = document.getElementById("teams-quick");
  const root = document.getElementById("teams-root");
  if (!quick || !root) return;

  const teams = await loadTeams();

  // 1) render quick view (index nahoře)
  renderQuickView(quick, teams);

  // 2) render detail karet (accordion)
  renderTeams(root, teams);

  // 3) accordion logika
  setupAccordion(root);

  // 4) auto-open po hash
  openByHash(root);

  window.addEventListener("hashchange", () => openByHash(root));
});

function groupTeams(teams) {
  const map = new Map();
  for (const t of teams) {
    if (!map.has(t.group)) map.set(t.group, []);
    map.get(t.group).push(t);
  }
  for (const [g, arr] of map) {
    arr.sort((a, b) => String(a.seed).localeCompare(String(b.seed), "cs"));
  }
  return map;
}

function renderQuickView(container, teams) {
  const groups = groupTeams(teams);

  container.innerHTML = [...groups.entries()].map(([group, arr]) => `
    <div class="quick-group">
      <h2 class="quick-title">Skupina ${escapeHtml(group)}</h2>

      <div class="quick-grid">
        ${arr.map(t => `
          <a class="team-quick-card" href="#${teamId(t)}">
            <div class="team-quick-name">${escapeHtml(t.name)}</div>
            <div class="team-quick-meta">
              <span class="pill">${escapeHtml(t.seed)}</span>
              <span class="pill muted">Skupina ${escapeHtml(t.group)}</span>
            </div>
          </a>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function renderTeams(root, teams) {
  // seřazení: A1..A4, B1..B4
  const sorted = [...teams].sort((a, b) => {
    const ga = String(a.group), gb = String(b.group);
    if (ga !== gb) return ga.localeCompare(gb, "cs");
    return String(a.seed).localeCompare(String(b.seed), "cs");
  });

  root.innerHTML = sorted.map(t => {
    const id = teamId(t);
    return `
      <article class="card team" id="${id}">
        <button class="team__head"
          type="button"
          aria-expanded="false"
          aria-controls="panel-${id}">
            <div class="team__headMain">
              <div class="h2">${escapeHtml(t.name)}</div>

              <div class="team-meta">
                <span class="pill">${escapeHtml(t.seed)}</span>
                <span class="pill muted">Skupina ${escapeHtml(t.group)}</span>
              </div>
            </div>
          <span class="team__chev" aria-hidden="true"></span>
        </button>

        <div class="team__panel" id="panel-${id}" hidden>
          <div class="stack">
            <p class="muted">Detail bude doplněn (logo, soupisky, trenéři, odkazy).</p>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function setupAccordion(root) {
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".team__head");
    if (!btn) return;

    const card = btn.closest(".team");
    const panel = card.querySelector(".team__panel");
    const isOpen = btn.getAttribute("aria-expanded") === "true";

    btn.setAttribute("aria-expanded", String(!isOpen));
    panel.hidden = isOpen;

    card.classList.toggle("is-open", !isOpen);

    if (!isOpen) {
      history.replaceState(null, "", `#${card.id}`);
    }
  });
}

function openByHash(root) {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;

  const card = root.querySelector(`#${CSS.escape(id)}`);
  if (!card) return;

  const btn = card.querySelector(".team__head");
  const panel = card.querySelector(".team__panel");

  btn.setAttribute("aria-expanded", "true");
  panel.hidden = false;

  card.classList.add("is-open");

  card.scrollIntoView({ behavior: "smooth", block: "start" });

  card.classList.add("flash");
  setTimeout(() => card.classList.remove("flash"), 800);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}