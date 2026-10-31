import { industries, type Industry } from "../content.ts";
import { stepsHtml, tabsHtml, totalMinutes as total } from "../industries-markup.ts";
import { onTick } from "../lib/ticker.ts";
import { clamp, prefersReducedMotion } from "../lib/util.ts";

/* Industries: pick an industry, then flip one of its workflows between how it runs today and how it runs after.
   Steps swap with a short stagger and the time total counts to its new value. */

type Mode = "today" | "after";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
export function initIndustries(): void {
  const tabList = document.querySelector<HTMLElement>(".ind-tabs");
  const title = document.querySelector<HTMLElement>("[data-ind-title]");
  const list = document.querySelector<HTMLOListElement>("[data-ind-steps]");
  const totalEl = document.querySelector<HTMLElement>("[data-ind-total]");
  const unitEl = document.querySelector<HTMLElement>(".ind-total .mono");
  const toggle = document.querySelector<HTMLElement>(".toggle");
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".toggle-btn"));
  const panel = document.querySelector<HTMLElement>("#ind-panel");
  if (!tabList || !title || !list || !totalEl || !toggle || !panel) return;

  const reduced = prefersReducedMotion();
  let current: Industry = industries[0];
  let mode: Mode = "today";
  let shownTotal = total(current.today);
  let stopCount: (() => void) | null = null;

  tabList.innerHTML = tabsHtml();
  const tabs = Array.from(tabList.querySelectorAll<HTMLButtonElement>(".ind-tab"));
  // Without scripts the build shows the first workflow as plain content; the tabs and toggle need this script.
  tabList.hidden = false;
  toggle.hidden = false;
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", tabs[0].id);

  const placeThumb = (): void => {
    const on = buttons.find((b) => b.dataset.mode === mode);
    if (!on) return;
    toggle.style.setProperty("--tx", `${on.offsetLeft}px`);
    toggle.style.setProperty("--tw", `${on.offsetWidth}px`);
  };

  const countTo = (target: number): void => {
    stopCount?.();
    if (reduced) {
      shownTotal = target;
      totalEl.textContent = String(target);
      return;
    }
    const from = shownTotal;
    const start = performance.now();
    stopCount = onTick((_dt, now) => {
      const t = clamp((now - start) / 900, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      shownTotal = Math.round(from + (target - from) * eased);
      totalEl.textContent = String(shownTotal);
      if (t >= 1) {
        stopCount?.();
        stopCount = null;
      }
    });
  };

  let swapId = 0;
  const render = (animate: boolean): void => {
    const steps = current[mode];
    title.textContent = current.workflow;
    if (unitEl) unitEl.textContent = current.unit;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    panel.dataset.mode = mode;
    placeThumb();
    countTo(total(steps));
    document.dispatchEvent(new CustomEvent("industry:change", { detail: { industry: current, mode } }));

    if (!animate || reduced) {
      list.innerHTML = stepsHtml(steps);
      return;
    }
    const id = ++swapId;
    const old = Array.from(list.children) as HTMLElement[];
    const exits = old.map((li, i) =>
      li.animate([{ opacity: 1, translate: "0 0" }, { opacity: 0, translate: "0 -10px" }], {
        duration: 220,
        delay: i * 25,
        easing: "ease-in",
        fill: "forwards",
      }).finished
    );
    Promise.all(exits).catch(() => {}).then(() => {
      if (id !== swapId) return;
      list.innerHTML = stepsHtml(steps);
      Array.from(list.children).forEach((li, i) => {
        li.animate([{ opacity: 0, translate: "0 14px" }, { opacity: 1, translate: "0 0" }], {
          duration: 700,
          delay: i * 70,
          easing: EASE,
          fill: "backwards",
        });
      });
    });
  };

  const selectTab = (index: number, focus: boolean): void => {
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", tabs[index].id);
    if (focus) tabs[index].focus();
    current = industries[index];
    mode = "today";
    render(true);
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(i, false));
    tab.addEventListener("keydown", (event) => {
      const keys: Record<string, number> = {
        ArrowRight: i + 1,
        ArrowDown: i + 1,
        ArrowLeft: i - 1,
        ArrowUp: i - 1,
        Home: 0,
        End: tabs.length - 1,
      };
      if (!(event.key in keys)) return;
      event.preventDefault();
      selectTab((keys[event.key] + tabs.length) % tabs.length, true);
    });
  });

  buttons.forEach((button) =>
    button.addEventListener("click", () => {
      const next = button.dataset.mode as Mode;
      if (next === mode) return;
      mode = next;
      render(true);
    })
  );

  new ResizeObserver(placeThumb).observe(toggle);
  document.fonts?.ready.then(placeThumb);
  render(false);
}
