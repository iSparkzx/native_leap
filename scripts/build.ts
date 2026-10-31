/// <reference lib="deno.ns" />
import { firstIndustryFill } from "../src/ts/industries-markup.ts";

// Builds dist/: index.html + styles.css + main.js + brand assets, plus standalone.html with everything inlined.
// Logo markers in src/index.html (<!-- @logo horizontal class="x" decorative -->) are replaced with the supplied
// brand-kit SVG, unchanged except that its white fill becomes currentColor so CSS can set pure #FFF or #000.

const root = new URL("../", import.meta.url);
const src = new URL("src/", root);
const dist = new URL("dist/", root);
const path = (url: URL): string => decodeURIComponent(url.pathname);

await Deno.mkdir(new URL("assets/brand/", dist), { recursive: true });

const bundle = await new Deno.Command(Deno.execPath(), {
  args: [
    "bundle",
    "--platform", "browser",
    "--format", "iife",
    "--minify",
    path(new URL("ts/main.ts", src)),
    "-o", path(new URL("main.js", dist)),
  ],
  stdout: "inherit",
  stderr: "inherit",
}).spawn().status;
if (!bundle.success) Deno.exit(bundle.code);

const logoFiles: Record<string, string> = {
  horizontal: "native-leap-horizontal-white.svg",
  symbol: "native-leap-symbol-white.svg",
  wordmark: "native-leap-wordmark-white.svg",
};

async function logoSvg(kind: string, className: string, decorative: boolean): Promise<string> {
  const file = logoFiles[kind];
  if (!file) throw new Error(`Unknown logo marker: ${kind}`);
  let svg = await Deno.readTextFile(new URL(`assets/brand/${file}`, src));
  svg = svg
    .replaceAll('fill="#FFFFFF"', 'fill="currentColor"')
    .replace(/ width="[^"]*" height="[^"]*"/, "")
    .replace("<svg ", `<svg class="${className}" `);
  if (decorative) {
    svg = svg
      .replace(' role="img" aria-label="Native Leap"', ' aria-hidden="true" focusable="false"')
      .replace("<title>Native Leap</title>", "");
  }
  return svg;
}

let html = await Deno.readTextFile(new URL("index.html", src));
const markers = [...html.matchAll(/<!-- @logo (\w+) class="([^"]*)"( decorative)? -->/g)];
for (const [marker, kind, className, decorative] of markers) {
  const svg = await logoSvg(kind, className, Boolean(decorative));
  html = html.replace(marker, () => svg);
}

const industry: Record<string, string> = firstIndustryFill();
html = html.replace(/<!-- @industry (\w+) -->/g, (_, key: string) => {
  if (!Object.hasOwn(industry, key)) throw new Error(`Unknown industry marker: ${key}`);
  return industry[key];
});

const css = await Deno.readTextFile(new URL("styles.css", src));
const js = await Deno.readTextFile(new URL("main.js", dist));

await Deno.writeTextFile(new URL("index.html", dist), html);
await Deno.writeTextFile(new URL("styles.css", dist), css);
for await (const entry of Deno.readDir(new URL("assets/brand/", src))) {
  await Deno.copyFile(new URL(`assets/brand/${entry.name}`, src), new URL(`assets/brand/${entry.name}`, dist));
}

if (js.includes("</script")) throw new Error("main.js contains </script and cannot be inlined");

const favicon = await Deno.readTextFile(new URL("assets/brand/favicon.svg", src));
const faviconData = `data:image/svg+xml,${encodeURIComponent(favicon)}`;

// Function replacements so `$` sequences in the minified code are kept literally.
const standalone = html
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${css}</style>`)
  .replace('<script src="main.js" defer></script>', () => `<script>${js}</script>`)
  .replace('href="assets/brand/favicon.svg"', () => `href="${faviconData}"`)
  .replace(/\s*<link rel="(?:alternate icon|apple-touch-icon)"[^>]*>/g, "");
await Deno.writeTextFile(new URL("standalone.html", dist), standalone);

console.log("Built dist/index.html, dist/styles.css, dist/main.js, dist/assets/ and dist/standalone.html");
