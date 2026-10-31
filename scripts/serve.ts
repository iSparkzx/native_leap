/// <reference lib="deno.ns" />
// Tiny static server for dist/ at http://127.0.0.1:5174

const dist = new URL("../dist/", import.meta.url);
const types: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
};

export async function handle(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  const file = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  if (file.includes("..")) return new Response("Not found", { status: 404 });
  try {
    const body = await Deno.readFile(new URL(file, dist));
    const type = types[file.split(".").pop() ?? ""] ?? "application/octet-stream";
    return new Response(body, { headers: { "content-type": type } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

if (import.meta.main) Deno.serve({ hostname: "127.0.0.1", port: 5174 }, handle);
