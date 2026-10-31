import { clamp, mulberry32 } from "../lib/util.ts";
import {
  catmullRom,
  gauss,
  hatchedPlane,
  ink,
  ion,
  nebula,
  node,
  type NodeKind,
  polyline,
  project,
  type Pt,
  type Rect,
  smoothstep,
  stipple,
  surface,
  TAU,
  text,
  Track,
  type V3,
  type View,
} from "./core.ts";

/* Reusable engraved scenes. Each one lays itself out inside a rectangle, paints its unchanging parts once
   (drawStatic, cached by the plate) and its moving parts every frame (draw). All geometry is schematic.
   Ion marks work moving on its own and nebula marks results; anything waiting for a person stays in ink. */

export interface Scene {
  layout(rect: Rect): void;
  drawStatic(ctx: CanvasRenderingContext2D): void;
  draw(ctx: CanvasRenderingContext2D, t: number): void;
}

const randGauss = (rand: () => number): number => {
  const u = Math.max(rand(), 1e-6);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rand());
};

/* ---------- Point survey: stippled clusters in an axis box ---------- */

export interface CloudScene extends Scene {
  clusterCenter(i: number): Pt;
  readonly clusters: number;
}

export function cloudScene(opts: { seed: number; rotate: boolean; highlight?: string; density?: number }): CloudScene {
  const rand = mulberry32(opts.seed);
  const density = opts.density ?? 1;
  const clusters: { c: V3; s: number; n: number }[] = [
    { c: [-0.55, -0.35, 0.8], s: 0.16, n: 360 },
    { c: [0.52, -0.55, 0.35], s: 0.14, n: 230 },
    { c: [0.42, 0.45, 0.82], s: 0.2, n: 540 },
    { c: [-0.5, 0.52, 0.32], s: 0.13, n: 190 },
    { c: [-0.02, -0.08, 0.5], s: 0.11, n: 210 },
  ];
  const points: V3[] = [];
  for (const cl of clusters) {
    for (let i = 0; i < cl.n * 1.5 * density; i++) {
      points.push([
        clamp(cl.c[0] + randGauss(rand) * cl.s, -1, 1),
        clamp(cl.c[1] + randGauss(rand) * cl.s, -1, 1),
        clamp(cl.c[2] + randGauss(rand) * cl.s * 0.9, 0.02, 1.3),
      ]);
    }
  }
  for (let i = 0; i < 240 * density; i++) points.push([rand() * 2 - 1, rand() * 2 - 1, rand() * 1.3]);

  let rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let base: View = { yaw: -0.62, pitch: 0.42, scale: 1, cx: 0, cy: 0, persp: 7 };
  const viewAt = (t: number): View => ({ ...base, yaw: base.yaw + (opts.rotate ? t * 0.16 : 0) });

  const seg = (ctx: CanvasRenderingContext2D, v: View, a: V3, b: V3): void => {
    const p = project(v, a), q = project(v, b);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  };

  const paint = (ctx: CanvasRenderingContext2D, v: View): void => {
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = ink(0.16);
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) {
      const c = -1 + k * 0.25;
      seg(ctx, v, [c, -1, 0], [c, 1, 0]);
      seg(ctx, v, [-1, c, 0], [1, c, 0]);
    }
    ctx.stroke();
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = ink(0.4);
    ctx.beginPath();
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) seg(ctx, v, [x, y, 0], [x, y, 1.3]);
    const ring = (z: number) => {
      seg(ctx, v, [-1, -1, z], [1, -1, z]);
      seg(ctx, v, [1, -1, z], [1, 1, z]);
      seg(ctx, v, [1, 1, z], [-1, 1, z]);
      seg(ctx, v, [-1, 1, z], [-1, -1, z]);
    };
    ring(0);
    ring(1.3);
    ctx.stroke();

    const label = (s: string, p: V3) => {
      const q = project(v, p);
      text(ctx, s, q.x, q.y, { italic: true, size: 13, align: "center", baseline: "middle", alpha: 0.85 });
    };
    label("x", [1.2, -1.08, 0]);
    label("y", [1.1, 1.18, 0]);
    label("z", [-1, -1, 1.46]);

    stipple(ctx, v, points, 1.2, 0.78);

    if (opts.highlight) {
      const c = clusters[2].c;
      const ringPts: Pt[] = [];
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * TAU;
        ringPts.push(project(v, [c[0] + Math.cos(a) * 0.42, c[1] + Math.sin(a) * 0.42, c[2]]));
      }
      polyline(ctx, ringPts, 1.3, 1, [3, 3], nebula);
      const top = ringPts.reduce((m, p) => (p.y < m.y ? p : m), ringPts[0]);
      const lx = rect.x + rect.w - 2;
      const ly = rect.y + 13;
      text(ctx, opts.highlight, lx, ly, { italic: true, size: 13, align: "right" });
      const w = ctx.measureText(opts.highlight).width;
      polyline(ctx, [{ x: lx - w / 2, y: ly + 5 }, top], 0.8, 0.9, [], nebula);
    }
  };

  return {
    clusters: clusters.length,
    layout(r) {
      rect = r;
      const scale = Math.min(r.w / 3.25, r.h / 2.85);
      base = { yaw: -0.62, pitch: 0.42, scale, cx: r.x + r.w / 2, cy: r.y + 1.95 * scale + (r.h - 2.75 * scale) / 2, persp: 7 };
    },
    drawStatic(ctx) {
      if (!opts.rotate) paint(ctx, viewAt(0));
    },
    draw(ctx, t) {
      if (opts.rotate) paint(ctx, viewAt(t));
    },
    clusterCenter(i) {
      return project(viewAt(0), clusters[i % clusters.length].c);
    },
  };
}

