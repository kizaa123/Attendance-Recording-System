(function () {
  var coursesExpanded = false;
  var programmeExpanded = {};

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function isProgrammesOpen() {
    return coursesExpanded;
  }

  function setProgrammesOpen(value) {
    coursesExpanded = !!value;
  }

  function isProgrammeOpen(classId) {
    if (programmeExpanded[classId] === true) return true;
    if (programmeExpanded[classId] === false) return false;
    return sessionStorage.getItem("attendify-sidebar-prog-" + classId) === "1";
  }

  function setProgrammeOpen(classId, value) {
    programmeExpanded[classId] = !!value;
    sessionStorage.setItem("attendify-sidebar-prog-" + classId, value ? "1" : "0");
  }

  function activeClassId() {
    var params = new URLSearchParams(window.location.search);
    var requested = params.get("class") || params.get("programme");
    if (requested) return requested;
    try {
      return Attendify.load().activeClassId || "";
    } catch (error) {
      return "";
    }
  }

  function activeCourseId() {
    return new URLSearchParams(window.location.search).get("course") || "";
  }

  function linkClass(active) {
    return active
      ? "flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-brand-500 text-white font-semibold text-sm shadow-md shadow-brand-900/50"
      : "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-brand-800/50 transition font-medium text-sm";
  }

  function renderShell(nav) {
    var page = nav.getAttribute("data-page") || "dashboard";
    var expanded = isProgrammesOpen();
    nav.innerHTML =
      '<a href="dashboard.html" data-nav-link="dashboard" class="' + linkClass(page === "dashboard") + '">' +
      '<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>' +
      "Dashboard</a>" +
      '<div class="pt-1">' +
      '<div class="flex items-center gap-1 rounded-xl px-1.5 py-1 ' + (page === "courses" ? "bg-brand-800/40" : "") + '">' +
      '<button type="button" id="sidebar-courses-toggle" class="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-brand-800/50 transition text-left" aria-expanded="' + (expanded ? "true" : "false") + '">' +
      '<svg id="sidebar-courses-chevron" class="w-4 h-4 shrink-0 text-slate-400 transition-transform ' + (expanded ? "rotate-180" : "") + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>' +
      '<span class="text-sm font-semibold truncate">Programmes</span>' +
      "</button>" +
      '<button type="button" data-action="add-programme" id="sidebar-add-programme" title="Add programme" aria-label="Add programme" class="w-7 h-7 shrink-0 rounded-md bg-brand-700/80 hover:bg-tealAccent-600 text-white text-sm font-bold leading-none flex items-center justify-center">+</button>' +
      "</div>" +
      '<div id="sidebar-courses-list" class="sidebar-courses-list mt-1 space-y-0.5 overflow-hidden ' + (expanded ? "" : "hidden") + '"></div>' +
      "</div>" +
      '<a href="reports.html" data-nav-link="reports" class="' + linkClass(page === "reports") + '">' +
      '<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' +
      "Report</a>" +
      '<a href="settings.html" data-nav-link="settings" class="' + linkClass(page === "settings") + '">' +
      '<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' +
      "Settings</a>";
  }

  function renderClassList(nav) {
    var list = nav.querySelector("#sidebar-courses-list");
    if (!list || !window.Attendify) return;
    var classes = Attendify.load().classes || [];
    var currentProgramme = activeClassId();
    var currentCourse = activeCourseId();
    if (!classes.length) {
      list.innerHTML =
        '<p class="pl-8 pr-2 py-2 text-[11px] text-slate-500">No programmes yet. Tap <strong class="text-slate-400">+</strong> beside Programmes to add one.</p>';
      return;
    }
    list.innerHTML = classes
      .map(function (programme) {
        var progOpen = isProgrammeOpen(programme.id);
        var courses = Attendify.coursesForProgramme(programme.id);
        var chevronRot = progOpen ? "rotate-180" : "";
        var coursesHidden = progOpen ? "" : "hidden";
        var lvlQ = new URLSearchParams(window.location.search).get("level") || "";
        var progLevel =
          programme.teachLevel != null && programme.teachLevel !== "" ? String(programme.teachLevel) : "";
        var programmeActive =
          programme.id === currentProgramme && !currentCourse && String(lvlQ) === progLevel;
        var rowBg = programmeActive
          ? "bg-brand-800/90 border border-brand-700/50 text-white"
          : "text-slate-300 hover:bg-brand-800/45";
        var courseLines = courses
          .map(function (course) {
            var href =
              "course.html?programme=" + encodeURIComponent(programme.id) + "&course=" + encodeURIComponent(course.id);
            var isActive = currentCourse === course.id;
            var courseCls = isActive
              ? "block pl-11 pr-2 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-brand-700/90 border border-brand-600/40"
              : "block pl-11 pr-2 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-brand-800/40 transition";
            var menuId = "sb-course-menu-" + course.id.replace(/[^a-zA-Z0-9_-]/g, "_");
            return (
              '<div class="flex items-center gap-0.5 pr-1 group/sb-course">' +
              '<a href="' +
              href +
              '" class="' +
              courseCls +
              ' flex-1 min-w-0"><span class="font-mono">' +
              escapeHtml(course.code) +
              "</span> · " +
              '<span class="opacity-90 truncate">' +
              escapeHtml(course.name) +
              "</span></a>" +
              '<div class="relative shrink-0">' +
              '<button type="button" data-action="sidebar-course-menu" data-course-id="' +
              escapeHtml(course.id) +
              '" class="w-6 h-6 rounded text-slate-500 hover:text-white hover:bg-brand-700/80 flex items-center justify-center" aria-label="Course options">' +
              menuDotsSvg +
              "</button>" +
              '<div id="' +
              menuId +
              '" data-sidebar-course-menu class="hidden absolute right-0 top-full mt-0.5 z-30 min-w-[7rem] py-1 rounded-lg border border-brand-700 bg-brand-900 shadow-lg text-left">' +
              '<button type="button" data-action="edit-course" data-class-id="' +
              escapeHtml(programme.id) +
              '" data-course-id="' +
              escapeHtml(course.id) +
              '" class="block w-full text-left px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-brand-800">Edit</button>' +
              '<button type="button" data-action="delete-course" data-class-id="' +
              escapeHtml(programme.id) +
              '" data-course-id="' +
              escapeHtml(course.id) +
              '" data-course-code="' +
              escapeHtml(course.code) +
              '" class="block w-full text-left px-3 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-brand-800">Delete</button>' +
              "</div></div></div>"
            );
          })
          .join("");
        if (!courses.length) {
          courseLines =
            '<p class="pl-11 pr-2 py-1 text-[10px] text-slate-500 italic">No courses yet. Tap + to add one.</p>';
        }
        return (
          '<div class="rounded-lg mx-0.5 ' +
          (programmeActive ? "bg-brand-800/30" : "") +
          '" data-programme-id="' +
          escapeHtml(programme.id) +
          '">' +
          '<div class="flex items-center gap-0.5 pr-1">' +
          '<button type="button" data-action="toggle-programme" data-class-id="' +
          escapeHtml(programme.id) +
          '" class="flex items-center gap-1 flex-shrink-0 pl-2 pr-0.5 py-2 rounded-lg text-slate-400 hover:text-white transition" aria-label="Expand courses">' +
          '<svg class="w-3.5 h-3.5 transition-transform ' +
          chevronRot +
          '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></button>' +
          '<a href="programme.html?programme=' +
          encodeURIComponent(programme.id) +
          (progLevel ? "&level=" + encodeURIComponent(progLevel) : "") +
          '" class="flex items-center gap-1.5 flex-1 min-w-0 pl-1 pr-1 py-2 rounded-lg text-xs font-semibold ' +
          rowBg +
          ' transition truncate" title="Registration &amp; roster">' +
          '<span class="truncate"><span class="font-mono text-[11px]">' +
          escapeHtml(programme.code) +
          (progLevel ? ' <span class="text-tealAccent-300">L' + escapeHtml(progLevel) + "</span>" : "") +
          "</span><span class=\"block text-[10px] font-normal opacity-80 truncate\">" +
          escapeHtml(programme.name) +
          "</span></span></a>" +
          '<button type="button" data-action="add-course" data-class-id="' +
          escapeHtml(programme.id) +
          '" title="Add course" class="w-7 h-7 shrink-0 rounded-md bg-brand-700/80 hover:bg-tealAccent-600 text-white text-sm font-bold leading-none flex items-center justify-center">+</button>' +
          "</div>" +
          '<div data-programme-courses class="space-y-0.5 pb-1 ' +
          coursesHidden +
          '">' +
          courseLines +
          "</div></div>"
        );
      })
      .join("");
  }

  function toggleProgrammes(nav) {
    var expanded = !isProgrammesOpen();
    setProgrammesOpen(expanded);
    var list = nav.querySelector("#sidebar-courses-list");
    var chevron = nav.querySelector("#sidebar-courses-chevron");
    var toggle = nav.querySelector("#sidebar-courses-toggle");
    if (list) list.classList.toggle("hidden", !expanded);
    if (chevron) chevron.classList.toggle("rotate-180", expanded);
    if (toggle) toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function toggleProgramme(nav, classId) {
    setProgrammeOpen(classId, !isProgrammeOpen(classId));
    renderClassList(nav);
  }

  var menuDotsSvg =
    '<svg class="faculty-menu-dots-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>';

  function closeAllCourseMenus() {
    document.querySelectorAll("[data-sidebar-course-menu]").forEach(function (el) {
      el.classList.add("hidden");
    });
  }

  function ensureCreateCourseModal() {
    if (document.getElementById("create-course-modal")) return;
    var modal = document.createElement("div");
    modal.id = "create-course-modal";
    modal.className = "hidden fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55 backdrop-blur-sm p-4";
    modal.innerHTML =
      '<div class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">' +
      '<h3 id="create-course-title" class="text-lg font-bold text-slate-900">Create course</h3>' +
      '<p class="text-xs text-slate-500 mt-1">Only you will see this course. Programme students (shared QR) appear automatically.</p>' +
      '<p class="text-xs text-slate-500 mt-1">Programme <span id="create-course-programme" class="font-semibold text-slate-700"></span></p>' +
      '<form id="create-course-form" class="mt-4 space-y-3">' +
      '<input type="hidden" id="create-course-class-id" name="classId" value="" />' +
      '<input type="hidden" id="create-course-edit-id" name="courseId" value="" />' +
      '<div><label class="text-xs font-semibold text-slate-600">Course code</label>' +
      '<input name="code" required placeholder="e.g. CS 101" class="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"/></div>' +
      '<div><label class="text-xs font-semibold text-slate-600">Course name</label>' +
      '<input name="name" required placeholder="e.g. Introduction to Programming" class="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"/></div>' +
      '<p id="create-course-error" class="hidden text-xs text-rose-600 font-medium"></p>' +
      '<div class="flex justify-end gap-2 pt-2">' +
      '<button type="button" id="create-course-cancel" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>' +
      '<button type="submit" id="create-course-submit" class="px-4 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg">Create</button>' +
      "</div></form></div>";
    document.body.appendChild(modal);

    function closeModal() {
      modal.classList.add("hidden");
      document.getElementById("create-course-form").reset();
      document.getElementById("create-course-edit-id").value = "";
      document.getElementById("create-course-title").textContent = "Create course";
      var submitBtn = document.getElementById("create-course-submit");
      if (submitBtn) submitBtn.textContent = "Create";
      document.getElementById("create-course-error").classList.add("hidden");
    }

    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal();
    });
    document.getElementById("create-course-cancel").addEventListener("click", closeModal);
    document.getElementById("create-course-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var classId = document.getElementById("create-course-class-id").value;
      var form = event.target;
      var errorEl = document.getElementById("create-course-error");
      errorEl.classList.add("hidden");
      var editId = document.getElementById("create-course-edit-id").value;
      var promise = editId
        ? Attendify.updateProgrammeCourse(editId, form.code.value, form.name.value)
        : Attendify.addProgrammeCourse(classId, form.code.value, form.name.value);
      promise.then(function (result) {
        if (!result.ok) {
          errorEl.textContent = result.error || (editId ? "Could not save the course." : "Could not create the course.");
          errorEl.classList.remove("hidden");
          return;
        }
        closeModal();
        setProgrammeOpen(classId, true);
        setProgrammesOpen(true);
        var nav = document.getElementById("faculty-nav");
        if (nav) renderClassList(nav);
        window.dispatchEvent(new CustomEvent(editId ? "attendify:course-updated" : "attendify:course-created"));
      });
    });
  }

  function openCreateCourseModal(classId, courseToEdit) {
    ensureCreateCourseModal();
    var programme = Attendify.classById(classId);
    document.getElementById("create-course-class-id").value = classId;
    document.getElementById("create-course-edit-id").value = courseToEdit ? courseToEdit.id : "";
    document.getElementById("create-course-title").textContent = courseToEdit ? "Edit course" : "Create course";
    var submitBtn = document.getElementById("create-course-submit");
    if (submitBtn) submitBtn.textContent = courseToEdit ? "Save" : "Create";
    document.getElementById("create-course-programme").textContent = programme
      ? programme.code + " · " + programme.name
      : "";
    var form = document.getElementById("create-course-form");
    if (form) {
      form.code.value = courseToEdit ? courseToEdit.code : "";
      form.name.value = courseToEdit ? courseToEdit.name : "";
    }
    document.getElementById("create-course-error").classList.add("hidden");
    document.getElementById("create-course-modal").classList.remove("hidden");
    var input = document.querySelector("#create-course-form input[name=code]");
    if (input) input.focus();
  }

  function openEditCourseModal(classId, courseId) {
    closeAllCourseMenus();
    var course = Attendify.courseById(courseId);
    if (!course) return;
    openCreateCourseModal(classId, course);
  }

  var addProgrammeCatalogue = [];

  function assignmentAlreadyOnDashboard(classId, level) {
    if (!classId || level == null || level === "") return false;
    return (Attendify.load().classes || []).some(function (row) {
      return row.id === classId && Number(row.teachLevel) === Number(level);
    });
  }

  function rebuildAddProgrammeLevelOptions(keepLevel) {
    var levelEl = document.getElementById("add-programme-level");
    var progEl = document.getElementById("add-programme-select");
    if (!levelEl || !progEl) return;
    var pick = addProgrammeCatalogue.filter(function (p) {
      return p.id === progEl.value;
    })[0];
    var html = '<option value="" disabled selected>Choose level</option>';
    if (!pick) {
      levelEl.innerHTML = html;
      return;
    }
    var max = pick.maxLevel ? Number(pick.maxLevel) : 400;
    if (!max || max < 400) max = 400;
    var prev = keepLevel ? levelEl.value : "";
    for (var lvl = 100; lvl <= max; lvl += 100) {
      var label = "Level " + lvl;
      if (lvl >= 500 && max >= 600) {
        if (lvl === 500) label = "Level 500 / clinical";
        if (lvl === 600) label = "Level 600 / final";
      }
      var taken = assignmentAlreadyOnDashboard(pick.classId, lvl);
      html +=
        '<option value="' +
        lvl +
        '"' +
        (taken ? ' disabled title="Already on your dashboard"' : "") +
        ">" +
        label +
        (taken ? " (added)" : "") +
        "</option>";
    }
    levelEl.innerHTML = html;
    if (prev && Number(prev) <= max && !assignmentAlreadyOnDashboard(pick.classId, Number(prev))) {
      levelEl.value = prev;
    }
  }

  function refreshAddProgrammeRosterNote() {
    var note = document.getElementById("add-programme-roster-note");
    var progEl = document.getElementById("add-programme-select");
    var levelEl = document.getElementById("add-programme-level");
    if (!note || !progEl || !levelEl || !window.Attendify) return;
    var uccId = progEl.value;
    var level = levelEl.value;
    if (!uccId || !level) {
      note.classList.add("hidden");
      note.textContent = "";
      return;
    }
    Attendify.previewUccProgrammeRoster(uccId, level).then(function (preview) {
      if (!preview || !preview.ok) {
        note.classList.add("hidden");
        return;
      }
      if (preview.count > 0) {
        note.textContent =
          preview.count +
          " student" +
          (preview.count === 1 ? "" : "s") +
          " already registered for " +
          (preview.programme.code || "this programme") +
          " at Level " +
          level +
          ". They will appear on your roster automatically.";
        note.classList.remove("hidden");
      } else {
        note.textContent =
          "No students at this level yet. Share the registration link from the programme page when you are ready.";
        note.classList.remove("hidden");
      }
    });
  }

  function ensureAddProgrammeModal() {
    if (document.getElementById("add-programme-modal")) return;
    var modal = document.createElement("div");
    modal.id = "add-programme-modal";
    modal.className = "hidden fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55 backdrop-blur-sm p-4";
    modal.innerHTML =
      '<div class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">' +
      '<h3 class="text-lg font-bold text-slate-900">Add programme</h3>' +
      '<p class="text-xs text-slate-500 mt-1">Choose the programme and level you teach (same as at sign-up). Existing students at that level join your roster right away.</p>' +
      '<form id="add-programme-form" class="mt-4 space-y-3">' +
      '<label class="block text-xs font-semibold text-slate-600">Programme' +
      '<select id="add-programme-select" required class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">' +
      '<option value="" disabled selected>Loading…</option>' +
      "</select></label>" +
      '<label class="block text-xs font-semibold text-slate-600">Level' +
      '<select id="add-programme-level" required class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">' +
      '<option value="" disabled selected>Choose level</option>' +
      "</select></label>" +
      '<p id="add-programme-roster-note" class="hidden text-[11px] text-teal-800 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2 leading-relaxed"></p>' +
      '<p id="add-programme-error" class="hidden text-xs font-semibold text-rose-600"></p>' +
      '<div class="flex justify-end gap-2 pt-1">' +
      '<button type="button" id="add-programme-cancel" class="px-4 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700">Cancel</button>' +
      '<button type="submit" class="px-4 py-2 rounded-xl bg-brand-900 text-white text-xs font-bold">Add to dashboard</button>' +
      "</div></form></div>";
    document.body.appendChild(modal);
    function closeModal() {
      modal.classList.add("hidden");
    }
    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal();
    });
    document.getElementById("add-programme-cancel").addEventListener("click", closeModal);
    var progSelect = document.getElementById("add-programme-select");
    var levelSelect = document.getElementById("add-programme-level");
    if (progSelect) {
      progSelect.addEventListener("change", function () {
        rebuildAddProgrammeLevelOptions(false);
        refreshAddProgrammeRosterNote();
      });
    }
    if (levelSelect) {
      levelSelect.addEventListener("change", refreshAddProgrammeRosterNote);
    }
    document.getElementById("add-programme-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var err = document.getElementById("add-programme-error");
      if (err) {
        err.classList.add("hidden");
        err.textContent = "";
      }
      var uccId = progSelect ? progSelect.value : "";
      var level = levelSelect ? Number(levelSelect.value) : 0;
      if (!uccId || !level) {
        if (err) {
          err.textContent = "Choose a programme and level.";
          err.classList.remove("hidden");
        }
        return;
      }
      Attendify.addLecturerProgramme({ uccProgrammeId: uccId, level: level }).then(function (result) {
        if (!result.ok) {
          if (err) {
            err.textContent = result.error || "Could not add the programme.";
            err.classList.remove("hidden");
          }
          return;
        }
        closeModal();
        setProgrammesOpen(true);
        if (result.assignment && result.assignment.classId) {
          setProgrammeOpen(result.assignment.classId, true);
        }
        var nav = document.getElementById("faculty-nav");
        if (nav) renderClassList(nav);
        window.dispatchEvent(new CustomEvent("attendify:programmes-updated"));
      });
    });
  }

  function openAddProgrammeModal() {
    ensureAddProgrammeModal();
    var modal = document.getElementById("add-programme-modal");
    var err = document.getElementById("add-programme-error");
    var note = document.getElementById("add-programme-roster-note");
    if (err) {
      err.classList.add("hidden");
      err.textContent = "";
    }
    if (note) note.classList.add("hidden");
    var select = document.getElementById("add-programme-select");
    if (select) {
      select.innerHTML = '<option value="" disabled selected>Loading…</option>';
    }
    modal.classList.remove("hidden");
    Attendify.fetchLecturerProgrammeCatalogue().then(function (pack) {
      addProgrammeCatalogue = (pack && pack.programmes) || [];
      if (!select) return;
      if (!addProgrammeCatalogue.length) {
        select.innerHTML = '<option value="" disabled selected>No programmes found</option>';
        return;
      }
      var html = '<option value="" disabled selected>Choose programme</option>';
      addProgrammeCatalogue.forEach(function (p) {
        html +=
          '<option value="' +
          escapeHtml(p.id) +
          '">' +
          escapeHtml((p.code || "") + " · " + (p.name || "")) +
          "</option>";
      });
      select.innerHTML = html;
      rebuildAddProgrammeLevelOptions(false);
    });
    var levelSelect = document.getElementById("add-programme-level");
    if (levelSelect) levelSelect.value = "";
  }

  function bindNav(nav) {
    nav.addEventListener("click", function (event) {
      var addProgramme = event.target.closest("[data-action=add-programme]");
      if (addProgramme) {
        event.preventDefault();
        event.stopPropagation();
        Attendify.ready().then(function () {
          openAddProgrammeModal();
        });
        return;
      }
      var addCourse = event.target.closest("[data-action=add-course]");
      if (addCourse) {
        event.preventDefault();
        event.stopPropagation();
        Attendify.ready().then(function () {
          openCreateCourseModal(addCourse.getAttribute("data-class-id"));
        });
        return;
      }
      var toggleProg = event.target.closest("[data-action=toggle-programme]");
      if (toggleProg) {
        event.preventDefault();
        toggleProgramme(nav, toggleProg.getAttribute("data-class-id"));
        return;
      }
      var courseMenuBtn = event.target.closest("[data-action=sidebar-course-menu]");
      if (courseMenuBtn) {
        event.preventDefault();
        event.stopPropagation();
        var cid = courseMenuBtn.getAttribute("data-course-id");
        var panel = document.getElementById("sb-course-menu-" + String(cid || "").replace(/[^a-zA-Z0-9_-]/g, "_"));
        if (!panel) return;
        var willOpen = panel.classList.contains("hidden");
        closeAllCourseMenus();
        if (willOpen) panel.classList.remove("hidden");
        return;
      }
      var editCourse = event.target.closest("[data-action=edit-course]");
      if (editCourse) {
        event.preventDefault();
        event.stopPropagation();
        closeAllCourseMenus();
        Attendify.ready().then(function () {
          openEditCourseModal(editCourse.getAttribute("data-class-id"), editCourse.getAttribute("data-course-id"));
        });
        return;
      }
      var deleteCourse = event.target.closest("[data-action=delete-course]");
      if (deleteCourse) {
        event.preventDefault();
        event.stopPropagation();
        closeAllCourseMenus();
        var courseCode = deleteCourse.getAttribute("data-course-code") || "this course";
        if (
          !window.confirm(
            "Delete course “" + courseCode + "”? Attendance history for this course stays in reports but the course page will be removed."
          )
        ) {
          return;
        }
        Attendify.deleteProgrammeCourse(deleteCourse.getAttribute("data-course-id")).then(function (result) {
          if (!result.ok) {
            window.alert(result.error || "Could not delete the course.");
            return;
          }
          renderClassList(nav);
          window.dispatchEvent(new CustomEvent("attendify:course-deleted"));
        });
        return;
      }
      if (event.target.closest("#sidebar-courses-toggle")) {
        event.preventDefault();
        toggleProgrammes(nav);
      }
    });
  }

  function currentBottomNavKey() {
    var nav = document.getElementById("faculty-nav");
    var page = nav ? String(nav.getAttribute("data-page") || "") : "";
    var path = String(window.location.pathname || "")
      .split("/")
      .pop()
      .toLowerCase();
    if (page === "dashboard" || path === "dashboard.html") return "dashboard";
    if (page === "reports" || path === "reports.html") return "reports";
    if (page === "settings" || path === "settings.html") return "settings";
    if (page === "courses" || page === "programme" || path === "course.html" || path === "programme.html") {
      return "attendance";
    }
    return "dashboard";
  }

  function attendanceNavHref() {
    var params = new URLSearchParams(window.location.search);
    var prog = params.get("programme") || params.get("class") || "";
    var course = params.get("course") || "";
    if (prog && course) {
      return (
        "course.html?programme=" + encodeURIComponent(prog) + "&course=" + encodeURIComponent(course)
      );
    }
    try {
      if (window.Attendify) {
        var classId = activeClassId();
        if (!classId) {
          var state = Attendify.load();
          classId = state.activeClassId || (state.classes[0] && state.classes[0].id) || "";
        }
        if (classId) {
          var courses = Attendify.coursesForProgramme(classId) || [];
          if (courses[0]) {
            return (
              "course.html?programme=" +
              encodeURIComponent(classId) +
              "&course=" +
              encodeURIComponent(courses[0].id)
            );
          }
          var lvl = params.get("level") || "";
          return (
            "programme.html?programme=" +
            encodeURIComponent(classId) +
            (lvl ? "&level=" + encodeURIComponent(lvl) : "")
          );
        }
      }
    } catch (_) {}
    return "dashboard.html";
  }

  function programmeAttendanceLabel(programme) {
    var bits = [];
    if (programme.code) bits.push(String(programme.code));
    if (programme.name) bits.push(String(programme.name));
    var label = bits.join(" · ") || "Programme";
    if (programme.teachLevel != null && programme.teachLevel !== "") {
      label += " · L" + String(programme.teachLevel);
    }
    return label;
  }

  function courseAttendanceHref(programme, course) {
    return (
      "course.html?programme=" +
      encodeURIComponent(programme.id) +
      "&course=" +
      encodeURIComponent(course.id)
    );
  }

  function programmeAttendanceHref(programme) {
    var href = "programme.html?programme=" + encodeURIComponent(programme.id);
    if (programme.teachLevel != null && programme.teachLevel !== "") {
      href += "&level=" + encodeURIComponent(programme.teachLevel);
    }
    return href;
  }

  function ensureMobileAttendancePickerModal() {
    if (document.getElementById("mobile-attendance-picker")) return;
    var modal = document.createElement("div");
    modal.id = "mobile-attendance-picker";
    modal.className =
      "hidden fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-900/55 backdrop-blur-sm p-0 sm:p-4";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "mobile-attendance-picker-title");
    modal.innerHTML =
      '<div class="mobile-attendance-picker-sheet bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 w-full max-w-md max-h-[min(88vh,32rem)] flex flex-col">' +
      '<div class="flex items-center gap-2 px-4 pt-4 pb-2 border-b border-slate-100 shrink-0">' +
      '<button type="button" id="mobile-attendance-picker-back" class="hidden shrink-0 w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center" aria-label="Back">' +
      '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></button>' +
      '<div class="min-w-0 flex-1">' +
      '<h3 id="mobile-attendance-picker-title" class="text-base font-bold text-slate-900 truncate">Attendance</h3>' +
      '<p id="mobile-attendance-picker-subtitle" class="text-[11px] text-slate-500 mt-0.5 truncate"></p>' +
      "</div>" +
      '<button type="button" id="mobile-attendance-picker-close" class="shrink-0 w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center" aria-label="Close">' +
      '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' +
      "</button></div>" +
      '<div id="mobile-attendance-picker-list" class="overflow-y-auto flex-1 px-3 py-3 space-y-2"></div>' +
      "</div>";
    document.body.appendChild(modal);

    var pickerState = { programmes: [], programmeIndex: -1 };

    function closePicker() {
      modal.classList.add("hidden");
      pickerState.programmeIndex = -1;
      document.getElementById("mobile-attendance-picker-list").innerHTML = "";
    }

    function renderProgrammeStep() {
      var programmes = pickerState.programmes;
      var title = document.getElementById("mobile-attendance-picker-title");
      var subtitle = document.getElementById("mobile-attendance-picker-subtitle");
      var list = document.getElementById("mobile-attendance-picker-list");
      var backBtn = document.getElementById("mobile-attendance-picker-back");
      if (title) title.textContent = "Choose programme";
      if (subtitle) subtitle.textContent = "Select where you want to take attendance.";
      if (backBtn) backBtn.classList.add("hidden");
      list.innerHTML = programmes
        .map(function (programme, index) {
          return (
            '<button type="button" data-attendance-pick="programme" data-programme-index="' +
            index +
            '" class="mobile-attendance-picker-item w-full text-left px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-200 transition">' +
            '<span class="block text-sm font-bold text-brand-900">' +
            escapeHtml(programme.code || programme.id) +
            "</span>" +
            '<span class="block text-xs text-slate-600 mt-0.5">' +
            escapeHtml(programme.name || "") +
            (programme.teachLevel != null && programme.teachLevel !== ""
              ? ' <span class="font-semibold text-teal-700">· L' + escapeHtml(programme.teachLevel) + "</span>"
              : "") +
            "</span></button>"
          );
        })
        .join("");
    }

    function openCourseStep(programme, showBack) {
      if (!programme || !window.Attendify) return;
      var courses = Attendify.coursesForProgramme(programme.id) || [];
      if (!courses.length) {
        closePicker();
        window.location.href = programmeAttendanceHref(programme);
        return;
      }
      if (courses.length === 1) {
        closePicker();
        window.location.href = courseAttendanceHref(programme, courses[0]);
        return;
      }
      var title = document.getElementById("mobile-attendance-picker-title");
      var subtitle = document.getElementById("mobile-attendance-picker-subtitle");
      var list = document.getElementById("mobile-attendance-picker-list");
      var backBtn = document.getElementById("mobile-attendance-picker-back");
      if (title) title.textContent = "Choose class";
      if (subtitle) subtitle.textContent = programmeAttendanceLabel(programme);
      if (backBtn) backBtn.classList.toggle("hidden", !showBack);
      list.innerHTML = courses
        .map(function (course) {
          return (
            '<button type="button" data-attendance-pick="course" data-programme-index="' +
            pickerState.programmeIndex +
            '" data-course-id="' +
            escapeHtml(course.id) +
            '" class="mobile-attendance-picker-item w-full text-left px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-200 transition">' +
            '<span class="block text-sm font-bold font-mono text-brand-900">' +
            escapeHtml(course.code) +
            "</span>" +
            '<span class="block text-xs text-slate-600 mt-0.5">' +
            escapeHtml(course.name) +
            "</span></button>"
          );
        })
        .join("");
      modal.classList.remove("hidden");
    }

    modal.addEventListener("click", function (event) {
      if (event.target === modal) closePicker();
    });
    document.getElementById("mobile-attendance-picker-close").addEventListener("click", closePicker);
    document.getElementById("mobile-attendance-picker-back").addEventListener("click", function () {
      pickerState.programmeIndex = -1;
      renderProgrammeStep();
    });
    function handleAttendancePickerTap(event) {
      var pick = event.target.closest("[data-attendance-pick]");
      if (!pick) return;
      var kind = pick.getAttribute("data-attendance-pick");
      if (kind === "programme") {
        var idx = parseInt(pick.getAttribute("data-programme-index"), 10);
        var programme = pickerState.programmes[idx];
        if (!programme) return;
        pickerState.programmeIndex = idx;
        openCourseStep(programme, pickerState.programmes.length > 1);
        return;
      }
      if (kind === "course") {
        var pIdx = parseInt(pick.getAttribute("data-programme-index"), 10);
        var courseId = pick.getAttribute("data-course-id") || "";
        var prog = pickerState.programmes[pIdx];
        if (!prog || !courseId) return;
        var course = (Attendify.coursesForProgramme(prog.id) || []).filter(function (c) {
          return c.id === courseId;
        })[0];
        if (!course) return;
        closePicker();
        window.location.href = courseAttendanceHref(prog, course);
      }
    }
  var pickerListEl = document.getElementById("mobile-attendance-picker-list");
  if (pickerListEl) {
    pickerListEl.addEventListener("click", handleAttendancePickerTap);
    pickerListEl.addEventListener(
      "touchend",
      function (event) {
        if (!event.target.closest("[data-attendance-pick]")) return;
        event.preventDefault();
        handleAttendancePickerTap(event);
      },
      { passive: false }
    );
  }

    window.AttendifyMobileAttendancePicker = {
      open: function () {
        if (!window.Attendify) return;
        Attendify.ready().then(function () {
          var programmes = Attendify.load().classes || [];
          if (!programmes.length) {
            window.alert("Create a programme on the dashboard first.");
            return;
          }
          pickerState.programmes = programmes;
          pickerState.programmeIndex = -1;
          if (programmes.length > 1) {
            renderProgrammeStep();
            modal.classList.remove("hidden");
            return;
          }
          openCourseStep(programmes[0], false);
        });
      },
      close: closePicker
    };
  }

  function startMobileAttendanceFlow() {
    ensureMobileAttendancePickerModal();
    if (window.AttendifyMobileAttendancePicker) AttendifyMobileAttendancePicker.open();
  }

  function bottomNavIcon(kind) {
    var paths = {
      dashboard:
        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>',
      attendance:
        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>',
      reports:
        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>',
      settings:
        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>'
    };
    return (
      '<svg class="faculty-bottom-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">' +
      (paths[kind] || paths.dashboard) +
      "</svg>"
    );
  }

  function initMobileBottomNav() {
    if (document.getElementById("faculty-bottom-nav")) return;
    var active = currentBottomNavKey();
    var items = [
      { key: "dashboard", href: "dashboard.html", label: "Dashboard" },
      { key: "attendance", href: attendanceNavHref(), label: "Attendance" },
      { key: "reports", href: "reports.html", label: "Report" },
      { key: "settings", href: "settings.html", label: "Settings" }
    ];
    var bar = document.createElement("nav");
    bar.id = "faculty-bottom-nav";
    bar.className = "faculty-bottom-nav";
    bar.setAttribute("aria-label", "Main navigation");
    bar.innerHTML = items
      .map(function (item) {
        var isActive = item.key === active;
        return (
          '<a href="' +
          item.href +
          '" data-bottom-nav="' +
          item.key +
          '" class="faculty-bottom-nav-item' +
          (isActive ? " is-active" : "") +
          '"' +
          (isActive ? ' aria-current="page"' : "") +
          ">" +
          bottomNavIcon(item.key) +
          '<span class="faculty-bottom-nav-label">' +
          item.label +
          "</span></a>"
        );
      })
      .join("");
    document.body.appendChild(bar);
    document.body.classList.add("has-faculty-bottom-nav");

    function onAttendanceNavTap(event) {
      var attendanceLink = event.target.closest('[data-bottom-nav="attendance"]');
      if (!attendanceLink) return;
      event.preventDefault();
      startMobileAttendanceFlow();
    }
    bar.addEventListener("click", onAttendanceNavTap);
    bar.addEventListener("touchend", onAttendanceNavTap, { passive: false });

    function refreshAttendanceLink() {
      var link = bar.querySelector('[data-bottom-nav="attendance"]');
      if (!link) return;
      link.setAttribute("href", attendanceNavHref());
      if (currentBottomNavKey() === "attendance") link.classList.add("is-active");
    }

    if (window.Attendify && Attendify.ready) {
      Attendify.ready().then(refreshAttendanceLink);
    }
    window.addEventListener("attendify:programmes-updated", refreshAttendanceLink);
    window.addEventListener("attendify:course-created", refreshAttendanceLink);
  }

  function facultyAppBarTitle() {
    var nav = document.getElementById("faculty-nav");
    var page = nav ? String(nav.getAttribute("data-page") || "") : "";
    var map = {
      dashboard: "Dashboard",
      reports: "Report",
      settings: "Settings",
      courses: "Course",
      programme: "Programme"
    };
    if (map[page]) return map[page];
    var header = document.querySelector("main > header");
    if (header) {
      var p = header.querySelector(".faculty-topbar-desktop p.font-black, .faculty-topbar-desktop h1");
      if (p && p.textContent) return String(p.textContent).trim();
    }
    return "Attendify";
  }

  function facultyBackHref() {
    var nav = document.getElementById("faculty-nav");
    var page = nav ? String(nav.getAttribute("data-page") || "") : "";
    var params = new URLSearchParams(window.location.search);
    if (page === "dashboard") return "";
    if (page === "courses") {
      var prog = params.get("programme") || params.get("class") || "";
      if (prog) return "programme.html?programme=" + encodeURIComponent(prog);
      return "dashboard.html";
    }
    if (page === "programme") return "dashboard.html";
    return "dashboard.html";
  }

  function initFacultyAppBar(header) {
    if (!header || header.dataset.facultyAppBar === "1") return;
    header.dataset.facultyAppBar = "1";
    header.classList.add("faculty-topbar");

    var desktop = document.createElement("div");
    desktop.className = "faculty-topbar-desktop w-full";
    while (header.firstChild) desktop.appendChild(header.firstChild);
    header.appendChild(desktop);

    var navRoot = document.getElementById("faculty-nav");
    var pageKey = navRoot ? String(navRoot.getAttribute("data-page") || "") : "";
    var isDashboardHome = pageKey === "dashboard";
    var backHref = facultyBackHref();
    var titleText = isDashboardHome ? "" : facultyAppBarTitle();
    var appBar = document.createElement("div");
    appBar.className = "faculty-app-bar" + (isDashboardHome ? " faculty-app-bar--home" : "");
    appBar.innerHTML =
      (backHref
        ? '<button type="button" id="btn-faculty-back" class="faculty-app-back" aria-label="Go back">' +
          '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></button>'
        : "") +
      (titleText
        ? '<p class="faculty-app-bar-title">' + escapeHtml(titleText) + "</p>"
        : "") +
      '<div class="faculty-app-bar-actions">' +
      '<a href="settings.html" class="faculty-header-profile" id="faculty-header-profile" aria-label="Account and settings">' +
      '<span id="faculty-header-avatar" class="faculty-header-avatar-slot"></span>' +
      "</a>" +
      '<button type="button" id="btn-sidebar-toggle" class="faculty-menu-dots" aria-expanded="false" aria-controls="faculty-sidebar" aria-label="Open menu">' +
      menuDotsSvg +
      "</button></div>";
    header.insertBefore(appBar, desktop);

    var backBtn = document.getElementById("btn-faculty-back");
    if (backBtn && backHref) {
      backBtn.addEventListener("click", function () {
        window.location.href = backHref;
      });
    }
  }

  function ensureTabletSidebarToggle(desktopWrap) {
    if (!desktopWrap || document.getElementById("btn-sidebar-toggle-tablet")) return;
    if (document.getElementById("btn-sidebar-toggle")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btn-sidebar-toggle-tablet";
    btn.className = "faculty-sidebar-toggle faculty-sidebar-toggle--tablet";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "faculty-sidebar");
    btn.setAttribute("aria-label", "Open navigation menu");
    btn.innerHTML =
      '<svg class="faculty-sidebar-toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>' +
      "</svg>";
    desktopWrap.insertBefore(btn, desktopWrap.firstChild);
    return btn;
  }

  function initMobileSidebar(nav) {
    var aside = document.querySelector("body > aside");
    var main = document.querySelector("body > main");
    if (!aside || !main) return;
    aside.classList.add("faculty-sidebar");
    if (!aside.id) aside.id = "faculty-sidebar";

    var header = main.querySelector("header");
    if (!header) return;
    initFacultyAppBar(header);

    var backdrop = document.getElementById("faculty-sidebar-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "faculty-sidebar-backdrop";
      backdrop.className = "faculty-sidebar-backdrop";
      backdrop.hidden = true;
      document.body.appendChild(backdrop);
    }

    var btn = document.getElementById("btn-sidebar-toggle");
    if (!btn) {
      var desktopWrap = header.querySelector(".faculty-topbar-desktop");
      btn = ensureTabletSidebarToggle(desktopWrap);
    }
    if (!btn) return;

    var tabletBtn = document.getElementById("btn-sidebar-toggle-tablet");

    function setSidebarOpen(open) {
      var on = !!open;
      document.body.classList.toggle("faculty-sidebar-open", on);
      backdrop.hidden = !on;
      [btn, tabletBtn].forEach(function (toggle) {
        if (!toggle) return;
        toggle.setAttribute("aria-expanded", on ? "true" : "false");
        toggle.setAttribute("aria-label", on ? "Close navigation menu" : "Open menu");
      });
      document.body.style.overflow = on ? "hidden" : "";
    }

    if (!header.dataset.sidebarBound) {
      header.dataset.sidebarBound = "1";
      [btn, tabletBtn].forEach(function (toggle) {
        if (!toggle) return;
        toggle.addEventListener("click", function () {
          setSidebarOpen(!document.body.classList.contains("faculty-sidebar-open"));
        });
      });
      backdrop.addEventListener("click", function () {
        setSidebarOpen(false);
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") setSidebarOpen(false);
      });
      if (nav) {
        nav.addEventListener("click", function (event) {
          if (event.target.closest('a[href*=".html"]')) setSidebarOpen(false);
        });
      }
      window.addEventListener(
        "resize",
        function () {
          if (window.matchMedia("(min-width: 1024px)").matches) setSidebarOpen(false);
        },
        { passive: true }
      );
    }
  }

  function mount() {
    var nav = document.getElementById("faculty-nav");
    if (!nav) return;
    document.body.classList.add("faculty-content-pending");
    initMobileSidebar(nav);
    initMobileBottomNav();
    renderShell(nav);
    bindNav(nav);
    ensureCreateCourseModal();
    ensureAddProgrammeModal();
    ensureMobileAttendancePickerModal();
    if (!window.Attendify) return;
    Attendify.ready().then(function () {
      renderClassList(nav);
      var session = Attendify.getSession && Attendify.getSession();
      if (session && session.lecturer && Attendify.paintLecturerChrome) {
        Attendify.paintLecturerChrome(session.lecturer, { sidebar: true, header: true });
      }
      document.body.classList.remove("faculty-content-pending");
      document.body.classList.add("faculty-content-ready");
    });
    document.querySelectorAll("#btn-logout").forEach(function (logoutBtn) {
      if (logoutBtn.dataset.bound) return;
      logoutBtn.dataset.bound = "1";
      logoutBtn.addEventListener("click", function () {
        if (window.Attendify && Attendify.logoutLecturer) Attendify.logoutLecturer();
      });
    });
    window.addEventListener("attendify:programmes-updated", function () {
      renderClassList(nav);
    });
    window.addEventListener("attendify:course-created", function () {
      renderClassList(nav);
    });
    window.addEventListener("attendify:course-updated", function () {
      renderClassList(nav);
    });
    window.addEventListener("attendify:course-deleted", function () {
      renderClassList(nav);
    });
    document.addEventListener("click", function (event) {
      if (!event.target.closest("[data-sidebar-course-menu]") && !event.target.closest("[data-action=sidebar-course-menu]")) {
        closeAllCourseMenus();
      }
    });
    setInterval(function () {
      if (document.hidden) return;
      Attendify.ready().then(function () {
        renderClassList(nav);
      });
    }, 12000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  document.addEventListener("click", function (event) {
    if (!event.target.closest("#btn-add-programme-dashboard")) return;
    event.preventDefault();
    if (!window.Attendify) return;
    Attendify.ready().then(function () {
      openAddProgrammeModal();
    });
  });

  window.AttendifySidebar = {
    refresh: function () {
      var nav = document.getElementById("faculty-nav");
      if (nav) renderClassList(nav);
    },
    openCreateCourseModal: openCreateCourseModal,
    openEditCourseModal: openEditCourseModal,
    openAddProgrammeModal: openAddProgrammeModal
  };
})();
