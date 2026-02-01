console.log("rozpis.js loaded");

(async () => {
  const updatedEl = document.getElementById('updated');

  try {
    const url = `../data/rozpis.json?v=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();

    if (updatedEl) {
      updatedEl.textContent = data.updated || new Date().toLocaleString('cs-CZ');
    }

    const pillHtml = (hala) => {
      const n = Number(hala);
      if (n === 1) return '<span class="pill pill--h1">Hala 1</span>';
      if (n === 2) return '<span class="pill pill--h2">Hala 2</span>';
      return `<span class="pill">Hala ${hala ?? '—'}</span>`;
    };

    const fillTable = (tableId, rows, renderRow) => {
      const tbl = document.getElementById(tableId);
      if (!tbl) return;

      const tbody = tbl.querySelector('tbody');
      if (!tbody) return;

      tbody.innerHTML = '';
      (Array.isArray(rows) ? rows : []).forEach((r) => {
        const tr = document.createElement('tr');
        tr.innerHTML = renderRow(r);
        tbody.appendChild(tr);
      });
    };

    // Pátek + Sobota (4 sloupce)
    const renderGroupRow = (r) => `
      <td>${r.cas ?? '—'}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${r.zapas ?? '—'}</td>
      <td>${r.skupina ?? '—'}</td>
    `;

    fillTable('tbl-rozpis-patek', data.patek, renderGroupRow);
    fillTable('tbl-rozpis-sobota', data.sobota, renderGroupRow);

    // Neděle (play-off, 4 sloupce, ale jiné pořadí)
    fillTable('tbl-rozpis-nedele', data.nedele, (r) => `
      <td>${r.cas ?? '—'}</td>
      <td>${pillHtml(r.hala)}</td>
      <td>${r.faze ?? '—'}</td>
      <td>${r.zapas ?? '—'}</td>
    `);

  } catch (err) {
    console.error(err);
    if (updatedEl) updatedEl.textContent = 'chyba načtení dat';
  }
})();
