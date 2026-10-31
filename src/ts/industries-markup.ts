import { industries, type WorkflowStep } from "./content.ts";
import { escapeHtml } from "./lib/util.ts";

/* Industries panel markup, shared by scripts/build.ts, which writes the first workflow into index.html so the
   section reads without scripts, and modules/industries.ts, which re-renders the panel on every change. */

export const totalMinutes = (steps: WorkflowStep[]): number => steps.reduce((sum, s) => sum + (s.minutes ?? 0), 0);

export const tabsHtml = (): string =>
  industries
    .map(
      (ind, i) =>
        `<button class="ind-tab" type="button" role="tab" id="tab-${ind.id}" aria-controls="ind-panel" ` +
        `aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${escapeHtml(ind.name)}` +
        `<span class="mono">0${i + 1}</span></button>`,
    )
    .join("");

export const stepsHtml = (steps: WorkflowStep[]): string =>
  steps
    .map(
      (s, i) =>
        `<li class="ind-step"><span class="mono">${String(i + 1).padStart(2, "0")}</span>` +
        `<span class="ind-step-text">${escapeHtml(s.text)}</span>` +
        (s.minutes === null
          ? `<span class="ind-step-time"><span class="ind-step-auto">Automatic</span></span>`
          : `<span class="ind-step-time mono">${s.minutes} min</span>`) +
        `</li>`,
    )
    .join("");

type IndustryMarker = "title" | "unit" | "steps" | "total";

export function firstIndustryFill(): Record<IndustryMarker, string> {
  const first = industries[0];
  return {
    title: escapeHtml(first.workflow),
    unit: escapeHtml(first.unit),
    steps: stepsHtml(first.today),
    total: String(totalMinutes(first.today)),
  };
}
