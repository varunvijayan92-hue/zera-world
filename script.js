document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".contact-form");

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const button = form.querySelector("button");
      const originalText = button.textContent;

      button.textContent = "Request sent";
      button.disabled = true;
      button.style.opacity = "0.85";

      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        button.style.opacity = "1";
        form.reset();
      }, 1800);
    });
  }
});
