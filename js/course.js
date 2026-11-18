(function () {
  var params = new URLSearchParams(window.location.search);
  var programmeId = params.get("programme") || params.get("class") || "";
  var courseId = params.get("course") || "";
  var selectedWeek = 1;

  var scannerModal = document.getElementById("scannerModal");
  var scanner = null;
  var lastCode = "";
  var lastScanAt = 0;
  var lectureLabel = "";
  var cameraFacing = "environment";
  var cameraStarting = false;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function studentAvatarCell(student) {
    return Attendify.avatarMarkup(student, "w-12 h-12", "ring-2 ring-slate-100");
  }

  function fillWeekSelects() {
    var total = Attendify.semesterInfo().totalWeeks || 15;
    var html = "";
    var w;
    for (w = 1; w <= total; w++) {
      html += '<option value="' + w + '">Week ' + w + "</option>";
    }
    document.getElementById("course-week-filter").innerHTML = html;
    document.getElementById("take-attendance-week").innerHTML = html;
  }

  function syncTakeAttendanceWeekSelect() {
    var takeWeek = document.getElementById("take-attendance-week");
    if (takeWeek) takeWeek.value = String(selectedWeek);
  }

  function latestWeekWithRecords() {
    var total = Attendify.semesterInfo().totalWeeks || 15;
    var w;
    for (w = total; w >= 1; w--) {
      if (sessionHasRecords(w)) return w;
    }
    return 0;
  }

  function pickDefaultViewWeek() {
    var latest = latestWeekWithRecords();
    if (latest) return latest;
    return Attendify.semesterInfo().currentWeek || 1;
  }

  function isWeekClosed(week) {
    var pair = programmeAndCourse();
    if (!pair) return false;
    return Attendify.isCourseWeekSessionClosed(programmeId, pair.course, week);
  }

  function isSelectedWeekClosed() {
    return isWeekClosed(selectedWeek);
  }

  function isWeekSessionActive(week) {
    return sessionHasRecords(week) && !isWeekClosed(week);
  }

  function statusLabelForExport(scanned, week) {
    if (scanned) return "Present";
    if (isWeekClosed(week)) return "Absent";
    if (sessionHasRecords(week)) return "Waiting";
    return "…";
  }

  function sessionBadgeKind(scanned, week) {
    if (scanned) return "present";
    if (isWeekClosed(week)) return "absent";
    if (sessionHasRecords(week)) return "waiting";
    return "";
  }

  function statusBadgeHtml(scanned, week) {
    var badge = window.AttendifyStudentList && AttendifyStudentList.attendanceSessionBadge;
    var sessionUi = sessionHasRecords(week) || isWeekClosed(week);
    if (sessionUi && badge) {
      var kind = sessionBadgeKind(scanned, week);
      if (kind) return badge(kind);
    }
    if (scanned) {
      return '<span class="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 shadow-xs">Present ✓</span>';
    }
    if (isWeekClosed(week)) {
      return '<span class="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold text-rose-800 bg-rose-100 border border-rose-300 shadow-xs">Absent ✕</span>';
    }
    if (sessionHasRecords(week)) {
      return '<span class="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 shadow-xs">Waiting…</span>';
    }
    return '<span class="text-slate-400">…</span>';
  }

  function rosterUsesSessionCards(week) {
    return sessionHasRecords(week) || isWeekClosed(week);
  }

  function setRosterSessionUi(on) {
    var rosterTable = document.querySelector(".student-roster-table--attendance");
    if (!rosterTable) return;
    rosterTable.classList.toggle("student-roster-table--session-ui", !!on);
    var rosterWrap = rosterTable.parentElement;
    if (rosterWrap) rosterWrap.classList.toggle("course-roster-session-wrap", !!on);
  }

  function updateAbsentStatCard(sessionActive) {
    var card = document.getElementById("course-stat-absent-card");
    var label = document.getElementById("course-stat-absent-label");
    var value = document.getElementById("course-stat-absent");
    if (!card || !value) return;
    if (sessionActive) {
      card.classList.remove("border-t-slate-300", "border-t-rose-500");
      card.classList.add("border-t-amber-400");
      if (label) {
        label.textContent = "Waiting";
        label.classList.remove("text-slate-400");
        label.classList.add("text-amber-800");
      }
      value.classList.remove("text-slate-700", "text-rose-700");
      value.classList.add("text-amber-700");
    } else {
      card.classList.remove("border-t-amber-400");
      card.classList.add("border-t-rose-500");
      if (label) {
        label.textContent = "Absent";
        label.classList.remove("text-amber-800");
        label.classList.add("text-slate-400");
      }
      value.classList.remove("text-amber-700");
      value.classList.add("text-rose-700");
    }
  }

  function updateTakeAttendanceUi() {
    var btn = document.getElementById("btn-take-attendance");
    if (!btn) return;
    var closed = isSelectedWeekClosed();
    btn.disabled = closed;
    btn.setAttribute("aria-disabled", closed ? "true" : "false");
    btn.title = closed ? "Attendance session ended for this week" : "";
    btn.classList.toggle("opacity-50", closed);
    btn.classList.toggle("cursor-not-allowed", closed);
    btn.classList.toggle("pointer-events-none", closed);
    btn.classList.toggle("bg-brand-600", !closed);
    btn.classList.toggle("hover:bg-brand-700", !closed);
    btn.classList.toggle("bg-slate-400", closed);
    var label = btn.querySelector("[data-take-label]");
    if (label) label.textContent = closed ? "Session ended" : "Take attendance";
  }

  function updateWeekBanner() {
    var el = document.getElementById("course-week-banner");
    if (!el) return;
    if (isSelectedWeekClosed()) {
      el.textContent = "Week " + selectedWeek + ": session ended. Unscanned students are marked absent.";
      el.classList.add("text-slate-700", "bg-slate-100", "border-slate-300");
      el.classList.remove("text-amber-800", "bg-amber-50", "border-amber-100", "text-slate-600", "bg-slate-50", "border-slate-200");
      return;
    }
    if (isWeekSessionActive(selectedWeek)) {
      el.textContent = "Week " + selectedWeek + " - session in progress.";
      el.classList.add("text-amber-800", "bg-amber-50", "border-amber-100");
      el.classList.remove("text-slate-600", "bg-slate-50", "border-slate-200", "text-slate-700", "bg-slate-100", "border-slate-300");
      return;
    }
    var latest = latestWeekWithRecords();
    var hasData = sessionHasRecords(selectedWeek);
    if (hasData) {
      el.textContent = "Showing Week " + selectedWeek + " attendance.";
      el.classList.remove("text-amber-700", "bg-amber-50", "border-amber-100");
      el.classList.add("text-slate-600", "bg-slate-50", "border-slate-200");
    } else if (latest && selectedWeek !== latest) {
      el.textContent =
        "Week " + selectedWeek + " has no scans yet. Latest recorded week is Week " + latest + ".";
      el.classList.add("text-amber-800", "bg-amber-50", "border-amber-100");
      el.classList.remove("text-slate-600", "bg-slate-50", "border-slate-200");
    } else {
      el.textContent = "Week " + selectedWeek + ": attendance not started yet.";
      el.classList.add("text-slate-600", "bg-slate-50", "border-slate-200");
    }
  }

  function sortStudentsByAttendance(students, present) {
    return students.slice().sort(function (a, b) {
      var aPresent = present[a.id] ? 1 : 0;
      var bPresent = present[b.id] ? 1 : 0;
      if (bPresent !== aPresent) return bPresent - aPresent;
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
    });
  }

  function weekExportRows() {
    var present = presentMapForWeek(selectedWeek);
    var students = sortStudentsByAttendance(Attendify.studentsFor(programmeId), present);
    return students.map(function (student) {
      var scanned = present[student.id];
      return {
        name: student.name,
        index: student.index,
        level: Attendify.formatStudentLevel(student),
        status: statusLabelForExport(scanned, selectedWeek),
        time: scanned ? Attendify.formatTime(scanned) : "…"
      };
    });
  }

  function exportWeekCsv() {
    var pair = programmeAndCourse();
    if (!pair) return;
    if (!sessionHasRecords(selectedWeek)) {
      window.alert("No attendance recorded for Week " + selectedWeek + " yet.");
      return;
    }
    var rows = [["Student name", "Index no.", "Level", "Status", "Time"]];
    weekExportRows().forEach(function (row) {
      rows.push([row.name, row.index, row.level, row.status, row.time]);
    });
    var code = String(pair.course.code || "course").replace(/\s+/g, "-");
    Attendify.downloadCsv(code + "-week-" + selectedWeek + "-attendance.csv", rows);
  }

  function exportWeekPdf() {
    var pair = programmeAndCourse();
    if (!pair) return;
    if (!sessionHasRecords(selectedWeek)) {
      window.alert("No attendance recorded for Week " + selectedWeek + " yet.");
      return;
    }
    Attendify.printAttendanceReport({
      title: pair.course.code + " · " + pair.course.name,
      subtitle:
        pair.programme.code +
        " · Week " +
        selectedWeek +
        " · exported " +
        new Date().toLocaleString(),
      rows: weekExportRows()
    });
  }

  function programmeAndCourse() {
    var programme = Attendify.classById(programmeId);
    var course = Attendify.courseById(courseId);
    if (!programme || !course || course.classId !== programme.id) return null;
    return { programme: programme, course: course };
  }

  function renderHeader() {
    var pair = programmeAndCourse();
    if (!pair) {
      document.getElementById("course-title").textContent = "Course not found";
      return false;
    }
    document.getElementById("course-programme-label").textContent =
      pair.programme.code + " · " + pair.programme.name;
    document.getElementById("course-title").textContent = pair.course.name;
    document.getElementById("course-code-line").textContent = pair.course.code;
    lectureLabel = Attendify.courseLectureLabel(pair.course);
    document.title = "Attendify | " + pair.course.code;
    return true;
  }

  function sessionForWeek(week) {
    var pair = programmeAndCourse();
    if (!pair) return null;
    return Attendify.findSessionForCourseWeek(programmeId, pair.course, week);
  }

  function presentMapForWeek(week) {
    var session = sessionForWeek(week);
    var map = {};
    if (!session || !session.records) return map;
    session.records.forEach(function (record) {
      map[record.studentId] = record.scannedAt;
    });
    return map;
  }

  function isScannerOpen() {
    return scannerModal && !scannerModal.classList.contains("hidden");
  }

  function sessionHasRecords(week) {
    var session = sessionForWeek(week);
    return !!(session && session.records && session.records.length > 0);
  }

  /** Full roster after first scan, or after session ended (present + absent). */
  function shouldShowRosterForWeek(week) {
    return sessionHasRecords(week) || isWeekClosed(week);
  }

  function updateWeekStatCard() {
    var totalWeeks = Attendify.semesterInfo().totalWeeks || 15;
    var valueEl = document.getElementById("course-stat-week-value");
    if (valueEl) valueEl.textContent = String(selectedWeek) + "/" + String(totalWeeks);
  }

  function renderStats(enrolled, presentCount, absentCount, rosterVisible, scanning, sessionActive) {
    document.getElementById("course-stat-enrolled").textContent = String(enrolled);
    if (!rosterVisible) {
      updateAbsentStatCard(false);
      if (scanning && enrolled) {
        document.getElementById("course-stat-present").textContent = String(presentCount);
        document.getElementById("course-stat-absent").textContent = "…";
        document.getElementById("course-stat-present-note").textContent = "Week " + selectedWeek + ": scanning";
        document.getElementById("course-stat-absent-note").textContent = "Roster appears after the first scan";
        updateWeekStatCard();
        return;
      }
      document.getElementById("course-stat-present").textContent = "…";
      document.getElementById("course-stat-absent").textContent = "…";
      document.getElementById("course-stat-present-note").textContent = "Week " + selectedWeek + ": not started";
      document.getElementById("course-stat-absent-note").textContent = "Take attendance to record this week";
      updateWeekStatCard();
      return;
    }
    updateAbsentStatCard(!!sessionActive);
    document.getElementById("course-stat-present").textContent = String(presentCount);
    document.getElementById("course-stat-absent").textContent = String(absentCount);
    document.getElementById("course-stat-present-note").textContent =
      "Week " + selectedWeek + (enrolled ? " · " + Math.round((presentCount / enrolled) * 1000) / 10 + "% turnout" : "");
    document.getElementById("course-stat-absent-note").textContent = sessionActive
      ? enrolled
        ? "Week " + selectedWeek + ": session open, not scanned yet"
        : "No students on programme"
      : enrolled
        ? "Week " + selectedWeek + ": session ended, absent"
        : "No students on programme";
    updateWeekStatCard();
  }

  function renderTable() {
    var pair = programmeAndCourse();
    if (!pair) return;
    var students = Attendify.studentsFor(programmeId);
    var body = document.getElementById("course-roster-body");
    var enrolled = students.length;
    var scanning = isScannerOpen();
    var showRoster = shouldShowRosterForWeek(selectedWeek);
    var presentPeek = presentMapForWeek(selectedWeek);
    var peekPresent = 0;
    Object.keys(presentPeek).forEach(function () {
      peekPresent += 1;
    });
    if (!enrolled) {
      renderStats(0, 0, 0, false, false);
      body.innerHTML =
        '<tr><td colspan="4" class="py-8 px-4 text-center text-slate-400">No students on this programme. <a class="text-brand-600 font-semibold" href="programme.html?programme=' +
        encodeURIComponent(programmeId) +
        '">Open registration</a>.</td></tr>';
      setRosterSessionUi(false);
      return;
    }
    if (!showRoster) {
      renderStats(enrolled, peekPresent, 0, false, scanning);
      body.innerHTML =
        '<tr><td colspan="4" class="py-10 px-4 text-center text-slate-400 text-sm">No attendance for Week ' +
        selectedWeek +
        " yet. Use Take attendance or pick another week.</td></tr>";
      updateWeekBanner();
      updateTakeAttendanceUi();
      setRosterSessionUi(false);
      return;
    }
    var present = presentMapForWeek(selectedWeek);
    var presentCount = 0;
    var sessionCards = rosterUsesSessionCards(selectedWeek);
    students = sortStudentsByAttendance(students, present);
    body.innerHTML = students
      .map(function (student) {
        var scanned = present[student.id];
        if (scanned) presentCount += 1;
        var status = statusBadgeHtml(scanned, selectedWeek);
        var badgeKind = sessionBadgeKind(scanned, selectedWeek);
        var timeCell = scanned
          ? '<span class="font-mono text-slate-700 tabular-nums">' + esc(Attendify.formatTime(scanned)) + "</span>"
          : '<span class="text-slate-300">…</span>';
        var listUi = window.AttendifyStudentList;
        var mobileBlock;
        if (sessionCards && listUi && listUi.attendanceSessionRosterCard && badgeKind) {
          mobileBlock =
            '<div class="student-roster-mobile-only">' +
            listUi.attendanceSessionRosterCard(student, badgeKind, scanned) +
            "</div>";
        } else {
          var mobileIdentity =
            listUi && listUi.identityHtml
              ? listUi.identityHtml(student, {
                  index: true,
                  extra: scanned ? Attendify.formatTime(scanned) : ""
                })
              : esc(student.name);
          mobileBlock = '<div class="student-roster-mobile-only">' + mobileIdentity + "</div>";
        }
        return (
          '<tr class="student-roster-row' +
          (sessionCards ? " student-roster-row--session" : "") +
          ' border-t border-slate-100">' +
          '<td class="py-2.5 px-4 student-roster-main">' +
          mobileBlock +
          '<div class="hidden md:flex md:items-center md:gap-3 min-w-0">' +
          studentAvatarCell(student) +
          '<span class="font-semibold text-slate-800 truncate">' +
          esc(student.name) +
          "</span></div></td>" +
          '<td class="student-roster-index py-2.5 px-4 font-mono text-slate-600">' +
          esc(student.index) +
          "</td>" +
          '<td class="student-roster-status-col py-2.5 px-4 text-xs">' +
          status +
          "</td>" +
          '<td class="student-roster-time-col py-2.5 px-4 text-right text-xs">' +
          timeCell +
          "</td></tr>"
        );
      })
      .join("");
    var sessionActive = isWeekSessionActive(selectedWeek);
    var notScanned = enrolled - presentCount;
    renderStats(enrolled, presentCount, notScanned, true, scanning, sessionActive);
    updateWeekBanner();
    updateTakeAttendanceUi();
    Attendify.hydrateAvatars(body);
    updateLiveScanBanner();
    setRosterSessionUi(sessionCards);
  }

  function removeScanForStudent(studentId) {
    Attendify.removeAttendance(programmeId, studentId, lectureLabel, selectedWeek, courseId).then(function (result) {
      if (!result.ok) return;
      AttendifyScannerHud.hideVerified();
      renderLive(selectedWeek);
      renderTable();
    });
  }

  function renderLive(week) {
    var rows = Attendify.attendanceRows(programmeId, lectureLabel, week);
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
        setTimeout(closeScanner, 2700);
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
    renderLive(selectedWeek);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () {
        renderTable();
      });
    } else {
      renderTable();
    }
    AttendifyScannerHud.showVerified(result.student, result.record.scannedAt, result.duplicate);
    var undoBtn = document.getElementById("scan-hud-undo");
    if (undoBtn) {
      undoBtn.onclick = function () {
        removeScanForStudent(result.student.id);
      };
    }
  }

  function onScan(text) {
    var parsed = Attendify.parseQr(text);
    var qrToken = parsed && parsed.qrToken ? parsed.qrToken : null;
    var index = parsed && parsed.index ? parsed.index : !qrToken ? text : null;
    return Attendify.markPresent(programmeId, index, qrToken, lectureLabel, selectedWeek).then(handleScanResult);
  }

  function persistLiveScanFromCourse(week) {
    if (!Attendify.saveLiveScanSession || !programmeId || !courseId) return;
    Attendify.saveLiveScanSession({
      source: "course",
      classId: programmeId,
      courseId: courseId,
      weekNumber: week != null ? week : selectedWeek,
      lectureName: lectureLabel,
      sessionId: activeCourseSessionId || null,
      teachLevel: "",
      returnUrl:
        "course.html?programme=" + encodeURIComponent(programmeId) + "&course=" + encodeURIComponent(courseId)
    });
  }

  function hudScanMessage(text, kind, playErr) {
    if (window.AttendifyScannerHud && AttendifyScannerHud.showScanMessage) {
      AttendifyScannerHud.showScanMessage(text, kind || "info", playErr !== false);
    }
  }

  function submitManualIndexSuffix() {
    var errEl = document.getElementById("manual-index-error");
    var input = document.getElementById("manual-index-suffix");
    if (errEl) errEl.classList.add("hidden");
    var resolved = Attendify.resolveStudentIndexSuffix(programmeId, input ? input.value : "", null);
    if (!resolved.ok) {
      if (errEl) errEl.classList.add("hidden");
      if (window.AttendifyScannerHud && AttendifyScannerHud.showUnknown) {
        AttendifyScannerHud.showUnknown();
      }
      return;
    }
    Attendify.markPresent(programmeId, resolved.index, null, lectureLabel, selectedWeek).then(function (result) {
      if (result.ok && input) {
        input.value = "";
        input.focus();
      }
      handleScanResult(result);
    });
  }

  function updateLiveScanBanner() {
    var banner = document.getElementById("live-scan-banner");
    var textEl = document.getElementById("live-scan-banner-text");
    if (!banner || !textEl || !Attendify.getLiveScanSession) return;
    var live = Attendify.getLiveScanSession();
    if (
      !live ||
      live.classId !== programmeId ||
      String(live.courseId || "") !== String(courseId || "") ||
      !Attendify.isLiveScanSessionStillOpen(live)
    ) {
      banner.classList.add("hidden");
      if (
        live &&
        live.classId === programmeId &&
        String(live.courseId || "") === String(courseId || "") &&
        !Attendify.isLiveScanSessionStillOpen(live) &&
        Attendify.clearLiveScanSession
      ) {
        Attendify.clearLiveScanSession();
      }
      return;
    }
    textEl.textContent = "Week " + live.weekNumber + " - session in progress.";
    banner.classList.remove("hidden");
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
      hudScanMessage("Scanner library did not load. Check your connection.", "error", true);
      return;
    }
    if (window.AttendifyScannerHud && AttendifyScannerHud.isCameraContextOk && !AttendifyScannerHud.isCameraContextOk()) {
      hudScanMessage(
        AttendifyScannerHud.cameraContextHint
          ? AttendifyScannerHud.cameraContextHint()
          : "Camera not available in this context.",
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
    Hud.updateCameraFacingBadge(document.getElementById("scan-camera-facing-badge"), cameraFacing);
    Hud.setFacingButtonStates(
      document.getElementById("btn-camera-front"),
      document.getElementById("btn-camera-back"),
      cameraFacing
    );
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

  var activeCourseSessionId = null;
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

    var sid = activeCourseSessionId;
    if (!sid) {
      var sess = sessionForWeek(selectedWeek);
      if (sess) sid = sess.sessionId;
    }

    if (!sid) {
      if (input) input.value = "Could not find active session ID.";
      setTaShareLinkText("Could not find active session ID.");
      return;
    }

    Attendify.createTaShareLink(programmeId, sid).then(function (res) {
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

  function openScanner(week, sessionId, showShareModalImmediately) {
    var pair = programmeAndCourse();
    if (!pair) return;
    selectedWeek = Number(week) || 1;
    activeCourseSessionId = sessionId || null;
    if (isWeekClosed(selectedWeek)) {
      scannerModal.classList.remove("hidden");
      hudScanMessage("Attendance for Week " + selectedWeek + " has ended.", "warning", true);
      setTimeout(closeScanner, 2700);
      updateTakeAttendanceUi();
      return;
    }
    Attendify.setActiveLectureName(lectureLabel);
    Attendify.setActiveWeekNumber(selectedWeek);
    Attendify.setActiveCourseId(pair.course.id);
    document.getElementById("scannerTitle").textContent = pair.course.code + " · Week " + selectedWeek;
    document.getElementById("scanner-programme-label").textContent = pair.course.name;
    var shareBtn = document.getElementById("btn-share-access");
    if (shareBtn) shareBtn.classList.remove("hidden");
    scannerModal.classList.remove("hidden");
    if (AttendifyScannerHud.beginLiveScanSession) AttendifyScannerHud.beginLiveScanSession();
    AttendifyScannerHud.hideVerified();
    renderTable();
    renderLive(selectedWeek);
    openScannerCameraAfterLayout();

    if (showShareModalImmediately) {
      setTimeout(openTaShareModal, 350);
    }
    persistLiveScanFromCourse(selectedWeek);
    var manualErr = document.getElementById("manual-index-error");
    var manualInput = document.getElementById("manual-index-suffix");
    if (manualErr) manualErr.classList.add("hidden");
    if (manualInput) manualInput.value = "";
  }

  function closeScanner() {
    stopCamera();
    if (window.AttendifyScannerHud && AttendifyScannerHud.prepareManualFirstScan) {
      AttendifyScannerHud.prepareManualFirstScan();
    }
    if (window.AttendifyScannerHud && AttendifyScannerHud.endLiveScanSession) {
      AttendifyScannerHud.endLiveScanSession();
    }
    scannerModal.classList.add("hidden");
    persistLiveScanFromCourse(selectedWeek);
    Attendify.ready().then(function () {
      renderTable();
      updateLiveScanBanner();
    });
  }

  document.getElementById("course-week-filter").addEventListener("change", function (event) {
    selectedWeek = Number(event.target.value) || 1;
    syncTakeAttendanceWeekSelect();
    renderTable();
    updateWeekBanner();
    updateTakeAttendanceUi();
  });

  document.getElementById("btn-export-week-csv").addEventListener("click", exportWeekCsv);
  document.getElementById("btn-export-week-pdf").addEventListener("click", exportWeekPdf);

  document.getElementById("btn-take-attendance").addEventListener("click", function () {
    if (isSelectedWeekClosed()) return;
    syncTakeAttendanceWeekSelect();
    document.getElementById("take-attendance-error").classList.add("hidden");
    document.getElementById("takeAttendanceModal").classList.remove("hidden");
  });

  document.getElementById("take-attendance-cancel").addEventListener("click", function () {
    document.getElementById("takeAttendanceModal").classList.add("hidden");
  });

  document.getElementById("take-attendance-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var week = Number(document.getElementById("take-attendance-week").value) || selectedWeek;
    var err = document.getElementById("take-attendance-error");
    err.classList.add("hidden");
    if (isWeekClosed(week)) {
      err.textContent = "Attendance for Week " + week + " has ended.";
      err.classList.remove("hidden");
      return;
    }
    Attendify.startAttendanceSession(programmeId, null, {
      courseId: courseId,
      weekNumber: week
    }).then(function (result) {
      if (!result.ok) {
        err.textContent =
          result.message ||
          (result.error === "session_closed"
            ? "Attendance for this week has ended."
            : result.error || "Could not start.");
        err.classList.remove("hidden");
        if (result.error === "session_closed") updateTakeAttendanceUi();
        return;
      }
      document.getElementById("takeAttendanceModal").classList.add("hidden");
      document.getElementById("course-week-filter").value = String(week);
      selectedWeek = Number(week);
      syncTakeAttendanceWeekSelect();
      openScanner(week, result.sessionId, true);
    });
  });

  document.getElementById("btn-close-scanner").addEventListener("click", closeScanner);
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
    Attendify.closeAttendanceSession(programmeId, lectureLabel, selectedWeek, courseId).then(function (result) {
      if (!result || !result.ok) {
        hudScanMessage(
          (result && (result.message || result.error)) || "Could not end the session.",
          "error",
          true
        );
        return;
      }
      if (Attendify.clearLiveScanSession) Attendify.clearLiveScanSession();
      closeScanner();
      updateTakeAttendanceUi();
      updateWeekBanner();
      renderTable();
      updateLiveScanBanner();
    });
  });
  document.getElementById("btn-view-roster").addEventListener("click", function () {
    closeScanner();
    updateLiveScanBanner();
    var table = document.getElementById("course-roster-body");
    if (table) {
      var section = table.closest(".bg-white");
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  var manualIndexForm = document.getElementById("manual-index-form");
  if (manualIndexForm) {
    manualIndexForm.addEventListener("submit", function (event) {
      event.preventDefault();
      submitManualIndexSuffix();
    });
  }
  var continueScanBtn = document.getElementById("btn-continue-live-scan");
  if (continueScanBtn) {
    continueScanBtn.addEventListener("click", function () {
      var live = Attendify.getLiveScanSession();
      if (!live || !live.returnUrl) return;
      if (live.weekNumber != null) {
        selectedWeek = Number(live.weekNumber) || selectedWeek;
        var weekFilter = document.getElementById("course-week-filter");
        if (weekFilter) weekFilter.value = String(selectedWeek);
      }
      var sid = live.sessionId || null;
      openScanner(selectedWeek, sid, false);
    });
  }
  document.getElementById("btn-scan-flip").addEventListener("click", flipCamera);
  if (window.AttendifyScannerHud && AttendifyScannerHud.bindOpenCameraButton) {
    AttendifyScannerHud.bindOpenCameraButton("btn-open-camera", launchScannerCamera);
  }
  syncFacingUi();

  Attendify.ready().then(function () {
    if (!programmeId || !courseId) {
      window.location.href = "dashboard.html";
      return;
    }
    fillWeekSelects();
    if (!renderHeader()) return;
    selectedWeek = pickDefaultViewWeek();
    document.getElementById("course-week-filter").value = String(selectedWeek);
    syncTakeAttendanceWeekSelect();
    updateWeekBanner();
    updateTakeAttendanceUi();
    renderTable();

    var resumeParams = new URLSearchParams(window.location.search);
    if (resumeParams.get("resumeScan") === "1" && Attendify.getLiveScanSession) {
      var liveResume = Attendify.getLiveScanSession();
      if (
        liveResume &&
        liveResume.classId === programmeId &&
        String(liveResume.courseId || "") === String(courseId) &&
        Attendify.isLiveScanSessionStillOpen(liveResume)
      ) {
        selectedWeek = Number(liveResume.weekNumber) || selectedWeek;
        document.getElementById("course-week-filter").value = String(selectedWeek);
        syncTakeAttendanceWeekSelect();
        openScanner(selectedWeek, liveResume.sessionId || null, false);
      }
    }

    function isLiveWeekSession() {
      var session = sessionForWeek(selectedWeek);
      return !!(session && !session.closedAt);
    }

    function refreshAttendanceFromServer() {
      if (document.hidden) return;
      Attendify.syncFromServer().then(function () {
        renderTable();
        updateWeekBanner();
        updateTakeAttendanceUi();
        updateLiveScanBanner();
        if (isScannerOpen()) {
          renderLive(selectedWeek);
        }
      });
    }

    var syncTick = 0;
    setInterval(function () {
      syncTick += 1;
      var scanning = isScannerOpen();
      var live = scanning || isLiveWeekSession();
      if (scanning) {
        if (syncTick % 2 !== 0) return;
        refreshAttendanceFromServer();
        return;
      }
      if (!live && syncTick % 5 !== 0) return;
      refreshAttendanceFromServer();
    }, 1000);

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && (isScannerOpen() || isLiveWeekSession())) {
        refreshAttendanceFromServer();
      }
    });
  });
})();
