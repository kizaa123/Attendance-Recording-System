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
      '<button type="button" id="sidebar-add-class" title="Create programme" class="w-8 h-8 shrink-0 rounded-lg bg-tealAccent-600 hover:bg-tealAccent-500 text-white font-bold text-lg leading-none flex items-center justify-center shadow-sm transition">+</button>' +
      "</div>" +
      '<div id="sidebar-courses-list" class="sidebar-courses-list mt-1 space-y-0.5 overflow-hidden ' + (expanded ? "" : "hidden") + '"></div>' +
      "</div>" +
      '<a href="reports.html" data-nav-link="reports" class="' + linkClass(page === "reports") + '">' +
      '<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' +
      "Report</a>";
  }

  function renderClassList(nav) {
    var list = nav.querySelector("#sidebar-courses-list");
    if (!list || !window.Attendify) return;
    var classes = Attendify.load().classes || [];
    var currentProgramme = activeClassId();
    var currentCourse = activeCourseId();
    if (!classes.length) {
      list.innerHTML =
        '<p class="pl-8 pr-2 py-2 text-[11px] text-slate-500">No programmes yet. Tap <strong class="text-slate-400">+</strong> to create one.</p>';
      return;
    }
    list.innerHTML = classes
      .map(function (programme) {
        var progOpen = isProgrammeOpen(programme.id);
        var courses = Attendify.coursesForProgramme(programme.id);
        var chevronRot = progOpen ? "rotate-180" : "";
        var coursesHidden = progOpen ? "" : "hidden";
        var programmeActive = programme.id === currentProgramme && !currentCourse;
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
            return (
              '<a href="' +
              href +
              '" class="' +
              courseCls +
              '"><span class="font-mono">' +
              escapeHtml(course.code) +
              "</span> · " +
              '<span class="opacity-90 truncate">' +
              escapeHtml(course.name) +
              "</span></a>"
            );
          })
          .join("");
        if (!courses.length) {
          courseLines =
            '<p class="pl-11 pr-2 py-1 text-[10px] text-slate-500 italic">No courses — tap + to add one.</p>';
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
          '" class="flex items-center gap-1.5 flex-1 min-w-0 pl-1 pr-1 py-2 rounded-lg text-xs font-semibold ' +
          rowBg +
          ' transition truncate" title="Registration &amp; roster">' +
          '<span class="truncate"><span class="font-mono text-[11px]">' +
          escapeHtml(programme.code) +
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

  function ensureCreateModal() {
    var old = document.getElementById("create-class-modal");
    if (old && old.querySelector('input[name="department"]')) old.remove();
    if (document.getElementById("create-class-modal")) return;
    var modal = document.createElement("div");
    modal.id = "create-class-modal";
    modal.className = "hidden fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55 backdrop-blur-sm p-4";
    modal.innerHTML =
      '<div class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">' +
      '<h3 class="text-lg font-bold text-slate-900">Create programme</h3>' +
      '<p class="text-xs text-slate-500 mt-1">Add courses under the programme, then take attendance by week.</p>' +
      '<form id="create-class-form" class="mt-4 space-y-3">' +
      '<div><label class="text-xs font-semibold text-slate-600">Programme code</label>' +
      '<input name="code" required placeholder="e.g. BSc CS" class="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"/></div>' +
      '<div><label class="text-xs font-semibold text-slate-600">Programme name</label>' +
      '<input name="name" required placeholder="e.g. BSc Computer Science" class="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"/></div>' +
      '<p id="create-class-error" class="hidden text-xs text-rose-600 font-medium"></p>' +
      '<div class="flex justify-end gap-2 pt-2">' +
      '<button type="button" id="create-class-cancel" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>' +
      '<button type="submit" class="px-4 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg">Create</button>' +
      "</div></form></div>";
    document.body.appendChild(modal);

    function closeModal() {
      modal.classList.add("hidden");
      var form = document.getElementById("create-class-form");
      form.reset();
      form.dataset.saving = "0";
      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Create";
      }
      document.getElementById("create-class-error").classList.add("hidden");
      document.getElementById("create-class-error").textContent = "";
    }

    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal();
    });
    document.getElementById("create-class-cancel").addEventListener("click", closeModal);
    document.getElementById("create-class-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var form = event.target;
      if (form.dataset.saving === "1") return;
      form.dataset.saving = "1";
      var errorEl = document.getElementById("create-class-error");
      var submitBtn = form.querySelector('button[type="submit"]');
      errorEl.classList.add("hidden");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving…";
      }
      Attendify.addClass(form.code.value, form.name.value).then(function (result) {
        form.dataset.saving = "0";
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Create";
        }
        if (!result.ok) {
          errorEl.textContent = result.error || "Could not create the programme.";
          errorEl.classList.remove("hidden");
          return;
        }
        closeModal();
        setProgrammeOpen(result.classId, true);
        setProgrammesOpen(true);
        var nav = document.getElementById("faculty-nav");
        if (nav) renderClassList(nav);
        window.dispatchEvent(new CustomEvent("attendify:class-created", { detail: { classId: result.classId } }));
      });
    });
  }

  function ensureCreateCourseModal() {
    if (document.getElementById("create-course-modal")) return;
    var modal = document.createElement("div");
    modal.id = "create-course-modal";
    modal.className = "hidden fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55 backdrop-blur-sm p-4";
    modal.innerHTML =
      '<div class="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">' +
      '<h3 class="text-lg font-bold text-slate-900">Create course</h3>' +
      '<p class="text-xs text-slate-500 mt-1">Programme <span id="create-course-programme" class="font-semibold text-slate-700"></span></p>' +
      '<form id="create-course-form" class="mt-4 space-y-3">' +
      '<input type="hidden" id="create-course-class-id" name="classId" value="" />' +
      '<div><label class="text-xs font-semibold text-slate-600">Course code</label>' +
      '<input name="code" required placeholder="e.g. CS 101" class="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"/></div>' +
      '<div><label class="text-xs font-semibold text-slate-600">Course name</label>' +
      '<input name="name" required placeholder="e.g. Introduction to Programming" class="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"/></div>' +
      '<p id="create-course-error" class="hidden text-xs text-rose-600 font-medium"></p>' +
      '<div class="flex justify-end gap-2 pt-2">' +
      '<button type="button" id="create-course-cancel" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>' +
      '<button type="submit" class="px-4 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg">Create</button>' +
      "</div></form></div>";
    document.body.appendChild(modal);

    function closeModal() {
      modal.classList.add("hidden");
      document.getElementById("create-course-form").reset();
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
      Attendify.addProgrammeCourse(classId, form.code.value, form.name.value).then(function (result) {
        if (!result.ok) {
          errorEl.textContent = result.error || "Could not create the course.";
          errorEl.classList.remove("hidden");
          return;
        }
        closeModal();
        setProgrammeOpen(classId, true);
        setProgrammesOpen(true);
        var nav = document.getElementById("faculty-nav");
        if (nav) renderClassList(nav);
        window.dispatchEvent(new CustomEvent("attendify:course-created"));
      });
    });
  }

  function openCreateModal() {
    ensureCreateModal();
    document.getElementById("create-class-error").classList.add("hidden");
    document.getElementById("create-class-modal").classList.remove("hidden");
    var input = document.querySelector("#create-class-form input[name=code]");
    if (input) input.focus();
  }

  function openCreateCourseModal(classId) {
    ensureCreateCourseModal();
    var programme = Attendify.classById(classId);
    document.getElementById("create-course-class-id").value = classId;
    document.getElementById("create-course-programme").textContent = programme
      ? programme.code + " — " + programme.name
      : "";
    document.getElementById("create-course-error").classList.add("hidden");
    document.getElementById("create-course-modal").classList.remove("hidden");
    var input = document.querySelector("#create-course-form input[name=code]");
    if (input) input.focus();
  }

  function bindNav(nav) {
    nav.addEventListener("click", function (event) {
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
      if (event.target.closest("#sidebar-add-class")) {
        event.preventDefault();
        event.stopPropagation();
        if (window.Attendify) Attendify.ready().then(openCreateModal);
        else openCreateModal();
        return;
      }
      if (event.target.closest("#sidebar-courses-toggle")) {
        event.preventDefault();
        toggleProgrammes(nav);
      }
    });
  }

  function mount() {
    var nav = document.getElementById("faculty-nav");
    if (!nav) return;
    renderShell(nav);
    bindNav(nav);
    ensureCreateModal();
    ensureCreateCourseModal();
    if (!window.Attendify) return;
    Attendify.ready().then(function () {
      renderClassList(nav);
    });
    window.addEventListener("attendify:class-created", function () {
      renderClassList(nav);
    });
    window.addEventListener("attendify:course-created", function () {
      renderClassList(nav);
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

  window.AttendifySidebar = {
    refresh: function () {
      var nav = document.getElementById("faculty-nav");
      if (nav) renderClassList(nav);
    },
    openCreateCourseModal: openCreateCourseModal
  };
})();
