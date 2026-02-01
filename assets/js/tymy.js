// tymy.js – accordion pro soupisky + otevření po kliknutí z "Skupina A/B"

(() => {
  const toggles = Array.from(document.querySelectorAll('.team__toggle'));

  const setOpen = (btn, open) => {
    const card = btn.closest('.team');
    const body = card?.querySelector('.team__body');
    if (!body) return;

    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    body.hidden = !open;
  };

  // toggle click
  toggles.forEach(btn => {
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      setOpen(btn, !isOpen);
    });
  });

  // klik z rychlého seznamu -> otevře kartu a scrollne
  document.querySelectorAll('.js-open-team').forEach(link => {
    link.addEventListener('click', (e) => {
      const hash = link.getAttribute('href');
      if (!hash || !hash.startsWith('#')) return;

      const target = document.querySelector(hash);
      if (!target) return;

      e.preventDefault();

      const btn = target.querySelector('.team__toggle');
      if (btn) setOpen(btn, true);

      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // upraví URL hash bez skoku
      history.replaceState(null, '', hash);
    });
  });

  // pokud přijdeš na URL s hashem, otevři příslušný tým
  if (location.hash) {
    const target = document.querySelector(location.hash);
    const btn = target?.querySelector('.team__toggle');
    if (btn) setOpen(btn, true);
  }
})();
