/// <reference lib="deno.ns" />
import { handle } from "./serve.ts";

const get = (path: string, host = "127.0.0.1:5174") =>
  handle(new Request(`http://127.0.0.1:5174${path}`, { headers: { host } }));

const assertStatus = async (path: string, expected: number, host?: string) => {
  const response = await get(path, host);
  await response.body?.cancel();
  if (response.status !== expected) throw new Error(`${path} (Host ${host ?? "default"}) returned ${response.status}, expected ${expected}`);
};

// The test runs with unscoped --allow-read, so only the server's own path check can refuse these.
Deno.test("refuses an encoded absolute path outside dist/", () => assertStatus("/%2Fetc%2Fos-release", 404));
Deno.test("refuses a file: URL outside dist/", () => assertStatus("/file:%2F%2F%2Fetc%2Fos-release", 404));
Deno.test("refuses an encoded parent path", () => assertStatus("/..%2fdeno.json", 404));
Deno.test("answers a malformed escape with 400, not a crash", () => assertStatus("/%", 400));
Deno.test("refuses a request for another host, so DNS rebinding cannot read files", () => assertStatus("/index.html", 421, "attacker.example:5174"));
