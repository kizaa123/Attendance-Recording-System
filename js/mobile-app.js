(function (win) {
  var STANDALONE_CLASS = "attendify-standalone";

  function isStandalone() {
    try {
      if (win.matchMedia && win.matchMedia("(display-mode: standalone)").matches) return true;
      if (win.matchMedia && win.matchMedia("(display-mode: fullscreen)").matches) return true;
      if (win.navigator.standalone === true) return true;
    } catch (_) {}
    return false;
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (win.location.protocol !== "https:" && win.location.hostname !== "localhost") return;
    win.addEventListener("load", function () {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(function () {});
    });
  }

  function applyStandaloneClass() {
    if (isStandalone()) {
      document.documentElement.classList.add(STANDALONE_CLASS);
    }
  }

  var deferredInstallPrompt = null;

  function captureInstallPrompt() {
    win.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredInstallPrompt = e;
      var btn = document.getElementById("btn-pwa-install");
      if (btn) btn.classList.remove("hidden");
    });
  }

  function promptInstall() {
    if (!deferredInstallPrompt) {
      win.location.href = "/install.html";
      return Promise.resolve({ outcome: "dismissed" });
    }
    var prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    return prompt.prompt().then(function () {
      return prompt.userChoice;
    });
  }

  registerServiceWorker();
  applyStandaloneClass();
  captureInstallPrompt();

  win.AttendifyMobileApp = {
    isStandalone: isStandalone,
    promptInstall: promptInstall
  };
})(window);