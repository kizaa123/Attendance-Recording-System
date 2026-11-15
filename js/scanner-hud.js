(function (global) {
  var lastVerifiedStudentId = "";
  var hudDismissTimer = null;
  var HUD_DISMISS_MS = 2600;
  var HUD_DISMISS_VERIFIED_MS = 3400;
  var audioCtx = null;

  function clearHudDismissTimer() {
    if (hudDismissTimer) {
      clearTimeout(hudDismissTimer);
      hudDismissTimer = null;
    }
  }

  function scheduleHudDismiss(ms) {
    clearHudDismissTimer();
    hudDismissTimer = setTimeout(hideVerified, ms != null ? ms : HUD_DISMISS_MS);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function getAudioCtx() {
    if (!global.AudioContext && !global.webkitAudioContext) return null;
    if (!audioCtx) {
      audioCtx = new (global.AudioContext || global.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function tone(freq, durationMs, type, gainValue, when) {
    var ctx = getAudioCtx();
    if (!ctx) return;
    var start = when != null ? when : ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue || 0.12, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + durationMs / 1000 + 0.02);
  }

  function playSuccess() {
    var ctx = getAudioCtx();
    if (!ctx) return;
    var t = ctx.currentTime;
    tone(880, 90, "sine", 0.14, t);
    tone(1320, 140, "sine", 0.11, t + 0.09);
  }

  function playDuplicate() {
    var ctx = getAudioCtx();
    if (!ctx) return;
    var t = ctx.currentTime;
    tone(520, 80, "triangle", 0.1, t);
    tone(520, 80, "triangle", 0.08, t + 0.14);
  }

  function playError() {
    var ctx = getAudioCtx();
    if (!ctx) return;
    var t = ctx.currentTime;
    tone(220, 160, "sawtooth", 0.07, t);
    tone(160, 220, "sawtooth", 0.05, t + 0.12);
  }

  function avatarHtml(student, sizeClass, ringClass) {
    return global.Attendify.avatarMarkup(student, sizeClass || "w-12 h-12", ringClass || "ring-2 ring-white shadow");
  }

  function showVerified(student, scannedAt, duplicate) {
    var box = document.getElementById("scan-hud-verified");
    if (!box || !student) return;
    clearHudDismissTimer();
    lastVerifiedStudentId = student.id;
    box.classList.remove("hidden");
    if (duplicate) playDuplicate();
    else playSuccess();
    var time = global.Attendify.formatTime(scannedAt);
    var shell = duplicate
      ? "bg-amber-50 border border-amber-200"
      : "bg-teal-50 border border-teal-100";
    var badge = duplicate
      ? "text-amber-900 bg-amber-100"
      : "text-teal-800 bg-teal-100";
    var badgeLabel = duplicate ? "Already in" : "Verified";
    var titleHtml = duplicate
      ? '<p class="text-[11px] font-semibold text-amber-950 mt-0.5 leading-snug">' +
        esc(student.name) +
        ", already marked present</p>"
      : '<p class="text-[11px] font-semibold text-slate-900 mt-0.5 truncate">' + esc(student.name) + "</p>";
    var subtitle = duplicate
      ? '<p class="text-[10px] text-amber-800/90">First scan at <span class="font-mono">' + esc(time) + "</span></p>"
      : '<p class="text-[10px] text-slate-600">ID: <span class="font-mono">' +
        esc(student.index) +
        "</span> · Present</p>";

    box.innerHTML =
      '<div class="flex items-center gap-2 px-2.5 py-2 ' +
      shell +
      ' rounded-xl shadow-sm">' +
      '<div class="relative shrink-0">' +
      avatarHtml(student, "w-9 h-9", "ring-2 ring-white shadow") +
      (duplicate
        ? '<span class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">!</span>'
        : '<span class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">✓</span>') +
      "</div>" +
      '<div class="flex-1 min-w-0">' +
      '<div class="flex items-center gap-2 flex-wrap">' +
      '<span class="text-[9px] font-bold uppercase tracking-wide ' +
      badge +
      ' px-1.5 py-0.5 rounded">' +
      badgeLabel +
      "</span>" +
      (!duplicate
        ? '<span class="text-[9px] text-slate-500 font-mono">' + esc(time) + "</span>"
        : "") +
      "</div>" +
      titleHtml +
      subtitle +
      "</div>" +
      '<button type="button" id="scan-hud-undo" class="text-[10px] font-bold text-teal-700 hover:text-teal-900 px-1.5 py-0.5 shrink-0">Undo</button></div>';
    global.Attendify.hydrateAvatars(box);
    scheduleHudDismiss(duplicate ? HUD_DISMISS_MS : HUD_DISMISS_VERIFIED_MS);
  }

  function hideVerified() {
    clearHudDismissTimer();
    var box = document.getElementById("scan-hud-verified");
    if (box) {
      box.classList.add("hidden");
      box.innerHTML = "";
    }
    lastVerifiedStudentId = "";
  }

  function isUnregisteredScan(result) {
    if (!result) return false;
    var err = String(result.error || "").toLowerCase();
    if (err === "unknown") return true;
    var msg = String(result.message || result.error || "").toLowerCase();
    if (msg.indexOf("roster") !== -1) return true;
    if (msg.indexOf("not registered") !== -1) return true;
    if (msg.indexOf("not on") !== -1 && msg.indexOf("programme") !== -1) return true;
    return false;
  }

  function showUnknown() {
    showScanMessage("Not on the registration roster", "error", true);
  }

  function showScanMessage(text, kind, playErr) {
    var box = document.getElementById("scan-hud-verified");
    if (!box) return;
    clearHudDismissTimer();
    lastVerifiedStudentId = "";
    if (playErr) playError();
    var styles = {
      error: "bg-rose-100 border-rose-300 text-rose-900",
      warning: "bg-amber-100 border-amber-300 text-amber-900",
      info: "bg-slate-100 border-slate-300 text-slate-800"
    };
    var skin = styles[kind] || styles.info;
    box.classList.remove("hidden");
    box.innerHTML =
      '<div class="px-2 py-1.5 rounded-md border text-center shadow-sm ' +
      skin +
      '">' +
      '<p class="text-[10px] font-medium leading-tight">' +
      esc(text) +
      "</p></div>";
    scheduleHudDismiss(HUD_DISMISS_MS);
  }

  function renderRecent(rows, onRemove) {
    var list = document.getElementById("scan-hud-recent-list");
    var subtitle = document.getElementById("scan-hud-recent-subtitle");
    if (!list) return;
    var count = rows ? rows.length : 0;
    if (subtitle) {
      subtitle.textContent = count ? count + (count === 1 ? " marked" : " marked in this session") : "Waiting for scans";
    }
    if (!count) {
      list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">Scanned students appear here.</p>';
      return;
    }
    var mobileHtml = "";
    var tableRows = "";
    rows.forEach(function (row, index) {
      var removeBtn =
        '<button type="button" data-action="remove-scan" data-student-id="' +
        esc(row.student.id) +
        '" class="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-lg leading-none shrink-0 scan-present-remove" title="Remove">×</button>';
      var listUi = global.AttendifyStudentList;
      var card =
        listUi && listUi.attendanceSessionRosterCard
          ? listUi.attendanceSessionRosterCard(row.student, "present", row.scannedAt, {
              ring: "ring-2 ring-white",
              removeButtonHtml: removeBtn
            })
          : "";
      if (!card) {
        card =
          '<div class="attendance-session-card attendance-session-card--roster">' +
          avatarHtml(row.student, "w-11 h-11", "ring-2 ring-white") +
          '<div class="min-w-0 flex-1"><p class="font-semibold text-slate-900 text-sm truncate">' +
          esc(row.student.name) +
          "</p></div></div>";
      }
      mobileHtml +=
        '<div class="scan-present-card" data-student-id="' +
        esc(row.student.id) +
        '">' +
        card +
        "</div>";
      if (listUi && listUi.attendanceSessionTableRow) {
        tableRows += listUi.attendanceSessionTableRow(row.student, "present", row.scannedAt, { removeButtonHtml: removeBtn }, index + 1);
      }
    });
    list.innerHTML =
      '<div class="scan-present-cards md:hidden">' +
      '<div class="scan-present-list space-y-2">' +
      mobileHtml +
      "</div></div>" +
      '<div class="scan-present-table-wrap hidden md:block min-h-0 overflow-y-auto rounded-xl border border-slate-100">' +
      '<table class="scan-present-table w-full text-left border-collapse">' +
      '<thead class="scan-present-table-head text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/95 border-b border-slate-200 sticky top-0 z-[1]">' +
      "<tr>" +
      '<th class="py-2.5 px-3 text-center w-12">#</th>' +
      '<th class="py-2.5 px-3">Student</th>' +
      '<th class="py-2.5 px-3">Index</th>' +
      '<th class="py-2.5 px-3">Time</th>' +
      '<th class="py-2.5 px-3">Status</th>' +
      '<th class="py-2.5 px-3 w-12"><span class="sr-only">Remove</span></th>' +
      "</tr></thead><tbody>" +
      tableRows +
      "</tbody></table></div>";

    list.querySelectorAll("[data-action=remove-scan]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (onRemove) onRemove(btn.getAttribute("data-student-id"));
      });
    });
    global.Attendify.hydrateAvatars(list);
  }

  function getLastVerifiedStudentId() {
    return lastVerifiedStudentId;
  }

  function prepareQrReader(readerId) {
    var el = document.getElementById(readerId || "qr-reader");
    if (el) el.innerHTML = "";
  }

  /** Stop scanner and clear the reader DOM so a new instance can attach. */
  function releaseCamera(scanner, readerId) {
    readerId = readerId || "qr-reader";
    if (!scanner) {
      prepareQrReader(readerId);
      return Promise.resolve();
    }
    if (scanner.isScanning) {
      return scanner
        .stop()
        .then(function () {
          return scanner.clear();
        })
        .catch(function () {
          try {
            scanner.clear();
          } catch (e) {}
        })
        .then(function () {
          prepareQrReader(readerId);
        });
    }
    try {
      scanner.clear();
    } catch (e2) {}
    prepareQrReader(readerId);
    return Promise.resolve();
  }

  function isCameraContextOk() {
    if (window.location.protocol === "file:") return false;
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function cameraContextHint() {
    if (window.location.protocol === "file:") {
      return "The camera cannot run from a saved file. Open Attendify in your browser.";
    }
    if (!window.isSecureContext) {
      return "The camera needs a secure connection. Use the HTTPS link from your lecturer.";
    }
    return "Allow camera access in your browser, or use manual entry below.";
  }

  function qrboxSizing(viewfinderWidth, viewfinderHeight, fullFrame) {
    var w = viewfinderWidth > 0 ? viewfinderWidth : 320;
    var h = viewfinderHeight > 0 ? viewfinderHeight : 240;
    if (fullFrame) {
      return {
        width: Math.max(200, Math.floor(w * 0.98)),
        height: Math.max(150, Math.floor(h * 0.98))
      };
    }
    var edge = Math.min(w, h);
    var size = Math.max(200, Math.floor(edge * 0.9));
    return { width: size, height: size };
  }

  /** @param {{ fullFrame?: boolean }} options */
  function getCameraConfig(options) {
    options = options || {};
    var fullFrame = options.fullFrame !== false;
    return {
      fps: 18,
      disableFlip: false,
      qrbox: function (viewfinderWidth, viewfinderHeight) {
        return qrboxSizing(viewfinderWidth, viewfinderHeight, fullFrame);
      }
    };
  }

  function softVideoResolution(constraint) {
    var base =
      constraint && typeof constraint === "object" ? Object.assign({}, constraint) : { facingMode: constraint || "environment" };
    base.width = { ideal: 1280 };
    base.height = { ideal: 720 };
    return base;
  }

  function buildCameraStartPlans(facing) {
    var facingAttempts = getCameraConstraintAttempts(facing);
    var plans = [];
    facingAttempts.forEach(function (video) {
      plans.push({ video: video, config: getCameraConfig({ fullFrame: true }), experimental: true });
    });
    facingAttempts.forEach(function (video) {
      plans.push({ video: video, config: getCameraConfig({ fullFrame: false }), experimental: true });
    });
    facingAttempts.forEach(function (video) {
      plans.push({ video: softVideoResolution(video), config: getCameraConfig({ fullFrame: true }), experimental: false });
    });
    return plans;
  }

  function getCameraConstraintAttempts(facing) {
    var primary = facing === "user" ? "user" : "environment";
    var alt = primary === "user" ? "environment" : "user";
    return [
      { facingMode: { ideal: primary } },
      { facingMode: primary },
      { facingMode: { ideal: alt } },
      { facingMode: alt }
    ];
  }

  function facingFromConstraint(constraint) {
    if (!constraint) return "environment";
    var fm = constraint.facingMode;
    if (typeof fm === "string") return fm;
    if (fm && fm.ideal) return fm.ideal;
    return "environment";
  }

  function getCameraVideoConstraints(facing) {
    return getCameraConstraintAttempts(facing)[0];
  }

  function createQrScanner(readerId, useExperimental) {
    readerId = readerId || "qr-reader";
    if (useExperimental !== false) {
      try {
        return new Html5Qrcode(readerId, {
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false
        });
      } catch (e) {
        /* fall through */
      }
    }
    return new Html5Qrcode(readerId);
  }

  function warmCameraLayout(readerId, callback) {
    readerId = readerId || "qr-reader";
    var runs = 0;
    function tick() {
      runs += 1;
      var el = document.getElementById(readerId);
      var shell = el && el.closest ? el.closest(".scan-camera-shell") : null;
      var ready = shell && shell.clientWidth >= 120 && shell.clientHeight >= 100;
      if (ready) {
        if (callback) callback();
        return;
      }
      if (runs < 32) requestAnimationFrame(tick);
      else if (callback) callback();
    }
    requestAnimationFrame(tick);
  }

  /**
   * Start camera with simple constraints and several fallbacks (flip / strict facing).
   * @param {{ readerId?: string, facing?: string, onScan: function, onScanner?: function }} options
   */
  function startQrCamera(options) {
    options = options || {};
    var readerId = options.readerId || "qr-reader";
    var facing = options.facing === "user" ? "user" : "environment";
    var onScan = options.onScan;
    if (typeof onScan !== "function") return Promise.reject(new Error("onScan required"));
    var plans = buildCameraStartPlans(facing);

    function runAttempt(index) {
      if (index >= plans.length) {
        return Promise.reject(new Error("camera_start_failed"));
      }
      var plan = plans[index];
      prepareQrReader(readerId);
      var instance;
      try {
        instance = createQrScanner(readerId, plan.experimental);
      } catch (e) {
        return runAttempt(index + 1);
      }
      if (options.onScanner) options.onScanner(instance);
      return instance
        .start(plan.video, plan.config, onScan, function () {})
        .then(function () {
          return {
            scanner: instance,
            attempt: index,
            facing: facingFromConstraint(plan.video)
          };
        })
        .catch(function () {
          return releaseCamera(instance, readerId).then(function () {
            return runAttempt(index + 1);
          });
        });
    }

    return new Promise(function (resolve, reject) {
      warmCameraLayout(readerId, function () {
        runAttempt(0).then(resolve).catch(reject);
      });
    });
  }

  global.AttendifyScannerHud = {
    showVerified: showVerified,
    hideVerified: hideVerified,
    showUnknown: showUnknown,
    showScanMessage: showScanMessage,
    isUnregisteredScan: isUnregisteredScan,
    renderRecent: renderRecent,
    getLastVerifiedStudentId: getLastVerifiedStudentId,
    playSuccess: playSuccess,
    playDuplicate: playDuplicate,
    playError: playError,
    getCameraConfig: getCameraConfig,
    warmCameraLayout: warmCameraLayout,
    prepareQrReader: prepareQrReader,
    releaseCamera: releaseCamera,
    isCameraContextOk: isCameraContextOk,
    cameraContextHint: cameraContextHint,
    createQrScanner: createQrScanner,
    getCameraVideoConstraints: getCameraVideoConstraints,
    startQrCamera: startQrCamera
  };
})(window);
