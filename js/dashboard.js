var scannerModal = document.getElementById("scannerModal");
var scannerTitle = document.getElementById("scannerTitle");
var scanStatus = document.getElementById("scan-status");
var activeClassId = "bsc-cs";
var activeLectureTitle = "";
var activeWeek = null;
var activeCourseId = "";
var activeSessionId = null;
var activeTeachLevel = "";
var scanner = null;
var lastCode = "";
var lastScanAt = 0;
var cameraFacing = "environment";
var cameraStarting = false;

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function avatarCell(student) {
  return Attendify.avatarMarkup(student, "w-8 h-8", "");
}

function removeScanForStudent(studentId) {
  Attendify.removeAttendance(activeClassId, studentId, activeLectureTitle, activeWeek, activeCourseId).then(function (result) {
    if (!result.ok) return;
    AttendifyScannerHud.hideVerified();
    renderLive();
    renderDashboard();
  });
}

function renderLive() {
  var rows = Attendify.attendanceRows(activeClassId, activeLectureTitle, activeWeek);
  AttendifyScannerHud.renderRecent(rows, removeScanForStudent);
}

function handleScanResult(result) {
  if (result && result.ok && result.student && Attendify.mergeStudentIntoCache) {
    Attendify.mergeStudentIntoCache(result.student);
  }
  if (!result.ok) {
    if (
      window.AttendifyScannerHud &&
      AttendifyScannerHud.isUnregisteredScan &&
      AttendifyScannerHud.isUnregisteredScan(result)
    ) {
      AttendifyScannerHud.showUnknown();
      return;
    }
    if (result.error === "session_closed" && window.AttendifyScannerHud && AttendifyScannerHud.showScanMessage) {
      AttendifyScannerHud.showScanMessage(
        result.message || "Attendance for this week has ended.",
        "warning",
        true
      );
      setTimeout(closeScannerModal, 2700);
      return;
    }
    var msg = result.message || result.error || "Could not record this scan.";
    if (window.AttendifyScannerHud && AttendifyScannerHud.showScanMessage) {
      AttendifyScannerHud.showScanMessage(msg, "error", true);
    } else if (window.AttendifyScannerHud && AttendifyScannerHud.playError) {
      AttendifyScannerHud.playError();
    }
    return;
  }
  renderLive();
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(function () {
      renderDashboard();
    });
  } else {
    renderDashboard();
  }
  AttendifyScannerHud.showVerified(result.student, result.record.scannedAt, result.duplicate);
  var undoBtn = document.getElementById("scan-hud-undo");
  if (undoBtn) {
    undoBtn.onclick = function () {
      removeScanForStudent(result.student.id);
    };
  }
}

function scanDedupeMs() {
  return (window.AttendifyScannerHud && AttendifyScannerHud.SCAN_DEDUPE_MS) || 260;
}

function onScan(text) {
  var parsed = Attendify.parseQr(text);
  var qrToken = parsed && parsed.qrToken ? parsed.qrToken : null;
  var index = parsed && parsed.index ? parsed.index : !qrToken ? text : null;
  return Attendify.markPresent(activeClassId, index, qrToken, activeLectureTitle, activeWeek).then(handleScanResult);
}

function persistLiveScanFromDashboard() {
  if (!Attendify.saveLiveScanSession || !activeClassId) return;
  Attendify.saveLiveScanSession({
    source: "dashboard",
    classId: activeClassId,
    courseId: activeCourseId || "",
    weekNumber: activeWeek,
    lectureName: activeLectureTitle,
    sessionId: activeSessionId || null,
    teachLevel: activeTeachLevel || "",
    returnUrl: "dashboard.html"
  });
}

function submitManualIndexSuffix() {
  var errEl = document.getElementById("manual-index-error");
  var input = document.getElementById("manual-index-suffix");
  if (errEl) errEl.classList.add("hidden");
  var resolved = Attendify.resolveStudentIndexSuffix(
    activeClassId,
    input ? input.value : "",
    activeTeachLevel
  );
  if (!resolved.ok) {
    if (errEl) errEl.classList.add("hidden");
    if (window.AttendifyScannerHud && AttendifyScannerHud.showUnknown) {
      AttendifyScannerHud.showUnknown();
    }
    return;
  }
  Attendify.markPresent(activeClassId, resolved.index, null, activeLectureTitle, activeWeek).then(function (result) {
    if (result.ok && input) {
      input.value = "";
      input.focus();
    }
    handleScanResult(result);
  });
}

function hudScanMessage(text, kind, playErr) {
  if (window.AttendifyScannerHud && AttendifyScannerHud.showScanMessage) {
    AttendifyScannerHud.showScanMessage(text, kind || "info", playErr !== false);
  }
}

function stopCamera() {
  var current = scanner;
  scanner = null;
  cameraStarting = false;
  if (window.AttendifyScannerHud && AttendifyScannerHud.releaseCamera) {
    return AttendifyScannerHud.releaseCamera(current, "qr-reader");
  }
  if (current && current.isScanning) {
    return current
      .stop()
      .then(function () {
        return current.clear();
      })
      .catch(function () {});
  }
  return Promise.resolve();
}

