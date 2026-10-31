# Native Leap — homepage concept

A one-page homepage for Native Leap, built on the Shift brand kit. HTML, CSS and TypeScript with no runtime dependencies.

## Design direction

Researched with Refero: four style searches plus a Vercel/Geist search, about 50 styles in all, with full specs pulled for Ciridae, AI for Business (dayos), mono and Norgram.

- **Primary reference: Ciridae**, an AI transformation firm. Kept: near-black full-bleed canvas, monochrome base, typography as the main texture, ghost pill buttons and badges, no shadows, and abstract light instead of photography.
- **Borrowed from Norgram:** alternating obsidian and white bands.
- **Borrowed from mono:** 1px hairline rows for lists (the four steps, the industry tabs, the workflow steps).
- **Brand rules from the kit:** Obsidian `#08090B`, White, and Silver `#9A9EA6`, with Silver used only on dark. Geist 500 for headings and 400 for body. The logo is always the supplied artwork in pure `#FFFFFF` or `#000000`, never redrawn, stretched, rotated or recoloured.
- **Signature move:** each white band has the Shift mark's two corners at page scale, rounded top-left and bottom-right. Bands slide in from the right and leave to the left as you scroll.

## Accent colours

Three space-tech colours, set at the top of `src/styles.css`. They are an addition to the brand kit, whose palette is "deliberately monochrome." They follow Refero references: Mapbox's single signal blue, and Astro's and Galileo's blue-violet with cyan light. The scripts read the same custom properties, so changing a hex there recolours the figures and the hero too.

| Token | Colour | Its one job | Contrast |
|---|---|---|---|
| `--ion` | `#3b5bff` electric blue | Work moving on its own, and actions | 5.1:1 on white; white text on it 5.1:1 |
| `--nebula` | `#7c4dff` violet | Results | 4.8:1 on white; white text on it 4.8:1; 4.1:1 on Obsidian (large type only) |
| `--plasma` | `#3ec5ff` cyan | Light on dark surfaces | 10.1:1 on Obsidian; too pale for white, so never used there |

They appear mostly in transitions and animations:

- **Hero:** the light sweep is plasma, click ripples are nebula, and the pointer swell and horizon glow are ion. The badge has a plasma beacon.
- **Section labels:** a beacon dot that pings outward (plasma on dark, ion on light).
- **Statement:** each word ignites plasma, passes through nebula and settles to white as you scroll.
- **Buttons:** pill hovers fill with an ion-to-nebula gradient.
- **Links:** text-link hovers draw an accent-to-nebula underline.
- **Approach:** the progress rail is ion to nebula, and the active step number is ion.
- **Delivery stack:** layers glow plasma as items pass.
- **Industries:** the selected tab underline uses the gradient; on phones the tab fills ion. The "With Native Leap" toggle slides over in ion, and its time total turns nebula.
- **Results:** the stats run plasma to nebula.
- **Contact:** the selected form choices are ion.
- **Footer:** links hover plasma, and a scan line rides up the wordmark as it reveals.
- **Focus rings:** use the accent.

**Never coloured:** the logo (the kit forbids recolouring it), headlines, body copy and backgrounds. With reduced motion the looping beacons, the word ignite and the scan line are off.

## Engraved figures