/* ---------- Linked corpus: torus mesh with a node network flowing around the loop ---------- */

export interface TorusScene extends Scene {
  readonly track: Track;
}

export function torusScene(opts: { seed: number; flow: number; checkpoint?: string; nodes?: number }): TorusScene {
  const R = 1, r = 0.4;
  const pos = (U: number, V: number): V3 => [(R + r * Math.cos(V)) * Math.cos(U), (R + r * Math.cos(V)) * Math.sin(U), r * Math.sin(V)];
  const nrm = (U: number, V: number): V3 => [Math.cos(V) * Math.cos(U), Math.cos(V) * Math.sin(U), Math.sin(V)];
  const rand = mulberry32(opts.seed);
  const nodes = Array.from({ length: opts.nodes ?? 56 }, () => ({ u: rand(), v: rand(), size: 1.7 + rand() * 1.7 }));
  const edges: [number, number][] = [];
  {
    const p = nodes.map((n) => pos(n.u * TAU, n.v * TAU));
    const seen = new Set<string>();
    p.forEach((a, i) => {
      const near = p
        .map((b, j) => ({ j, d: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) }))
        .filter((e) => e.j !== i && e.d < 0.6)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2);
      for (const { j } of near) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push([i, j]);
        }
      }
    });
  }
  const checkU = -Math.PI / 2 + 0.6;
  let view: View = { yaw: 0, pitch: 0.62, scale: 1, cx: 0, cy: 0, persp: 8 };
  let rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let track = new Track([]);

  return {
    get track() {
      return track;
    },
    layout(r) {
      rect = r;
      const scale = Math.min(r.w / 2.95, r.h / 2.3);
      view = { yaw: 0, pitch: 0.62, scale, cx: r.x + r.w / 2, cy: r.y + r.h / 2 + (opts.checkpoint ? -0.06 : 0.05) * scale, persp: 8 };
      const pts: Pt[] = [];
      for (let i = 0; i <= 40; i++) {
        const U = -Math.PI / 2 - 1.15 + (2.3 * i) / 40;
        const p = pos(U, 0.8), n = nrm(U, 0.8);
        pts.push(project(view, [p[0] + n[0] * 0.02, p[1] + n[1] * 0.02, p[2] + n[2] * 0.02]));
      }
      track = new Track(pts);
    },
    drawStatic(ctx) {
      surface(ctx, view, (u, v) => pos(u * TAU, v * TAU), { nu: 76, nv: 26, line: 0.42, alpha: 0.5, tone: 0.75 });
      if (opts.checkpoint) {
        // A frame slicing the tube: items crossing it are checked. Left unfilled so the mesh reads through it.
        const c = Math.cos(checkU), s = Math.sin(checkU), a = R - r - 0.08, b = R + r + 0.08, h = r + 0.05;
        const at = (k: number, z: number): V3 => [k * c, k * s, z];
        const q = [at(a, -h), at(b, -h), at(b, h), at(a, h)].map((p) => project(view, p));
        ctx.lineWidth = 0.4;
        ctx.strokeStyle = ink(0.35);
        ctx.beginPath();
        for (let i = 1; i < 6; i++) {
          const p = project(view, at(a + ((b - a) * i) / 6, -h)), e = project(view, at(a + ((b - a) * i) / 6, h));
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(e.x, e.y);
        }
        ctx.stroke();
        ctx.lineWidth = 0.85;
        ctx.strokeStyle = ink(0.85);
        ctx.beginPath();
        q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.stroke();
        const top = q.reduce((m, p) => (p.y < m.y ? p : m));
        const lx = rect.x + rect.w - 2, ly = rect.y + 13;
        text(ctx, opts.checkpoint, lx, ly, { italic: true, size: 13, align: "right" });
        const w = ctx.measureText(opts.checkpoint).width;
        polyline(ctx, [{ x: lx - w / 2, y: ly + 5 }, top], 0.7, 0.7);
      }
    },
    draw(ctx, t) {
      const offset = t * opts.flow;
      const screen = nodes.map((n) => {
        const U = (n.u + offset) * TAU, V = n.v * TAU;
        const p = pos(U, V), nn = nrm(U, V);
        const q = project(view, p);
        const qn = project(view, [p[0] + nn[0] * 0.1, p[1] + nn[1] * 0.1, p[2] + nn[2] * 0.1]);
        let since = ((U - checkU) % TAU + TAU) % TAU;
        if (since > Math.PI) since -= TAU;
        return { x: q.x, y: q.y, alpha: smoothstep(0.004, 0.03, q.d - qn.d), checked: Boolean(opts.checkpoint) && since > 0 && since < 1.3 };
      });
      ctx.lineWidth = 0.7;
      for (const [i, j] of edges) {
        const a = screen[i], b = screen[j];
        const alpha = Math.min(a.alpha, b.alpha) * 0.75;
        if (alpha < 0.03) continue;
        ctx.strokeStyle = ink(alpha);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      screen.forEach((s, i) => node(ctx, s.x, s.y, nodes[i].size, s.checked ? "ring" : "dot", s.alpha, s.checked ? nebula : ink));
    },
  };
}

