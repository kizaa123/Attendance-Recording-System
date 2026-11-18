(function (win) {
  var SESSION_KEY = "attendify-session";

  function isMobileAuth() {
    return win.matchMedia("(max-width: 1023px)").matches;
  }

  function hasStoredLecturerSession() {
    try {
      var raw = win.sessionStorage.getItem(SESSION_KEY) || win.localStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      var session = JSON.parse(raw);
      return !!(session && session.token && session.lecturer);
    } catch (e) {
      return false;
    }
  }

  function mobileSplashHref(search) {
    var q = search != null ? String(search) : win.location.search || "";
    return "splash.html" + q;
  }

  function loginAfterSplashHref() {
    var params = new URLSearchParams(win.location.search || "");
    var wantSignup = params.get("mode") === "signup";
    params.delete("splash");
    params.set("from", "splash");
    if (!wantSignup) {
      params.delete("mode");
    }
    var qs = params.toString();
    return "login.html" + (qs ? "?" + qs : "?from=splash");
  }

  function gateLoginToSplash() {
    if (!isMobileAuth()) return;
    var params = new URLSearchParams(win.location.search || "");
    if (params.get("from") === "splash") {
      var openedSignup = params.get("mode") === "signup";
      params.delete("from");
      params.delete("splash");
      if (!openedSignup) {
        params.delete("mode");
      }
      var clean = params.toString();
      try {
        win.history.replaceState(null, "", "login.html" + (clean ? "?" + clean : ""));
      } catch (e) {}
      try {
        sessionStorage.setItem("attendify_auth_mode", openedSignup ? "signup" : "signin");
      } catch (e2) {}
      return;
    }
    if (params.get("splash") === "1") {
      params.delete("splash");
      var legacy = params.toString();
      win.location.replace(mobileSplashHref(legacy ? "?" + legacy : ""));
      return;
    }
    var ref = String(document.referrer || "");
    if (ref.indexOf("splash.html") !== -1) return;
    win.location.replace(mobileSplashHref(win.location.search + win.location.hash));
  }

  function signInEntryHref(search) {
    if (isMobileAuth()) return mobileSplashHref(search || "");
    return "login.html" + (search || "");
  }

  win.AttendifyAuthEntry = {
    isMobileAuth: isMobileAuth,
    hasStoredLecturerSession: hasStoredLecturerSession,
    mobileSplashHref: mobileSplashHref,
    loginAfterSplashHref: loginAfterSplashHref,
    gateLoginToSplash: gateLoginToSplash,
    signInEntryHref: signInEntryHref
  };
})(window);