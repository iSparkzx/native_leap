/* Engraved-figure drawing kit (Canvas 2D). Black and grey ink on white paper: fine wireframe meshes with
   hidden lines removed by painting back-to-front, stippled points, small flat nodes, heavier selected paths and
   serif labels. No glossy shading, gradients or shadows; surface tone is limited to a few percent of grey.
   Two accents work like coloured ink on an old plate and mark only what Native Leap changes: `ion` for work
   moving on its own, `nebula` for results. Everything else, including anything waiting for a person, is ink. */

import { type Accent, accentRGB } from "../lib/palette.ts";

export type V3 = readonly [number, number, number];

export interface Pt {
  x: number;
  y: number;
}

export interface P2 extends Pt {
  /** Depth into the screen; larger is farther. */
  d: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface View {
  yaw: number;
  pitch: number;
  scale: number;
  cx: number;
  cy: number;
  /** Camera distance in world units; larger is flatter. */
  persp: number;
}

export const TAU = Math.PI * 2;
export const SERIF = '"STIX Two Text", "Times New Roman", Times, serif';
export const PAPER = "#ffffff";
const INK_RGB = "12,13,15";

/** A drawing colour at a given opacity. */
export type Tint = (alpha: number) => string;

export const ink: Tint = (alpha) => `rgba(${INK_RGB},${alpha})`;

/** An accent from CSS, read on first use once the stylesheet has applied. */
const accent = (name: Accent): Tint => {
  let rgb: string | null = null;
  return (alpha) => `rgba(${(rgb ??= accentRGB(name).join(","))},${alpha})`;
};

/** Work moving on its own. */
export const ion: Tint = accent("ion");
/** Results: what was ranked, checked or delivered. */
export const nebula: Tint = accent("nebula");

/** A colour part-way from ink (0) to ion (1), for morphs between the two. */
export const inkToIon = (w: number): Tint => {
  if (w <= 0) return ink;
  if (w >= 1) return ion;
  const a = INK_RGB.split(",").map(Number), b = accentRGB("ion");
  const rgb = a.map((c, i) => Math.round(c + (b[i] - c) * w)).join(",");
  return (alpha) => `rgba(${rgb},${alpha})`;
};

/** World is x right, y away, z up. Yaw turns about z, pitch tilts the camera down toward the scene. */
export function project(view: View, p: V3): P2 {
  const ca = Math.cos(view.yaw), sa = Math.sin(view.yaw);
  const x1 = p[0] * ca - p[1] * sa;
  const y1 = p[0] * sa + p[1] * ca;
  const cb = Math.cos(view.pitch), sb = Math.sin(view.pitch);
  const up = p[2] * cb + y1 * sb;
  const depth = y1 * cb - p[2] * sb;
  const f = view.persp / (view.persp + depth);
  return { x: view.cx + x1 * view.scale * f, y: view.cy - up * view.scale * f, d: depth };
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const LIGHT = unit([-0.45, -0.55, 0.7]);
/** Paper tones from white to about 8% grey. */
const TONES = Array.from({ length: 17 }, (_, i) => {
  const g = Math.round(255 - i * 1.3);
  return `rgb(${g},${g},${Math.min(255, g + 1)})`;
});

export interface SurfaceStyle {
  nu: number;
  nv: number;
  line?: number;
  alpha?: number;
  /** 0 = pure white faces, 1 = up to ~8% grey on faces turned from the light. */
  tone?: number;
}

/** Wireframe surface from a (u, v) ∈ [0, 1]² parametrisation. Faces are painted back to front in paper colour
 * and stroked, so nearer mesh hides farther mesh like an engraving. */
export function surface(ctx: CanvasRenderingContext2D, view: View, fn: (u: number, v: number) => V3, style: SurfaceStyle): void {
  const { nu, nv } = style;
  const cols = nu + 1;
  const world: V3[] = [];
  const screen: P2[] = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const w = fn(i / nu, j / nv);
      world.push(w);
      screen.push(project(view, w));
    }
  }
  const quads: { i: number; d: number }[] = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const k = j * cols + i;
      quads.push({ i: k, d: screen[k].d + screen[k + 1].d + screen[k + cols].d + screen[k + cols + 1].d });
    }
  }
  quads.sort((a, b) => b.d - a.d);

  ctx.lineWidth = style.line ?? 0.5;
  ctx.strokeStyle = ink(style.alpha ?? 0.55);
  ctx.lineJoin = "round";
  const tone = style.tone ?? 0.5;
  for (const q of quads) {
    const a = screen[q.i], b = screen[q.i + 1], c = screen[q.i + cols + 1], d = screen[q.i + cols];
    const n = unit(cross(sub(world[q.i + 1], world[q.i]), sub(world[q.i + cols], world[q.i])));
    const level = Math.round((1 - Math.abs(dot(n, LIGHT))) * tone * 16);
    ctx.fillStyle = TONES[Math.min(16, Math.max(0, level))];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/** Flat quad (four corners) filled with paper and hatched with a fine grid. */
export function hatchedPlane(ctx: CanvasRenderingContext2D, view: View, corners: [V3, V3, V3, V3], lines: [number, number], alpha = 0.32): void {
  const [a, b, c, d] = corners.map((p) => project(view, p));
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fillStyle = PAPER;
  ctx.fill();
  const lerp3 = (p: V3, q: V3, t: number): V3 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  ctx.lineWidth = 0.45;
  ctx.strokeStyle = ink(alpha);
  ctx.beginPath();
  for (let i = 1; i < lines[0]; i++) {
    const t = i / lines[0];
    const p = project(view, lerp3(corners[0], corners[1], t));
    const q = project(view, lerp3(corners[3], corners[2], t));
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  }
  for (let i = 1; i < lines[1]; i++) {
    const t = i / lines[1];
    const p = project(view, lerp3(corners[0], corners[3], t));
    const q = project(view, lerp3(corners[1], corners[2], t));
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  }
  ctx.stroke();
  ctx.lineWidth = 0.75;
  ctx.strokeStyle = ink(0.75);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.stroke();
}

export function stipple(ctx: CanvasRenderingContext2D, view: View, points: V3[], size = 1.1, alpha = 0.75): void {
  ctx.fillStyle = ink(alpha);
  const h = size / 2;
  for (const p of points) {
    const q = project(view, p);
    ctx.fillRect(q.x - h, q.y - h, size, size);
  }
}

export type NodeKind = "dot" | "ring" | "target";

/** Small flat node with a paper halo so it separates from the mesh beneath it. */
export function node(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, kind: NodeKind = "dot", alpha = 1, tint: Tint = ink): void {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r + 1.4, 0, TAU);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (kind === "dot") {
    ctx.fillStyle = tint(1);
    ctx.fill();
  } else {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = tint(1);
    ctx.stroke();
    if (kind === "target") {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.42, 0, TAU);
      ctx.fillStyle = tint(1);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function polyline(ctx: CanvasRenderingContext2D, pts: Pt[], width: number, alpha: number, dash: number[] = [], tint: Tint = ink): void {
  if (pts.length < 2) return;
  ctx.setLineDash(dash);
  ctx.lineWidth = width;
  ctx.strokeStyle = tint(alpha);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function arrow(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, opts: { dash?: number[]; alpha?: number; width?: number; head?: number } = {}): void {
  const head = opts.head ?? 7;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const end = { x: to.x - Math.cos(angle) * head * 0.8, y: to.y - Math.sin(angle) * head * 0.8 };
  polyline(ctx, [from, end], opts.width ?? 0.9, opts.alpha ?? 0.9, opts.dash ?? []);
  ctx.fillStyle = ink(opts.alpha ?? 0.9);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - Math.cos(angle - 0.32) * head, to.y - Math.sin(angle - 0.32) * head);
  ctx.lineTo(to.x - Math.cos(angle + 0.32) * head, to.y - Math.sin(angle + 0.32) * head);
  ctx.closePath();
  ctx.fill();
}

export function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  opts: { size?: number; italic?: boolean; weight?: number; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; alpha?: number } = {},
): void {
  ctx.font = `${opts.italic ? "italic " : ""}${opts.weight ?? 400} ${opts.size ?? 13}px ${SERIF}`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = opts.baseline ?? "alphabetic";
  ctx.fillStyle = ink(opts.alpha ?? 0.9);
  ctx.fillText(value, x, y);
}

/** Catmull-Rom through points of any dimension. The curve passes through every input point. */
export function catmullRom(points: number[][], steps: number): number[][] {
  if (points.length < 2) return points.slice();
  const out: number[][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push(p1.map((_, k) =>
        0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
      ));
    }
  }
  out.push(points[points.length - 1].slice());
  return out;
}

