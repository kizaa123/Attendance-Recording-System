(function () {
  var fromSplash = false;
  try {
    fromSplash =
      new URLSearchParams(window.location.search || "").get("from") === "splash" ||
      sessionStorage.getItem("attendify_enter_anim") === "splash";
  } catch (_) {}
  if (!fromSplash) return;
  try {
    document.documentElement.classList.add("auth-html-from-splash");
  } catch (_) {}
})();