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
for (const dir of ["brand", "fonts"]) {
  await Deno.mkdir(new URL(`assets/${dir}/`, dist), { recursive: true });
  for await (const entry of Deno.readDir(new URL(`assets/${dir}/`, src))) {
    await Deno.copyFile(new URL(`assets/${dir}/${entry.name}`, src), new URL(`assets/${dir}/${entry.name}`, dist));
  }
}

if (js.includes("</script")) throw new Error("main.js contains </script and cannot be inlined");

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
let standaloneCss = css;
for (const path of new Set(css.match(/assets\/fonts\/[\w.-]+\.woff2/g) ?? [])) {
  const data = `data:font/woff2;base64,${toBase64(await Deno.readFile(new URL(path, src)))}`;
  standaloneCss = standaloneCss.replaceAll(`"${path}"`, () => `"${data}"`);
}

const favicon = await Deno.readTextFile(new URL("assets/brand/favicon.svg", src));
const faviconData = `data:image/svg+xml,${encodeURIComponent(favicon)}`;

// Function replacements so `$` sequences in the minified code are kept literally.
const standalone = html
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${standaloneCss}</style>`)
  .replace(/\s*<link rel="preload"[^>]*as="font"[^>]*>/g, "")
  .replace('<script src="main.js" defer></script>', () => `<script>${js}</script>`)
  .replace('href="assets/brand/favicon.svg"', () => `href="${faviconData}"`)
  .replace(/\s*<link rel="(?:alternate icon|apple-touch-icon)"[^>]*>/g, "");
if (/(?:url\(|href=)"?assets\/fonts\//.test(standalone)) throw new Error("standalone.html still loads a font file instead of embedding it");
await Deno.writeTextFile(new URL("standalone.html", dist), standalone);

console.log("Built dist/index.html, dist/styles.css, dist/main.js, dist/assets/ and dist/standalone.html");