function startCamera() {
  if (cameraStarting) return;
  if (typeof Html5Qrcode === "undefined") {
    hudScanMessage("Scanner library did not load.", "error", true);
    return;
  }
  if (window.AttendifyScannerHud && AttendifyScannerHud.isCameraContextOk && !AttendifyScannerHud.isCameraContextOk()) {
    hudScanMessage(
      AttendifyScannerHud.cameraContextHint ? AttendifyScannerHud.cameraContextHint() : "Camera not available in this context.",
      "warning",
      true
    );
    return;
  }
  var Hud = window.AttendifyScannerHud;
  if (!Hud || !Hud.startQrCamera) {
    hudScanMessage("Scanner failed to initialize.", "error", true);
    return;
  }
  cameraStarting = true;
  var facing = cameraFacing === "environment" ? "environment" : "user";
  stopCamera()
    .then(function () {
      return Hud.startQrCamera({
        readerId: "qr-reader",
        facing: facing,
        onScan: onScan,
        onScanner: function (instance) {
          scanner = instance;
        }
      });
    })
    .then(function (result) {
      cameraStarting = false;
      if (result && result.facing) cameraFacing = result.facing;
      syncFacingUi();
    })
    .catch(function () {
      cameraStarting = false;
      scanner = null;
      hudScanMessage(
        Hud.cameraContextHint ? Hud.cameraContextHint() : "Camera unavailable. Use manual entry or tap ↻ to retry.",
        "warning",
        true
      );
    });
}

function syncFacingUi() {
  var Hud = window.AttendifyScannerHud;
  if (!Hud) return;
  if (Hud.setFacingButtonStates) {
    Hud.setFacingButtonStates(null, null, cameraFacing);
  }
}

function applyCameraFacing(next) {
  var want = next === "user" ? "user" : "environment";
  if (!scanner && !cameraStarting) {
    cameraFacing = want;
    syncFacingUi();
    startCamera();
    return;
  }
  if (cameraFacing === want) return;
  cameraFacing = want;
  syncFacingUi();
  stopCamera().then(function () {
    setTimeout(startCamera, 80);
  });
}

function flipCamera() {
  var shell = document.getElementById("scan-camera-shell");
  if (shell && shell.classList.contains("hidden")) {
    launchScannerCamera();
    return;
  }
  if (!scanner && !cameraStarting) {
    launchScannerCamera();
    return;
  }
  applyCameraFacing(cameraFacing === "environment" ? "user" : "environment");
}

function openScannerCameraAfterLayout() {
  var Hud = window.AttendifyScannerHud;
  if (Hud && Hud.prepareManualFirstScan) Hud.prepareManualFirstScan();
  stopCamera();
}

function launchScannerCamera() {
  var Hud = window.AttendifyScannerHud;
  if (Hud && Hud.setScanCameraExpanded) Hud.setScanCameraExpanded(true);
  stopCamera().then(function () {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        function runStart() {
          startCamera();
        }
        if (Hud && Hud.whenHtml5QrcodeReady) {
          Hud.whenHtml5QrcodeReady(function (ok) {
            if (!ok) {
              hudScanMessage("Scanner is still loading. Tap Open camera again.", "warning", false);
              return;
            }
            setTimeout(runStart, 80);
          });
        } else {
          runStart();
        }
      });
    });
  });
}

function openScannerModal(classId, lectureName, options) {
  options = options || {};
  var programme = Attendify.classById(classId);
  if (!programme) return;
  activeClassId = programme.id;
  activeLectureTitle = String(lectureName || "").trim();
  activeWeek =
    options.weekNumber != null && options.weekNumber !== ""
      ? Number(options.weekNumber)
      : Attendify.semesterInfo().currentWeek || 1;
  activeCourseId = options.courseId ? String(options.courseId) : "";
  activeSessionId = options.sessionId || null;
  activeTeachLevel =
    options.teachLevel != null && options.teachLevel !== "" ? String(options.teachLevel) : "";
  Attendify.setActiveLectureName(activeLectureTitle);
  Attendify.setActiveWeekNumber(activeWeek);
  Attendify.setActiveCourseId(activeCourseId);
  scannerTitle.textContent = activeLectureTitle + " · Week " + activeWeek;
  document.getElementById("scanner-programme-label").textContent = programme.name;
  var rosterBtn = document.getElementById("btn-view-roster");
  if (rosterBtn) {
    var rosterUrl = "programme.html?programme=" + encodeURIComponent(activeClassId);
    if (options.teachLevel != null && options.teachLevel !== "") {
      rosterUrl += "&level=" + encodeURIComponent(String(options.teachLevel));
    }
    rosterBtn.href = rosterUrl;
  }
  var shareBtn = document.getElementById("btn-share-access");
  if (shareBtn) shareBtn.classList.remove("hidden");
  scannerModal.classList.remove("hidden");
  if (AttendifyScannerHud.beginLiveScanSession) AttendifyScannerHud.beginLiveScanSession();
  AttendifyScannerHud.hideVerified();
  renderLive();
  openScannerCameraAfterLayout();

  if (options.showShareModalImmediately) {
    setTimeout(openTaShareModal, 350);
  }
  persistLiveScanFromDashboard();
  var manualErr = document.getElementById("manual-index-error");
  var manualInput = document.getElementById("manual-index-suffix");
  if (manualErr) manualErr.classList.add("hidden");
  if (manualInput) manualInput.value = "";
}

var currentTaShareUrl = "";

function setTaShareLinkText(msg) {
  var span = document.getElementById("ta-share-link-text");
  if (span) span.textContent = msg;
  else {
    var anchor = document.getElementById("ta-share-link-anchor");
    if (anchor) anchor.textContent = msg;
  }
}

