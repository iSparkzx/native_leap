import { arrow, ink, ion, node, polyline, type Pt, type Rect, text, Track } from "../engrave/core.ts";
import { type Layer, makeLayer, mountPlate } from "../engrave/runtime.ts";
import { cloudScene, gatesScene, networkScene, pathScene, type Scene, torusScene } from "../engrave/scenes.ts";
import { clamp, prefersReducedMotion } from "../lib/util.ts";

/* Fig. 2, the delivery stack as one engraved plate. Items of work leave your systems, pass through the knowledge
   layer, are handled by an agent, cross four review gates and reach your team. Items are drawn in ion while
   they move on their own; every fourth one waits at Review for a person, in ink. Entering a stage lights the
   matching rows of the layer list (see modules/stack.ts). */

const STAGES = ["1. Your systems", "2. Knowledge layer", "3. Agents", "4. Evals and review", "5. Your team"];
const ARROWS = ["connectors", "MCP tools", "scored", "approved"];
const WIDE = 860;
const TITLE = 30;
const SLOT_V = 160;
const GAP_V = 54;
const SPAWN_EVERY = 2.2;
/** Reduced motion draws one still at this time, with items at these ages: one heading to your team, one waiting
 * at Review (item ids 1, 5, 9… wait there), one with the agent and one in the knowledge layer. */
const STILL = 20;
const STILL_AGES = [8.6, 7.5, 4.2, 1.8];

interface Piece {
  track: Track;
  dur: number;
  stage: number | null;
  /** Gate index → distance along this piece's track. */
  marks?: [number, number][];
  hold?: number;
  flash?: number;
}

interface Token {
  born: number;
  pieces: Piece[];
  starts: number[];
  total: number;
  at: number;
  marked: Set<number>;
}

const gapFor = (w: number): number => clamp(w * 0.056, 62, 84);
const slotWidth = (w: number): number => (w - 4 * gapFor(w)) / 5;

