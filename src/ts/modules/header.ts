import { onScrollFrame } from "../lib/ticker.ts";

/* The header takes the colour of the band beneath it, turns solid once the hero is behind it,
   hides while scrolling down and returns on the way up. It updates on scroll, focus and menu changes only.
   The menu covers the page on small screens. */

export function initHeader(): void {
  const header = document.querySelector<HTMLElement>(".site-header");
  const toggle = document.querySelector<HTMLButtonElement>(".menu-toggle");
  const menu = document.querySelector<HTMLElement>("#menu");
  if (!header) return;

  const bands = Array.from(document.querySelectorAll<HTMLElement>("main > [data-theme], footer[data-theme]"));
  let lastY = window.scrollY;
  let travel = 0;
  let menuOpen = false;

  const update = onScrollFrame(() => {
    const y = window.scrollY;
    const probe = header.offsetHeight / 2;
    let theme = "dark";
    for (const band of bands) {
      const rect = band.getBoundingClientRect();
      if (rect.top <= probe && rect.bottom > probe) {
        theme = band.dataset.theme ?? "dark";
        break;
      }
    }
    if (menuOpen) theme = "dark";
    if (header.dataset.theme !== theme) header.dataset.theme = theme;

    header.classList.toggle("is-solid", y > 24 && !menuOpen);

    const delta = y - lastY;
    lastY = y;
    travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
    const focusInside = header.contains(document.activeElement);
    if (menuOpen || focusInside || y < 400 || travel < -12) header.classList.remove("is-hidden");
    else if (travel > 24) header.classList.add("is-hidden");
  });
  header.addEventListener("focusin", update);

  if (!toggle || !menu) return;

  const setMenu = (open: boolean): void => {
    menuOpen = open;
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Close" : "Menu";
    document.documentElement.style.overflow = open ? "hidden" : "";
    if (open) menu.querySelector<HTMLAnchorElement>("a")?.focus();
    update();
  };

  toggle.addEventListener("click", () => setMenu(!menuOpen));
  menu.addEventListener("click", (event) => {
    if ((event.target as Element).closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuOpen) {
      setMenu(false);
      toggle.focus();
    }
  });
  window.matchMedia("(min-width: 1101px)").addEventListener("change", (event) => {
    if (event.matches && menuOpen) setMenu(false);
  });
}
