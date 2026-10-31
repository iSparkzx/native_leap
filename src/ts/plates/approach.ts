import { polyline } from "../engrave/core.ts";
import { easeInOut, type Layer, makeLayer, mountPlate, type PlateHandle } from "../engrave/runtime.ts";
import { cloudScene, pathScene, planesScene, type Scene, torusScene } from "../engrave/scenes.ts";
import { clamp } from "../lib/util.ts";

/* Fig. 1, beside Assess → Prove → Build → Run. One plate whose figure changes with the step being read,
   swapped by a vertical wipe. Each figure is a schematic of what that step does, not a measurement. */

const FIGURES: { num: string; title: string; alt: string; make: () => Scene }[] = [
  {
    num: "Fig. 1a",
    title: "Assess · where the hours go",
    alt: "Schematic: a slowly rotating box of stippled points. Each cluster stands for a group of similar tasks; the circled cluster is ranked first.",
    make: () => cloudScene({ seed: 11, rotate: true, highlight: "ranked first" }),
  },
  {
    num: "Fig. 1b",
    title: "Prove · one workflow, end to end",
    alt: "Schematic: one path crosses a wireframe landscape through five waypoints, and a marker walks it from start to finish.",
    make: () => pathScene({ seed: 21, route: [[-1.35, -0.5], [-0.72, 0.3], [-0.05, -0.32], [0.62, 0.38], [1.3, -0.15]], loop: 5.5, label: "pilot path" }),
  },
  {
    num: "Fig. 1c",
    title: "Build · systems joined on shared layers",
    alt: "Schematic: four stacked layers labelled ERP, Inbox, Documents and Knowledge. Vertical links join them one at a time.",
    make: () => planesScene({ labels: ["ERP", "Inbox", "Documents", "Knowledge"], seed: 5, animate: true }),
  },
  {
    num: "Fig. 1d",
    title: "Run · a monitored loop",
    alt: "Schematic: a wireframe torus with a network of nodes circling it. Nodes passing the evaluation checkpoint are marked as checked.",
    make: () => torusScene({ seed: 3, flow: 0.03, checkpoint: "eval checkpoint", nodes: 90 }),
  },
];

const WIPE = 0.8;

export function initApproachPlate(): void {
  const figure = document.querySelector<HTMLElement>('[data-plate="approach"]');
  if (!figure) return;
  const numEl = figure.querySelector<HTMLElement>("[data-plate-num]");
  const titleEl = figure.querySelector<HTMLElement>("[data-plate-title]");
  const canvas = figure.querySelector<HTMLCanvasElement>("[data-plate-canvas]");
  const scenes = FIGURES.map((f) => f.make());
  const compact = window.matchMedia("(max-width: 900px)");

  let layers: Layer[] = [];
  let width = 0;
  let height = 0;
  let current = 0;
  let previous = 0;
  let wipeFrom = -Infinity;

  const paint = (ctx: CanvasRenderingContext2D, i: number, t: number, x0: number, x1: number): void => {
    if (x1 - x0 < 0.5 || !layers[i]) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, x1 - x0, height);
    ctx.clip();
    ctx.drawImage(layers[i].canvas, 0, 0, width, height);
    scenes[i].draw(ctx, t);
    ctx.restore();
  };

  let handle: PlateHandle | null = null;
  handle = mountPlate(figure, {
    heightFor: (w) => (compact.matches ? clamp(w * 0.5, 170, 230) : Math.round(w * 0.84)),
    layout(w, h, dpr) {
      width = w;
      height = h;
      const rect = { x: 4, y: 6, w: w - 8, h: h - 12 };
      layers = scenes.map((scene) => {
        scene.layout(rect);
        const layer = makeLayer(w, h, dpr);
        scene.drawStatic(layer.ctx);
        return layer;
      });
    },
    frame(ctx, t) {
      const p = clamp((t - wipeFrom) / WIPE, 0, 1);
      if (p >= 1) {
        paint(ctx, current, t, 0, width);
        return;
      }
      const edge = easeInOut(p) * width;
      paint(ctx, previous, t, edge, width);
      paint(ctx, current, t, 0, edge);
      polyline(ctx, [{ x: edge, y: 0 }, { x: edge, y: height }], 0.8, 0.55);
    },
  });

  const describe = (): void => {
    const f = FIGURES[current];
    if (numEl) numEl.textContent = f.num;
    if (titleEl) titleEl.textContent = f.title;
    canvas?.setAttribute("aria-label", f.alt);
  };
  describe();

  document.addEventListener("ladder:step", (event) => {
    const i = (event as CustomEvent<number>).detail;
    if (i === current || !FIGURES[i]) return;
    previous = current;
    current = i;
    wipeFrom = handle?.running() ? handle.time() : -Infinity;
    describe();
    handle?.redraw();
  });
}