export function initStackPlate(): void {
  const figure = document.querySelector<HTMLElement>('[data-plate="stack"]');
  if (!figure) return;

  const cloud = cloudScene({ seed: 7, rotate: false, density: 0.5 });
  const torus = torusScene({ seed: 9, flow: 0.02, nodes: 64 });
  const path = pathScene({ seed: 14, route: [[-1.35, -0.35], [-0.5, 0.35], [0.35, -0.3], [1.3, 0.2]] });
  const gates = gatesScene({ labels: ["Draft", "Review", "Approve", "Apply"] });
  const team = networkScene({ seed: 4, rotate: false });
  const scenes: Scene[] = [cloud, torus, path, gates, team];

  let width = 0;
  let height = 0;
  let wide = true;
  let entries: Pt[] = [];
  let exits: Pt[] = [];
  let layer: Layer | null = null;
  let tokens: Token[] = [];
  let spawned = 0;
  let lastSpawn = -Infinity;

  const journey = (id: number): Piece[] => {
    const pieces: Piece[] = [];
    const link = (k: number): Piece => ({ track: new Track([exits[k], entries[k + 1]]), dur: 0.55, stage: null });
    pieces.push({ track: new Track([cloud.clusterCenter(id), exits[0]]), dur: 0.9, stage: 0 });
    pieces.push(link(0));
    pieces.push({ track: new Track([entries[1], ...torus.track.pts, exits[1]]), dur: 1.7, stage: 1 });
    pieces.push(link(1));
    pieces.push({ track: new Track([entries[2], ...path.track.pts, exits[2]]), dur: 1.9, stage: 2 });
    pieces.push(link(2));

    const full = new Track([entries[3], ...gates.track.pts, exits[3]]);
    const lead = Math.hypot(gates.track.pts[0].x - entries[3].x, gates.track.pts[0].y - entries[3].y);
    const gateAt = gates.gateAt.map((d) => d + lead);
    if (id % 4 === 1) {
      const stop = gateAt[1];
      pieces.push({ track: new Track(full.slice(0, stop)), dur: 0.8, stage: 3, marks: [[0, gateAt[0]]] });
      pieces.push({ track: new Track([full.at(stop), full.at(stop)]), dur: 1.1, stage: null, hold: 1 });
      pieces.push({ track: new Track(full.slice(stop, full.length)), dur: 1.0, stage: null, marks: [[1, 0], [2, gateAt[2] - stop], [3, gateAt[3] - stop]] });
    } else {
      pieces.push({ track: full, dur: 1.7, stage: 3, marks: gateAt.map((d, i) => [i, d] as [number, number]) });
    }
    pieces.push(link(3));
    const target = (id * 7 + 3) % team.count;
    pieces.push({ track: new Track([entries[4], team.nodeAt(target)]), dur: 0.8, stage: 4, flash: target });
    return pieces;
  };

  const spawn = (t: number): void => {
    const pieces = journey(spawned++);
    const starts: number[] = [];
    let sum = 0;
    for (const p of pieces) {
      starts.push(sum);
      sum += p.dur;
    }
    tokens.push({ born: t, pieces, starts, total: sum, at: -1, marked: new Set() });
  };

  /** Advances and draws the items. With live off (the reduced-motion still) nothing spawns, flashes or lights. */
  const step = (ctx: CanvasRenderingContext2D, t: number, live = true): void => {
    if (live && t - lastSpawn >= SPAWN_EVERY) {
      lastSpawn = t;
      spawn(t);
    }
    tokens = tokens.filter((tok) => {
      const e = t - tok.born;
      if (e >= tok.total) {
        const last = tok.pieces[tok.pieces.length - 1];
        if (last.flash !== undefined) team.flash(last.flash, t);
        return false;
      }
      let k = tok.pieces.length - 1;
      while (k > 0 && tok.starts[k] > e) k--;
      const piece = tok.pieces[k];
      if (k !== tok.at) {
        tok.at = k;
        if (live && piece.stage !== null) document.dispatchEvent(new CustomEvent("plate:stage", { detail: piece.stage }));
        if (piece.hold !== undefined) gates.hold(piece.hold, t + piece.dur);
      }
      const s = ((e - tok.starts[k]) / piece.dur) * piece.track.length;
      for (const [gate, at] of live ? piece.marks ?? [] : []) {
        if (s >= at && !tok.marked.has(gate)) {
          tok.marked.add(gate);
          gates.pass(gate, t);
        }
      }
      // In motion the item is in ion; waiting for a person at Review it turns to ink.
      const waiting = piece.hold !== undefined;
      const p = piece.track.at(s);
      polyline(ctx, piece.track.slice(Math.max(0, s - 22), s), 2.4, 1, [], waiting ? ink : ion);
      node(ctx, p.x, p.y, waiting ? 4 : 3.4, waiting ? "target" : "dot", 1, waiting ? ink : ion);
      return true;
    });
  };

  const reduced = prefersReducedMotion();
  mountPlate(figure, {
    heightFor: (w) => (w >= WIDE ? clamp(TITLE + 14 + slotWidth(w) * 0.9, 230, 300) : 5 * (TITLE + SLOT_V) + 4 * GAP_V),
    layout(w, h, dpr) {
      width = w;
      height = h;
      wide = w >= WIDE;
      const slots: Rect[] = [];
      if (wide) {
        const gap = gapFor(w);
        const sw = slotWidth(w);
        for (let k = 0; k < 5; k++) slots.push({ x: k * (sw + gap), y: TITLE + 4, w: sw, h: h - TITLE - 10 });
        entries = slots.map((r) => ({ x: r.x - 2, y: r.y + r.h / 2 }));
        exits = slots.map((r) => ({ x: r.x + r.w + 2, y: r.y + r.h / 2 }));
      } else {
        for (let k = 0; k < 5; k++) slots.push({ x: 0, y: k * (TITLE + SLOT_V + GAP_V) + TITLE, w, h: SLOT_V });
        entries = slots.map((r) => ({ x: r.x + r.w / 2, y: r.y - 2 }));
        exits = slots.map((r) => ({ x: r.x + r.w / 2, y: r.y + r.h + 2 }));
      }
      scenes.forEach((scene, i) => scene.layout(slots[i]));

      layer = makeLayer(w, h, dpr);
      const c = layer.ctx;
      scenes.forEach((scene) => scene.drawStatic(c));
      slots.forEach((r, i) => {
        if (wide) text(c, STAGES[i], r.x + r.w / 2, 17, { weight: 600, size: 14, align: "center", alpha: 1 });
        else text(c, STAGES[i], r.x, r.y - 12, { weight: 600, size: 14, alpha: 1 });
      });
      for (let k = 0; k < 4; k++) {
        const from = exits[k], to = entries[k + 1];
        arrow(c, from, to, { width: 0.9, alpha: 0.9 });
        if (wide) text(c, ARROWS[k], (from.x + to.x) / 2, from.y - 9, { italic: true, size: 12.5, align: "center" });
        else text(c, ARROWS[k], from.x + 12, (from.y + to.y) / 2 + 4, { italic: true, size: 12.5 });
      }
      tokens = [];
      spawned = 0;
      lastSpawn = -Infinity;
      if (reduced) STILL_AGES.forEach((age) => spawn(STILL - age));
    },
    frame(ctx, t) {
      if (!layer) return;
      ctx.drawImage(layer.canvas, 0, 0, width, height);
      scenes.forEach((scene) => scene.draw(ctx, reduced ? STILL : t));
      step(ctx, reduced ? STILL : t, !reduced);
    },
  });
}