function openTaShareModal() {
  var modal = document.getElementById("taShareModal");
  if (!modal) return;
  var input = document.getElementById("ta-share-link");
  var anchor = document.getElementById("ta-share-link-anchor");
  var qrContainer = document.getElementById("ta-share-qr");
  var copiedMsg = document.getElementById("ta-share-copied");
  if (copiedMsg) copiedMsg.classList.add("hidden");
  currentTaShareUrl = "";
  if (input) input.value = "Generating TA link...";
  setTaShareLinkText("Generating TA link...");
  if (anchor) anchor.removeAttribute("href");
  if (qrContainer) {
    qrContainer.innerHTML = '<div class="w-5 h-5 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin"></div>';
  }
  modal.classList.remove("hidden");

  var sid = activeSessionId;
  if (!sid) {
    var sess = Attendify.activeSessionFor(activeClassId, activeLectureTitle, activeWeek);
    if (sess) sid = sess.sessionId;
  }

  if (!sid) {
    if (input) input.value = "Could not find active session ID.";
    setTaShareLinkText("Could not find active session ID.");
    return;
  }

  Attendify.createTaShareLink(activeClassId, sid).then(function (res) {
    if (!res.ok) {
      var err = res.error || "Failed to generate link.";
      if (input) input.value = err;
      setTaShareLinkText(err);
      return;
    }
    currentTaShareUrl = res.url;
    var label = res.displayUrl || (Attendify.displayShareUrl ? Attendify.displayShareUrl(res.url) : res.url);
    if (input) input.value = res.url;
    setTaShareLinkText(label);
    if (anchor) anchor.href = res.url;
    var openBtn = document.getElementById("ta-share-open");
    if (openBtn) {
      openBtn.href = res.url;
      openBtn.classList.remove("pointer-events-none", "opacity-50");
    }
    if (qrContainer && Attendify.drawBrandedShareQr) {
      Attendify.drawBrandedShareQr(qrContainer, res.url, null, "attendify-ta-scanner.png", {
        size: 156,
        avatar: 38
      });
    }
  }).catch(function () {
    if (input) input.value = "Error generating link.";
    setTaShareLinkText("Error generating link.");
  });
}

function fillStartAttendanceCourseSelect(classId) {
  var sel = document.getElementById("start-attendance-course");
  var emptyMsg = document.getElementById("start-attendance-no-courses");
  var submitBtn = document.querySelector("#start-attendance-form button[type=submit]");
  if (!sel) return;
  var courses = Attendify.coursesForProgramme(classId);
  if (!courses.length) {
    sel.innerHTML = '<option value="">No courses yet</option>';
    sel.disabled = true;
    if (emptyMsg) emptyMsg.classList.remove("hidden");
    if (submitBtn) submitBtn.disabled = true;
    return;
  }
  sel.disabled = false;
  if (submitBtn) submitBtn.disabled = false;
  if (emptyMsg) emptyMsg.classList.add("hidden");
  sel.innerHTML =
    '<option value="" disabled selected>Select a course</option>' +
    courses
      .map(function (course) {
        return (
          '<option value="' +
          esc(course.id) +
          '">' +
          esc(course.code) +
          " · " +
          esc(course.name) +
          "</option>"
        );
      })
      .join("");
}

function openStartAttendanceModal(classId, teachLevel) {
  var programme = Attendify.classById(classId, teachLevel);
  if (!programme) return;
  document.getElementById("start-programme-name").textContent = programme.name;
  document.getElementById("start-programme-code").textContent = programme.code;
  var levelEl = document.getElementById("start-programme-level");
  if (levelEl) {
    if (programme.teachLevel != null && programme.teachLevel !== "") {
      levelEl.textContent = " · Level " + programme.teachLevel;
      levelEl.classList.remove("hidden");
    } else {
      levelEl.textContent = "";
      levelEl.classList.add("hidden");
    }
  }
  fillStartAttendanceCourseSelect(programme.id);
  var weekEl = document.getElementById("start-attendance-week");
  if (weekEl) weekEl.value = String(Attendify.semesterInfo().currentWeek || 1);
  document.getElementById("start-attendance-error").classList.add("hidden");
  var modal = document.getElementById("startAttendanceModal");
  modal.dataset.programmeId = programme.id;
  if (programme.teachLevel != null && programme.teachLevel !== "") {
    modal.dataset.teachLevel = String(programme.teachLevel);
  } else {
    delete modal.dataset.teachLevel;
  }
  modal.classList.remove("hidden");
  var courseEl = document.getElementById("start-attendance-course");
  setTimeout(function () {
    if (courseEl && !courseEl.disabled) courseEl.focus();
  }, 100);
}

function fillWeekSelect(selectId) {
  var el = document.getElementById(selectId);
  if (!el || el.options.length) return;
  var total = Attendify.semesterInfo().totalWeeks || 15;
  var html = "";
  var w;
  for (w = 1; w <= total; w++) {
    html += '<option value="' + w + '">Week ' + w + "</option>";
  }
  el.innerHTML = html;
}

function closeStartAttendanceModal() {
  document.getElementById("startAttendanceModal").classList.add("hidden");
}

function closeScannerModal() {
  stopCamera();
  if (window.AttendifyScannerHud && AttendifyScannerHud.prepareManualFirstScan) {
    AttendifyScannerHud.prepareManualFirstScan();
  }
  if (window.AttendifyScannerHud && AttendifyScannerHud.endLiveScanSession) {
    AttendifyScannerHud.endLiveScanSession();
  }
  scannerModal.classList.add("hidden");
  persistLiveScanFromDashboard();
}

function defaultClassId() {
  var state = Attendify.load();
  return state.activeClassId || (state.classes[0] && state.classes[0].id) || "cs101";
}

var openScannerBtn = document.getElementById("btn-open-scanner");
if (openScannerBtn) {
  openScannerBtn.addEventListener("click", function () {
    openStartAttendanceModal(defaultClassId());
  });
}

