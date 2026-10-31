import { onTick } from "../lib/ticker.ts";
import { prefersReducedMotion } from "../lib/util.ts";
import { PAPER } from "./core.ts";

/* Shared plumbing for an engraved plate: sizes the canvas to its column, caches static layers, animates only
   while the plate is on screen and not paused, and draws one still frame under reduced motion. */

export interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export function makeLayer(width: number, height: number, dpr: number): Layer {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

export interface PlateApp {
  layout(width: number, height: number, dpr: number): void;
  frame(ctx: CanvasRenderingContext2D, t: number): void;
}

export interface PlateHandle {
  readonly reduced: boolean;
  /** True while the animation loop is advancing. */
  running(): boolean;
  time(): number;
  redraw(): void;
  relayout(): void;
}

export function mountPlate(figure: HTMLElement, app: PlateApp): PlateHandle | null {
  const canvas = figure.querySelector<HTMLCanvasElement>("[data-plate-canvas]");
  const toggle = figure.querySelector<HTMLButtonElement>("[data-plate-toggle]");
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return null;

  const reduced = prefersReducedMotion();
  let width = 0;
  let height = 0;
  let dpr = 1;
  let t = 0;
  let visible = false;
  let paused = false;
  let stop: (() => void) | null = null;

  const draw = (): void => {
    if (!width) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);
    app.frame(ctx, t);
  };

  const relayout = (force = false): void => {
    const w = Math.round(canvas.clientWidth);
    const h = Math.round(canvas.clientHeight);
    const nextDpr = Math.min(2, window.devicePixelRatio || 1);
    if (!w || !h || (!force && w === width && h === height && nextDpr === dpr)) return;
    width = w;
    height = h;
    dpr = nextDpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    app.layout(width, height, dpr);
    draw();
  };

  const sync = (): void => {
    const shouldRun = visible && !paused && !reduced;
    if (shouldRun && !stop) {
      stop = onTick((dt) => {
        t += dt;
        draw();
      });
    } else if (!shouldRun && stop) {
      stop();
      stop = null;
    }
    figure.toggleAttribute("data-playing", Boolean(stop));
  };

  if (toggle) {
    toggle.hidden = reduced;
    toggle.addEventListener("click", () => {
      paused = !paused;
      toggle.textContent = paused ? "Play" : "Pause";
      toggle.setAttribute("aria-pressed", String(paused));
      sync();
    });
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }, { rootMargin: "80px 0px" }).observe(figure);

  let queued = false;
  new ResizeObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      relayout();
    });
  }).observe(canvas);

  // Canvas labels are set in STIX Two Text; repaint the cached layers once it has loaded.
  const fonts = document.fonts;
  if (fonts) {
    Promise.all([fonts.load('400 13px "STIX Two Text"'), fonts.load('italic 400 13px "STIX Two Text"'), fonts.load('600 14px "STIX Two Text"')])
      .catch(() => {})
      .then(() => relayout(true));
  }
  relayout(true);

  return {
    reduced,
    running: () => Boolean(stop),
    time: () => t,
    redraw: draw,
    relayout: () => relayout(true),
  };
}

export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
