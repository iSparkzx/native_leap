type TickFn = (dt: number, now: number) => void;

const subscribers = new Set<TickFn>();
let last = 0;
let running = false;

function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  for (const fn of subscribers) fn(dt, now);
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
