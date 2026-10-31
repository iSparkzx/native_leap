import { onScrollFrame, onTick } from "../lib/ticker.ts";
import { clamp, prefersReducedMotion } from "../lib/util.ts";

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Splits the statement into words that light up, silver-dark to white, as it scrolls through the viewport. */
export function initStatementFill(): void {
  const el = document.querySelector<HTMLElement>("[data-fill]");
  if (!el) return;
  const words = (el.textContent ?? "").trim().split(/\s+/);
  el.textContent = "";
  const spans = words.map((word, i) => {
    const span = document.createElement("span");
    span.className = "w";
    span.textContent = word;
    el.append(span);
    if (i < words.length - 1) el.append(" ");
    return span;
  });

  if (prefersReducedMotion()) {
    spans.forEach((s) => s.classList.add("is-on"));
    return;
  }

  let lit = -1;
  onScrollFrame(() => {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    if (rect.bottom < -200 || rect.top > vh + 200) return;
    const progress = clamp((vh * 0.82 - rect.top) / (rect.height + vh * 0.2), 0, 1);
    const count = Math.round(progress * spans.length);
    if (count === lit) return;
    lit = count;
    spans.forEach((span, i) => span.classList.toggle("is-on", i < count));
  });
}

/** White bands slide in from the right with the mark's top-left corner leading, and leave to the left with its
 * bottom-right corner trailing. The shift stays inside the band's own padding so content is never clipped. */
export function initBandShift(): void {
  if (prefersReducedMotion()) return;
  const bands = Array.from(document.querySelectorAll<HTMLElement>("[data-shift]"));
  const MAX = 12;
  const last = new Map<HTMLElement, string>();

  onScrollFrame(() => {
    const vh = window.innerHeight;
    const rects = bands.map((band) => band.getBoundingClientRect());
    bands.forEach((band, i) => {
      const rect = rects[i];
      if (rect.bottom < 0 || rect.top > vh) return;
      const enter = clamp((vh - rect.top) / (vh * 0.45), 0, 1);
      const leave = clamp((vh * 0.45 - rect.bottom) / (vh * 0.45), 0, 1);
      const shiftL = (1 - easeOutCubic(enter)) * MAX;
      const shiftR = Math.pow(leave, 3) * MAX;
      const key = `${shiftL.toFixed(2)}|${shiftR.toFixed(2)}`;
      if (last.get(band) === key) return;
      last.set(band, key);
      band.style.setProperty("--shift-l", `${shiftL.toFixed(2)}%`);
      band.style.setProperty("--shift-r", `${shiftR.toFixed(2)}%`);
    });
  });
}

/** Fades blocks up once as they enter. Siblings in the same section stagger slightly. */
export function initReveal(): void {
  const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal], [data-footer-mark]"));
  const groups = new Map<Element, number>();
  for (const item of items) {
    const section = item.closest("section, footer") ?? document.body;
    const index = groups.get(section) ?? 0;
    groups.set(section, index + 1);
    item.style.setProperty("--d", `${Math.min(index, 4) * 90}ms`);
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  items.forEach((item) => io.observe(item));
}

/** Counts stats up from zero the first time they are seen. */
export function initCounters(): void {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-count]"));
  const reduced = prefersReducedMotion();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        const el = entry.target as HTMLElement;
        const target = Number(el.dataset.count);
        if (reduced) {
          el.textContent = String(target);
          continue;
        }
        el.textContent = "0";
        const start = performance.now();
        const stop = onTick((_dt, now) => {
          const t = clamp((now - start) / 1600, 0, 1);
          el.textContent = String(Math.round(target * easeOutCubic(t)));
          if (t >= 1) stop();
        });
      }
    },
    { threshold: 0.6 },
  );
  els.forEach((el) => io.observe(el));
}
