(function () {
  var MIN_LOAD_MS = 520;
  var TARGET_LOAD_MS = 780;
  var MAX_LOAD_MS = 1400;
  var HOLD_AT_FULL_MS = 100;
  var FADE_OUT_MS = 140;

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

  var splashParams = new URLSearchParams(window.location.search || "");
  var fromPwa = splashParams.get("from") === "pwa";
  if (fromPwa) {
    try {
      if (sessionStorage.getItem("attendify_splash_seen") === "1") {
        skipToLogin();
        return;
      }
      sessionStorage.setItem("attendify_splash_seen", "1");
    } catch (e) {}
  }

  var splash = document.getElementById("auth-splash");
  var fill = splash ? splash.querySelector(".auth-splash__bar-fill") : null;
  var bar = splash ? splash.querySelector(".auth-splash__bar") : null;
  var title = splash ? splash.querySelector(".auth-splash__title") : null;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var targetMs = reducedMotion ? 700 : fromPwa ? TARGET_LOAD_MS : 920;
  var minMs = reducedMotion ? 400 : MIN_LOAD_MS;
  var maxMs = reducedMotion ? 900 : MAX_LOAD_MS;
  var holdMs = reducedMotion ? 80 : HOLD_AT_FULL_MS;
  var fadeMs = reducedMotion ? 0 : FADE_OUT_MS;

  try {
    document.documentElement.style.setProperty("--auth-splash-duration-mobile", targetMs + "ms");
    document.documentElement.style.setProperty("--auth-splash-fade-ms", fadeMs + "ms");
  } catch (e) {}

  if (fromPwa && splash) splash.classList.add("auth-splash--pwa");

  function goLogin() {
    try {
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

  var loginTarget = loginUrl();
  var preload = fetch(loginTarget, { credentials: "same-origin", cache: "no-store" }).catch(function () {
    return null;
  });

  var start = Date.now();
  var finished = false;

  function tick() {
    if (finished) return;
    var elapsed = Date.now() - start;
    var pct = Math.min(100, (elapsed / targetMs) * 100);
    setProgress(pct);
    if (elapsed < maxMs + holdMs) window.requestAnimationFrame(tick);
  }
  window.requestAnimationFrame(tick);

  function finishSplash() {
    if (finished) return;
    finished = true;
    setProgress(100);
    splash.classList.remove("auth-splash--loading");
    if (title) title.classList.remove("auth-splash__title--loading");
    splash.classList.add("auth-splash--hide");
    splash.setAttribute("aria-busy", "false");
    window.setTimeout(goLogin, Math.max(fadeMs, 90));
  }

  Promise.all([
    preload,
    new Promise(function (resolve) {
      window.setTimeout(resolve, minMs);
    })
  ])
    .then(function () {
      var elapsed = Date.now() - start;
      var wait = Math.max(0, Math.min(targetMs, maxMs) - elapsed);
      window.setTimeout(finishSplash, wait + holdMs);
    })
    .catch(function () {
      window.setTimeout(finishSplash, holdMs);
    });

  window.setTimeout(function () {
    finishSplash();
  }, maxMs + holdMs + 120);
})();