/* ---------- Terrain: a wireframe landscape that paths run across ---------- */

const TX0 = -1.6, TX1 = 1.6, TY0 = -1, TY1 = 1;

export type Height = (x: number, y: number) => number;

export function terrain(seed: number): Height {
  const rand = mulberry32(seed);
  const bumps = Array.from({ length: 7 }, () => ({
    x: rand() * 3.2 - 1.6,
    y: rand() * 1.8 - 0.9,
    s: 0.26 + rand() * 0.3,
    a: (rand() < 0.75 ? 1 : -0.55) * (0.16 + rand() * 0.26),
  }));
  return (x, y) => bumps.reduce((h, b) => h + b.a * gauss(x - b.x, y - b.y, b.s), 0) + 0.035 * Math.sin(2.3 * x + 1.1) * Math.cos(1.9 * y);
}

export function landscapeView(r: Rect): View {
  const scale = Math.min(r.w / 3.8, r.h / 1.75);
  return { yaw: -0.32, pitch: 0.6, scale, cx: r.x + r.w / 2, cy: r.y + r.h / 2 + 0.22 * scale, persp: 8 };
}

export function drawTerrain(ctx: CanvasRenderingContext2D, view: View, h: Height, amp: number, density = 1): void {
  surface(ctx, view, (u, v) => {
    const x = TX0 + (TX1 - TX0) * u, y = TY0 + (TY1 - TY0) * v;
    return [x, y, h(x, y) * amp];
  }, { nu: Math.round(58 * density), nv: Math.round(34 * density), line: 0.42, alpha: 0.5, tone: 0.55 });
}

/** A route across the terrain: the smoothed track in screen space, plus each waypoint's screen position and
 * distance along the track. */
