/* Field notes filter: All, Guides, Explainers, Playbooks, Videos. Without this script every note shows and the
   filter stays hidden. */

export function initNotes(): void {
  const filter = document.querySelector<HTMLElement>("[data-notes-filter]");
  const items = Array.from(document.querySelectorAll<HTMLElement>("[data-notes] > [data-kind]"));
  if (!filter || !items.length) return;
  const buttons = Array.from(filter.querySelectorAll<HTMLButtonElement>("[data-kind]"));
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const kind = button.dataset.kind;
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      items.forEach((item) => {
        item.hidden = kind !== "all" && item.dataset.kind !== kind;
      });
    });
  }
  filter.hidden = false;
}
