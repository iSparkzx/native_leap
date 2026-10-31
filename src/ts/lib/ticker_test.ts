/// <reference lib="deno.ns" />
const queued: FrameRequestCallback[] = [];
globalThis.requestAnimationFrame = (callback) => queued.push(callback);
const { onTick } = await import("./ticker.ts");

const runFrame = (now: number) => {
  const callback = queued.shift();
  if (!callback) throw new Error(`no frame queued at ${now}ms, so the loop has stopped`);
  callback(now);
};

Deno.test("a subscriber that throws does not stop the others", () => {
  const logged: unknown[] = [];
  const consoleError = console.error;
  console.error = (...args: unknown[]) => logged.push(args);
  try {
    let calls = 0;
    const stopHealthy = onTick(() => {
      calls++;
    });
    onTick(() => {
      throw new Error("bad frame");
    });
    for (const now of [16, 32, 48]) runFrame(now);
    stopHealthy();
    runFrame(64);
    if (calls !== 3) throw new Error(`healthy subscriber ran ${calls} times, expected 3`);
    if (logged.length !== 1) throw new Error(`expected the error logged once, got ${logged.length}`);
    if (queued.length !== 0) throw new Error("the loop kept running with no subscribers");
  } finally {
    console.error = consoleError;
  }
});
