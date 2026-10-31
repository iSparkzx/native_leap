import { prefersReducedMotion } from "../lib/util.ts";

/* Team carousel. The track is a native scroll-snap list, so it swipes, scrolls and keys without this script; this
   adds the dot indicators and the previous/next arrows. There is one dot per stopping position, not per member:
   with three members in view the last three share the end position, so they get one dot between them. The
   active dot stretches into a pill. */

export function initTeam(): void {
  const track = document.querySelector<HTMLElement>("[data-team-track]");
  const dots = document.querySelector<HTMLElement>("[data-team-dots]");
  const nav = document.querySelector<HTMLElement>("[data-team-nav]");
  const prev = document.querySelector<HTMLButtonElement>("[data-team-prev]");
  const next = document.querySelector<HTMLButtonElement>("[data-team-next]");
  if (!track || !dots || !nav || !prev || !next) return;
  const members = Array.from(track.children) as HTMLElement[];
  if (members.length < 2) return;

  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  let stops: number[] = [];
  // Where a smooth scroll is heading, so quick repeated clicks keep stepping instead of restarting from here.
  let target: number | null = null;
  let active = -1;

  /** Scroll offsets the track can stop at: each member's start, clamped to the end, near-duplicates merged. */
  const measure = (): void => {
    const edge = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const max = track.scrollWidth - track.clientWidth;
    const step = members[1].offsetLeft - members[0].offsetLeft;
    stops = [];
    for (const member of members) {
      const at = Math.min(member.offsetLeft - edge, max);
      if (!stops.length || at - stops[stops.length - 1] > step * 0.3) stops.push(at);
      else stops[stops.length - 1] = at;
    }
    if (dots.children.length !== stops.length) {
      dots.replaceChildren(...stops.map((_, i) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "team-dot";
        button.setAttribute("aria-label", `Show position ${i + 1} of ${stops.length}`);
        button.addEventListener("click", () => go(i));
        return button;
      }));
      active = -1;
    }
  };

  const go = (i: number): void => {
    const index = Math.max(0, Math.min(stops.length - 1, i));
    target = index;
    track.scrollTo({ left: stops[index], behavior });
  };

  const nearest = (): number => {
    let index = 0;
    stops.forEach((at, i) => {
      if (Math.abs(at - track.scrollLeft) < Math.abs(stops[index] - track.scrollLeft)) index = i;
    });
    return index;
  };

  const sync = (): void => {
    const index = nearest();
    if (target !== null && Math.abs(stops[target] - track.scrollLeft) < 4) target = null;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= stops[stops.length - 1] - 2;
    if (index === active) return;
    active = index;
    Array.from(dots.children).forEach((dot, i) => dot.setAttribute("aria-current", String(i === index)));
  };

  prev.addEventListener("click", () => go((target ?? nearest()) - 1));
  next.addEventListener("click", () => go((target ?? nearest()) + 1));

  let queued = false;
  let dirty = false;
  const schedule = (remeasure = false): void => {
    dirty ||= remeasure;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (dirty) measure();
      dirty = false;
      sync();
    });
  };
  track.addEventListener("scroll", () => schedule(), { passive: true });
  new ResizeObserver(() => schedule(true)).observe(track);
  // The moment someone scrolls by hand, or a scroll settles, the in-flight target no longer applies.
  const release = (): void => {
    target = null;
  };
  for (const type of ["scrollend", "pointerdown", "wheel", "touchstart"]) track.addEventListener(type, release, { passive: true });

  nav.hidden = false;
  dots.hidden = false;
  track.classList.add("is-enhanced");
  measure();
  sync();
}