document.getElementById("start-attendance-cancel").addEventListener("click", closeStartAttendanceModal);
document.getElementById("startAttendanceModal").addEventListener("click", function (event) {
  if (event.target.id === "startAttendanceModal") closeStartAttendanceModal();
});
document.getElementById("start-attendance-form").addEventListener("submit", function (event) {
  event.preventDefault();
  var courseId = document.getElementById("start-attendance-course").value;
  var week = Number(document.getElementById("start-attendance-week").value) || Attendify.semesterInfo().currentWeek || 1;
  var err = document.getElementById("start-attendance-error");
  var course = Attendify.courseById(courseId);
  if (!courseId || !course) {
    err.textContent = "Select a course created under this programme.";
    err.classList.remove("hidden");
    return;
  }
  if (Attendify.isCourseWeekSessionClosed && Attendify.isCourseWeekSessionClosed(modalProgrammeId(), course, week)) {
    err.textContent = "Attendance for Week " + week + " has already ended for this course.";
    err.classList.remove("hidden");
    return;
  }
  err.classList.add("hidden");
  var modal = document.getElementById("startAttendanceModal");
  var programmeId = modal.dataset.programmeId || defaultClassId();
  var teachLevel = modal.dataset.teachLevel || "";
  Attendify.startAttendanceSession(programmeId, null, { courseId: courseId, weekNumber: week }).then(function (result) {
    if (!result.ok) {
      err.textContent =
        result.message ||
        (result.error === "session_closed"
          ? "Attendance for this week has ended."
          : result.error || "Could not start session.");
      err.classList.remove("hidden");
      return;
    }
    closeStartAttendanceModal();
    renderDashboard();
    openScannerModal(programmeId, result.lectureName || Attendify.courseLectureLabel(course), {
      weekNumber: week,
      courseId: courseId,
      sessionId: result.sessionId,
      teachLevel: teachLevel,
      showShareModalImmediately: true
    });
  });
});

function modalProgrammeId() {
  var modal = document.getElementById("startAttendanceModal");
  return (modal && modal.dataset.programmeId) || defaultClassId();
}

var classCardsHost = document.getElementById("dashboard-class-cards");
if (classCardsHost) {
  classCardsHost.addEventListener("click", function (event) {
    var progMenuToggle = event.target.closest("[data-action=programme-menu-toggle]");
    if (progMenuToggle) {
      event.stopPropagation();
      var progMenuId = progMenuToggle.getAttribute("data-menu-id");
      var progPanel = progMenuId ? document.getElementById(progMenuId) : null;
      if (!progPanel) return;
      var progWillOpen = progPanel.classList.contains("hidden");
      closeAllProgrammeMenus();
      closeAllCourseMenus();
      if (progWillOpen) progPanel.classList.remove("hidden");
      return;
    }
    var editProg = event.target.closest("[data-action=edit-programme]");
    if (editProg) {
      event.stopPropagation();
      closeAllProgrammeMenus();
      openEditProgrammeModal(editProg.getAttribute("data-class-id"));
      return;
    }
    var deleteProg = event.target.closest("[data-action=delete-programme]");
    if (deleteProg) {
      event.stopPropagation();
      closeAllProgrammeMenus();
      var progCode = deleteProg.getAttribute("data-programme-code") || "this programme";
      if (
        !window.confirm(
          "Delete programme “" +
            progCode +
            "”? This removes students and attendance tied to this programme on the server."
        )
      ) {
        return;
      }
      Attendify.deleteProgramme(deleteProg.getAttribute("data-class-id")).then(function (result) {
        if (!result.ok) {
          window.alert(result.error || "Could not delete the programme.");
          return;
        }
        renderDashboard();
        if (window.AttendifySidebar && AttendifySidebar.refresh) AttendifySidebar.refresh();
      });
      return;
    }
    var courseMenuToggle = event.target.closest("[data-action=course-menu-toggle]");
    if (courseMenuToggle) {
      event.stopPropagation();
      var courseMenuId = courseMenuToggle.getAttribute("data-menu-id");
      var coursePanel = courseMenuId ? document.getElementById(courseMenuId) : null;
      if (!coursePanel) return;
      var courseWillOpen = coursePanel.classList.contains("hidden");
      closeAllProgrammeMenus();
      closeAllCourseMenus();
      if (courseWillOpen) coursePanel.classList.remove("hidden");
      return;
    }
    var editCourse = event.target.closest("[data-action=edit-course]");
    if (editCourse) {
      event.stopPropagation();
      closeAllCourseMenus();
      if (window.AttendifySidebar && AttendifySidebar.openEditCourseModal) {
        AttendifySidebar.openEditCourseModal(
          editCourse.getAttribute("data-class-id"),
          editCourse.getAttribute("data-course-id")
        );
      }
      return;
    }
    var deleteCourse = event.target.closest("[data-action=delete-course]");
    if (deleteCourse) {
      event.stopPropagation();
      closeAllCourseMenus();
      var courseCode = deleteCourse.getAttribute("data-course-code") || "this course";
      if (!window.confirm("Delete course “" + courseCode + "”?")) return;
      Attendify.deleteProgrammeCourse(deleteCourse.getAttribute("data-course-id")).then(function (result) {
        if (!result.ok) {
          window.alert(result.error || "Could not delete the course.");
          return;
        }
        renderDashboard();
        if (window.AttendifySidebar && AttendifySidebar.refresh) AttendifySidebar.refresh();
        window.dispatchEvent(new CustomEvent("attendify:course-deleted"));
      });
      return;
    }
    var toggleCourses = event.target.closest("[data-action=toggle-card-courses]");
    if (toggleCourses) {
      var cidToggle = toggleCourses.getAttribute("data-class-id");
      var prefixToggle = toggleCourses.getAttribute("data-card-prefix") || cardPrefix(cidToggle);
      var teachToggle = toggleCourses.getAttribute("data-teach-level");
      var listEl = document.getElementById(prefixToggle + "-courses-list");
      var chev = toggleCourses.querySelector("[data-chevron]");
      var open = listEl && listEl.classList.contains("hidden");
      if (listEl) listEl.classList.toggle("hidden", !open);
      if (chev) chev.classList.toggle("rotate-180", open);
      sessionStorage.setItem(
        "attendify-card-courses-" + cardCoursesStorageKey(cidToggle, teachToggle),
        open ? "1" : "0"
      );
      toggleCourses.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }
    var addCourseBtn = event.target.closest("[data-action=add-course-card]");
    if (addCourseBtn) {
      event.stopPropagation();
      var cidAdd = addCourseBtn.getAttribute("data-class-id");
      if (window.AttendifySidebar && AttendifySidebar.openCreateCourseModal) {
        AttendifySidebar.openCreateCourseModal(cidAdd);
      }
      return;
    }
    var button = event.target.closest("[data-action=scan]");
    if (!button) return;
    openStartAttendanceModal(button.getAttribute("data-class-id"), button.getAttribute("data-teach-level"));
  });
}

