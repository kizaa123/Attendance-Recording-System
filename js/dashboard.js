var scannerModal = document.getElementById("scannerModal");
var scannerTitle = document.getElementById("scannerTitle");
var scanStatus = document.getElementById("scan-status");
var activeClassId = "bsc-cs";
var activeLectureTitle = "";
var activeWeek = null;
var activeCourseId = "";
var activeSessionId = null;
var scanner = null;
var lastCode = "";
var lastScanAt = 0;
var cameraFacing = "environment";

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
  if (!result.ok) {
    var msg = result.message || result.error || "This card is not on the programme roster.";
    if (result.error === "session_closed") closeScannerModal();
    window.alert(msg);
    return;
  }
  renderLive();
  renderDashboard();
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
  Attendify.markPresent(activeClassId, index, qrToken, activeLectureTitle, activeWeek).then(handleScanResult);
}

function simulateScan() {
  var rows = Attendify.attendanceRows(activeClassId, activeLectureTitle, activeWeek);
  var marked = {};
  rows.forEach(function (row) {
    marked[row.student.id] = true;
  });
  var students = Attendify.studentsFor(activeClassId);
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
    window.alert("Scanner library did not load.");
    return;
  }
  var config = { fps: 10, qrbox: { width: 240, height: 240 } };
  scanner = new Html5Qrcode("qr-reader");
  scanner.start({ facingMode: cameraFacing }, config, onScan, function () {}).catch(function () {
    cameraFacing = cameraFacing === "environment" ? "user" : "environment";
    scanner = new Html5Qrcode("qr-reader");
    return scanner.start({ facingMode: cameraFacing }, config, onScan, function () {});
  }).catch(function () {
    window.alert("Camera unavailable. Use Simulate scan or allow camera access.");
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
  Attendify.setActiveLectureName(activeLectureTitle);
  Attendify.setActiveWeekNumber(activeWeek);
  Attendify.setActiveCourseId(activeCourseId);
  scannerTitle.textContent = activeLectureTitle + " · Week " + activeWeek;
  document.getElementById("scanner-programme-label").textContent = programme.name;
  var rosterBtn = document.getElementById("btn-view-roster");
  if (rosterBtn) rosterBtn.href = "programme.html?programme=" + encodeURIComponent(activeClassId);
  var shareBtn = document.getElementById("btn-share-access");
  if (shareBtn) shareBtn.classList.remove("hidden");
  scannerModal.classList.remove("hidden");
  AttendifyScannerHud.hideVerified();
  renderLive();
  stopCamera();
  setTimeout(startCamera, 200);

  if (options.showShareModalImmediately) {
    setTimeout(openTaShareModal, 350);
  }
}

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

  var sid = activeSessionId;
  if (!sid) {
    var sess = Attendify.activeSessionFor(activeClassId, activeLectureTitle, activeWeek);
    if (sess) sid = sess.sessionId;
  }

  if (!sid) {
    if (input) input.value = "Could not find active session ID.";
    if (anchor) anchor.textContent = "Could not find active session ID.";
    return;
  }

  Attendify.createTaShareLink(activeClassId, sid).then(function (res) {
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

function openStartAttendanceModal(classId) {
  var programme = Attendify.classById(classId);
  if (!programme) return;
  document.getElementById("start-programme-name").textContent = programme.name;
  document.getElementById("start-programme-code").textContent = programme.code;
  document.getElementById("start-lecture-name").value = "";
  var weekEl = document.getElementById("start-attendance-week");
  if (weekEl) weekEl.value = String(Attendify.semesterInfo().currentWeek || 1);
  document.getElementById("start-attendance-error").classList.add("hidden");
  document.getElementById("startAttendanceModal").dataset.programmeId = programme.id;
  document.getElementById("startAttendanceModal").classList.remove("hidden");
  setTimeout(function () {
    document.getElementById("start-lecture-name").focus();
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
  scannerModal.classList.add("hidden");
}

function defaultClassId() {
  var state = Attendify.load();
  return state.activeClassId || (state.classes[0] && state.classes[0].id) || "cs101";
}

document.getElementById("btn-open-scanner").addEventListener("click", function () {
  openStartAttendanceModal(defaultClassId());
});

document.getElementById("start-attendance-cancel").addEventListener("click", closeStartAttendanceModal);
document.getElementById("startAttendanceModal").addEventListener("click", function (event) {
  if (event.target.id === "startAttendanceModal") closeStartAttendanceModal();
});
document.getElementById("start-attendance-form").addEventListener("submit", function (event) {
  event.preventDefault();
  var lecture = document.getElementById("start-lecture-name").value.trim();
  var week = document.getElementById("start-attendance-week").value;
  var err = document.getElementById("start-attendance-error");
  if (!lecture) {
    err.textContent = "Type the course or module name for this attendance.";
    err.classList.remove("hidden");
    return;
  }
  err.classList.add("hidden");
  var programmeId = document.getElementById("startAttendanceModal").dataset.programmeId || defaultClassId();
  Attendify.startAttendanceSession(programmeId, lecture, { weekNumber: week }).then(function (result) {
    if (!result.ok) {
      err.textContent = result.message || result.error || "Could not start session.";
      err.classList.remove("hidden");
      return;
    }
    closeStartAttendanceModal();
    renderDashboard();
    openScannerModal(programmeId, result.lectureName || lecture, {
      weekNumber: week,
      sessionId: result.sessionId,
      showShareModalImmediately: true
    });
  });
});

var classCardsHost = document.getElementById("dashboard-class-cards");
if (classCardsHost) {
  classCardsHost.addEventListener("click", function (event) {
    var menuBtn = event.target.closest("[data-action=programme-menu]");
    if (menuBtn) {
      event.stopPropagation();
      var cid = menuBtn.getAttribute("data-class-id");
      var menu = document.getElementById(cardPrefix(cid) + "-menu");
      if (!menu) return;
      var open = menu.classList.contains("hidden");
      closeAllProgrammeMenus();
      if (open) menu.classList.remove("hidden");
      return;
    }
    var editBtn = event.target.closest("[data-action=edit-programme]");
    if (editBtn) {
      event.stopPropagation();
      openEditProgrammeModal(editBtn.getAttribute("data-class-id"));
      return;
    }
    var delBtn = event.target.closest("[data-action=delete-programme]");
    if (delBtn) {
      event.stopPropagation();
      closeAllProgrammeMenus();
      var delId = delBtn.getAttribute("data-class-id");
      var prog = Attendify.classById(delId);
      var label = prog ? prog.code + " — " + prog.name : "this programme";
      if (!window.confirm("Delete " + label + "? Students and attendance for this programme will be removed.")) return;
      Attendify.deleteProgramme(delId).then(function (result) {
        if (!result.ok) {
          window.alert(result.error || "Could not delete the programme.");
          return;
        }
        renderDashboard();
        window.dispatchEvent(new CustomEvent("attendify:class-created"));
      });
      return;
    }
    var toggleCourses = event.target.closest("[data-action=toggle-card-courses]");
    if (toggleCourses) {
      var cidToggle = toggleCourses.getAttribute("data-class-id");
      var listEl = document.getElementById(cardPrefix(cidToggle) + "-courses-list");
      var chev = toggleCourses.querySelector("[data-chevron]");
      var open = listEl && listEl.classList.contains("hidden");
      if (listEl) listEl.classList.toggle("hidden", !open);
      if (chev) chev.classList.toggle("rotate-180", open);
      sessionStorage.setItem("attendify-card-courses-" + cidToggle, open ? "1" : "0");
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
    openStartAttendanceModal(button.getAttribute("data-class-id"));
  });
}

document.addEventListener("click", function (event) {
  if (event.target.closest("[data-action=programme-menu]") || event.target.closest("[data-programme-menu]")) return;
  closeAllProgrammeMenus();
});

document.getElementById("edit-programme-cancel").addEventListener("click", closeEditProgrammeModal);
document.getElementById("editProgrammeModal").addEventListener("click", function (event) {
  if (event.target.id === "editProgrammeModal") closeEditProgrammeModal();
});
document.getElementById("edit-programme-form").addEventListener("submit", function (event) {
  event.preventDefault();
  var id = document.getElementById("edit-programme-id").value;
  var code = document.getElementById("edit-programme-code").value;
  var name = document.getElementById("edit-programme-name").value;
  var err = document.getElementById("edit-programme-error");
  Attendify.updateProgramme(id, code, name).then(function (result) {
    if (!result.ok) {
      err.textContent = result.error || "Could not save.";
      err.classList.remove("hidden");
      return;
    }
    closeEditProgrammeModal();
    renderDashboard();
    window.dispatchEvent(new CustomEvent("attendify:class-created"));
  });
});
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
    closeScannerModal();
    renderDashboard();
  });
});
document.getElementById("btn-scan-simulate").addEventListener("click", simulateScan);
document.getElementById("btn-scan-flip").addEventListener("click", flipCamera);

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") closeScannerModal();
});

