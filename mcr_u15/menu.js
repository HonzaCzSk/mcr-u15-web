(function(){
  const toggle = document.getElementById("menuToggle");
  const menu = document.getElementById("mobileMenu");
  if(!toggle || !menu) return;

  function openMenu(){
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeMenu(){
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  toggle.addEventListener("click", () => {
    if(menu.classList.contains("is-open")) closeMenu();
    else openMenu();
  });

  menu.addEventListener("click", (e) => {
    if(e.target.matches("[data-close]")) closeMenu();
  });

  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closeMenu();
  });

  // zavřít po kliknutí na link (lepší UX)
  menu.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => closeMenu());
  });
})();
