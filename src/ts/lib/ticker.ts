type TickFn = (dt: number, now: number) => void;

const subscribers = new Set<TickFn>();
let last = 0;
let running = false;

function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  for (const fn of subscribers) {
    try {
      fn(dt, now);
    } catch (error) {
      // Drop only the failing animation; the rest of the page keeps moving.
      subscribers.delete(fn);
      console.error(error);
    }
  }
  if (subscribers.size > 0) requestAnimationFrame(frame);
  else running = false;
}

/** One shared requestAnimationFrame loop. `dt` is in seconds, `now` in ms. Returns an unsubscribe function. */
export function onTick(fn: TickFn): () => void {
  subscribers.add(fn);
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  return () => {
    subscribers.delete(fn);
  };
}

/** Runs `fn` at most once per frame, and only after the page scrolls or resizes or its fonts load, plus once now.
 * Unlike `onTick`, it leaves an idle page idle. Returns a function that schedules `fn` for other state changes. */
export function onScrollFrame(fn: () => void): () => void {
  let queued = false;
  const schedule = (): void => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  document.fonts?.ready.then(schedule);
  schedule();
  return schedule;
}
