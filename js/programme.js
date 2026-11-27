var classId = "";
var levelFilter = "";
var course = null;
var editingId = "";

var rosterBody = document.getElementById("roster-body");
var searchInput = document.getElementById("roster-search");
var addModal = document.getElementById("addModal");
var qrModal = document.getElementById("qrModal");

function syncCourse() {
  classId = Attendify.requestedClassId();
  levelFilter = new URLSearchParams(window.location.search).get("level") || "";
  course = Attendify.classById(classId, levelFilter);
}

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

var menuDotsSvg =
  '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>';

function closeAllStudentMenus() {
  document.querySelectorAll("[data-student-menu]").forEach(function (el) {
    el.classList.add("hidden");
  });
}

var uccPhotoForSubmit = "";
var lastRosterSignature = "";
var addSavePending = false;

function avatar(student) {
  return Attendify.avatarMarkup(student, "w-14 h-14", "ring-2 ring-slate-100");
}

function updateLiveScanBanner() {
  var banner = document.getElementById("live-scan-banner");
  var textEl = document.getElementById("live-scan-banner-text");
  if (!banner || !textEl || !Attendify.getLiveScanSession) return;
  syncCourse();
  var live = Attendify.getLiveScanSession();
  if (!live || live.classId !== classId || !Attendify.isLiveScanSessionStillOpen(live)) {
    banner.classList.add("hidden");
    if (live && live.classId === classId && !Attendify.isLiveScanSessionStillOpen(live) && Attendify.clearLiveScanSession) {
      Attendify.clearLiveScanSession();
    }
    return;
  }
  textEl.textContent = "Week " + live.weekNumber + " - session in progress.";
  banner.classList.remove("hidden");
}

