/**
 * Forces lecturer login before protected portal pages load.
 * Include after store.js on dashboard, course, programme, and reports.
 */
(function () {
  function loginRedirect(extra) {
    extra = extra || "";
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.location.replace("splash.html" + extra);
      return;
    }
    window.location.replace("login.html" + extra);
  }

  if (!window.Attendify || typeof Attendify.validateSession !== "function") {
    loginRedirect();
    return;
  }

  var page = (window.location.pathname.split("/").pop() || "dashboard.html") + (window.location.search || "");
  var next = encodeURIComponent(page);

  function bounce() {
    try {
      Attendify.clearSession();
    } catch (_) {}
    loginRedirect("?next=" + next);
  }

  var session = Attendify.getSession && Attendify.getSession();

  function backgroundSessionCheck() {
    Attendify.validateSession({ soft: true }).then(function (result) {
      if (result && result.ok) return;
      if (result && (result.offline || result.code === "NETWORK")) return;
      if (session && session.token) return;
      bounce();
    });
  }

  if (session && session.lecturer && session.token) {
    backgroundSessionCheck();
    return;
  }

  Attendify.validateSession({ soft: true }).then(function (result) {
    if (result && result.ok) return;
    if (result && (result.offline || result.code === "NETWORK")) return;
    bounce();
  });
})();