(function () {
  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function comingFromSplash() {
    try {
      if (sessionStorage.getItem("attendify_enter_anim") === "splash") return true;
    } catch (e) {}
    try {
      if (new URLSearchParams(window.location.search || "").get("from") === "splash") return true;
    } catch (e2) {}
    return false;
  }

  function applyStoredEnter() {
    var kind = "";
    try {
      kind = sessionStorage.getItem("attendify_enter_anim") || "";
    } catch (e) {}
    if (!kind && comingFromSplash()) kind = "splash";
    if (!kind) return;
    try {
      sessionStorage.removeItem("attendify_enter_anim");
    } catch (e2) {}
    if (kind === "splash" && document.body && document.body.classList.contains("auth-page")) {
      document.body.classList.add("auth-enter-from-splash");
      if (!reducedMotion()) document.body.classList.add("auth-enter-from-splash--motion");
    }
    if (kind === "portal" && document.body) {
      if (!reducedMotion()) document.body.classList.add("faculty-page-enter");
    }
  }

  if (document.body) applyStoredEnter();
  else document.addEventListener("DOMContentLoaded", applyStoredEnter);

  window.AttendifyPageTransitions = {
    markSplashEnter: function () {
      try {
        sessionStorage.setItem("attendify_enter_anim", "splash");
      } catch (e) {}
    },
    markPortalEnter: function () {
      try {
        sessionStorage.setItem("attendify_enter_anim", "portal");
      } catch (e) {}
    }
  };
})();