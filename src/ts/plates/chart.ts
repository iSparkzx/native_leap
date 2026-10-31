import { onTick } from "../lib/ticker.ts";
import { clamp, mulberry32, prefersReducedMotion } from "../lib/util.ts";

/* Fig. 4, an engraved line chart in the Results section: thin smoothed daily lines per rep, one heavy 7-day
   average (ink, then nebula from go-live), a shaded pilot window and a dashed go-live marker. It draws itself left to right the first time it is
   seen, then you can scrub any day with the pointer or the arrow keys. The series are synthetic placeholders that
   match the placeholder stats above; they are labelled as such and must be replaced with real engagement data. */

const DAYS = 56;
const REPS = 6;
const MA = 7;
const PILOT: [number, number] = [14, 27];
const GO_LIVE = 35;
const Y_MAX = 25;
const GREYS = ["#444", "#555", "#666", "#808080", "#949494", "#aaa"];
const NS = "http://www.w3.org/2000/svg";

function syntheticSeries(): number[][] {
  const rand = mulberry32(2026);
  return Array.from({ length: REPS }, (_, r) => {
    const base = 17 + (r - 2.5) * 0.8;
    const inPilot = r < 2;
    return Array.from({ length: DAYS }, (_, d) => {
      let factor = 1;
      if (inPilot && d >= PILOT[0]) factor = 1 - 0.42 * clamp((d - PILOT[0]) / 6, 0, 1);
      if (d >= GO_LIVE) factor = 0.18 + (inPilot ? 0.4 : 0.82) * Math.exp(-(d - GO_LIVE) / 3.2);
      const noise = (rand() - 0.5) * 2.6 * Math.sqrt(factor);
      return Math.max(0.6, base * factor + noise);
    });
  });
}

const fmt = (n: number): string => n.toFixed(1);