function renderRoster() {
  syncCourse();
  if (!course) {
    document.getElementById("programme-page-title").textContent = "Programme not found";
    return;
  }

  var query = (searchInput.value || "").trim().toLowerCase();
  var all = Attendify.studentsFor(classId, levelFilter || null);
  var students = all.filter(function (student) {
    if (!query) return true;
    return student.name.toLowerCase().indexOf(query) !== -1 || student.index.toLowerCase().indexOf(query) !== -1;
  });

  var title = course.name;
  if (levelFilter) title += " · Level " + levelFilter;
  document.getElementById("programme-page-title").textContent = title;
  var codeLine = course.code + (levelFilter ? " · L" + levelFilter : "");
  document.getElementById("programme-page-code").textContent = codeLine;
  document.title = "Attendify | " + course.code;

  var shareLevel = levelFilter || (course.teachLevel != null ? course.teachLevel : "");
  var url = Attendify.enrollUrl(classId, shareLevel);
  document.getElementById("course-registered-count").textContent = String(all.length);
  var enrollSummary = document.getElementById("enroll-share-summary");
  if (enrollSummary && Attendify.enrollShareSummary) {
    enrollSummary.textContent = Attendify.enrollShareSummary(course, shareLevel);
  }
  var enrollLink = document.getElementById("enroll-link");
  var label = Attendify.displayShareUrl ? Attendify.displayShareUrl(url) : url;
  enrollLink.textContent = label;
  enrollLink.href = url;
  var enrollOpen = document.getElementById("enroll-open");
  if (enrollOpen) enrollOpen.href = url;

  document.getElementById("roster-count").textContent = "Showing " + students.length + " of " + all.length;
  document.getElementById("roster-range").textContent =
    all.length ? all.length + " registered, used for all courses under this programme" : "No registrations yet";

  if (!students.length) {
    rosterBody.innerHTML =
      '<tr><td colspan="5" class="py-10 px-6 text-center text-sm text-slate-500">No students yet. Share the registration link or add manually.</td></tr>';
    return;
  }

  rosterBody.innerHTML = students
    .map(function (student, index) {
      var number = String(index + 1);
      if (number.length < 2) number = "0" + number;
      var menuId = "roster-student-menu-" + String(student.id).replace(/[^a-zA-Z0-9_-]/g, "_");
      var listUi = window.AttendifyStudentList;
      var mobileIdentity =
        listUi && listUi.identityHtml
          ? listUi.identityHtml(student, { level: true, email: false })
          : esc(student.name);
      return (
        '<tr class="student-roster-row hover:bg-slate-50/80 border-t border-slate-100">' +
        '<td class="student-roster-num py-4 px-6 text-center text-xs font-semibold text-slate-400">' +
        number +
        "</td>" +
        '<td class="student-roster-main py-4 px-6">' +
        '<div class="student-roster-mobile-only">' +
        mobileIdentity +
        "</div>" +
        '<div class="hidden md:flex md:items-center md:gap-3">' +
        avatar(student) +
        '<div><div class="font-bold text-slate-900">' +
        esc(student.name) +
        "</div>" +
        '<div class="text-xs text-slate-500">' +
        esc(student.email || "…") +
        "</div></div></div></td>" +
        '<td class="student-roster-index py-4 px-6 font-mono text-xs font-bold text-slate-800">' +
        esc(student.index) +
        "</td>" +
        '<td class="student-roster-level py-4 px-6 text-xs font-bold text-slate-600">' +
        (student.level ? "L" + esc(String(student.level)) : "…") +
        "</td>" +
        '<td class="student-roster-actions py-4 px-6 text-right">' +
        '<div class="flex items-center justify-end gap-1">' +
        '<button type="button" data-action="qr" data-id="' +
        esc(student.id) +
        '" class="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg text-xs font-semibold md:inline-flex student-roster-icon-btn md:w-auto md:h-auto" title="View QR card">QR</button>' +
        '<div class="relative">' +
        '<button type="button" data-action="student-menu-toggle" data-menu-id="' +
        esc(menuId) +
        '" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center student-roster-icon-btn md:w-8 md:h-8" aria-label="Student options">' +
        menuDotsSvg +
        "</button>" +
        '<div id="' +
        esc(menuId) +
        '" data-student-menu class="hidden absolute right-0 top-full mt-0.5 z-30 min-w-[9.5rem] py-1 rounded-lg border border-slate-200 bg-white shadow-lg text-left">' +
        '<button type="button" data-action="edit" data-id="' +
        esc(student.id) +
        '" class="block w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit student</button>' +
        '<button type="button" data-action="delete-student" data-id="' +
        esc(student.id) +
        '" data-student-name="' +
        esc(student.name) +
        '" class="block w-full text-left px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">Delete student</button>' +
        "</div></div></div></td></tr>"
      );
    })
    .join("");
  Attendify.hydrateAvatars(rosterBody);
  updateLiveScanBanner();
}

function rosterSignature() {
  syncCourse();
  return Attendify.studentsFor(classId)
    .map(function (student) {
      return [student.id, student.name, student.index, student.photo || "", student.email || ""].join("\u0001");
    })
    .join("\u0002");
}

function programmeTeachLevel() {
  if (levelFilter) return String(levelFilter);
  if (course && course.teachLevel != null && course.teachLevel !== "") return String(course.teachLevel);
  return "";
}

