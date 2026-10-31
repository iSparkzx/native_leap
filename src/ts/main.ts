import { initField } from "./modules/field.ts";
import { initForm } from "./modules/form.ts";
import { initHeader } from "./modules/header.ts";
import { initIndustries } from "./modules/industries.ts";
import { initIntro } from "./modules/intro.ts";
import { initLadder } from "./modules/ladder.ts";
import { initNotes } from "./modules/notes.ts";
import { initBandShift, initCounters, initReveal, initStatementFill } from "./modules/scrollFx.ts";
import { initStack } from "./modules/stack.ts";
import { initTeam } from "./modules/team.ts";
import { initApproachPlate } from "./plates/approach.ts";
import { initResultsChart } from "./plates/chart.ts";
import { initIndustryPlate } from "./plates/industry.ts";
import { initStackPlate } from "./plates/stack.ts";
import { initThumbs } from "./plates/thumbs.ts";

// Plates listen for events from the sections they illustrate, so they start first. The reveal starts next, so no
// later failure can leave content hidden. Each init is isolated: one that throws must not take the rest down.
const inits = [
  initApproachPlate,
  initStackPlate,
  initIndustryPlate,
  initResultsChart,
  initThumbs,
  initReveal,
  initIndustries,
  initStatementFill,
  initHeader,
  initIntro,
  initField,
  initBandShift,
  initCounters,
  initLadder,
  initStack,
  initTeam,
  initNotes,
  initForm,
];
for (const init of inits) {
  try {
    init();
  } catch (error) {
    console.error(error);
  }
}
// Tells the failsafe in index.html that the scripted states are driven, so it keeps .js.
document.documentElement.classList.add("js-ready");
