/// <reference lib="deno.ns" />
import { fillMarkers, inlineStandalone, logoSvg } from "./build.ts";

const page = (body = "") =>
  `<link rel="icon" type="image/svg+xml" href="assets/brand/favicon.svg">\n` +
  `<link rel="stylesheet" href="styles.css">\n${body}\n<script src="main.js" defer></script>`;
const inline = (html: string, css = "body{}") => inlineStandalone(html, css, "void 0", new Map(), "<svg/>");

const rejects = async (run: () => unknown, message: RegExp) => {
  try {
    await run();
  } catch (error) {
    if (message.test(String(error))) return;
    throw new Error(`threw the wrong error: ${error}`);
  }
  throw new Error(`did not throw (expected ${message})`);
};

Deno.test("a mistyped logo marker fails the build instead of dropping the logo", () =>
  rejects(() => fillMarkers('<header><!-- @logo horizontal --></header>'), /marker/i));

Deno.test("a logo marker named like an object method gets a clear error", () =>
  rejects(() => fillMarkers('<!-- @logo constructor class="logo" -->'), /Unknown logo marker: constructor/));

Deno.test("a stylesheet link the inliner cannot find fails the build", () =>
  rejects(() => inline(page().replace('href="styles.css"', 'href="./styles.css"')), /styles\.css/));

Deno.test("a relative image left in standalone.html fails the build", () =>
  rejects(() => inline(page('<img src="assets/team/name.jpg" alt="">')), /assets\/team\/name\.jpg/));

Deno.test("a relative url() left in the inlined CSS fails the build", () =>
  rejects(() => inline(page(), 'body{background:url("assets/texture.png")}'), /assets\/texture\.png/));

Deno.test("the footer wordmark is named Native Leap, not by its file title", async () => {
  const svg = await logoSvg("wordmark", "logo", false);
  if (!svg.includes('role="img" aria-label="Native Leap"') || /<title>/.test(svg)) {
    throw new Error(`wordmark is not labelled "Native Leap": ${svg.slice(0, 200)}`);
  }
});

Deno.test("decorative logos are hidden from assistive technology", async () => {
  for (const kind of ["horizontal", "symbol", "wordmark"]) {
    const svg = await logoSvg(kind, "logo", true);
    if (!svg.includes('aria-hidden="true"') || /role="img"|aria-label=|<title>/.test(svg)) {
      throw new Error(`${kind} is not hidden: ${svg.slice(0, 200)}`);
    }
  }
});
