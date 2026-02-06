// ../assets/js/tymy.js
import { loadTeams, teamId } from "./teams-store.js";

document.addEventListener("DOMContentLoaded", async () => {
  const quick = document.getElementById("teams-quick");
  const root = document.getElementById("teams-root");
  if (!quick || !root) return;

const teamsAll = await loadTeams();

renderQuickView(quick, teamsAll);
renderTeams(root, teamsAll);

setupAccordion(root);
setupQuickHover(quick, root);
setupSearch(quick, root);

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

function setupSearch(quickRoot, teamsRoot) {
  const input = quickRoot.querySelector('[data-team-search="1"]');
  if (!input) return;

  const apply = () => {
    const q = input.value.trim().toLowerCase();

    // Quick cards
    const quickCards = [...quickRoot.querySelectorAll(".team-quick-card[data-hay]")];
    for (const a of quickCards) {
      const hay = a.getAttribute("data-hay") || "";
      a.hidden = q ? !hay.includes(q) : false;
    }

    // Quick groups: schovat skupinu, když v ní nic nezbylo
    const groups = [...quickRoot.querySelectorAll(".quick-group[data-group]")];
    for (const g of groups) {
      const anyVisible = !!g.querySelector(".team-quick-card:not([hidden])");
      g.hidden = !anyVisible;
    }

    // Detail cards
    const teamCards = [...teamsRoot.querySelectorAll(".team[data-hay]")];
    for (const c of teamCards) {
      const hay = c.getAttribute("data-hay") || "";
      c.hidden = q ? !hay.includes(q) : false;
    }

    // Pokud je otevřený tým teď skrytý, zavři ho + smaž active v quick view
    const open = teamsRoot.querySelector(".team.is-open");
    if (open && open.hidden) {
      closeAll(teamsRoot);
      history.replaceState(null, "", `#`);
      setQuickActive("");
    }
  };

  input.addEventListener("input", apply);

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const first = quickRoot.querySelector(".team-quick-card:not([hidden])");
    if (first) location.hash = first.getAttribute("href");
  });
}

function renderQuickView(container, teams) {
  const groups = groupTeams(teams);

  container.innerHTML =
    `
      <div class="team-search">
        <input
          class="team-search__input"
          type="search"
          placeholder="Hledat tým…"
          autocomplete="off"
          spellcheck="false"
          data-team-search="1"
        />
      </div>
    ` +
    [...groups.entries()]
      .map(
        ([group, arr]) => `
          <div class="quick-group" data-group="${escapeHtml(group)}">
            <h2 class="quick-title">Skupina ${escapeHtml(group)}</h2>

            <div class="quick-grid">
              ${arr
                .map(
                  (t) => `
                    <a
                      class="team-quick-card"
                      href="#${teamId(t)}"
                      data-team="${teamId(t)}"
                      data-hay="${escapeHtml(`${t.name} ${t.seed} ${t.group}`.toLowerCase())}"
                    >
                      <div class="team-quick-name">${escapeHtml(t.name)}</div>
                      <div class="team-quick-meta">
                        <span class="pill">${escapeHtml(t.seed)}</span>
                        <span class="pill muted">Skupina ${escapeHtml(
                          t.group
                        )}</span>
                      </div>
                    </a>
                  `
                )
                .join("")}
            </div>
          </div>
        `
      )
      .join("");
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
      <article class="card team" id="${id}" data-hay="${escapeHtml(`${t.name} ${t.seed} ${t.group}`.toLowerCase())}">
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
          <div class="team-info">
            <div class="team-info__logo">
              ${t.logo
                ? `<img src="${escapeHtml(t.logo)}" alt="${escapeHtml(t.name)} – logo" loading="lazy">`
                : `<div class="team-logo-placeholder" aria-hidden="true"></div>`
              }
            </div>

            <div class="team-info__grid">
              ${infoRow("Klub", t.club)}
              ${infoRow("Město", t.city)}
              ${infoRow("Trenér/ka", t.coach)}
            </div>

            <div class="team-info__links">
              ${linkBtn("Web", t.website)}
              ${linkBtn("Instagram", t.instagram)}
            </div>
            ${t.note ? `<div class="team-info__note">${escapeHtml(t.note)}</div>` : ``}
            ${renderRoster(t.roster)}
          </div>
        </div>

      </article>
    `;
  }).join("");
}

function closeAll(root) {
  root.querySelectorAll(".team").forEach(card => {
    const btn = card.querySelector(".team__head");
    const panel = card.querySelector(".team__panel");
    if (!btn || !panel) return;
    btn.setAttribute("aria-expanded", "false");
    panel.hidden = true;
    card.classList.remove("is-open");
  });
}

function setupAccordion(root) {
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".team__head");
    if (!btn) return;

    const card = btn.closest(".team");
    const panel = card.querySelector(".team__panel");
    const isOpen = btn.getAttribute("aria-expanded") === "true";

    // one-open: nejdřív všechno zavřít
    closeAll(root);

    // klik na už otevřený tým = zůstane zavřeno
    if (isOpen) {
      history.replaceState(null, "", `#`);
      setQuickActive("");
      return;
    }

    // otevři vybraný
    btn.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    card.classList.add("is-open");

    history.replaceState(null, "", `#${card.id}`);
    setQuickActive(card.id); // ✅ fix: ne "id", ale card.id
  });
}

