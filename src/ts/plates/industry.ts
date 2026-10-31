import type { Industry } from "../content.ts";
import { catmullRom, ink, inkToIon, ion, node, type NodeKind, PAPER, polyline, project, TAU, text, Track, type View } from "../engrave/core.ts";
import { easeInOut, type Layer, makeLayer, mountPlate, type PlateHandle } from "../engrave/runtime.ts";
import { drawTerrain, landscapeView, terrain } from "../engrave/scenes.ts";
import { clamp, hashString, lerp, mulberry32, prefersReducedMotion } from "../lib/util.ts";

/* Fig. 3, beside the industry workflow. One item's path across a terrain, one waypoint per step. A marker walks the
   path and waits at each step a person does, one second for every three minutes; steps that run on their own
   barely hold it. Switching to "With Native Leap" flattens the terrain, straightens the path and turns it from ink
   to ion; the old route stays as a dashed ghost. Terrain and route shape are schematic; only the step list and
   minutes are from content. */

type Mode = "today" | "after";

interface Geometry {
  /** The route with Native Leap, drawn in ion. */
  after: boolean;
  amp: number;
  /** 64 evenly spaced (x, y) points along the route. */
  curve: [number, number][];
  /** Each waypoint's position along `curve`, as a fractional index. */
  stops: number[];
  kinds: NodeKind[];
  minutes: (number | null)[];
}

const SAMPLES = 64;
const SECONDS_PER_MINUTE = 1 / 3;
const TRAVEL = 0.45;
const MORPH = 1.0;

function resample(points: number[][], count: number): { pts: [number, number][]; cum: number[] } {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = cum[cum.length - 1] || 1;
  const pts: [number, number][] = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const target = (total * k) / (count - 1);
    while (j < cum.length - 2 && cum[j + 1] < target) j++;
    const t = clamp((target - cum[j]) / (cum[j + 1] - cum[j] || 1), 0, 1);
    pts.push([lerp(points[j][0], points[j + 1][0], t), lerp(points[j][1], points[j + 1][1], t)]);
  }
  return { pts, cum: cum.map((c) => c / total) };
}

function geometry(industry: Industry, mode: Mode): Geometry {
  const steps = industry[mode];
  const rand = mulberry32(hashString(industry.id));
  const n = steps.length;
  const route = steps.map((_, i) => {
    const x = -1.35 + (2.7 * i) / Math.max(1, n - 1);
    const y = mode === "today" ? (i % 2 ? 0.5 : -0.44) * (0.7 + rand() * 0.5) : 0.1 * Math.sin(i * 1.9);
    return [x, y];
  });
  const STEPS = 16;
  const { pts, cum } = resample(catmullRom(route, STEPS), SAMPLES);
  return {
    after: mode === "after",
    amp: mode === "today" ? 1 : 0.26,
    curve: pts,
    stops: route.map((_, i) => cum[Math.min(cum.length - 1, i * STEPS)] * (SAMPLES - 1)),
    kinds: steps.map((s) => (s.minutes === null ? "ring" : "dot")),
    minutes: steps.map((s) => s.minutes),
  };
}