document.getElementById("btn-close-scanner").addEventListener("click", closeScannerModal);
var shareAccessBtn = document.getElementById("btn-share-access");
if (shareAccessBtn) shareAccessBtn.addEventListener("click", openTaShareModal);

var taShareClose = document.getElementById("ta-share-close");
if (taShareClose) {
  taShareClose.addEventListener("click", function () {
    document.getElementById("taShareModal").classList.add("hidden");
  });
}

var taShareModalEl = document.getElementById("taShareModal");
if (taShareModalEl) {
  taShareModalEl.addEventListener("click", function (event) {
    if (event.target.id === "taShareModal") {
      taShareModalEl.classList.add("hidden");
    }
  });
}

var taShareCopyBtn = document.getElementById("ta-share-copy");
if (taShareCopyBtn) {
  taShareCopyBtn.addEventListener("click", function () {
    var linkInput = document.getElementById("ta-share-link");
    var anchor = document.getElementById("ta-share-link-anchor");
    var urlToCopy = currentTaShareUrl || (anchor && anchor.href && anchor.href.indexOf("http") === 0 ? anchor.href : "") || (linkInput ? linkInput.value : "");
    if (!urlToCopy || urlToCopy.indexOf("http") !== 0) return;
    var copiedMsg = document.getElementById("ta-share-copied");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(urlToCopy).then(function () {
        if (copiedMsg) copiedMsg.classList.remove("hidden");
        setTimeout(function () { if (copiedMsg) copiedMsg.classList.add("hidden"); }, 3000);
      }).catch(function () {
        if (copiedMsg) copiedMsg.classList.remove("hidden");
        setTimeout(function () { if (copiedMsg) copiedMsg.classList.add("hidden"); }, 3000);
      });
    } else {
      if (copiedMsg) copiedMsg.classList.remove("hidden");
      setTimeout(function () { if (copiedMsg) copiedMsg.classList.add("hidden"); }, 3000);
    }
  });
}

document.getElementById("btn-save-session").addEventListener("click", function () {
  Attendify.closeAttendanceSession(activeClassId, activeLectureTitle, activeWeek, activeCourseId || null).then(function () {
    if (Attendify.clearLiveScanSession) Attendify.clearLiveScanSession();
    closeScannerModal();
    renderDashboard();
  });
});
var manualIndexForm = document.getElementById("manual-index-form");
if (manualIndexForm) {
  manualIndexForm.addEventListener("submit", function (event) {
    event.preventDefault();
    submitManualIndexSuffix();
  });
}
var viewRosterBtn = document.getElementById("btn-view-roster");
if (viewRosterBtn) {
  viewRosterBtn.addEventListener("click", function () {
    persistLiveScanFromDashboard();
  });
}
document.getElementById("btn-scan-flip").addEventListener("click", flipCamera);
if (window.AttendifyScannerHud && AttendifyScannerHud.bindOpenCameraButton) {
  AttendifyScannerHud.bindOpenCameraButton("btn-open-camera", launchScannerCamera);
}
syncFacingUi();

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") closeScannerModal();
});

var scanSvg =
  '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>';

