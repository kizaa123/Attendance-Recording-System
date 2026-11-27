/**
 * Offline / slow-network banner for faculty pages. Load after store.js.
 */
(function (global) {
  var hideTimer = null;

  function bannerEl() {
    var el = document.getElementById("attendify-net-banner");
    if (el) return el;
    if (!document.body) return null;
    el = document.createElement("div");
    el.id = "attendify-net-banner";
    el.className = "attendify-net-banner hidden";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
    return el;
  }

  function syncLabel() {
    var Att = global.Attendify;
    if (Att && Att.pendingScanCount) {
      var n = Att.pendingScanCount();
      if (n > 0) return n + " scan" + (n === 1 ? "" : "s") + " waiting to sync.";
    }
    return "";
  }

  function reflect() {
    var el = bannerEl();
    if (!el) return;
    var online = global.navigator.onLine !== false;
    var degraded = global.Attendify && Attendify.isNetworkDegraded && Attendify.isNetworkDegraded();
  var pending = syncLabel();

    if (!online || degraded) {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      el.classList.remove("hidden", "attendify-net-banner--synced");
      el.classList.add("attendify-net-banner--offline");
      el.textContent =
        "You’re offline or the connection is weak. You can keep using cached data. " +
        (pending || "Changes will sync when the network is stable.");
      return;
    }

    if (el.classList.contains("attendify-net-banner--offline")) {
      el.classList.remove("attendify-net-banner--offline");
      el.classList.add("attendify-net-banner--synced");
      el.textContent = "Back online — syncing…";
      hideTimer = setTimeout(function () {
        el.classList.add("hidden");
        el.classList.remove("attendify-net-banner--synced");
      }, 2600);
      return;
    }

    el.classList.add("hidden");
  }

  function init() {
    reflect();
    global.addEventListener("offline", reflect);
    global.addEventListener("online", function () {
      reflect();
      if (global.Attendify && Attendify.softReconnect) {
        Attendify.softReconnect().then(reflect);
      }
    });
    global.setInterval(reflect, 4000);
  }

  global.AttendifyConnectivity = { reflect: reflect, init: init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);