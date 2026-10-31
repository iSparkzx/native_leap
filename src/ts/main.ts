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

// Plates listen for events from the sections they illustrate, so they start first. A figure that fails to start
// must not take the rest of the page down with it.
for (const initPlate of [initApproachPlate, initStackPlate, initIndustryPlate, initResultsChart, initThumbs]) {
  try {
    initPlate();
  } catch (error) {
    console.error(error);
  }
}
initIndustries();
initStatementFill();
initHeader();
initIntro();
initField();
initBandShift();
initReveal();
initCounters();
initLadder();
initStack();
initTeam();
initNotes();
initForm();
