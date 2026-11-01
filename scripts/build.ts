/// <reference lib="deno.ns" />
import { firstIndustryFill } from "../src/ts/industries-markup.ts";

// Builds dist/: index.html + styles.css + main.js + brand assets, plus standalone.html with everything inlined.
// Logo markers in src/index.html (<!-- @logo horizontal class="x" decorative -->) are replaced with the supplied
// brand-kit SVG. Its white fill becomes currentColor so CSS can set pure #FFF or #000, CSS sets its size, and it is
// labelled "Native Leap" or hidden when decorative. The paths inside are never changed.

const root = new URL("../", import.meta.url);
const src = new URL("src/", root);
const dist = new URL("dist/", root);
const path = (url: URL): string => decodeURIComponent(url.pathname);

const logoFiles: Record<string, string> = {
  horizontal: "native-leap-horizontal-white.svg",
  symbol: "native-leap-symbol-white.svg",
  wordmark: "native-leap-wordmark-white.svg",
};

export async function logoSvg(kind: string, className: string, decorative: boolean): Promise<string> {
  if (!Object.hasOwn(logoFiles, kind)) throw new Error(`Unknown logo marker: ${kind}`);
  const file = logoFiles[kind];
  const label = decorative ? ' aria-hidden="true" focusable="false"' : ' role="img" aria-label="Native Leap"';
  const svg = (await Deno.readTextFile(new URL(`assets/brand/${file}`, src)))
    .replaceAll('fill="#FFFFFF"', 'fill="currentColor"')
    .replace(/<title>[^<]*<\/title>/, "")
    .replace(/<svg ([^>]*)>/, (_, attrs: string) => {
      const kept = attrs.replace(/ ?(?:width|height|role|aria-label)="[^"]*"/g, "").trim();
      return `<svg class="${className}" ${kept}${label}>`;
    });
  if (/fill="#[0-9a-f]{3,8}"/i.test(svg)) throw new Error(`${file} keeps a hard-coded fill, so CSS cannot set its colour`);
  return svg;
}

export async function fillMarkers(source: string): Promise<string> {
  let html = source;
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
  const leftover = html.match(/<!--\s*@\w+[^>]*-->/);
  if (leftover) throw new Error(`Unrecognised build marker: ${leftover[0]}`);
  return html;
}

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

/** `fonts` maps each `assets/fonts/…` path the CSS names to that file's bytes. */
export function inlineStandalone(html: string, css: string, js: string, fonts: Map<string, Uint8Array>, favicon: string): string {
  if (js.includes("</script")) throw new Error("main.js contains </script and cannot be inlined");
  let standaloneCss = css;
  for (const [fontPath, bytes] of fonts) {
    standaloneCss = standaloneCss.replaceAll(`"${fontPath}"`, () => `"data:font/woff2;base64,${toBase64(bytes)}"`);
  }
  const faviconData = `data:image/svg+xml,${encodeURIComponent(favicon)}`;
  const inlineOnce = (text: string, target: string, replacement: string): string => {
    if (!text.includes(target)) throw new Error(`standalone.html: index.html no longer contains ${target}`);
    // A function replacement keeps `$` sequences in the minified code literal.
    return text.replace(target, () => replacement);
  };
  let standalone = inlineOnce(html, '<link rel="stylesheet" href="styles.css">', `<style>\n${standaloneCss}</style>`);
  standalone = inlineOnce(standalone, '<script src="main.js" defer></script>', `<script>${js}</script>`);
  standalone = inlineOnce(standalone, 'href="assets/brand/favicon.svg"', `href="${faviconData}"`);
  standalone = standalone
    .replace(/\s*<link rel="preload"[^>]*as="font"[^>]*>/g, "")
    .replace(/\s*<link rel="(?:alternate icon|apple-touch-icon)"[^>]*>/g, "");
  const relative = standalone.match(/\s(?:src|href)="(?!#|data:|https?:|mailto:)([^"]+)"/) ??
    standalone.match(/url\(["']?(?!data:|#|https?:)([^"')]+)/);
  if (relative) throw new Error(`standalone.html still links ${relative[1]}; inline it or use an absolute URL`);
  return standalone;
}

const ignoreMissing = (error: unknown): void => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
};

async function build(): Promise<void> {
  // Built aside and swapped in at the end, so stale files go and a failed build leaves the last good dist/.
  const out = new URL("dist.tmp/", root);
  await Deno.remove(out, { recursive: true }).catch(ignoreMissing);
  await Deno.mkdir(out, { recursive: true });

  const bundle = await new Deno.Command(Deno.execPath(), {
    args: [
      "bundle",
      "--platform", "browser",
      "--format", "iife",
      "--minify",
      path(new URL("ts/main.ts", src)),
      "-o", path(new URL("main.js", out)),
    ],
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;
  if (!bundle.success) Deno.exit(bundle.code);

  const html = await fillMarkers(await Deno.readTextFile(new URL("index.html", src)));
  const css = await Deno.readTextFile(new URL("styles.css", src));
  const js = await Deno.readTextFile(new URL("main.js", out));
  const fonts = new Map<string, Uint8Array>();
  for (const fontPath of new Set(css.match(/assets\/fonts\/[\w.-]+\.woff2/g) ?? [])) {
    fonts.set(fontPath, await Deno.readFile(new URL(fontPath, src)));
  }
  const favicon = await Deno.readTextFile(new URL("assets/brand/favicon.svg", src));
  const standalone = inlineStandalone(html, css, js, fonts, favicon);

  await Deno.writeTextFile(new URL("index.html", out), html);
  await Deno.writeTextFile(new URL("styles.css", out), css);
  await Deno.writeTextFile(new URL("standalone.html", out), standalone);
  for (const dir of ["brand", "fonts"]) {
    await Deno.mkdir(new URL(`assets/${dir}/`, out), { recursive: true });
    for await (const entry of Deno.readDir(new URL(`assets/${dir}/`, src))) {
      await Deno.copyFile(new URL(`assets/${dir}/${entry.name}`, src), new URL(`assets/${dir}/${entry.name}`, out));
    }
  }

  await Deno.remove(dist, { recursive: true }).catch(ignoreMissing);
  await Deno.rename(out, dist);
  console.log("Built dist/index.html, dist/styles.css, dist/main.js, dist/assets/ and dist/standalone.html");
}

if (import.meta.main) await build();