/** Catmull-Rom through every point, written as cubic Béziers, so the curve never invents values between days. */
function smoothPath(points: [number, number][]): string {
  let d = `M${fmt(points[0][0])},${fmt(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    d += `C${fmt(p1[0] + (p2[0] - p0[0]) / 6)},${fmt(p1[1] + (p2[1] - p0[1]) / 6)} ${fmt(p2[0] - (p3[0] - p1[0]) / 6)},${fmt(p2[1] - (p3[1] - p1[1]) / 6)} ${fmt(p2[0])},${fmt(p2[1])}`;
  }
  return d;
}

export function initResultsChart(): void {
  const figure = document.querySelector<HTMLElement>('[data-plate="chart"]');
  const host = figure?.querySelector<HTMLElement>("[data-chart]");
  const readout = figure?.querySelector<HTMLElement>("[data-chart-readout]");
  if (!figure || !host || !readout) return;

  const reduced = prefersReducedMotion();
  const series = syntheticSeries();
  const combined = Array.from({ length: DAYS }, (_, d) => series.reduce((s, r) => s + r[d], 0) / REPS);
  const average = combined.map((_, d) => (d < MA - 1 ? null : combined.slice(d - MA + 1, d + 1).reduce((a, b) => a + b, 0) / MA));
  const hint = window.matchMedia("(hover: hover)").matches ? "Hover or use ← → to read a day." : "Drag across the chart to read a day.";

  let revealed = reduced ? 1 : 0;
  let started = reduced;
  let width = 0;
  let geometry = { left: 0, right: 0, top: 0, bottom: 0 };
  let svg: SVGSVGElement | null = null;

  const x = (d: number): number => geometry.left + (d / (DAYS - 1)) * (geometry.right - geometry.left);
  const y = (v: number): number => geometry.top + (1 - v / Y_MAX) * (geometry.bottom - geometry.top);

  const build = (): void => {
    width = Math.round(host.clientWidth);
    if (!width) return;
    const narrow = width < 640;
    const height = Math.round(parseFloat(getComputedStyle(host).minHeight)) || 300;
    geometry = { left: narrow ? 40 : 52, right: width - 14, top: 34, bottom: height - (narrow ? 40 : 44) };
    const { left, right, top, bottom } = geometry;
    const parts: string[] = [];

    for (let v = 0; v <= Y_MAX; v += 5) {
      parts.push(`<line class="c-grid" x1="${left}" x2="${right}" y1="${fmt(y(v))}" y2="${fmt(y(v))}"/>`);
      parts.push(`<text class="c-tick" x="${left - 8}" y="${fmt(y(v) + 4)}" text-anchor="end">${v}</text>`);
    }
    parts.push(`<rect class="c-band" x="${fmt(x(PILOT[0]))}" y="${top}" width="${fmt(x(PILOT[1]) - x(PILOT[0]))}" height="${bottom - top}"/>`);
    parts.push(`<text class="c-note" x="${fmt(x(PILOT[0]) + 6)}" y="${top + 15}">Prove pilot</text>`);
    parts.push(`<line class="c-event" x1="${fmt(x(GO_LIVE))}" x2="${fmt(x(GO_LIVE))}" y1="${top}" y2="${bottom}"/>`);
    parts.push(`<text class="c-note" x="${fmt(x(GO_LIVE) + 6)}" y="${top + 15}">go-live</text>`);

    const lines = series.map((s, r) => `<path class="c-series" stroke="${GREYS[r]}" d="${smoothPath(s.map((v, d) => [x(d), y(v)]))}"/>`);
    const avgPts = average.flatMap((v, d) => (v === null ? [] : [[x(d), y(v)] as [number, number]]));
    // One average curve, drawn twice and clipped at go-live: ink before, nebula after, so the join is seamless.
    const avg = smoothPath(avgPts);
    parts.push(
      `<g clip-path="url(#nl-chart-reveal)">${lines.join("")}` +
        `<path class="c-avg" clip-path="url(#nl-chart-before)" d="${avg}"/>` +
        `<path class="c-avg c-avg--after" clip-path="url(#nl-chart-after)" d="${avg}"/></g>`,
    );

    parts.push(`<line class="c-axis" x1="${left}" x2="${left}" y1="${top}" y2="${bottom}"/>`);
    parts.push(`<line class="c-axis" x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}"/>`);
    for (let w = 0; w < DAYS / 7; w += narrow ? 2 : 1) {
      const d = w * 7;
      parts.push(`<line class="c-axis" x1="${fmt(x(d))}" x2="${fmt(x(d))}" y1="${bottom}" y2="${bottom + 4}"/>`);
      parts.push(`<text class="c-tick" x="${fmt(x(d))}" y="${bottom + 18}" text-anchor="middle">Wk ${w + 1}</text>`);
    }
    parts.push(`<text class="c-label" transform="translate(${narrow ? 12 : 16} ${fmt((top + bottom) / 2)}) rotate(-90)" text-anchor="middle">Minutes per order</text>`);
    const legendX = narrow ? left + 10 : right - 210;
    parts.push(`<line class="c-avg" x1="${legendX}" x2="${legendX + 11}" y1="14" y2="14"/>`);
    parts.push(`<line class="c-avg c-avg--after" x1="${legendX + 11}" x2="${legendX + 22}" y1="14" y2="14"/>`);
    parts.push(`<text class="c-legend" x="${legendX + 30}" y="18">All reps (7-day avg)</text>`);
    parts.push(`<g class="c-cursor" data-cursor visibility="hidden"><line x1="0" x2="0" y1="${top}" y2="${bottom}"/><circle r="3.6" cx="0" cy="0"/></g>`);

    host.innerHTML =
      `<svg xmlns="${NS}" class="chart-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" tabindex="0" ` +
      `role="img" aria-label="Illustrative chart: minutes per order for six reps over eight weeks. Times fall during the Prove pilot for two reps, then for everyone after go-live in week 6, from about 17 minutes to about 3.">` +
      `<defs><clipPath id="nl-chart-reveal"><rect data-reveal x="0" y="0" height="${height}" width="0"/></clipPath>` +
      `<clipPath id="nl-chart-before"><rect x="0" y="0" width="${fmt(x(GO_LIVE))}" height="${height}"/></clipPath>` +
      `<clipPath id="nl-chart-after"><rect x="${fmt(x(GO_LIVE))}" y="0" width="${fmt(width - x(GO_LIVE))}" height="${height}"/></clipPath>` +
      `</defs>${parts.join("")}</svg>`;
    svg = host.querySelector("svg");
    bind();
    applyReveal();
  };

  const cursor = (day: number | null): void => {
    const g = svg?.querySelector<SVGGElement>("[data-cursor]");
    if (!g) return;
    if (day === null) {
      g.setAttribute("visibility", "hidden");
      readout.textContent = revealed >= 1 ? hint : "";
      return;
    }
    const d = clamp(Math.round(day), 0, DAYS - 1);
    const value = average[d] ?? combined[d];
    g.setAttribute("visibility", "visible");
    g.querySelector("line")?.setAttribute("x1", fmt(x(d)));
    g.querySelector("line")?.setAttribute("x2", fmt(x(d)));
    g.querySelector("circle")?.setAttribute("cx", fmt(x(d)));
    g.querySelector("circle")?.setAttribute("cy", fmt(y(value)));
    const values = series.map((s) => s[d]);
    readout.textContent =
      `Week ${Math.floor(d / 7) + 1}, day ${(d % 7) + 1} · all reps ${fmt(value)} min` +
      `${average[d] === null ? " (daily mean)" : " (7-day avg)"} · range ${fmt(Math.min(...values))}–${fmt(Math.max(...values))} min`;
  };

  const applyReveal = (): void => {
    const rect = svg?.querySelector("[data-reveal]");
    rect?.setAttribute("width", fmt(geometry.left + revealed * (geometry.right - geometry.left) + 4));
  };

  let scrub: number | null = null;
  const bind = (): void => {
    if (!svg) return;
    svg.addEventListener("pointermove", (event) => {
      if (revealed < 1) return;
      const box = svg!.getBoundingClientRect();
      const px = ((event.clientX - box.left) / box.width) * width;
      scrub = ((px - geometry.left) / (geometry.right - geometry.left)) * (DAYS - 1);
      cursor(scrub);
    });
    svg.addEventListener("pointerleave", () => {
      scrub = null;
      cursor(null);
    });
    svg.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      scrub = clamp(Math.round(scrub ?? DAYS - 1) + (event.key === "ArrowRight" ? 1 : -1), 0, DAYS - 1);
      cursor(scrub);
    });
    svg.addEventListener("blur", () => {
      scrub = null;
      cursor(null);
    });
  };

  const play = (): void => {
    started = true;
    const start = performance.now();
    const stop = onTick((_dt, now) => {
      const t = clamp((now - start) / 3400, 0, 1);
      revealed = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      applyReveal();
      if (t < 1) cursor(revealed * (DAYS - 1));
      else {
        cursor(null);
        stop();
      }
    });
  };

  new ResizeObserver(() => {
    if (Math.round(host.clientWidth) !== width) build();
  }).observe(host);
  build();
  readout.textContent = reduced ? hint : "";

  if (!reduced) {
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started) {
        io.disconnect();
        play();
      }
    }, { threshold: 0.45 });
    io.observe(figure);
  }
}
