console.log("vysledky.js loaded");

(async () => {
  const updatedEl = document.getElementById('updated');

  try {
    // Cache-bust: spolehlivější na GitHub Pages + v různých prohlížečích
    const url = `../data/vysledky.json?v=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();

    // poslední aktualizace
    if (updatedEl) {
      updatedEl.textContent = data.updated || new Date().toLocaleString('cs-CZ');
    }

    // helpers
    const badgeHtml = (stav) => {
      const s = String(stav || '').toUpperCase();
      if (s === 'FIN') return '<span class="badge badge--fin">FIN</span>';
      if (s === 'LIVE') return '<span class="badge badge--live">LIVE</span>';
      return '<span class="badge">SCHEDULED</span>';
    };

    const pillHtml = (hala) => {
      const n = Number(hala);
      if (n === 1) return '<span class="pill pill--h1">Hala 1</span>';
      if (n === 2) return '<span class="pill pill--h2">Hala 2</span>';
      return `<span class="pill">Hala ${hala ?? '—'}</span>`;
    };

    const isLive = (stav) => String(stav || '').toUpperCase() === 'LIVE';

    const fillTable = (tableId, rows, renderRow) => {
      const tbl = document.getElementById(tableId);
      if (!tbl) return;

      const tbody = tbl.querySelector('tbody');
      if (!tbody) return;

      tbody.innerHTML = '';

      (Array.isArray(rows) ? rows : []).forEach((r) => {
        const tr = document.createElement('tr');

        // LIVE řádek: přidá class pro blikání (CSS)
        if (isLive(r.stav)) tr.classList.add('is-live');

        tr.innerHTML = renderRow(r);
        tbody.appendChild(tr);
      });
    };

    // Pátek
    fillTable('tbl-patek', data.patek, (r) => `
      <td>${r.cas ?? '—'}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${r.zapas ?? '—'}</td>
      <td class="score">${r.skore ?? '—'}</td>
      <td>${badgeHtml(r.stav)}</td>
    `);

    // Play-off
    fillTable('tbl-playoff', data.playoff, (r) => `
      <td>${r.cas ?? '—'}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${r.faze ?? '—'}</td>
      <td>${r.zapas ?? '—'}</td>
      <td class="score">${r.skore ?? '—'}</td>
      <td>${badgeHtml(r.stav)}</td>
    `);

    // Auto-refresh: až po úspěšném načtení dat
    setTimeout(() => location.reload(), 60000);

  } catch (err) {
    console.error(err);
    if (updatedEl) updatedEl.textContent = 'chyba načtení dat';

    // i při chybě zkus znovu později
    setTimeout(() => location.reload(), 120000);
  }
})();
