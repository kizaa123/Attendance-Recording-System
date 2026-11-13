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
      el.textContent = "Week " + selectedWeek + " — session ended. No further attendance for this week.";
      el.classList.add("text-slate-700", "bg-slate-100", "border-slate-300");
      el.classList.remove("text-amber-800", "bg-amber-50", "border-amber-100", "text-slate-600", "bg-slate-50", "border-slate-200");
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
      el.textContent = "Week " + selectedWeek + " — attendance not started yet.";
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
        status: scanned ? "Present" : sessionHasRecords(selectedWeek) ? "Absent" : "—",
        time: scanned ? Attendify.formatTime(scanned) : ""
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
    var rows = [["Name", "Index", "Status", "Scanned at"]];
    weekExportRows().forEach(function (row) {
      rows.push([row.name, row.index, row.status, row.time || "—"]);
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
      title: pair.course.code + " — " + pair.course.name,
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
      pair.programme.code + " — " + pair.programme.name;
    document.getElementById("course-title").textContent = pair.course.name;
    document.getElementById("course-code-line").textContent = pair.course.code;
    lectureLabel = Attendify.courseLectureLabel(pair.course);
    document.title = "Attendify — " + pair.course.code;
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

  function renderStats(enrolled, presentCount, absentCount, rosterVisible, scanning) {
    document.getElementById("course-stat-enrolled").textContent = String(enrolled);
    if (!rosterVisible) {
      if (scanning && enrolled) {
        document.getElementById("course-stat-present").textContent = String(presentCount);
        document.getElementById("course-stat-absent").textContent = "—";
        document.getElementById("course-stat-present-note").textContent = "Week " + selectedWeek + " · scanning";
        document.getElementById("course-stat-absent-note").textContent = "Roster appears after the first scan";
        return;
      }
      document.getElementById("course-stat-present").textContent = "—";
      document.getElementById("course-stat-absent").textContent = "—";
      document.getElementById("course-stat-present-note").textContent = "Week " + selectedWeek + " · not started";
      document.getElementById("course-stat-absent-note").textContent = "Take attendance to record this week";
      return;
    }
    document.getElementById("course-stat-present").textContent = String(presentCount);
    document.getElementById("course-stat-absent").textContent = String(absentCount);
    document.getElementById("course-stat-present-note").textContent =
      "Week " + selectedWeek + (enrolled ? " · " + Math.round((presentCount / enrolled) * 1000) / 10 + "% turnout" : "");
    document.getElementById("course-stat-absent-note").textContent =
      enrolled ? "Week " + selectedWeek + " · not yet scanned" : "No students on programme";
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
      return;
    }
    var present = presentMapForWeek(selectedWeek);
    var presentCount = 0;
    students = sortStudentsByAttendance(students, present);
    body.innerHTML = students
      .map(function (student) {
        var scanned = present[student.id];
        if (scanned) presentCount += 1;
        var status = scanned
          ? '<span class="inline-flex items-center gap-1 text-emerald-700 font-semibold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Present</span>'
          : '<span class="text-slate-500 font-medium">Absent</span>';
        var timeCell = scanned
          ? '<span class="font-mono text-slate-700 tabular-nums">' + esc(Attendify.formatTime(scanned)) + "</span>"
          : '<span class="text-slate-300">—</span>';
        return (
          "<tr class=\"border-t border-slate-100\">" +
          '<td class="py-2.5 px-4">' +
          '<div class="flex items-center gap-3 min-w-0">' +
          studentAvatarCell(student) +
          '<span class="font-semibold text-slate-800 truncate">' +
          esc(student.name) +
          "</span></div></td>" +
          '<td class="py-2.5 px-4 font-mono text-slate-600">' +
          esc(student.index) +
          "</td>" +
          '<td class="py-2.5 px-4 text-xs">' +
          status +
          "</td>" +
          '<td class="py-2.5 px-4 text-right text-xs">' +
          timeCell +
          "</td></tr>"
        );
      })
      .join("");
    renderStats(enrolled, presentCount, enrolled - presentCount, true, scanning);
    updateWeekBanner();
    updateTakeAttendanceUi();
    Attendify.hydrateAvatars(body);
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
    if (!result.ok) {
      var msg = result.message || result.error || "This card is not on the programme roster.";
      if (result.error === "session_closed") closeScanner();
      window.alert(msg);
      return;
    }
    renderLive(selectedWeek);
    renderTable();
    AttendifyScannerHud.showVerified(result.student, result.record.scannedAt, result.duplicate);
    var undoBtn = document.getElementById("scan-hud-undo");
    if (undoBtn) {
      undoBtn.onclick = function () {
        removeScanForStudent(result.student.id);
      };
    }
  }

  function onScan(text) {
    var now = Date.now();
    if (text === lastCode && now - lastScanAt < 2000) return;
    lastCode = text;
    lastScanAt = now;
    var parsed = Attendify.parseQr(text);
    var qrToken = parsed && parsed.qrToken ? parsed.qrToken : null;
    var index = parsed && parsed.index ? parsed.index : !qrToken ? text : null;
    Attendify.markPresent(programmeId, index, qrToken, lectureLabel, selectedWeek).then(handleScanResult);
  }

  function simulateScan() {
    var rows = Attendify.attendanceRows(programmeId, lectureLabel, selectedWeek);
    var marked = {};
    rows.forEach(function (row) {
      marked[row.student.id] = true;
    });
    var students = Attendify.studentsFor(programmeId);
    if (!students.length) {
      window.alert("No students registered on this programme yet.");
      return;
    }
    var next = null;
    var i;
    for (i = 0; i < students.length; i++) {
      if (!marked[students[i].id]) {
        next = students[i];
        break;
      }
    }
    if (!next) next = students[0];
    onScan(Attendify.qrText(next));
  }

  function startCamera() {
    if (typeof Html5Qrcode === "undefined") {
      window.alert("Scanner library did not load. Check your connection.");
      return;
    }
    var config = { fps: 10, qrbox: { width: 240, height: 240 } };
    scanner = new Html5Qrcode("qr-reader");
    scanner
      .start({ facingMode: cameraFacing }, config, onScan, function () {})
      .catch(function () {
        cameraFacing = cameraFacing === "environment" ? "user" : "environment";
        scanner = new Html5Qrcode("qr-reader");
        return scanner.start({ facingMode: cameraFacing }, config, onScan, function () {});
      })
      .catch(function () {
        window.alert("Camera unavailable. Allow camera access, or use Simulate scan.");
      });
  }

  function flipCamera() {
    cameraFacing = cameraFacing === "environment" ? "user" : "environment";
    stopCamera();
    setTimeout(startCamera, 200);
  }

  function stopCamera() {
    if (!scanner) return;
    var current = scanner;
    scanner = null;
    if (current.isScanning) {
      current.stop().then(function () { return current.clear(); }).catch(function () {});
    }
  }

  var activeCourseSessionId = null;
  var currentTaShareUrl = "";

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
    if (anchor) {
      anchor.textContent = "Generating TA link...";
      anchor.removeAttribute("href");
    }
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
      if (anchor) anchor.textContent = "Could not find active session ID.";
      return;
    }

    Attendify.createTaShareLink(programmeId, sid).then(function (res) {
      if (!res.ok) {
        var err = res.error || "Failed to generate link.";
        if (input) input.value = err;
        if (anchor) anchor.textContent = err;
        return;
      }
      currentTaShareUrl = res.url;
      if (input) input.value = res.url;
      if (anchor) {
        anchor.textContent = res.url;
        anchor.href = res.url;
      }
      if (qrContainer && typeof QRCode !== "undefined") {
        qrContainer.innerHTML = "";
        new QRCode(qrContainer, {
          text: res.url,
          width: 144,
          height: 144,
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    }).catch(function () {
      if (input) input.value = "Error generating link.";
      if (anchor) anchor.textContent = "Error generating link.";
    });
  }

  function openScanner(week, sessionId, showShareModalImmediately) {
    var pair = programmeAndCourse();
    if (!pair) return;
    selectedWeek = Number(week) || 1;
    activeCourseSessionId = sessionId || null;
    if (isWeekClosed(selectedWeek)) {
      window.alert("Attendance for Week " + selectedWeek + " has ended.");
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
    AttendifyScannerHud.hideVerified();
    renderTable();
    renderLive(selectedWeek);
    stopCamera();
    setTimeout(startCamera, 200);

    if (showShareModalImmediately) {
      setTimeout(openTaShareModal, 350);
    }
  }

  function closeScanner() {
    stopCamera();
    scannerModal.classList.add("hidden");
    Attendify.ready().then(function () {
      renderTable();
    });
  }

  document.getElementById("course-week-filter").addEventListener("change", function (event) {
    selectedWeek = Number(event.target.value) || 1;
    renderTable();
    updateWeekBanner();
    updateTakeAttendanceUi();
  });

  document.getElementById("btn-export-week-csv").addEventListener("click", exportWeekCsv);
  document.getElementById("btn-export-week-pdf").addEventListener("click", exportWeekPdf);

  document.getElementById("btn-take-attendance").addEventListener("click", function () {
    if (isSelectedWeekClosed()) return;
    document.getElementById("take-attendance-week").value = String(selectedWeek);
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
        window.alert((result && (result.message || result.error)) || "Could not end the session.");
        return;
      }
      closeScanner();
      updateTakeAttendanceUi();
      updateWeekBanner();
      renderTable();
    });
  });
  document.getElementById("btn-view-roster").addEventListener("click", function () {
    closeScanner();
    var table = document.getElementById("course-roster-body");
    if (table) {
      var section = table.closest(".bg-white");
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  document.getElementById("btn-scan-simulate").addEventListener("click", simulateScan);
  document.getElementById("btn-scan-flip").addEventListener("click", flipCamera);

  Attendify.ready().then(function () {
    if (!programmeId || !courseId) {
      window.location.href = "dashboard.html";
      return;
    }
    fillWeekSelects();
    if (!renderHeader()) return;
    selectedWeek = pickDefaultViewWeek();
    document.getElementById("course-week-filter").value = String(selectedWeek);
    document.getElementById("take-attendance-week").value = String(selectedWeek);
    updateWeekBanner();
    updateTakeAttendanceUi();
    renderTable();

    // Periodic poll to sync TA scans and update the week attendance table live
    setInterval(function () {
      Attendify.ready().then(function () {
        renderTable();
        updateWeekBanner();
        updateTakeAttendanceUi();
        if (isScannerOpen()) {
          renderLive(selectedWeek);
        }
      });
    }, 3000);
  });
})();
