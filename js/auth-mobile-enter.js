(function () {
  if (!window.matchMedia("(max-width: 1023px)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    if (document.body.classList.contains("auth-enter-from-splash")) return;
  } catch (_) {}

  function run() {
    document.body.classList.add("auth-mobile-enter--motion");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();