export function routeOn(route: [number, number][], h: Height, amp: number, view: View, steps = 14): { track: Track; nodes: Pt[]; at: number[] } {
  const curve = catmullRom(route.map((p) => [p[0], p[1]]), steps);
  const track = new Track(curve.map(([x, y]) => project(view, [x, y, h(x, y) * amp + 0.02])));
  const nodes = route.map(([x, y]) => project(view, [x, y, h(x, y) * amp + 0.02]));
  const at = route.map((_, i) => track.cum[Math.min(track.cum.length - 1, i * steps)]);
  return { track, nodes, at };
}

export interface PathScene extends Scene {
  readonly track: Track;
}

/** Terrain with one heavy route through waypoints. With `loop`, a token walks the route and marks waypoints. */
export function pathScene(opts: { seed: number; route: [number, number][]; loop?: number; label?: string }): PathScene {
  const h = terrain(opts.seed);
  let view: View = landscapeView({ x: 0, y: 0, w: 1, h: 1 });
  let rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let route = routeOn(opts.route, h, 1, view);

  return {
    get track() {
      return route.track;
    },
    layout(r) {
      rect = r;
      view = landscapeView(r);
      route = routeOn(opts.route, h, 1, view);
    },
    drawStatic(ctx) {
      drawTerrain(ctx, view, h, 1);
      polyline(ctx, route.track.pts, 1.6, 1);
      if (!opts.loop) route.nodes.forEach((p, i) => node(ctx, p.x, p.y, 3.2, i === route.nodes.length - 1 ? "target" : "dot"));
      if (opts.label) {
        const target = route.track.atFraction(0.3);
        const lx = rect.x + 4, ly = rect.y + 14;
        text(ctx, opts.label, lx, ly, { italic: true, size: 13 });
        polyline(ctx, [{ x: lx + 30, y: ly + 5 }, target], 0.7, 0.7);
      }
    },
    draw(ctx, t) {
      if (!opts.loop) return;
      const f = (t % opts.loop) / opts.loop;
      const s = f * route.track.length;
      route.nodes.forEach((p, i) => {
        const last = i === route.nodes.length - 1;
        node(ctx, p.x, p.y, 3.2, last ? "target" : route.at[i] <= s ? "ring" : "dot");
      });
      const p = route.track.at(s);
      polyline(ctx, route.track.slice(Math.max(0, s - 26), s), 2.6, 1, [], ion);
      node(ctx, p.x, p.y, 3.6, "dot", 1, ion);
    },
  };
}

/* ---------- Stacked layers with connections between them ---------- */

export function planesScene(opts: { labels: string[]; seed: number; animate: boolean }): Scene {
  const rand = mulberry32(opts.seed);
  const n = opts.labels.length;
  const gap = 0.36;
  const columns = Array.from({ length: 4 }, () => [rand() * 1.4 - 0.7, rand() * 1.4 - 0.7] as [number, number]);
  const scatter = opts.labels.map(() => Array.from({ length: 6 }, () => [rand() * 1.7 - 0.85, rand() * 1.7 - 0.85] as [number, number]));
  let view: View = { yaw: -0.55, pitch: 0.5, scale: 1, cx: 0, cy: 0, persp: 8 };
  const PERIOD = 7;

  return {
    layout(r) {
      const labelRoom = 78;
      const scale = Math.min((r.w - labelRoom) / 2.95, r.h / (1.32 + (n - 1) * gap * 0.88 + 0.75));
      const top = 0.66 + (n - 1) * gap * 0.88;
      view = { yaw: -0.55, pitch: 0.5, scale, cx: r.x + labelRoom + (r.w - labelRoom) / 2, cy: r.y + r.h / 2 + ((top - 0.66) / 2) * scale, persp: 8 };
    },
    drawStatic(ctx) {
      for (let k = 0; k < n; k++) {
        const z = k * gap;
        const corners: [V3, V3, V3, V3] = [[-1, -1, z], [1, -1, z], [1, 1, z], [-1, 1, z]];
        hatchedPlane(ctx, view, corners, [10, 10], 0.28);
        const left = corners.map((p) => project(view, p)).reduce((m, p) => (p.x < m.x ? p : m));
        text(ctx, opts.labels[k], left.x - 10, left.y + 4, { italic: true, size: 13, align: "right" });
        for (const [x, y] of scatter[k]) {
          const p = project(view, [x, y, z]);
          node(ctx, p.x, p.y, 1.8, "dot", 0.85);
        }
      }
    },
    draw(ctx, t) {
      const phase = opts.animate ? t % PERIOD : PERIOD;
      columns.forEach(([x, y], c) => {
        const lit = phase > 0.6 + c * 1.2;
        const bottom = project(view, [x, y, 0]);
        const top = project(view, [x, y, (n - 1) * gap]);
        polyline(ctx, [bottom, top], lit ? 1.4 : 0.8, lit ? 1 : 0.35, lit ? [] : [3, 3], lit ? ion : ink);
        for (let k = 0; k < n; k++) {
          const p = project(view, [x, y, k * gap]);
          node(ctx, p.x, p.y, 2.8, lit ? "dot" : "ring", lit ? 1 : 0.6);
        }
        if (lit && opts.animate) {
          const f = ((phase - 0.6 - c * 1.2) % 1.6) / 1.6;
          const tok = { x: bottom.x + (top.x - bottom.x) * f, y: bottom.y + (top.y - bottom.y) * f };
          node(ctx, tok.x, tok.y, 2.6, "dot", 1, ion);
        }
      });
    },
  };
}

