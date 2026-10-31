import { prefersReducedMotion } from "../lib/util.ts";

/* Hero entrance: the symbol and badge rise in, headline lines slide up out of their masks,
   then the supporting copy follows. Waits for Geist so lines don't reflow mid-animation. */

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export function initIntro(): void {
  if (prefersReducedMotion()) return;

  const run = (): void => {
    const rise = (el: Element | null, delay: number, distance = 18): void => {
      el?.animate(
        [
          { opacity: 0, translate: `0 ${distance}px` },
          { opacity: 1, translate: "0 0" },
        ],
        { duration: 1000, delay, easing: EASE, fill: "both" },
      );
    };

    rise(document.querySelector(".hero-mark"), 80, 28);
    rise(document.querySelector(".hero .badge"), 260);
    document.querySelectorAll(".hero-title .line-inner").forEach((line, i) => {
      line.animate([{ translate: "0 110%" }, { translate: "0 0" }], {
        duration: 1200,
        delay: 340 + i * 120,
        easing: EASE,
        fill: "both",
      });
    });
    rise(document.querySelector(".hero-lede"), 720);
    rise(document.querySelector(".hero-actions"), 840);
    rise(document.querySelector(".hero-foot"), 1100, 0);
  };

  let started = false;
  const go = (): void => {
    if (started) return;
    started = true;
    run();
  };
  document.fonts?.ready.then(go);
  setTimeout(go, 900);
}
