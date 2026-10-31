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

type Reschedule = () => void;

/** Runs `fn` on the next frame, then again after each scroll, resize or font load, at most once a frame. */
export function onScrollFrame(fn: () => void): Reschedule {
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