function cardPrefix(course) {
  var classId = typeof course === "object" && course ? course.id : course;
  var lvl =
    typeof course === "object" && course && course.teachLevel != null ? String(course.teachLevel) : "";
  var base = String(classId || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  return lvl ? "card-" + base + "_L" + lvl : "card-" + base;
}

function programmeHref(classId, teachLevel) {
  var url = "programme.html?programme=" + encodeURIComponent(classId);
  if (teachLevel != null && teachLevel !== "") url += "&level=" + encodeURIComponent(String(teachLevel));
  return url;
}

function cardCoursesStorageKey(classId, teachLevel) {
  var key = String(classId || "");
  if (teachLevel != null && teachLevel !== "") key += "_L" + teachLevel;
  return key;
}

function isCardCoursesOpen(classId, teachLevel) {
  return sessionStorage.getItem("attendify-card-courses-" + cardCoursesStorageKey(classId, teachLevel)) === "1";
}

var menuDotsSvg =
  '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>';

function closeAllProgrammeMenus() {
  document.querySelectorAll("[data-programme-menu]").forEach(function (el) {
    el.classList.add("hidden");
  });
}

function closeAllCourseMenus() {
  document.querySelectorAll("[data-course-menu]").forEach(function (el) {
    el.classList.add("hidden");
  });
}

function openEditProgrammeModal(programmeId) {
  closeAllProgrammeMenus();
  var programme = Attendify.classById(programmeId);
  if (!programme) return;
  document.getElementById("edit-programme-id").value = programme.id;
  document.getElementById("edit-programme-code").value = programme.code;
  document.getElementById("edit-programme-name").value = programme.name;
  document.getElementById("edit-programme-error").classList.add("hidden");
  document.getElementById("editProgrammeModal").classList.remove("hidden");
}

function closeEditProgrammeModal() {
  document.getElementById("editProgrammeModal").classList.add("hidden");
}

function renderProgrammeCoursesList(classId, prefix, teachLevel) {
  var host = document.getElementById(prefix + "-courses-list");
  if (!host) return;
  var courses = Attendify.coursesForProgramme(classId);
  if (!courses.length) {
    host.innerHTML =
      '<li class="text-[11px] text-slate-400 italic px-1 py-0.5">No courses yet. Use + in the sidebar or on this card.</li>';
    return;
  }
  host.innerHTML = courses
    .map(function (course) {
      var href =
        "course.html?programme=" + encodeURIComponent(classId) + "&course=" + encodeURIComponent(course.id);
      if (teachLevel != null && teachLevel !== "") {
        href += "&level=" + encodeURIComponent(String(teachLevel));
      }
      var menuId = prefix + "-course-menu-" + String(course.id).replace(/[^a-zA-Z0-9_-]/g, "_");
      var cstats = Attendify.courseStats(classId, course.id);
      var takenLine =
        cstats.weeksWithAttendance > 0
          ? cstats.weeksWithAttendance +
            "/" +
            cstats.semesterWeeks +
            " wks · " +
            cstats.attendanceRecords +
            " taken"
          : "No attendance yet";
      return (
        '<li class="flex items-center gap-0.5">' +
        '<a href="' +
        esc(href) +
        '" class="flex-1 min-w-0 block rounded-md px-2 py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 border border-transparent hover:border-brand-100 transition">' +
        '<span class="font-mono text-slate-600">' +
        esc(course.code) +
        "</span> · " +
        esc(course.name) +
        '<span class="block text-[10px] font-medium text-slate-500 mt-0.5">' +
        esc(takenLine) +
        "</span></a>" +
        '<div class="relative shrink-0 pr-0.5">' +
        '<button type="button" data-action="course-menu-toggle" data-menu-id="' +
        esc(menuId) +
        '" class="w-6 h-6 rounded text-slate-400 hover:text-brand-800 hover:bg-slate-100 flex items-center justify-center" aria-label="Course options">' +
        menuDotsSvg +
        "</button>" +
        '<div id="' +
        esc(menuId) +
        '" data-course-menu class="hidden absolute right-0 top-full mt-0.5 z-30 min-w-[7rem] py-1 rounded-lg border border-slate-200 bg-white shadow-lg text-left">' +
        '<button type="button" data-action="edit-course" data-class-id="' +
        esc(classId) +
        '" data-course-id="' +
        esc(course.id) +
        '" class="block w-full text-left px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">Edit</button>' +
        '<button type="button" data-action="delete-course" data-class-id="' +
        esc(classId) +
        '" data-course-id="' +
        esc(course.id) +
        '" data-course-code="' +
        esc(course.code) +
        '" class="block w-full text-left px-3 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50">Delete</button>' +
        "</div></div></li>"
      );
    })
    .join("");
}

function renderClassCardStats(course, prefix) {
  var classId = course.id;
  var level = course.teachLevel;
  var stats = Attendify.classStats(classId, level);
  var courseTotal = Attendify.coursesForProgramme(classId).length;
  var enrolled = document.getElementById(prefix + "-enrolled");
  var courseCount = document.getElementById(prefix + "-course-count");
  var coursesBadge = document.getElementById(prefix + "-courses-count");
  var sessions = document.getElementById(prefix + "-sessions");
  var attendance = document.getElementById(prefix + "-attendance");
  var rate = document.getElementById(prefix + "-rate");
  var roster = document.getElementById(prefix + "-roster");
  if (enrolled) enrolled.textContent = String(stats.enrolled);
  if (courseCount) courseCount.textContent = String(courseTotal);
  if (coursesBadge) coursesBadge.textContent = String(courseTotal);
  if (sessions) {
    sessions.textContent = "…";
    sessions.title = "Roll-call weeks are shown on each course below";
  }
  if (attendance) {
    attendance.textContent = "…";
    attendance.title = "Attendance marks are shown on each course below";
  }
  if (roster) roster.title = stats.enrolled + " students enrolled";
  if (!rate) return;
  var inner = rate.querySelector("span");
  var val = "…";
  if (stats.turnoutToday != null && stats.enrolled > 0) val = stats.turnoutToday + "%";
  if (inner) inner.textContent = val;
  else rate.textContent = val;
  renderProgrammeCoursesList(classId, prefix, level);
}

function buildClassCardMarkup(course, index) {
  var prefix = cardPrefix(course);
  var progUrl = programmeHref(course.id, course.teachLevel);
  var levelBadge =
    course.teachLevel != null
      ? '<span class="inline-block ml-1 text-[10px] font-bold uppercase tracking-wide text-tealAccent-700 bg-tealAccent-50 border border-tealAccent-200 px-1.5 py-0.5 rounded">L' +
        esc(String(course.teachLevel)) +
        "</span>"
      : "";
  var topAccent = index === 0 ? " border-t-2 border-t-tealAccent-500" : "";
  var scanBtn = index % 2 === 0 ? "bg-tealAccent-600 hover:bg-tealAccent-700" : "bg-brand-600 hover:bg-brand-700";
  var rateColor = index % 2 === 0 ? "text-emerald-600" : "text-tealAccent-600";
  var badge = index % 2 === 0
    ? "bg-brand-50 text-brand-700 border-brand-100"
    : "bg-slate-100 text-slate-700 border-slate-200";
  var menuId = prefix + "-programme-menu";
  var coursesOpen = isCardCoursesOpen(course.id, course.teachLevel);
  return (
    '<article class="dashboard-prog-card relative w-full bg-white border border-slate-200/90' + topAccent + ' shadow-sm hover:shadow-md hover:border-brand-200/70 transition flex flex-col">' +
      '<div class="absolute top-2 right-2 z-20">' +
        '<button type="button" data-action="programme-menu-toggle" data-menu-id="' +
        esc(menuId) +
        '" class="w-6 h-6 sm:w-7 sm:h-7 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center" aria-label="Programme options">' +
        menuDotsSvg +
        "</button>" +
        '<div id="' +
        esc(menuId) +
        '" data-programme-menu class="hidden absolute right-0 top-full mt-0.5 min-w-[8.5rem] py-1 rounded-lg border border-slate-200 bg-white shadow-lg text-left">' +
        '<button type="button" data-action="edit-programme" data-class-id="' +
        esc(course.id) +
        '" class="block w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>' +
        '<button type="button" data-action="delete-programme" data-class-id="' +
        esc(course.id) +
        '" data-programme-code="' +
        esc(course.code) +
        '" class="block w-full text-left px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">Delete</button>' +
        "</div></div>" +
      '<div class="flex items-start justify-between gap-2 pr-8">' +
        '<div class="min-w-0 flex-1">' +
          '<span class="inline-flex flex-wrap items-center gap-1 text-xs font-mono font-bold ' + badge + ' px-2 py-0.5 rounded border">' +
          esc(course.code) +
          levelBadge +
          "</span>" +
          '<h4 class="text-xs sm:text-sm font-bold text-slate-900 leading-snug mt-1"><a href="' +
          progUrl +
          '" class="hover:text-brand-700 hover:underline">' +
          esc(course.name) +
          "</a></h4>" +
        "</div>" +
      "</div>" +
      '<div class="border-t border-slate-100 pt-2 -mt-0.5">' +
        '<div class="flex items-center justify-between gap-2">' +
        '<button type="button" data-action="toggle-card-courses" data-class-id="' +
        esc(course.id) +
        '" data-card-prefix="' +
        esc(prefix) +
        '"' +
        (course.teachLevel != null && course.teachLevel !== ""
          ? ' data-teach-level="' + esc(String(course.teachLevel)) + '"'
          : "") +
        ' class="flex items-center gap-1.5 text-left flex-1 min-w-0" aria-expanded="' +
        (coursesOpen ? "true" : "false") +
        '">' +
        '<svg data-chevron class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ' +
        (coursesOpen ? "rotate-180" : "") +
        '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>' +
        '<span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Courses</span>' +
        '<span id="' + prefix + '-courses-count" class="text-[10px] font-black text-brand-700 tabular-nums">0</span></button>' +
        '<button type="button" data-action="add-course-card" data-class-id="' +
        esc(course.id) +
        '" class="w-6 h-6 shrink-0 rounded text-slate-500 hover:text-brand-700 hover:bg-slate-100 text-sm font-bold leading-none" title="Add course">+</button>' +
        "</div>" +
        '<ul id="' +
        prefix +
        '-courses-list" class="mt-1 space-y-0.5 max-h-32 overflow-y-auto ' +
        (coursesOpen ? "" : "hidden") +
        '"></ul>' +
      "</div>" +
      '<div class="flex items-center justify-end -mt-1">' +
        '<div id="' + prefix + '-rate" class="text-sm font-black ' + rateColor + ' tabular-nums leading-none" title="Today\u2019s turnout">Today: <span class="text-base">\u2014</span></div>' +
      "</div>" +
      '<dl class="dashboard-prog-card-stats grid grid-cols-4 gap-0.5 border-t border-slate-100 pt-1.5 text-[10px] sm:text-[11px] leading-tight">' +
        '<div><dt class="text-slate-400 font-medium">Enrolled</dt><dd id="' + prefix + '-enrolled" class="font-bold text-slate-800 text-xs sm:text-sm mt-0.5">0</dd></div>' +
        '<div><dt class="text-slate-400 font-medium">Courses</dt><dd id="' + prefix + '-course-count" class="font-bold text-brand-700 text-xs sm:text-sm tabular-nums mt-0.5">0</dd></div>' +
        '<div><dt class="text-slate-400 font-medium" title="See each course in the list">Sessions</dt><dd id="' + prefix + '-sessions" class="font-bold text-slate-400 text-xs sm:text-sm mt-0.5">…</dd></div>' +
        '<div><dt class="text-slate-400 font-medium" title="Attendance taken per course below">Taken</dt><dd id="' + prefix + '-attendance" class="font-bold text-slate-400 text-xs sm:text-sm tabular-nums mt-0.5">…</dd></div>' +
      "</dl>" +
      '<div class="dashboard-prog-card-actions flex items-center gap-1.5">' +
        '<button type="button" data-action="scan" data-class-id="' +
        esc(course.id) +
        '"' +
        (course.teachLevel != null && course.teachLevel !== ""
          ? ' data-teach-level="' + esc(String(course.teachLevel)) + '"'
          : "") +
        ' class="flex-1 py-1.5 sm:py-2 px-2 ' +
        scanBtn +
        ' text-white rounded-md font-bold text-xs transition flex items-center justify-center gap-1.5">' +
        scanSvg +
        "Take attendance</button>" +
        '<a id="' + prefix + '-roster" href="' + progUrl + '" class="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-xs transition">Register</a>' +
      "</div></article>"
  );
}

function renderClassCards() {
  var host = document.getElementById("dashboard-class-cards");
  if (!host) return;
  var classes = Attendify.load().classes || [];
  if (!classes.length) {
    host.innerHTML =
      '<p class="text-sm text-slate-500">No programmes on your dashboard yet. Open <a href="settings.html" class="font-bold text-brand-700 hover:underline">Settings</a>, tap <strong>Edit</strong>, and add each programme with its level.</p>';
    return;
  }
  host.innerHTML = classes.map(buildClassCardMarkup).join("");
  classes.forEach(function (course, index) {
    renderClassCardStats(course, cardPrefix(course));
  });
}

function isLecturerNameTitle(token) {
  var t = String(token || "")
    .replace(/\./g, "")
    .trim()
    .toLowerCase();
  return /^(prof|dr|mr|mrs|ms|miss|rev|sir|madam)$/.test(t);
}

function dashboardGreetingName(lecturer) {
  if (!lecturer) return "";
  var raw = String(lecturer.fullName || lecturer.username || "").trim();
  if (!raw) return "";
  var parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length >= 2 && isLecturerNameTitle(parts[0])) {
    return parts[0] + " " + parts[1];
  }
  return parts[0];
}