function openAddModal(student) {
  editingId = student ? student.id : "";
  document.getElementById("add-title").textContent = student ? "Edit student" : "Register a student";
  document.getElementById("student-name").value = student ? student.name : "";
  document.getElementById("student-index").value = student ? student.index : "";
  document.getElementById("student-email").value = student ? student.email : "";
  document.getElementById("ucc-photo-preview").classList.add("hidden");
  document.getElementById("ucc-photo-img").classList.add("hidden");
  document.getElementById("ucc-photo-img").removeAttribute("src");
  document.getElementById("ucc-photo-status").textContent = "";
  uccPhotoForSubmit = student ? Attendify.studentPhotoUrl(student) : "";
  document.getElementById("add-error").textContent = "";
  addModal.classList.remove("hidden");
  if (student && student.index) {
    document.getElementById("student-index").dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function closeAddModal() {
  addModal.classList.add("hidden");
  addSavePending = false;
  var submitBtn = document.querySelector("#add-form button[type=submit]");
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save";
  }
}

function showQr(student, options) {
  options = options || {};
  var msgEl = document.getElementById("qr-success-msg");
  if (msgEl) {
    if (options.fromSave) {
      if (options.message) {
        msgEl.textContent = options.message;
      } else {
        msgEl.textContent = "Student saved successfully. Download the QR card below.";
      }
      msgEl.classList.remove("hidden");
    } else {
      msgEl.textContent = "";
      msgEl.classList.add("hidden");
    }
  }
  document.getElementById("qr-name").textContent = student.name;
  document.getElementById("qr-index").textContent = student.index;
  document.getElementById("qr-course").textContent = course.code + " · " + course.name;
  qrModal.classList.remove("hidden");
  Attendify.drawQr(
    document.getElementById("qr-holder"),
    Attendify.qrText(student),
    document.getElementById("qr-download"),
    student.index + "-qr-card.png",
    Attendify.qrCompositePhotoUrl(student),
    {
      attendanceCard: true,
      size: 192,
      avatar: 44,
      exportScale: 2,
      studentName: student.name,
      studentIndex: student.index
    }
  );
}

function copyLink() {
  var link = Attendify.enrollUrl(classId, levelFilter || (course && course.teachLevel));
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link);
  document.getElementById("copy-label").textContent = "Copied";
  setTimeout(function () {
    document.getElementById("copy-label").textContent = "Copy link";
  }, 1500);
}

searchInput.addEventListener("input", renderRoster);
document.getElementById("btn-manual-add").addEventListener("click", function () {
  openAddModal(null);
});
document.getElementById("add-cancel").addEventListener("click", closeAddModal);
document.getElementById("qr-close").addEventListener("click", function () {
  qrModal.classList.add("hidden");
});
document.getElementById("add-form").addEventListener("submit", function (event) {
  event.preventDefault();
  if (addSavePending) return;
  addSavePending = true;
  syncCourse();
  var teachLevel = programmeTeachLevel();
  if (!teachLevel) {
    addSavePending = false;
    document.getElementById("add-error").textContent =
      "This programme has no teaching level set. Add or fix the programme under Settings first.";
    return;
  }
  document.getElementById("add-error").textContent = "";
  var index = document.getElementById("student-index").value;
  var photo = uccPhotoForSubmit || Attendify.uccPhotoUrl(index);
  var submitBtn = event.submitter || document.querySelector("#add-form button[type=submit]");
  if (!editingId) {
    var onRoster = Attendify.findStudent(classId, index);
    if (onRoster) {
      addSavePending = false;
      var levelNote =
        levelFilter && onRoster.level != null && Number(onRoster.level) !== Number(levelFilter)
          ? " (registered at level " + onRoster.level + ". Clear the level filter or search the roster.)"
          : "";
      document.getElementById("add-error").textContent =
        "That index is already on this programme" + levelNote + ". Use Edit on their row to change details, or QR for their card.";
      return;
    }
  }
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";
  }
  Attendify.addStudent({
    id: editingId,
    classId: classId,
    name: document.getElementById("student-name").value,
    index: index,
    level: teachLevel,
    email: document.getElementById("student-email").value,
    photo: photo,
    source: editingId ? undefined : "lecturer"
  })
    .then(function (result) {
      if (!result.ok) {
        document.getElementById("add-error").textContent = result.error;
        return;
      }
      closeAddModal();
      renderRoster();
      showQr(result.student, { fromSave: true });
    })
    .finally(function () {
      if (addModal.classList.contains("hidden")) return;
      addSavePending = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save";
      }
    });
});