/* ---------- Gates: stages an item passes through ---------- */

export interface GatesScene extends Scene {
  readonly track: Track;
  /** Distance along the track at which each gate sits. */
  readonly gateAt: number[];
  pass(i: number, t: number): void;
  hold(i: number, until: number): void;
}

export function gatesScene(opts: { labels: string[] }): GatesScene {
  const n = opts.labels.length;
  const xs = opts.labels.map((_, i) => -1.35 + (2.7 * i) / (n - 1));
  let view: View = { yaw: -0.24, pitch: 0.16, scale: 1, cx: 0, cy: 0, persp: 7 };
  let labelSize = 13;
  let track = new Track([]);
  let gateAt: number[] = [];
  const passed = xs.map(() => -Infinity);
  const held = xs.map(() => -Infinity);

  return {
    get track() {
      return track;
    },
    get gateAt() {
      return gateAt;
    },
    pass(i, t) {
      passed[i] = t;
    },
    hold(i, until) {
      held[i] = until;
    },
    layout(r) {
      const scale = Math.min(r.w / 4.0, r.h / 2.2);
      labelSize = clamp(r.w / 16, 11, 13);
      view = { yaw: -0.24, pitch: 0.16, scale, cx: r.x + r.w / 2, cy: r.y + r.h / 2 + 0.08 * scale, persp: 7 };
      track = new Track([project(view, [-1.9, 0, 0]), project(view, [2.0, 0, 0])]);
      gateAt = xs.map((x) => {
        const p = project(view, [x, 0, 0]);
        return Math.hypot(p.x - track.pts[0].x, p.y - track.pts[0].y);
      });
    },
    drawStatic(ctx) {
      const order = xs.map((x, i) => ({ i, d: project(view, [x, 0, 0]).d })).sort((a, b) => b.d - a.d);
      for (const { i } of order) {
        const x = xs[i];
        hatchedPlane(ctx, view, [[x, -0.5, -0.62], [x, 0.5, -0.62], [x, 0.5, 0.62], [x, -0.5, 0.62]], [6, 8], 0.28);
      }
      ctx.font = `400 ${labelSize}px "STIX Two Text", serif`;
      const tops = xs.map((x) => project(view, [x, 0, 0.62]));
      const widths = opts.labels.map((l) => ctx.measureText(l).width);
      const crowded = tops.some((p, i) => i > 0 && p.x - tops[i - 1].x < (widths[i] + widths[i - 1]) / 2 + 6);
      xs.forEach((x, i) => {
        const below = crowded && i % 2 === 1;
        const p = below ? project(view, [x, 0, -0.62]) : tops[i];
        text(ctx, opts.labels[i], p.x, below ? p.y + labelSize + 4 : p.y - 9, { size: labelSize, align: "center" });
      });
      const a = project(view, [-1.9, 0, 0]), b = project(view, [2.0, 0, 0]);
      polyline(ctx, [a, b], 1.05, 0.95);
      ctx.fillStyle = ink(0.95);
      ctx.beginPath();
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.moveTo(b.x + Math.cos(ang) * 2, b.y + Math.sin(ang) * 2);
      ctx.lineTo(b.x - Math.cos(ang - 0.32) * 7, b.y - Math.sin(ang - 0.32) * 7);
      ctx.lineTo(b.x - Math.cos(ang + 0.32) * 7, b.y - Math.sin(ang + 0.32) * 7);
      ctx.closePath();
      ctx.fill();
    },
    draw(ctx, t) {
      xs.forEach((x, i) => {
        const p = project(view, [x, 0, 0]);
        const holding = t < held[i];
        const passing = !holding && t - passed[i] < 0.9;
        const kind: NodeKind = holding ? "ring" : passing || i === n - 1 ? "target" : "dot";
        node(ctx, p.x, p.y, kind === "dot" ? 3.4 : 4.6, kind, 1, passing ? ion : ink);
      });
    },
  };
}

