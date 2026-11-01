/// <reference lib="deno.ns" />
// Tiny static server for dist/ at http://127.0.0.1:5174

const port = 5174;
const dist = new URL("../dist/", import.meta.url);
// Only the names this server is reached by; any other Host is a DNS-rebinding page.
const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
const types: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  woff2: "font/woff2",
  txt: "text/plain; charset=utf-8",
};

const notFound = () => new Response("Not found", { status: 404 });

export async function handle(request: Request): Promise<Response> {
  if (!hosts.has(request.headers.get("host") ?? "")) return new Response("Misdirected request", { status: 421 });
  const { pathname } = new URL(request.url);
  let file: URL;
  try {
    file = new URL(pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1)), dist);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!file.href.startsWith(dist.href)) return notFound();
  try {
    const body = await Deno.readFile(file);
    const type = types[file.pathname.split(".").pop() ?? ""] ?? "application/octet-stream";
    return new Response(body, { headers: { "content-type": type } });
  } catch {
    return notFound();
  }
}

if (import.meta.main) Deno.serve({ hostname: "127.0.0.1", port }, handle);
