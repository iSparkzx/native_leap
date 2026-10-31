import { onTick } from "../lib/ticker.ts";

/* Approach section: the step nearest the reading line is active. The rail fills, the name updates and
   the engraved plate beside the steps (plates/approach.ts) switches to that step's figure. */

export function initLadder(): void {
  const steps = Array.from(document.querySelectorAll<HTMLElement>(".step"));
  const rail = document.querySelector<HTMLElement>(".ladder-rail");
  const name = document.querySelector<HTMLElement>("[data-ladder-name]");
  if (!steps.length) return;

  let active = -1;
  onTick(() => {
    const line = window.innerHeight * 0.55;
    let index = 0;
    steps.forEach((step, i) => {
      if (step.getBoundingClientRect().top < line) index = i;
    });
    if (index === active) return;
    active = index;
    steps.forEach((step, i) => step.classList.toggle("is-active", i === index));
    rail?.style.setProperty("--p", String((index + 1) / steps.length));
    if (name) name.textContent = steps[index].dataset.step ?? "";
    document.dispatchEvent(new CustomEvent("ladder:step", { detail: index }));
  });
}