function renderDashboard() {
  var stats = Attendify.dashboardStats();
  var state = Attendify.load();
  var heroTitle = document.getElementById("dashboard-hero-title");
  var progCount = document.getElementById("dashboard-programme-count");
  if (progCount) progCount.textContent = String((state.classes || []).length);
  if (heroTitle) {
    var session = Attendify.getSession && Attendify.getSession();
    var first = session && session.lecturer ? dashboardGreetingName(session.lecturer) : "";
    heroTitle.textContent = first ? "Hi, " + first : "Lecturer dashboard";
  }
  document.getElementById("stat-students").textContent = String(stats.totalStudents);
  document.getElementById("stat-classes").textContent = String(stats.totalClasses);
  document.getElementById("stat-class-list").textContent =
    state.classes
      .map(function (item) {
        return item.code + (item.teachLevel != null ? " L" + item.teachLevel : "");
      })
      .join(", ") || "No programmes yet";
  document.getElementById("stat-weeks").textContent = String(stats.semesterWeeks);
  document.getElementById("stat-week-detail").textContent = "Week " + stats.currentWeek + " of " + stats.semesterWeeks;
  document.getElementById("stat-attendance").textContent = String(stats.attendanceTaken);
  document.getElementById("stat-attendance-detail").textContent =
    stats.sessionDays + " course session" + (stats.sessionDays === 1 ? "" : "s") + " recorded";
  renderClassCards();
}

