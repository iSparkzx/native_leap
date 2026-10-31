/* Placeholder forms (contact, field-notes signup): check the email and confirm on the page. Nothing is sent
   anywhere. Each form keeps its own status line; data-sent overrides the confirmation text. */

export function initForm(): void {
  for (const form of document.querySelectorAll<HTMLFormElement>("[data-form]")) {
    const status = form.querySelector<HTMLElement>("[data-form-status]");
    if (!status) continue;

    const email = form.querySelector<HTMLInputElement>('input[name="email"]');
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (email && !email.checkValidity()) {
        email.setAttribute("aria-invalid", "true");
        status.textContent = "Add a work email so we can reply.";
        email.focus();
        return;
      }
      email?.removeAttribute("aria-invalid");
      status.textContent = form.dataset.sent ?? "Thanks. This is a placeholder form, so nothing was sent.";
      form.reset();
    });
    email?.addEventListener("input", () => email.removeAttribute("aria-invalid"));
  }
}