rosterBody.addEventListener("click", function (event) {
  var menuToggle = event.target.closest("[data-action=student-menu-toggle]");
  if (menuToggle) {
    event.stopPropagation();
    var panelId = menuToggle.getAttribute("data-menu-id");
    var panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;
    var willOpen = panel.classList.contains("hidden");
    closeAllStudentMenus();
    if (willOpen) panel.classList.remove("hidden");
    return;
  }
  var button = event.target.closest("button[data-id]");
  if (!button) return;
  var student = Attendify.studentsFor(classId).filter(function (item) {
    return item.id === button.getAttribute("data-id");
  })[0];
  if (!student) return;
  if (button.getAttribute("data-action") === "edit") {
    closeAllStudentMenus();
    openAddModal(student);
    return;
  }
  if (button.getAttribute("data-action") === "qr") showQr(student);
  if (button.getAttribute("data-action") === "delete-student") {
    closeAllStudentMenus();
    var label = button.getAttribute("data-student-name") || student.name;
    if (
      !window.confirm(
        "Delete “" + label + "” from this programme? Their attendance records will be removed as well."
      )
    ) {
      return;
    }
    Attendify.deleteStudent(student.id).then(function (result) {
      if (!result.ok) {
        window.alert(result.error || "Could not delete the student.");
        return;
      }
      lastRosterSignature = rosterSignature();
      renderRoster();
    });
  }
});

document.addEventListener("click", function (event) {
  if (!event.target.closest("[data-student-menu]") && !event.target.closest("[data-action=student-menu-toggle]")) {
    closeAllStudentMenus();
  }
});

var continueScanBtn = document.getElementById("btn-continue-live-scan");
if (continueScanBtn) {
  continueScanBtn.addEventListener("click", function () {
    var live = Attendify.getLiveScanSession();
    if (!live || !live.returnUrl) return;
    var sep = live.returnUrl.indexOf("?") >= 0 ? "&" : "?";
    window.location.href = live.returnUrl + sep + "resumeScan=1";
  });
}

document.getElementById("btn-copy-link").addEventListener("click", copyLink);
document.getElementById("btn-export-roster").addEventListener("click", function () {
  syncCourse();
  var rows = [["Student name", "Index no.", "Level", "Email", "Programme"]];
  Attendify.studentsFor(classId).forEach(function (student) {
    rows.push([
      student.name,
      student.index,
      Attendify.formatStudentLevel ? Attendify.formatStudentLevel(student) : student.level || "…",
      student.email,
      course.code
    ]);
  });
  Attendify.downloadCsv(course.code.replace(/\s+/g, "-") + "-roster.csv", rows);
});

Attendify.ready()
  .then(function () {
    var params = new URLSearchParams(window.location.search);
    if (!params.get("programme") && !params.get("class")) {
      window.location.href = "dashboard.html";
      return null;
    }
    return Attendify.refreshShareOrigin ? Attendify.refreshShareOrigin() : null;
  })
  .then(function () {
    var params = new URLSearchParams(window.location.search);
    if (!params.get("programme") && !params.get("class")) return;
  Attendify.bindUccPhotoPreview(document.getElementById("student-index"), {
    previewEl: document.getElementById("ucc-photo-preview"),
    imgEl: document.getElementById("ucc-photo-img"),
    spinnerEl: document.getElementById("ucc-photo-spinner"),
    statusEl: document.getElementById("ucc-photo-status"),
    onChange: function (result) {
      uccPhotoForSubmit = result.url || Attendify.uccPhotoUrl(document.getElementById("student-index").value);
    }
  });
  lastRosterSignature = rosterSignature();
  renderRoster();
  var rosterSyncTick = 0;
  setInterval(function () {
    if (document.hidden) return;
    rosterSyncTick += 1;
    var banner = document.getElementById("live-scan-banner");
    var liveOn = banner && !banner.classList.contains("hidden");
    if (!liveOn && rosterSyncTick % 4 !== 0) return;
    Attendify.syncFromServer().then(function () {
      var sig = rosterSignature();
      if (sig !== lastRosterSignature) {
        lastRosterSignature = sig;
        renderRoster();
      }
      updateLiveScanBanner();
    });
  }, 1000);
  });
