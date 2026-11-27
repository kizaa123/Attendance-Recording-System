(function (global) {
  var lastVerifiedStudentId = "";
  var hudDismissTimer = null;
  var HUD_DISMISS_MS = 2600;
  var HUD_DISMISS_VERIFIED_MS = 3400;
  var SCAN_DEDUPE_MS = 120;
  var SCAN_GATE_REPEAT_MS = 3000;
  var SCAN_BUSY_MIN_MS = 420;
  var HUD_DUPLICATE_SUPPRESS_MS = 2800;
  var audioCtx = null;
  var barcodeBoostStop = {};
  var lastHudFeedback = { studentId: "", kind: "", at: 0 };

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
    var now = Date.now();
    var sid = String(student.id || "");
    if (
      duplicate &&
      sid &&
      lastHudFeedback.studentId === sid &&
      lastHudFeedback.kind === "ok" &&
      now - lastHudFeedback.at < HUD_DUPLICATE_SUPPRESS_MS
    ) {
      return;
    }
    clearHudDismissTimer();
    lastVerifiedStudentId = student.id;
    box.classList.remove("hidden");
    if (duplicate) playDuplicate();
    else playSuccess();
    lastHudFeedback = { studentId: sid, kind: duplicate ? "dup" : "ok", at: now };
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

  function armReaderForDarkModeSafe(el) {
    if (!el) return;
    el.style.colorScheme = "light";
    el.style.backgroundColor = "#000000";
    el.setAttribute("data-color-scheme", "light");
    var shell = el.closest ? el.closest(".scan-camera-shell") : null;
    if (shell) {
      shell.style.colorScheme = "light";
      shell.setAttribute("data-scan-light", "1");
    }
    var modal = el.closest ? el.closest("#scannerModal, #mainUI") : null;
    if (modal) {
      modal.style.colorScheme = "light";
    }
    var docEl = document.documentElement;
    if (docEl) docEl.style.colorScheme = "light";
  }

  function prepareQrReader(readerId) {
    var el = document.getElementById(readerId || "qr-reader");
    if (el) {
      el.innerHTML = "";
      armReaderForDarkModeSafe(el);
    }
  }

  function stopBarcodeBoost(readerId) {
    readerId = readerId || "qr-reader";
    if (barcodeBoostStop[readerId]) {
      barcodeBoostStop[readerId]();
      delete barcodeBoostStop[readerId];
    }
  }

  function scanTextKey(text) {
    var raw = String(text || "").trim();
    if (!raw) return "";
    if (raw.indexOf("ATTENDIFY:v1:") === 0) return raw.slice(0, 96);
    return raw.slice(0, 140);
  }

  function createAsyncScanGate(onScan) {
    var busy = false;
    var busySince = 0;
    var lastKey = "";
    var lastAt = 0;

    return function gatedScan(text) {
      if (typeof onScan !== "function") return;
      var key = scanTextKey(text);
      if (!key) return;
      var now = Date.now();
      if (busy && now - busySince < 8000) return;
      if (key === lastKey && now - lastAt < SCAN_GATE_REPEAT_MS) return;
      lastKey = key;
      lastAt = now;
      busy = true;
      busySince = now;

      function release() {
        var elapsed = Date.now() - busySince;
        var wait = Math.max(0, SCAN_BUSY_MIN_MS - elapsed);
        global.setTimeout(function () {
          busy = false;
        }, wait);
      }

      try {
        var out = onScan(text);
        if (out && typeof out.then === "function") {
          out.then(release, release);
        } else {
          release();
        }
      } catch (e) {
        release();
      }
    };
  }

  function startBarcodeBoost(readerId, onScan) {
    readerId = readerId || "qr-reader";
    stopBarcodeBoost(readerId);
    if (typeof onScan !== "function") return;
    if (typeof global.BarcodeDetector === "undefined") return;

    var detector;
    try {
      detector = new global.BarcodeDetector({ formats: ["qr_code"] });
    } catch (e) {
      return;
    }

    var rafId = 0;
    var busy = false;
    var boostCanvas = null;
    var boostCtx = null;

    function findVideo() {
      var host = document.getElementById(readerId);
      return host ? host.querySelector("video") : null;
    }

    function pickCode(codes) {
      if (!codes || !codes.length) return "";
      var best = codes[0];
      var i;
      for (i = 1; i < codes.length; i++) {
        if ((codes[i].boundingBox && codes[i].boundingBox.width) > (best.boundingBox && best.boundingBox.width)) {
          best = codes[i];
        }
      }
      return String(best.rawValue || "").trim();
    }

    function ensureBoostCanvas() {
      if (!boostCanvas) {
        boostCanvas = document.createElement("canvas");
        boostCtx = boostCanvas.getContext("2d", { willReadFrequently: true });
      }
    }

    function drawToCanvas(ctx, video, sx, sy, sw, sh, dw, dh, opts) {
      opts = opts || {};
      ctx.imageSmoothingEnabled = opts.smooth !== false;
      if (opts.smooth === false) ctx.imageSmoothingEnabled = false;
      try {
        ctx.filter = opts.filter != null ? opts.filter : "contrast(1.22) brightness(1.04)";
      } catch (e) {}
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
      try {
        ctx.filter = "none";
      } catch (e2) {}
    }

    function detectScaled(video) {
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      var scale = Math.min(4.25, Math.max(2.2, 1720 / Math.max(vw, 320)));
      ensureBoostCanvas();
      boostCanvas.width = Math.floor(vw * scale);
      boostCanvas.height = Math.floor(vh * scale);
      if (!boostCtx) return detector.detect(video);
      drawToCanvas(boostCtx, video, 0, 0, vw, vh, boostCanvas.width, boostCanvas.height, {
        smooth: false,
        filter: "contrast(1.24) brightness(1.04)"
      });
      return detector.detect(boostCanvas);
    }

    /** Student QR on another phone screen — moire + small center box */
    function detectScreenQr(video) {
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      var inset = 0.2;
      var sx = Math.floor(vw * inset);
      var sy = Math.floor(vh * inset);
      var sw = Math.floor(vw * (1 - inset * 2));
      var sh = Math.floor(vh * (1 - inset * 2));
      var scale = Math.min(5, Math.max(3, 1920 / Math.max(sw, 180)));
      ensureBoostCanvas();
      boostCanvas.width = Math.floor(sw * scale);
      boostCanvas.height = Math.floor(sh * scale);
      if (!boostCtx) return global.Promise.resolve([]);
      drawToCanvas(boostCtx, video, sx, sy, sw, sh, boostCanvas.width, boostCanvas.height, {
        smooth: true,
        filter: "contrast(1.38) brightness(1.08) saturate(1.05)"
      });
      return detector.detect(boostCanvas);
    }

    function detectHighContrast(video) {
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      var scale = Math.min(4.5, Math.max(2.4, 1560 / Math.max(vw, 320)));
      ensureBoostCanvas();
      boostCanvas.width = Math.floor(vw * scale);
      boostCanvas.height = Math.floor(vh * scale);
      if (!boostCtx) return global.Promise.resolve([]);
      drawToCanvas(boostCtx, video, 0, 0, vw, vh, boostCanvas.width, boostCanvas.height, {
        smooth: false,
        filter: "contrast(1.52) brightness(0.98)"
      });
      return detector.detect(boostCanvas);
    }

    function detectCenterZoom(video) {
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      var inset = 0.12;
      var sx = Math.floor(vw * inset);
      var sy = Math.floor(vh * inset);
      var sw = Math.floor(vw * (1 - inset * 2));
      var sh = Math.floor(vh * (1 - inset * 2));
      var scale = Math.min(4.5, Math.max(2.8, 1580 / Math.max(sw, 220)));
      ensureBoostCanvas();
      boostCanvas.width = Math.floor(sw * scale);
      boostCanvas.height = Math.floor(sh * scale);
      if (!boostCtx) return global.Promise.resolve([]);
      drawToCanvas(boostCtx, video, sx, sy, sw, sh, boostCanvas.width, boostCanvas.height, {
        smooth: false,
        filter: "contrast(1.28) brightness(1.02)"
      });
      return detector.detect(boostCanvas);
    }

    /** Compact QR on another device, held far from the lecturer camera */
    function detectFarQr(video) {
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      if (vw < 32 || vh < 32) return global.Promise.resolve([]);
      var scale = Math.min(7, Math.max(4.2, 2600 / Math.max(vw, 240)));
      ensureBoostCanvas();
      boostCanvas.width = Math.floor(vw * scale);
      boostCanvas.height = Math.floor(vh * scale);
      if (!boostCtx) return global.Promise.resolve([]);
      drawToCanvas(boostCtx, video, 0, 0, vw, vh, boostCanvas.width, boostCanvas.height, {
        smooth: false,
        filter: "contrast(1.48) brightness(1.1) saturate(1.08)"
      });
      return detector.detect(boostCanvas);
    }

    function detectTinyCenter(video) {
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      var inset = 0.06;
      var sx = Math.floor(vw * inset);
      var sy = Math.floor(vh * inset);
      var sw = Math.floor(vw * (1 - inset * 2));
      var sh = Math.floor(vh * (1 - inset * 2));
      var scale = Math.min(7.5, Math.max(4.5, 2480 / Math.max(sw, 160)));
      ensureBoostCanvas();
      boostCanvas.width = Math.floor(sw * scale);
      boostCanvas.height = Math.floor(sh * scale);
      if (!boostCtx) return global.Promise.resolve([]);
      drawToCanvas(boostCtx, video, sx, sy, sw, sh, boostCanvas.width, boostCanvas.height, {
        smooth: false,
        filter: "contrast(1.55) brightness(1.06)"
      });
      return detector.detect(boostCanvas);
    }

    function safeDetect(promise) {
      return promise.catch(function () {
        return [];
      });
    }

    function mergeCodes(results) {
      var all = [];
      var i;
      for (i = 0; i < results.length; i++) {
        if (results[i] && results[i].length) all = all.concat(results[i]);
      }
      return all;
    }

    function detectPassChain(video) {
      return safeDetect(detector.detect(video)).then(function (codes) {
        if (codes.length) return codes;
        return global.Promise.all([
          safeDetect(detectScreenQr(video)),
          safeDetect(detectFarQr(video)),
          safeDetect(detectScaled(video)),
          safeDetect(detectHighContrast(video))
        ]).then(function (batch) {
          var merged = mergeCodes(batch);
          if (merged.length) return merged;
          return safeDetect(detectTinyCenter(video)).then(function (tiny) {
            if (tiny.length) return tiny;
            return safeDetect(detectCenterZoom(video));
          });
        });
      });
    }

    function loop() {
      rafId = global.requestAnimationFrame(loop);
      if (busy) return;
      var video = findVideo();
      if (!video || video.readyState < 2 || video.videoWidth < 32) return;
      busy = true;
      detectPassChain(video)
        .then(function (codes) {
          var text = pickCode(codes);
          if (text) onScan(text);
        })
        .catch(function () {})
        .then(function () {
          busy = false;
        });
    }

    rafId = global.requestAnimationFrame(loop);
    barcodeBoostStop[readerId] = function () {
      if (rafId) global.cancelAnimationFrame(rafId);
      rafId = 0;
      busy = false;
      boostCanvas = null;
      boostCtx = null;
    };
  }

  /** Stop scanner and clear the reader DOM so a new instance can attach. */
  function releaseCamera(scanner, readerId) {
    readerId = readerId || "qr-reader";
    stopBarcodeBoost(readerId);
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

  function isMobileDevice() {
    try {
      return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "");
    } catch (_) {
      return false;
    }
  }

  /** Phones/tablets need a tap before getUserMedia (iOS / many Android browsers). */
  function prefersTapToStartCamera() {
    return isMobileDevice();
  }

  function cameraFacingLabel(facing) {
    return facing === "user" ? "Front camera" : "Back camera";
  }

  function updateCameraFacingBadge(el, facing) {
    if (!el) return;
    el.setAttribute("data-facing", facing === "user" ? "user" : "environment");
    el.setAttribute("title", cameraFacingLabel(facing));
    el.textContent = "";
    el.setAttribute("aria-hidden", "true");
    el.classList.add("hidden");
  }

  function setFacingButtonStates(frontBtn, backBtn, facing) {
    if (frontBtn) frontBtn.setAttribute("aria-hidden", "true");
    if (backBtn) backBtn.setAttribute("aria-hidden", "true");
  }

  function whenHtml5QrcodeReady(callback, timeoutMs) {
    timeoutMs = timeoutMs == null ? 10000 : timeoutMs;
    var started = Date.now();
    (function tick() {
      if (typeof Html5Qrcode !== "undefined") {
        if (callback) callback(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        if (callback) callback(false);
        return;
      }
      setTimeout(tick, 25);
    })();
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
        width: Math.max(220, Math.floor(w)),
        height: Math.max(160, Math.floor(h))
      };
    }
    var edge = Math.min(w, h);
    var size = Math.max(220, Math.floor(edge * 0.94));
    return { width: size, height: size };
  }

  /** @param {{ fullFrame?: boolean, compactQrbox?: boolean }} options */
  function getCameraConfig(options) {
    options = options || {};
    var cfg = {
      fps: 60,
      disableFlip: false
    };
    var useFullFrame = options.compactQrbox ? false : options.fullFrame !== false;
    if (useFullFrame || options.compactQrbox) {
      cfg.qrbox = function (viewfinderWidth, viewfinderHeight) {
        return qrboxSizing(viewfinderWidth, viewfinderHeight, useFullFrame);
      };
    }
    if (typeof Html5QrcodeSupportedFormats !== "undefined") {
      cfg.formatsToSupport = [Html5QrcodeSupportedFormats.QR_CODE];
    }
    return cfg;
  }

  function softVideoResolution(constraint) {
    var base =
      constraint && typeof constraint === "object" ? Object.assign({}, constraint) : { facingMode: constraint || "environment" };
    base.width = { ideal: 1920, min: 640 };
    base.height = { ideal: 1080, min: 480 };
    base.focusMode = { ideal: "continuous" };
    base.frameRate = { ideal: 30, min: 15, max: 30 };
    try {
      base.advanced = [{ focusMode: "continuous" }];
    } catch (e) {}
    return base;
  }

  function buildCameraStartPlans(facing) {
    var primary = facing === "user" ? "user" : "environment";
    var alt = primary === "user" ? "environment" : "user";
    var plans = [
      {
        video: softVideoResolution({ facingMode: { ideal: primary } }),
        config: getCameraConfig({}),
        experimental: true
      },
      { video: { facingMode: { ideal: primary } }, config: getCameraConfig({}), experimental: true },
      { video: { facingMode: primary }, config: getCameraConfig({}), experimental: true },
      {
        video: softVideoResolution({ facingMode: { ideal: alt } }),
        config: getCameraConfig({}),
        experimental: true
      },
      {
        video: softVideoResolution({ facingMode: primary }),
        config: getCameraConfig({ compactQrbox: true }),
        experimental: false
      }
    ];
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
    var gatedOnScan = createAsyncScanGate(onScan);
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
        .start(plan.video, plan.config, gatedOnScan, function () {})
        .then(function () {
          var host = document.getElementById(readerId);
          armReaderForDarkModeSafe(host);
          if (host) {
            host.querySelectorAll("video, canvas, img").forEach(function (node) {
              node.style.filter = "none";
              node.style.webkitFilter = "none";
              node.style.colorScheme = "light";
            });
          }
          startBarcodeBoost(readerId, gatedOnScan);
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

  var liveScanOpenCount = 0;

  function isLiveScanPage() {
    return liveScanOpenCount > 0;
  }

  function setScanCameraExpanded(expanded) {
    var shell = document.getElementById("scan-camera-shell");
    var openBtn = document.getElementById("btn-open-camera");
    if (shell) shell.classList.toggle("hidden", !expanded);
    if (openBtn) openBtn.classList.toggle("hidden", expanded);
  }

  function beginLiveScanSession() {
    liveScanOpenCount += 1;
  }

  function endLiveScanSession() {
    liveScanOpenCount = Math.max(0, liveScanOpenCount - 1);
  }

  function prepareManualFirstScan() {
    setScanCameraExpanded(false);
  }

  function bindOpenCameraButton(btnId, onOpen) {
    var btn = document.getElementById(btnId || "btn-open-camera");
    if (!btn || btn._scanOpenBound) return;
    btn._scanOpenBound = true;
    btn.addEventListener("click", function () {
      setScanCameraExpanded(true);
      if (typeof onOpen === "function") onOpen();
    });
  }

  global.AttendifyScannerHud = {
    isLiveScanPage: isLiveScanPage,
    beginLiveScanSession: beginLiveScanSession,
    endLiveScanSession: endLiveScanSession,
    setScanCameraExpanded: setScanCameraExpanded,
    prepareManualFirstScan: prepareManualFirstScan,
    bindOpenCameraButton: bindOpenCameraButton,
    SCAN_DEDUPE_MS: SCAN_DEDUPE_MS,
    SCAN_GATE_REPEAT_MS: SCAN_GATE_REPEAT_MS,
    createAsyncScanGate: createAsyncScanGate,
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
    startQrCamera: startQrCamera,
    isMobileDevice: isMobileDevice,
    prefersTapToStartCamera: prefersTapToStartCamera,
    whenHtml5QrcodeReady: whenHtml5QrcodeReady,
    cameraFacingLabel: cameraFacingLabel,
    updateCameraFacingBadge: updateCameraFacingBadge,
    setFacingButtonStates: setFacingButtonStates
  };
})(window);