var scanSvg =
  '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>';

function cardPrefix(classId) {
  return "card-" + classId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function isCardCoursesOpen(classId) {
  return sessionStorage.getItem("attendify-card-courses-" + classId) === "1";
}

function renderProgrammeCoursesList(classId, prefix) {
  var host = document.getElementById(prefix + "-courses-list");
  if (!host) return;
  var courses = Attendify.coursesForProgramme(classId);
  if (!courses.length) {
    host.innerHTML =
      '<li class="text-[11px] text-slate-400 italic px-1 py-0.5">No courses yet — use + in the sidebar or on this card.</li>';
    return;
  }
  host.innerHTML = courses
    .map(function (course) {
      var href =
        "course.html?programme=" + encodeURIComponent(classId) + "&course=" + encodeURIComponent(course.id);
      return (
        '<li><a href="' +
        esc(href) +
        '" class="block rounded-md px-2 py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 border border-transparent hover:border-brand-100 transition">' +
        '<span class="font-mono text-slate-600">' +
        esc(course.code) +
        "</span> · " +
        esc(course.name) +
        "</a></li>"
      );
    })
    .join("");
}

function renderClassCardStats(classId, prefix) {
  var stats = Attendify.classStats(classId);
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
  if (sessions) sessions.textContent = String(stats.sessionDays);
  if (attendance) attendance.textContent = String(stats.attendanceRecords);
  if (roster) roster.title = stats.enrolled + " students enrolled";
  if (!rate) return;
  var inner = rate.querySelector("span");
  var val = "—";
  if (stats.turnoutToday != null && stats.enrolled > 0) val = stats.turnoutToday + "%";
  if (inner) inner.textContent = val;
  else rate.textContent = val;
  renderProgrammeCoursesList(classId, prefix);
}

var menuDotsSvg =
  '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>';

function closeAllProgrammeMenus() {
  document.querySelectorAll("[data-programme-menu]").forEach(function (el) {
    el.classList.add("hidden");
  });
}

function openEditProgrammeModal(programmeId) {
  closeAllProgrammeMenus();
  var course = Attendify.classById(programmeId);
  if (!course) return;
  document.getElementById("edit-programme-id").value = course.id;
  document.getElementById("edit-programme-code").value = course.code;
  document.getElementById("edit-programme-name").value = course.name;
  document.getElementById("edit-programme-error").classList.add("hidden");
  document.getElementById("editProgrammeModal").classList.remove("hidden");
}

function closeEditProgrammeModal() {
  document.getElementById("editProgrammeModal").classList.add("hidden");
}

function buildClassCardMarkup(course, index) {
  var prefix = cardPrefix(course.id);
  var topAccent = index === 0 ? " border-t-2 border-t-tealAccent-500" : "";
  var scanBtn = index % 2 === 0 ? "bg-tealAccent-600 hover:bg-tealAccent-700" : "bg-brand-600 hover:bg-brand-700";
  var rateColor = index % 2 === 0 ? "text-emerald-600" : "text-tealAccent-600";
  var badge = index % 2 === 0
    ? "bg-brand-50 text-brand-700 border-brand-100"
    : "bg-slate-100 text-slate-700 border-slate-200";
  var menuId = prefix + "-menu";
  return (
    '<article class="relative w-full sm:max-w-[22rem] bg-white rounded-lg p-3 border border-slate-200/90' + topAccent + ' shadow-sm hover:shadow-md hover:border-brand-200/70 transition flex flex-col gap-2.5">' +
      '<div class="absolute top-2 right-2 z-20">' +
        '<button type="button" data-action="programme-menu" data-class-id="' + esc(course.id) + '" class="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition" aria-label="Programme options" aria-haspopup="true">' +
          menuDotsSvg +
        "</button>" +
        '<div id="' + menuId + '" data-programme-menu class="hidden absolute right-0 mt-1 w-36 rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-xs font-semibold z-30">' +
          '<button type="button" data-action="edit-programme" data-class-id="' + esc(course.id) + '" class="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50">Edit</button>' +
          '<button type="button" data-action="delete-programme" data-class-id="' + esc(course.id) + '" class="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50">Delete</button>' +
        "</div>" +
      "</div>" +
      '<div class="flex items-start justify-between gap-2 pr-8">' +
        '<div class="min-w-0 flex-1">' +
          '<span class="inline-block text-xs font-mono font-bold ' + badge + ' px-2 py-0.5 rounded border">' + esc(course.code) + "</span>" +
          '<h4 class="text-sm font-bold text-slate-900 leading-snug mt-1.5"><a href="programme.html?programme=' +
          encodeURIComponent(course.id) +
          '" class="hover:text-brand-700 hover:underline">' +
          esc(course.name) +
          "</a></h4>" +
        "</div>" +
      "</div>" +
      '<div class="border-t border-slate-100 pt-2 -mt-0.5">' +
        '<div class="flex items-center justify-between gap-2">' +
        '<button type="button" data-action="toggle-card-courses" data-class-id="' +
        esc(course.id) +
        '" class="flex items-center gap-1.5 text-left flex-1 min-w-0" aria-expanded="' +
        (isCardCoursesOpen(course.id) ? "true" : "false") +
        '">' +
        '<svg data-chevron class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ' +
        (isCardCoursesOpen(course.id) ? "rotate-180" : "") +
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
        (isCardCoursesOpen(course.id) ? "" : "hidden") +
        '"></ul>' +
      "</div>" +
      '<div class="flex items-center justify-end -mt-1">' +
        '<div id="' + prefix + '-rate" class="text-sm font-black ' + rateColor + ' tabular-nums leading-none" title="Today\u2019s turnout">Today: <span class="text-base">\u2014</span></div>' +
      "</div>" +
      '<dl class="grid grid-cols-4 gap-1 border-t border-slate-100 pt-2 text-[11px] leading-tight">' +
        '<div><dt class="text-slate-400 font-medium">Enrolled</dt><dd id="' + prefix + '-enrolled" class="font-bold text-slate-800 text-sm mt-0.5">0</dd></div>' +
        '<div><dt class="text-slate-400 font-medium">Courses</dt><dd id="' + prefix + '-course-count" class="font-bold text-brand-700 text-sm tabular-nums mt-0.5">0</dd></div>' +
        '<div><dt class="text-slate-400 font-medium">Sessions</dt><dd id="' + prefix + '-sessions" class="font-bold text-slate-800 text-sm mt-0.5">0</dd></div>' +
        '<div><dt class="text-slate-400 font-medium" title="Attendance taken this semester">Taken</dt><dd id="' + prefix + '-attendance" class="font-bold text-emerald-700 text-sm tabular-nums mt-0.5">0</dd></div>' +
      "</dl>" +
      '<div class="flex items-center gap-2">' +
        '<button type="button" data-action="scan" data-class-id="' + esc(course.id) + '" class="flex-1 py-2 px-2.5 ' + scanBtn + ' text-white rounded-md font-bold text-xs transition flex items-center justify-center gap-1.5">' + scanSvg + "Take attendance</button>" +
        '<a id="' + prefix + '-roster" href="programme.html?programme=' + encodeURIComponent(course.id) + '" class="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-xs transition">Register</a>' +
      "</div></article>"
  );
}

function renderClassCards() {
  var host = document.getElementById("dashboard-class-cards");
  if (!host) return;
  var classes = Attendify.load().classes || [];
  if (!classes.length) {
    host.innerHTML = '<p class="text-sm text-slate-500">No programmes yet. Tap <strong class="text-brand-700">+</strong> beside <em>Programmes</em> in the sidebar.</p>';
    return;
  }
  host.innerHTML = classes.map(buildClassCardMarkup).join("");
  classes.forEach(function (course, index) {
    renderClassCardStats(course.id, cardPrefix(course.id));
  });
}

function renderDashboard() {
  var stats = Attendify.dashboardStats();
  var state = Attendify.load();
  document.getElementById("stat-students").textContent = String(stats.totalStudents);
  document.getElementById("stat-classes").textContent = String(stats.totalClasses);
  document.getElementById("stat-class-list").textContent = state.classes.map(function (item) { return item.code; }).join(", ") || "No programmes yet";
  document.getElementById("stat-weeks").textContent = String(stats.semesterWeeks);
  document.getElementById("stat-week-detail").textContent = "Week " + stats.currentWeek + " of " + stats.semesterWeeks;
  document.getElementById("stat-attendance").textContent = String(stats.attendanceTaken);
  document.getElementById("stat-attendance-detail").textContent = stats.sessionDays + " class day" + (stats.sessionDays === 1 ? "" : "s") + " recorded";
  renderClassCards();
}

var params = new URLSearchParams(window.location.search);
Attendify.ready().then(function () {
  fillWeekSelect("start-attendance-week");
  renderDashboard();
  setInterval(function () {
    Attendify.ready().then(function () {
      renderDashboard();
      if (scannerModal && !scannerModal.classList.contains("hidden")) {
        renderLive();
      }
    });
  }, 4000);
  if (params.get("scan") === "1") openScannerModal(params.get("class") || defaultClassId());
});

window.addEventListener("attendify:class-created", function () {
  Attendify.ready().then(renderDashboard);
});
window.addEventListener("attendify:course-created", function () {
  Attendify.ready().then(renderDashboard);
});