/** A screen-space polyline that can be walked by distance. */
export class Track {
  readonly pts: Pt[];
  readonly cum: number[];
  readonly length: number;

  constructor(pts: Pt[]) {
    this.pts = pts.length ? pts : [{ x: 0, y: 0 }];
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) {
      this.cum.push(this.cum[i - 1] + Math.hypot(this.pts[i].x - this.pts[i - 1].x, this.pts[i].y - this.pts[i - 1].y));
    }
    this.length = this.cum[this.cum.length - 1];
  }

  at(distance: number): Pt {
    const s = Math.min(Math.max(distance, 0), this.length);
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const span = this.cum[hi] - this.cum[lo] || 1;
    const t = (s - this.cum[lo]) / span;
    const a = this.pts[lo], b = this.pts[hi];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  atFraction(f: number): Pt {
    return this.at(f * this.length);
  }

  /** Points from distance a to b, for drawing part of the track. */
  slice(a: number, b: number): Pt[] {
    const out = [this.at(a)];
    for (let i = 0; i < this.pts.length; i++) if (this.cum[i] > a && this.cum[i] < b) out.push(this.pts[i]);
    out.push(this.at(b));
    return out;
  }
}

export const gauss = (dx: number, dy: number, s: number): number => Math.exp(-(dx * dx + dy * dy) / (2 * s * s));
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