var params = new URLSearchParams(window.location.search);

function applyLecturerChrome(session) {
  if (!session || !session.lecturer) return;
  Attendify.paintLecturerChrome(session.lecturer, { sidebar: true, header: true });
}

function promptCreateFirstCourse(classId) {
  if (!classId) return;
  setTimeout(function () {
    if (window.AttendifySidebar && AttendifySidebar.openCreateCourseModal) {
      AttendifySidebar.openCreateCourseModal(classId);
    }
  }, 450);
}

Attendify.ready().then(function () {
  var session = Attendify.requireLecturerSession();
  if (!session) return;
  applyLecturerChrome(session);
  fillWeekSelect("start-attendance-week");
  renderDashboard();

  var classFromQuery = params.get("class") || params.get("programme") || session.classId || "";
  var wantsCourse = params.get("createCourse") === "1" || session.createCourse;
  if (wantsCourse && classFromQuery) {
    session.createCourse = false;
    Attendify.saveSession(session);
    promptCreateFirstCourse(classFromQuery);
  }

  var dashSyncTick = 0;
  setInterval(function () {
    if (document.hidden) return;
    if (Attendify.isNetworkDegraded && Attendify.isNetworkDegraded()) {
      dashSyncTick += 1;
      if (dashSyncTick % 8 !== 0) return;
    } else {
      dashSyncTick += 1;
    }
    var scanning = scannerModal && !scannerModal.classList.contains("hidden");
    var cadence = Attendify.isNetworkDegraded && Attendify.isNetworkDegraded() ? 6 : scanning ? 2 : 5;
    if (dashSyncTick % cadence !== 0) return;
    Attendify.syncFromServer().then(function () {
      if (scanning) renderLive();
      else renderDashboard();
    });
  }, 3000);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && scannerModal && !scannerModal.classList.contains("hidden")) {
      Attendify.syncFromServer().then(function () {
        renderDashboard();
        renderLive();
      });
    }
  });
  if (params.get("resumeScan") === "1" && Attendify.getLiveScanSession) {
    var live = Attendify.getLiveScanSession();
    if (live && Attendify.isLiveScanSessionStillOpen(live)) {
      openScannerModal(live.classId, live.lectureName, {
        weekNumber: live.weekNumber,
        courseId: live.courseId || "",
        sessionId: live.sessionId || null,
        teachLevel: live.teachLevel || ""
      });
    }
  } else if (params.get("scan") === "1") {
    openScannerModal(params.get("class") || defaultClassId());
  }
});

window.addEventListener("attendify:programmes-updated", function () {
  Attendify.ready().then(renderDashboard);
});
window.addEventListener("attendify:course-created", function () {
  Attendify.ready().then(renderDashboard);
});
window.addEventListener("attendify:course-updated", function () {
  Attendify.ready().then(renderDashboard);
});
window.addEventListener("attendify:course-deleted", function () {
  Attendify.ready().then(renderDashboard);
});

document.addEventListener("click", function (event) {
  if (
    !event.target.closest("[data-programme-menu]") &&
    !event.target.closest("[data-action=programme-menu-toggle]") &&
    !event.target.closest("[data-course-menu]") &&
    !event.target.closest("[data-action=course-menu-toggle]")
  ) {
    closeAllProgrammeMenus();
    closeAllCourseMenus();
  }
});

var editProgrammeCancel = document.getElementById("edit-programme-cancel");
if (editProgrammeCancel) editProgrammeCancel.addEventListener("click", closeEditProgrammeModal);
var editProgrammeModal = document.getElementById("editProgrammeModal");
if (editProgrammeModal) {
  editProgrammeModal.addEventListener("click", function (event) {
    if (event.target.id === "editProgrammeModal") closeEditProgrammeModal();
  });
}
var editProgrammeForm = document.getElementById("edit-programme-form");
if (editProgrammeForm) {
  editProgrammeForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var id = document.getElementById("edit-programme-id").value;
    var code = document.getElementById("edit-programme-code").value.trim();
    var name = document.getElementById("edit-programme-name").value.trim();
    var err = document.getElementById("edit-programme-error");
    err.classList.add("hidden");
    Attendify.updateProgramme(id, code, name).then(function (result) {
      if (!result.ok) {
        err.textContent = result.error || "Could not save.";
        err.classList.remove("hidden");
        return;
      }
      closeEditProgrammeModal();
      renderDashboard();
      if (window.AttendifySidebar && AttendifySidebar.refresh) AttendifySidebar.refresh();
    });
  });
}