/* ---------- Network of people and systems ---------- */

export interface NetworkScene extends Scene {
  readonly count: number;
  nodeAt(i: number): Pt;
  flash(i: number, t: number): void;
}

export function networkScene(opts: { seed: number; rotate: boolean }): NetworkScene {
  const rand = mulberry32(opts.seed);
  const nodes = Array.from({ length: 22 }, () => {
    const a = rand() * TAU, b = Math.acos(rand() * 2 - 1), rr = Math.cbrt(rand()) * 0.95;
    return { p: [rr * Math.sin(b) * Math.cos(a), rr * Math.sin(b) * Math.sin(a), rr * Math.cos(b) * 0.7] as V3, size: rand() < 0.2 ? 4.6 : 2 + rand() * 1.6 };
  });
  const edges: [number, number][] = [];
  nodes.forEach((a, i) => {
    nodes
      .map((b, j) => ({ j, d: Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]) }))
      .filter((e) => e.j > i)
      .sort((x, y) => x.d - y.d)
      .slice(0, 2)
      .forEach(({ j }) => edges.push([i, j]));
  });
  const flashes = nodes.map(() => -Infinity);
  let base: View = { yaw: 0.3, pitch: 0.35, scale: 1, cx: 0, cy: 0, persp: 6 };
  const viewAt = (t: number): View => ({ ...base, yaw: base.yaw + (opts.rotate ? t * 0.12 : 0) });

  const drawEdges = (ctx: CanvasRenderingContext2D, v: View): void => {
    const s = nodes.map((n) => project(v, n.p));
    ctx.lineWidth = 0.7;
    for (const [i, j] of edges) {
      ctx.strokeStyle = ink(0.35 + 0.35 * smoothstep(1, -1, (s[i].d + s[j].d) / 2));
      ctx.beginPath();
      ctx.moveTo(s[i].x, s[i].y);
      ctx.lineTo(s[j].x, s[j].y);
      ctx.stroke();
    }
  };

  const drawNodes = (ctx: CanvasRenderingContext2D, v: View, t: number): void => {
    const s = nodes.map((n) => project(v, n.p));
    nodes
      .map((_, i) => ({ i, d: s[i].d }))
      .sort((a, b) => b.d - a.d)
      .forEach(({ i }) => {
        const f = (t - flashes[i]) / 0.9;
        const on = f >= 0 && f < 1;
        node(ctx, s[i].x, s[i].y, nodes[i].size, on ? "target" : "dot", 1, on ? nebula : ink);
        if (on) {
          ctx.lineWidth = 0.9;
          ctx.strokeStyle = nebula(1 - f);
          ctx.beginPath();
          ctx.arc(s[i].x, s[i].y, nodes[i].size + 3 + f * 12, 0, TAU);
          ctx.stroke();
        }
      });
  };

  return {
    count: nodes.length,
    layout(r) {
      const scale = Math.min(r.w / 2.4, r.h / 2.2);
      base = { yaw: 0.3, pitch: 0.35, scale, cx: r.x + r.w / 2, cy: r.y + r.h / 2, persp: 6 };
    },
    drawStatic(ctx) {
      if (!opts.rotate) drawEdges(ctx, viewAt(0));
    },
    draw(ctx, t) {
      if (opts.rotate) drawEdges(ctx, viewAt(t));
      drawNodes(ctx, viewAt(t), t);
    },
    nodeAt(i) {
      return project(viewAt(0), nodes[i % nodes.length].p);
    },
    flash(i, t) {
      flashes[i % nodes.length] = t;
    },
  };
}
