import { PAPER } from "../engrave/core.ts";
import { type Layer, makeLayer } from "../engrave/runtime.ts";
import { cloudScene, gatesScene, networkScene, pathScene, planesScene, type Scene, torusScene } from "../engrave/scenes.ts";
import { onTick } from "../lib/ticker.ts";
import { prefersReducedMotion } from "../lib/util.ts";

/* Engraved cover art for field notes, case studies and video posters, drawn with the same kit as the figures.
   Each <canvas data-thumb="kind"> gets one still plate (optional data-seed, data-labels="A|B|C"). Hovering or
   focusing its card plays the scene; reduced motion keeps it still. data-negative marks plates shown in negative
   on dark video posters (CSS inverts them), so those scenes are drawn in ink only, with no accent to invert. */

const STILL = 2.4;
const ROUTE: [number, number][] = [[-1.35, -0.45], [-0.6, 0.35], [0.1, -0.3], [0.75, 0.4], [1.3, -0.1]];

function sceneFor(kind: string, seed: number, labels: string[], plain: boolean): Scene | null {
  switch (kind) {
    case "path":
      return pathScene({ seed, route: ROUTE, loop: plain ? undefined : 6 });
    case "cloud":
      return cloudScene({ seed, rotate: true, highlight: plain ? undefined : labels[0] ?? "ranked first", density: 0.55 });
    case "torus":
      return torusScene({ seed, flow: 0.03, checkpoint: plain ? undefined : labels[0] ?? "eval", nodes: 64 });
    case "planes":
      return planesScene({ labels: labels.length ? labels : ["ERP", "Email", "Files"], seed, animate: true });
    case "gates":
      return gatesScene({ labels: labels.length ? labels : ["Draft", "Review", "Approve", "Apply"] });
    case "network":
      return networkScene({ seed, rotate: true });
  }
  return null;
}

export function initThumbs(): void {
  const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>("canvas[data-thumb]"));
  if (!canvases.length) return;
  const reduced = prefersReducedMotion();
  const relayouts: (() => void)[] = [];

  const near = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      near.unobserve(entry.target);
      (entry.target as HTMLCanvasElement & { start?: () => void }).start?.();
    }
  }, { rootMargin: "400px 0px" });

  for (const canvas of canvases) {
    const labels = canvas.dataset.labels ? canvas.dataset.labels.split("|") : [];
    const scene = sceneFor(canvas.dataset.thumb ?? "", Number(canvas.dataset.seed ?? 7), labels, canvas.hasAttribute("data-negative"));
    const ctx = canvas.getContext("2d");
    if (!scene || !ctx) continue;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let layer: Layer | null = null;
    let t = STILL;

    const draw = (): void => {
      if (!layer) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(layer.canvas, 0, 0, width, height);
      scene.draw(ctx, t);
    };

    const layout = (): void => {
      width = Math.round(canvas.clientWidth);
      height = Math.round(canvas.clientHeight);
      if (!width || !height) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const pad = Math.max(6, Math.min(width, height) * 0.05);
      scene.layout({ x: pad, y: pad, w: width - pad * 2, h: height - pad * 2 });
      layer = makeLayer(width, height, dpr);
      scene.drawStatic(layer.ctx);
      draw();
    };

    // Drawn the first time it comes near the viewport, then kept in step with its box.
    (canvas as HTMLCanvasElement & { start?: () => void }).start = () => {
      layout();
      relayouts.push(layout);
      let queued = false;
      new ResizeObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          if (Math.round(canvas.clientWidth) !== width || Math.round(canvas.clientHeight) !== height) layout();
        });
      }).observe(canvas);
    };
    near.observe(canvas);

    if (reduced) continue;
    const host = canvas.closest<HTMLElement>("[data-thumb-host]") ?? canvas.parentElement;
    let stop: (() => void) | null = null;
    const play = (): void => {
      stop ??= onTick((dt) => {
        t += dt;
        draw();
      });
    };
    const pause = (): void => {
      stop?.();
      stop = null;
    };
    host?.addEventListener("pointerenter", play);
    host?.addEventListener("pointerleave", pause);
    host?.addEventListener("focusin", play);
    host?.addEventListener("focusout", pause);
  }

  // Labels are set in STIX Two Text; repaint once it has loaded.
  document.fonts?.ready.then(() => relayouts.forEach((fn) => fn()));
}
