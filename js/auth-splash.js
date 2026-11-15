(function () {
  function loginUrl() {
    if (window.AttendifyAuthEntry && AttendifyAuthEntry.loginAfterSplashHref) {
      return AttendifyAuthEntry.loginAfterSplashHref();
    }
    return "login.html?from=splash";
  }

  function skipToLogin() {
    window.location.replace(loginUrl());
  }

  if (
    window.AttendifyAuthEntry &&
    !AttendifyAuthEntry.isMobileAuth()
  ) {
    skipToLogin();
    return;
  }

  if (window.matchMedia("(min-width: 1024px)").matches) {
    skipToLogin();
    return;
  }

  var splash = document.getElementById("auth-splash");
  var fill = splash ? splash.querySelector(".auth-splash__bar-fill") : null;
  var bar = splash ? splash.querySelector(".auth-splash__bar") : null;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var durationMs = reducedMotion ? 900 : 2000;

  function goLogin() {
    window.location.replace(loginUrl());
  }

  function setProgress(percent) {
    if (bar) bar.setAttribute("aria-valuenow", String(Math.round(percent)));
    if (fill && reducedMotion) fill.style.width = percent + "%";
  }

  if (!splash) {
    goLogin();
    return;
  }

  var start = Date.now();
  function tick() {
    var elapsed = Date.now() - start;
    var pct = Math.min(100, (elapsed / durationMs) * 100);
    setProgress(pct);
    if (elapsed < durationMs) window.requestAnimationFrame(tick);
  }
  window.requestAnimationFrame(tick);

  window.setTimeout(function () {
    if (splash) {
      splash.classList.add("auth-splash--hide");
      splash.setAttribute("aria-busy", "false");
    }
    window.setTimeout(goLogin, reducedMotion ? 120 : 400);
  }, durationMs + 60);
})();