(function () {
  if (!window.matchMedia("(min-width: 1024px)").matches) return;
  try {
    var fromSplash =
      new URLSearchParams(location.search).get("from") === "splash" ||
      sessionStorage.getItem("attendify_enter_anim") === "splash";
    if (fromSplash) return;
  } catch (_) {}

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  function onReady() {
    document.body.classList.add("auth-desktop-enter--motion");
    var loader = document.getElementById("auth-desktop-loader");
    if (loader) {
      window.setTimeout(function () {
        loader.classList.add("is-done");
        window.setTimeout(function () {
          if (loader.parentNode) loader.parentNode.removeChild(loader);
        }, 420);
      }, 1180);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})();