export function initIndustryPlate(): void {
  const figure = document.querySelector<HTMLElement>('[data-plate="industry"]');
  if (!figure) return;
  const h = terrain(33);

  let width = 0;
  let height = 0;
  let dpr = 1;
  let view: View = landscapeView({ x: 0, y: 0, w: 1, h: 1 });
  let layer: Layer | null = null;
  let from: Geometry | null = null;
  let to: Geometry | null = null;
  let ghost: Geometry | null = null;
  let morphFrom = -Infinity;
  let cycleFrom = 0;
  let renderedProgress = -1;

  const curveAt = (curve: [number, number][], index: number): [number, number] => {
    const i = clamp(Math.floor(index), 0, curve.length - 2);
    const t = index - i;
    return [lerp(curve[i][0], curve[i + 1][0], t), lerp(curve[i][1], curve[i + 1][1], t)];
  };

  const blend = (p: number): { amp: number; curve: [number, number][] } => {
    if (!from || !to || p >= 1) return { amp: to!.amp, curve: to!.curve };
    return {
      amp: lerp(from.amp, to.amp, p),
      curve: to.curve.map((pt, i) => [lerp(from!.curve[i][0], pt[0], p), lerp(from!.curve[i][1], pt[1], p)] as [number, number]),
    };
  };

  const trackFor = (curve: [number, number][], amp: number): Track =>
    new Track(curve.map(([x, y]) => project(view, [x, y, h(x, y) * amp + 0.02])));

  /** Paints terrain, ghost route, current route and numbered waypoints into the cached layer. */
  const render = (p: number): void => {
    if (!to || !width) return;
    layer ??= makeLayer(width, height, dpr);
    const c = layer.ctx;
    c.fillStyle = PAPER;
    c.fillRect(0, 0, width, height);
    const { amp, curve } = blend(p);
    drawTerrain(c, view, h, amp, 0.9);
    if (ghost && p >= 1) polyline(c, trackFor(ghost.curve, amp).pts, 1, 0.6, [4, 3]);
    const track = trackFor(curve, amp);
    const warmth = from && p < 1 ? lerp(Number(from.after), Number(to.after), p) : Number(to.after);
    polyline(c, track.pts, warmth > 0 ? 1.9 : 1.6, 1, [], inkToIon(warmth));
    const drawStops = (g: Geometry, alpha: number) => {
      g.stops.forEach((index, i) => {
        const [x, y] = curveAt(curve, index);
        const q = project(view, [x, y, h(x, y) * amp + 0.02]);
        node(c, q.x, q.y, 3.4, g.kinds[i], alpha);
        if (alpha > 0.5) text(c, String(i + 1), q.x, q.y - 10, { italic: true, size: 12, align: "center", alpha: 0.85 * alpha });
      });
    };
    if (from && p < 1) drawStops(from, 1 - p);
    drawStops(to, p >= 1 ? 1 : p);
    renderedProgress = p;
  };

  /** Where the marker is at time t in the current cycle, and how far through a wait it is. */
  const marker = (t: number): { s: number; stop: number; wait: number } | null => {
    if (!to) return null;
    const legs: { kind: "wait" | "move"; dur: number; stop: number }[] = [];
    to.stops.forEach((_, i) => {
      const m = to!.minutes[i];
      legs.push({ kind: "wait", dur: m === null ? 0.12 : m * SECONDS_PER_MINUTE, stop: i });
      if (i < to!.stops.length - 1) legs.push({ kind: "move", dur: TRAVEL, stop: i });
    });
    const total = legs.reduce((sum, l) => sum + l.dur, 0) + 0.9;
    let e = (t - cycleFrom) % total;
    for (const leg of legs) {
      if (e < leg.dur) {
        if (leg.kind === "wait") return { s: to.stops[leg.stop], stop: leg.stop, wait: e / leg.dur };
        return { s: lerp(to.stops[leg.stop], to.stops[leg.stop + 1], easeInOut(e / leg.dur)), stop: -1, wait: 0 };
      }
      e -= leg.dur;
    }
    return { s: to.stops[to.stops.length - 1], stop: -1, wait: 0 };
  };

  const reduced = prefersReducedMotion();
  // Assigned after mounting; the first frame is drawn during mountPlate, before this exists.
  let handle: PlateHandle | null = null;
  handle = mountPlate(figure, {
    heightFor: (w) => clamp(w * 0.62, 210, 290),
    layout(w, hgt, d) {
      width = w;
      height = hgt;
      dpr = d;
      layer = null;
      view = landscapeView({ x: 4, y: 8, w: w - 8, h: hgt - 14 });
      render(1);
    },
    frame(ctx, t) {
      const p = clamp((t - morphFrom) / MORPH, 0, 1);
      if (p !== renderedProgress && (p < 1 || renderedProgress < 1)) render(easeInOut(p));
      if (layer) ctx.drawImage(layer.canvas, 0, 0, width, height);
      if (p < 1 || !to || reduced) return;
      const m = marker(t);
      if (!m) return;
      const [x, y] = curveAt(to.curve, m.s);
      const q = project(view, [x, y, h(x, y) * to.amp + 0.02]);
      if (m.stop >= 0 && to.minutes[m.stop] !== null) {
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = ink(0.9);
        ctx.beginPath();
        ctx.arc(q.x, q.y, 9, -Math.PI / 2, -Math.PI / 2 + m.wait * TAU);
        ctx.stroke();
      }
      node(ctx, q.x, q.y, 3.8, "dot", 1, to.after ? ion : ink);
    },
  });

  document.addEventListener("industry:change", (event) => {
    const { industry, mode } = (event as CustomEvent<{ industry: Industry; mode: Mode }>).detail;
    const next = geometry(industry, mode);
    ghost = mode === "after" ? geometry(industry, "today") : null;
    const animate = Boolean(to) && Boolean(handle?.running());
    from = to ?? next;
    to = next;
    const t = handle?.time() ?? 0;
    morphFrom = animate ? t : -Infinity;
    cycleFrom = t + (animate ? MORPH : 0);
    renderedProgress = -1;
    if (!animate) render(1);
    handle?.redraw();
  });
}
