(() => {
  const DATA_URL = "../../data/media.json";
  const LS_KEY = "mcr_media_json_v1";

  const elFeatured = document.getElementById("featured-links");
  const elDays = document.getElementById("day-links");
  const elClips = document.getElementById("clips");
  const elGrid = document.getElementById("gallery-grid");
  const elStatus = document.getElementById("media-status");
  const elUpdated = document.getElementById("media-updated");

  // Lightbox state
  let lightbox = null;
  let lbImg = null;
  let lbCaption = null;
  let lbItems = [];
  let lbIndex = -1;

  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function setStatus(msg) {
    if (!elStatus) return;
    elStatus.textContent = msg;
  }

  function fmtDate(iso) {
    // iso: YYYY-MM-DD
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    return `${d}. ${m}. ${y}`;
  }

  async function loadData() {
    try {
      const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      localStorage.setItem(LS_KEY, JSON.stringify(json));
      return json;
    } catch (e) {
      // fallback localStorage
      const cached = localStorage.getItem(LS_KEY);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore
        }
      }
      return null;
    }
  }

  function renderFeatured(items = []) {
    if (!elFeatured) return;

    if (!items.length) {
      elFeatured.innerHTML = `<div class="empty">Zatím nejsou přidané žádné oficiální galerie.</div>`;
      return;
    }

    elFeatured.innerHTML = items
      .map((x) => {
        const title = escapeHtml(x.title);
        const url = escapeHtml(x.url);
        const tag = escapeHtml(x.tag || "");
        return `
          <a class="linkcard" href="${url}" target="_blank" rel="noopener noreferrer">
            <div class="linkcard__top">
              <div class="linkcard__title">${title}</div>
              ${tag ? `<span class="pill">${tag}</span>` : ""}
            </div>
            <div class="linkcard__meta">Otevřít externí galerii →</div>
          </a>
        `;
      })
      .join("");
  }

  function renderDays(days = []) {
    if (!elDays) return;

    if (!days.length) {
      elDays.innerHTML = `<div class="empty">Denní výběry se připravují…</div>`;
      return;
    }

    elDays.innerHTML = days
      .map((day) => {
        const label = escapeHtml(day.label);
        const links = Array.isArray(day.links) ? day.links : [];
        const linksHtml = links
          .slice(0, 6)
          .map(
            (l) => `
              <a class="daylink" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
                ${escapeHtml(l.title)}
              </a>
            `
          )
          .join("");

        return `
          <div class="dayblock">
            <div class="dayblock__title">${label}</div>
            <div class="dayblock__links">
              ${linksHtml || `<div class="empty small">Zatím bez odkazů.</div>`}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderClips(clips = []) {
    if (!elClips) return;

    if (!clips.length) {
      elClips.innerHTML = `<div class="empty">Videa přidáme během turnaje.</div>`;
      return;
    }

    elClips.innerHTML = clips
      .map((c) => {
        const title = escapeHtml(c.title);
        const url = escapeHtml(c.url);
        const platform = escapeHtml(c.platform || "Odkaz");
        return `
          <a class="clipitem" href="${url}" target="_blank" rel="noopener noreferrer">
            <div class="clipitem__title">${title}</div>
            <div class="clipitem__meta">
              <span class="pill pill--soft">${platform}</span>
              <span class="clipitem__arrow">Otevřít →</span>
            </div>
          </a>
        `;
      })
      .join("");
  }

  function ensureLightbox() {
    if (lightbox) return;

    lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.setAttribute("aria-hidden", "true");
    lightbox.innerHTML = `
      <div class="lightbox__backdrop" data-lb-close="1"></div>
      <div class="lightbox__wrap" role="dialog" aria-modal="true" aria-label="Náhled fotografie">
        <button class="lightbox__close" type="button" aria-label="Zavřít" data-lb-close="1">✕</button>
        <button class="lightbox__nav lightbox__prev" type="button" aria-label="Předchozí" data-lb-prev="1">‹</button>
        <img class="lightbox__img" alt="" />
        <button class="lightbox__nav lightbox__next" type="button" aria-label="Další" data-lb-next="1">›</button>
        <div class="lightbox__caption"></div>
      </div>
    `;
    document.body.appendChild(lightbox);

    lbImg = lightbox.querySelector(".lightbox__img");
    lbCaption = lightbox.querySelector(".lightbox__caption");

    lightbox.addEventListener("click", (e) => {
      const t = e.target;
      if (t && (t.dataset.lbClose || t.getAttribute("data-lb-close") === "1")) closeLightbox();
    });

    lightbox.querySelector("[data-lb-prev]")?.addEventListener("click", (e) => {
      e.preventDefault();
      stepLightbox(-1);
    });
    lightbox.querySelector("[data-lb-next]")?.addEventListener("click", (e) => {
      e.preventDefault();
      stepLightbox(1);
    });

    window.addEventListener("keydown", (e) => {
      if (!lightbox || lightbox.getAttribute("aria-hidden") === "true") return;

      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") stepLightbox(-1);
      if (e.key === "ArrowRight") stepLightbox(1);
    });
  }

  function openLightbox(index) {
    ensureLightbox();
    if (!lbItems.length) return;

    lbIndex = Math.max(0, Math.min(index, lbItems.length - 1));
    const item = lbItems[lbIndex];

    lbImg.src = item.full || item.src;
    lbImg.alt = item.alt || "";
    lbCaption.textContent = item.alt || "";

    lightbox.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("lb-open");
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("lb-open");
    // uvolni src (ať se nezbytečně drží paměť na mobilu)
    if (lbImg) lbImg.src = "";
  }

  function stepLightbox(dir) {
    if (!lbItems.length) return;
    let next = lbIndex + dir;
    if (next < 0) next = lbItems.length - 1;
    if (next >= lbItems.length) next = 0;
    openLightbox(next);
  }

  function renderGallery(thumbs = []) {
    if (!elGrid) return;

    lbItems = Array.isArray(thumbs) ? thumbs : [];

    if (!lbItems.length) {
      elGrid.innerHTML = `<div class="empty">Zatím nejsou nahrané žádné fotky. Přidáme během turnaje.</div>`;
      return;
    }

    elGrid.innerHTML = lbItems
      .map((t, idx) => {
        const src = escapeHtml(t.src);
        const alt = escapeHtml(t.alt || `Fotka ${idx + 1}`);
        return `
          <button class="thumb" type="button" data-idx="${idx}" aria-label="Otevřít fotku: ${alt}">
            <img src="${src}" alt="${alt}" loading="lazy" />
          </button>
        `;
      })
      .join("");

    elGrid.querySelectorAll(".thumb").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        openLightbox(Number.isFinite(idx) ? idx : 0);
      });
    });
  }

  function renderUpdated(updated) {
    if (!elUpdated) return;
    if (!updated) {
      elUpdated.style.display = "none";
      return;
    }
    elUpdated.style.display = "";
    elUpdated.textContent = `Poslední aktualizace: ${fmtDate(updated)}`;
  }

  async function init() {
    setStatus("Načítám…");

    const data = await loadData();
    if (!data) {
      setStatus("Fotky se připravují…");
      renderFeatured([]);
      renderDays([]);
      renderClips([]);
      renderGallery([]);
      renderUpdated(null);
      return;
    }

    setStatus(""); // pryč s loaderem

    renderUpdated(data.updated);
    renderFeatured(data.featured);
    renderDays(data.days);
    renderClips(data.clips);
    renderGallery(data.thumbs);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
