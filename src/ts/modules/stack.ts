/* Delivery stack: layers light up as items of work in the engraved plate pass through them. Hovering or
   focusing a layer shows what it does. */

export function initStack(): void {
  const layers = Array.from(document.querySelectorAll<HTMLElement>(".layer"));
  const detail = document.querySelector<HTMLElement>("[data-stack-detail]");
  if (!layers.length) return;

  if (detail && !window.matchMedia("(hover: hover)").matches) detail.textContent = "Tap a layer to see what it does.";
  const defaultText = detail?.textContent ?? "";
  for (const layer of layers) {
    layer.tabIndex = 0;
    const show = (): void => {
      if (detail) detail.textContent = layer.dataset.detail ?? defaultText;
    };
    const hide = (): void => {
      if (detail) detail.textContent = defaultText;
    };
    layer.addEventListener("pointerenter", show);
    layer.addEventListener("focus", show);
    layer.addEventListener("pointerleave", (event) => event.pointerType === "mouse" && hide());
    layer.addEventListener("blur", hide);
  }

  // The engraved plate below (plates/stack.ts) announces each stage an item of work enters; light its layers.
  const stageLayers = [[0], [1, 2, 3], [4, 5], [6], [7]];
  document.addEventListener("plate:stage", (event) => {
    for (const i of stageLayers[(event as CustomEvent<number>).detail] ?? []) {
      const layer = layers[i];
      if (!layer) continue;
      layer.classList.add("is-lit");
      clearTimeout(Number(layer.dataset.litTimer));
      layer.dataset.litTimer = String(setTimeout(() => layer.classList.remove("is-lit"), 700));
    }
  });
}
