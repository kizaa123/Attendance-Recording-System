(function () {
  var FILL_MS = 1900;
  var HOLD_AT_FULL_MS = 320;
  var FADE_OUT_MS = 200;

  function loginUrl() {
    if (window.AttendifyAuthEntry && AttendifyAuthEntry.loginAfterSplashHref) {
      return AttendifyAuthEntry.loginAfterSplashHref();
    }
    return "login.html?from=splash";
  }

  function skipToLogin() {
    window.location.replace(loginUrl());
  }

  if (window.AttendifyAuthEntry && !AttendifyAuthEntry.isMobileAuth()) {
    skipToLogin();
    return;
  }

  if (window.matchMedia("(min-width: 1024px)").matches) {
    skipToLogin();
    return;
  }

  try {
    sessionStorage.removeItem("attendify_splash_seen");
  } catch (e) {}

  var splash = document.getElementById("auth-splash");
  var fill = splash ? splash.querySelector(".auth-splash__bar-fill") : null;
  var bar = splash ? splash.querySelector(".auth-splash__bar") : null;
  var title = splash ? splash.querySelector(".auth-splash__title") : null;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fillMs = reducedMotion ? 1400 : FILL_MS;
  var holdMs = reducedMotion ? 400 : HOLD_AT_FULL_MS;
  var fadeMs = reducedMotion ? 0 : FADE_OUT_MS;

  try {
    document.documentElement.style.setProperty("--auth-splash-duration-mobile", fillMs + "ms");
    document.documentElement.style.setProperty("--auth-splash-fade-ms", fadeMs + "ms");
  } catch (e) {}

  function goLogin() {
    try {
      var splashParams = new URLSearchParams(window.location.search || "");
      sessionStorage.setItem(
        "attendify_auth_mode",
        splashParams.get("mode") === "signup" ? "signup" : "signin"
      );
    } catch (e) {}
    if (window.AttendifyPageTransitions && AttendifyPageTransitions.markSplashEnter) {
      AttendifyPageTransitions.markSplashEnter();
    }
    window.location.replace(loginUrl());
  }

  function setProgress(percent) {
    if (bar) bar.setAttribute("aria-valuenow", String(Math.round(percent)));
    if (fill) fill.style.width = percent + "%";
  }

  if (!splash) {
    goLogin();
    return;
  }

  splash.classList.add("auth-splash--visible", "auth-splash--loading");
  if (title) title.classList.add("auth-splash__title--loading");

  var start = Date.now();
  function tick() {
    var elapsed = Date.now() - start;
    var pct = Math.min(100, (elapsed / fillMs) * 100);
    setProgress(pct);
    if (elapsed < fillMs + holdMs) window.requestAnimationFrame(tick);
  }
  window.requestAnimationFrame(tick);

  window.setTimeout(function () {
    setProgress(100);
    splash.classList.remove("auth-splash--loading");
    if (title) title.classList.remove("auth-splash__title--loading");
    splash.classList.add("auth-splash--hide");
    splash.setAttribute("aria-busy", "false");
    window.setTimeout(goLogin, Math.max(fadeMs, 120));
  }, fillMs + holdMs);
})();