Four key sections carry animated scientific plates in the [engraved-figures](https://github.com/OutThisLife/brooklyn-skills/blob/main/skills/engraved-figures/SKILL.md) style. They use black and grey ink on white paper, fine wireframe meshes with hidden lines removed, stippled points, small flat nodes, heavier lines for the paths that matter, STIX Two Text serif labels and hairline rules. Serif type is used only inside the figures; the site stays in Geist. Two accents work like coloured ink on an old plate. Ion marks work moving on its own, nebula marks results, and anything waiting for a person stays black.

| Figure | Section | What it simulates |
|---|---|---|
| Fig. 1a–d | Approach | One plate that follows the step you are reading, swapped by a vertical wipe. Assess: a rotating point survey with the top-ranked cluster circled in nebula. Prove: an ion marker walks one path across a terrain. Build: ion links join four system layers one by one. Run: nodes circle a torus and turn to nebula rings as they pass a checkpoint |
| Fig. 2 | How it works | Items of work, in ion, flow from your systems through the knowledge layer, an agent and four review gates to your team. Every fourth item turns black and waits at Review for a person, and deliveries flash nebula. The layer list beside it glows plasma as items pass |
| Fig. 3 | Industries | One item's path, one waypoint per step of the selected workflow. The marker waits at each step a person does, one second per three minutes. "With Native Leap" flattens the terrain, straightens the path and turns it ion, leaving the old route dashed |
| Fig. 4 | Results | A line chart: six reps' daily minutes per order, a heavy 7-day average (black, then nebula from go-live), the pilot window and the go-live marker. It draws in once, then you can scrub any day with the pointer, a drag or the arrow keys |

All geometry is labelled schematic. The Fig. 4 series is synthetic placeholder data, labelled as such, to be replaced with real engagement data. Each canvas plate animates only while on screen and has a Pause control. With reduced motion, every figure draws one still frame and the controls are hidden.

## Reading first

After [Supernal](https://getsupernal.ai), the page leads with material to read and watch rather than a sales ask.

- **Calls to action:** the hero offers "See how we work" and "Read the field notes." The header button says "Contact." The only conversion ask is the contact form at the end, labelled "Start a conversation."
- **(01) Field notes**, straight under the hero:
  - guides, explainers, playbooks and a video, filterable by kind
  - each note has engraved cover art, its kind in the accent, a read time, title, one-line summary and a read link
  - a monthly email signup ("No pitch") as the soft conversion
- **(06) Case studies:** the featured distributor story, then three more case-study cards with a headline result each.
- **(07) Watch:** a featured walkthrough and three short videos.

**The imagery is drawn in code until real assets exist:**
- engraved cover art from the figure kit (`src/ts/plates/thumbs.ts`), still until you hover the card, then it plays
- the same plates in negative on dark video posters
- a mock of the order desk as the featured video's poster

**What's placeholder:**
- The articles, case studies and videos are planned titles and are marked as placeholders. Their links point back to their sections, the play marks don't play anything, and the signup sends nothing.
- To publish real content, point each card's link at the article page, swap a poster's contents for a `<video>` or an embed, and give the signup form a real endpoint.

## Our team

Its layout follows the team section of Dala on Refero (style `e5f5f8cf-e68d-4ed1-bbf5-6b67569af648`).

- **Kept from Dala:**
  - members float on the dark canvas in a sideways carousel, with no cards, borders or fills
  - each member is a large portrait, then a small uppercase role in the accent, then the name in large white type, then a LinkedIn icon
  - dot indicators below, with the active dot in the accent
- **Brand instead of Dala:**
  - Geist 500 for names, 400 for body, and Silver for bios
  - the Shift mark's two rounded corners on each portrait frame
  - the site's own accents in place of Dala's violet: Plasma for role labels, the active dot and the hover ring, and an Ion, Nebula or Plasma glow in each placeholder portrait
- **How the carousel works:**
  - It's a native scroll-snap list, so it swipes and scrolls without JavaScript. `src/ts/modules/team.ts` adds the arrows and the dots.
  - Three members fit per view on desktop, two on tablets, and one with a peek of the next on phones, so every stop is clean.
  - There is one dot per stop, not per member.

**To add real people,** edit each `<li class="member">` in `src/index.html`:
- Replace the `.member-photo` placeholder contents with `<img src="…" alt="Name Surname">` and remove `role="img"` and its label. Photos are cropped to 4:5 and shown in black and white, to keep the brand monochrome.
- Fill in the role, name, one-line bio and LinkedIn URL. The links currently point back to the section.

## Run it

Requires [Deno](https://deno.com) 2.4 or newer (for `deno bundle`, which is still experimental).

```sh
deno task build   # type-check src/ts, bundle to dist/
deno task dev     # build, then serve dist/ at http://127.0.0.1:5174
```

You can also open `dist/index.html` straight from disk. `dist/standalone.html` is the same page as one file.

## Where things live

| Path | What it is |
|---|---|
| `src/index.html` | Page structure and copy. `<!-- @logo … -->` markers are replaced with the brand-kit SVGs at build time |
| `src/styles.css` | Tokens at the top, then one block per section |
| `src/ts/content.ts` | Industry workflows (today vs with Native Leap) and their illustrative times |
| `src/ts/modules/field.ts` | Hero background (WebGL): a perspective field of white points rolls toward the viewer under a soft horizon light. The pointer raises a swell and a click sends a ripple. The sweep is plasma, ripples nebula, the swell and horizon ion |
| `src/ts/modules/intro.ts` | Hero entrance |
| `src/ts/modules/scrollFx.ts` | Statement word fill, band shift, reveals, counters |
| `src/ts/modules/ladder.ts` | Tracks the active step (Assess → Prove → Build → Run) and tells Fig. 1 |
| `src/ts/modules/stack.ts` | Delivery stack list: layers light as Fig. 2's items pass; hover or tap for details |
| `src/ts/lib/palette.ts` | Reads the `--ion`, `--nebula` and `--plasma` accents from CSS for canvas and WebGL |
| `src/ts/engrave/core.ts` | Engraved drawing kit: projection, hidden-line meshes, hatched planes, stipple, nodes, arrows, serif labels, `ink`, `ion` and `nebula` tints |
| `src/ts/engrave/scenes.ts` | Reusable scenes: point survey, torus network, terrain and paths, stacked layers, gates, network |
| `src/ts/engrave/runtime.ts` | Plate plumbing: sizing, cached static layers, play only on screen, Pause, reduced motion |
| `src/ts/plates/` | The four figures: `approach.ts`, `stack.ts`, `industry.ts`, `chart.ts` (SVG) |
| `src/ts/modules/industries.ts` | Industry tabs and the Today / With Native Leap toggle |
| `src/ts/modules/team.ts` | Team carousel: dots per scroll stop, previous/next arrows |
| `src/ts/modules/notes.ts` | Field notes filter (All, Guides, Explainers, Playbooks, Videos) |
| `src/ts/plates/thumbs.ts` | Engraved cover art for notes, case studies and video posters; plays on hover |
| `src/ts/modules/form.ts` | Placeholder contact form and field-notes signup |
| `src/ts/modules/header.ts` | Header follows the band colour beneath it, hides on scroll down, mobile menu |
| `src/assets/brand/` | Logo SVGs and favicons copied unchanged from the brand kit |

## Placeholder content

The copy assumes Native Leap is an AI enablement consultancy for distributors, manufacturers, trade contractors and insurance agencies. Everything in the Case studies section is invented: figures, stories and quote. So are the field notes and videos, which are planned titles. The Our team section has placeholder names, portraits, bios and LinkedIn links. The same goes for the workflow times, email and location. Replace all of it before launch. The form sends nothing.

## Motion and accessibility

- Without WebGL the hero falls back to a static CSS horizon glow. `prefers-reduced-motion` draws one still frame of the field and turns off the intro, band shift, word fill, counters and stack pulse. Everything renders in its final state.
- Hero content has a CSS fallback that shows it after 3 seconds if the script fails.
- Industry tabs work with arrow keys, Home and End. Stack layers are focusable.
