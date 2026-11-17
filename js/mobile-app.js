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

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  }

  function isAndroid() {
    return /android/i.test(navigator.userAgent || "");
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (win.location.protocol !== "https:" && win.location.hostname !== "localhost") return;
    win.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {});
    });
  }

  function applyStandaloneClass() {
    if (isStandalone()) {
      document.documentElement.classList.add(STANDALONE_CLASS);
    }
  }

  var deferredInstallPrompt = null;

  function updateInstallButton() {
    var btn = document.getElementById("btn-pwa-install");
    if (!btn) return;
    btn.classList.remove("hidden");
    if (deferredInstallPrompt) {
      btn.textContent = "Install Attendify";
      btn.setAttribute("data-install-mode", "native");
    } else if (isStandalone()) {
      btn.textContent = "App already installed";
      btn.setAttribute("disabled", "disabled");
      btn.classList.add("opacity-60", "cursor-not-allowed");
    } else {
      btn.textContent = isIos() ? "How to add to Home Screen" : "Install on this phone";
      btn.setAttribute("data-install-mode", "manual");
    }
  }

  function captureInstallPrompt() {
    win.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredInstallPrompt = e;
      updateInstallButton();
    });
    win.addEventListener("appinstalled", function () {
      deferredInstallPrompt = null;
      updateInstallButton();
    });
  }

  function clearInstallHighlights() {
    document.querySelectorAll("[data-install-step]").forEach(function (el) {
      el.classList.remove("install-step--highlight");
    });
  }

  function showManualInstallHelp() {
    var help = document.getElementById("install-help");
    var androidBlock = document.getElementById("install-steps-android");
    var iosBlock = document.getElementById("install-steps-ios");
    var title = document.getElementById("install-help-title");
    var text = document.getElementById("install-help-text");

    clearInstallHighlights();

    if (win.location.protocol === "file:") {
      if (title) title.textContent = "Open in your browser";
      if (text) {
        text.textContent =
          "Install only works over HTTPS. Upload Attendify to your server or open the live Render link in Chrome or Safari, then return to this page.";
      }
      if (help) help.classList.remove("hidden");
      if (help && help.scrollIntoView) help.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    if (isIos()) {
      if (title) title.textContent = "Add to Home Screen (iPhone)";
      if (text) {
        text.textContent =
          "In Safari, tap the Share button, then Add to Home Screen, then Add. Use Safari, not Chrome, on iPhone.";
      }
      if (iosBlock) iosBlock.classList.add("install-step--highlight");
      if (androidBlock) androidBlock.classList.remove("install-step--highlight");
    } else if (isAndroid()) {
      if (title) title.textContent = "Install in Chrome";
      if (text) {
        text.textContent =
          "In Chrome, open the ⋮ menu and choose Install app or Add to Home screen. If you do not see it, refresh this page once, then try again.";
      }
      if (androidBlock) androidBlock.classList.add("install-step--highlight");
      if (iosBlock) iosBlock.classList.remove("install-step--highlight");
    } else {
      if (title) title.textContent = "Install from the browser";
      if (text) {
        text.textContent =
          "Use your browser’s menu to install or add this site to your home screen. Chrome on Android and Safari on iPhone work best.";
      }
      if (androidBlock) androidBlock.classList.add("install-step--highlight");
    }

    if (help) {
      help.classList.remove("hidden");
      if (help.scrollIntoView) help.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function promptInstall(options) {
    options = options || {};
    if (isStandalone()) {
      showManualInstallHelp();
      return Promise.resolve({ outcome: "already-installed" });
    }

    if (deferredInstallPrompt) {
      var prompt = deferredInstallPrompt;
      return prompt
        .prompt()
        .then(function () {
          return prompt.userChoice;
        })
        .then(function (choice) {
          if (choice && choice.outcome === "accepted") {
            deferredInstallPrompt = null;
          } else if (choice && choice.outcome === "dismissed") {
            deferredInstallPrompt = prompt;
          }
          updateInstallButton();
          return choice || { outcome: "unknown" };
        })
        .catch(function () {
          showManualInstallHelp();
          return { outcome: "manual" };
        });
    }

    if (options.fromInstallPage || /install\.html/i.test(win.location.pathname)) {
      showManualInstallHelp();
      return Promise.resolve({ outcome: "manual" });
    }

    win.location.href = "/install.html";
    return Promise.resolve({ outcome: "navigate" });
  }

  function initInstallPage() {
    var btn = document.getElementById("btn-pwa-install");
    if (!btn) return;

    updateInstallButton();

    btn.addEventListener("click", function () {
      if (btn.disabled) return;
      promptInstall({ fromInstallPage: true });
    });

    win.setTimeout(function () {
      if (!deferredInstallPrompt) updateInstallButton();
    }, 800);
  }

  registerServiceWorker();
  applyStandaloneClass();
  captureInstallPrompt();

  function onReady() {
    if (document.getElementById("btn-pwa-install")) initInstallPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }

  win.AttendifyMobileApp = {
    isStandalone: isStandalone,
    isIos: isIos,
    isAndroid: isAndroid,
    promptInstall: promptInstall,
    showManualInstallHelp: showManualInstallHelp
  };
})(window);