function openByHash(root) {
  let lastHash = "";
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;

  closeAll(root);

  const card = root.querySelector(`#${CSS.escape(id)}`);
  if (!card) return;

  const btn = card.querySelector(".team__head");
  const panel = card.querySelector(".team__panel");

  btn.setAttribute("aria-expanded", "true");
  panel.hidden = false;
  card.classList.add("is-open");

  setQuickActive(id);

  card.scrollIntoView({ behavior: "smooth", block: "start" });

  // flash jen když je to nové
  if (lastHash !== id) {
    card.classList.add("flash");
    setTimeout(() => card.classList.remove("flash"), 900);
    lastHash = id;
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setupQuickHover(quickRoot, teamsRoot) {
  const clear = () => {
    teamsRoot.querySelectorAll(".team.is-hovered")
      .forEach(x => x.classList.remove("is-hovered"));
  };

  quickRoot.addEventListener("mouseover", (e) => {
    const a = e.target.closest("[data-team]");
    if (!a) return;
    clear();
    const id = a.getAttribute("data-team");
    const card = teamsRoot.querySelector(`#${CSS.escape(id)}`);
    if (card) card.classList.add("is-hovered");
  });

  quickRoot.addEventListener("mouseout", (e) => {
    const a = e.target.closest("[data-team]");
    if (!a) return;
    clear();
  });
}

function setQuickActive(id){
  document.querySelectorAll(".team-quick-card.is-active")
    .forEach(x => x.classList.remove("is-active"));

  if (!id) return;

  const a = document.querySelector(`.team-quick-card[data-team="${id.replaceAll('"','\\"')}"]`);
  if (a) a.classList.add("is-active");
}

function linkBtn(text, href){
  if(!href){
    return `<span class="btnlink is-disabled" aria-disabled="true">${escapeHtml(text)}</span>`;
  }
  return `<a class="btnlink" href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`;
}

function prettyUrl(url){
  try{
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  }catch{
    return url;
  }
}

function renderRoster(roster){
  if (!Array.isArray(roster) || roster.length === 0){
    return `
      <div class="roster">
        <div class="roster__head">
          <div class="roster__title">Soupiska</div>
          <div class="roster__count muted">—</div>
        </div>
        <div class="muted">Soupiska bude doplněna.</div>
      </div>
    `;
  }

  const sorted = [...roster].sort((a,b) => {
    const na = (a?.no ?? 9999);
    const nb = (b?.no ?? 9999);
    return na - nb;
  });

  const hasYear = sorted.some(p => p.year);
  const hasPos  = sorted.some(p => p.pos);

  return `
    <div class="roster">
      <div class="roster__head">
        <div class="roster__title">Soupiska</div>
        <div class="roster__count muted">${sorted.length} hráček</div>
      </div>

      <div class="roster__tablewrap">
        <table class="roster__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jméno</th>
              ${hasPos ? `<th>Poz.</th>` : ``}
              ${hasYear ? `<th>Rok</th>` : ``}
            </tr>
          </thead>
          <tbody>
            ${sorted.map(p => `
              <tr>
                <td class="roster__no">${p.no ?? "—"}</td>
                <td class="roster__name">
                  ${escapeHtml(p.name ?? "—")}
                  ${p.captain ? `<span class="roster__cap">C</span>` : ``}
                </td>
                ${hasPos ? `<td>${p.pos ? `<span class="pill">${escapeHtml(p.pos)}</span>` : "—"}</td>` : ``}
                ${hasYear ? `<td>${p.year ?? "—"}</td>` : ``}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function infoRow(label, value){
  return `
    <div class="info-row">
      <div class="info-row__label">${escapeHtml(label)}</div>
      <div class="info-row__value">
        ${value ? escapeHtml(value) : "—"}
      </div>
    </div>
  `;
}
