(function () {
  "use strict";

  var selectedClassId = "";
  var selectedCourseId = "";
  var selectedWeek = "all";
  var searchQuery = "";
  var currentFilteredRows = [];

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtTime(iso) {
    if (!iso) return "…";
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
    } catch (e) {
      return String(iso);
    }
  }

  function fmtLevel(student) {
    return Attendify.formatStudentLevel ? Attendify.formatStudentLevel(student) : "…";
  }

  function studentPhoto(s) {
    if (!s) return "";
    if (s.photo && String(s.photo).trim()) return String(s.photo).trim();
    var idx = s.index || s.studentIndex;
    if (!idx) return "";
    return "https://cdn.ucc.edu.gh/photos/?tag=" + encodeURIComponent(String(idx).trim()).replace(/%2F/gi, "/");
  }

  function renderAvatar(s, sizeClass) {
    var name = typeof s === "string" ? s : (s && s.name) || "";
    var photo = typeof s === "object" ? studentPhoto(s) : "";
    var ini = Attendify.initials(name);
    var size = sizeClass || "w-8 h-8";

    if (photo) {
      return (
        '<div class="' + size + ' rounded-full overflow-hidden shrink-0 relative bg-slate-200 select-none shadow-sm">' +
          '<img src="' + esc(photo) + '" alt="' + esc(name) + '" class="w-full h-full object-cover" onerror="this.style.display=\'none\'; if(this.nextElementSibling) this.nextElementSibling.style.display=\'flex\';" />' +
          '<span class="hidden absolute inset-0 items-center justify-center bg-teal-100 text-teal-800 font-bold text-xs">' + esc(ini) + '</span>' +
        '</div>'
      );
    }

    return (
      '<span class="' + size + ' rounded-full bg-brand-100 text-brand-800 font-bold text-xs inline-flex items-center justify-center shrink-0 select-none shadow-sm">' +
        esc(ini) +
      '</span>'
    );
  }

  function init() {
    var params = new URLSearchParams(window.location.search);
    var initialClass = params.get("class") || params.get("programme") || "";
    var initialCourse = params.get("course") || "";
    var initialWeek = params.get("week") || "all";

    var state = Attendify.load();
    var classes = state.classes || [];
    if (!classes.length) return;

    selectedClassId = initialClass && classes.some(function (c) { return c.id === initialClass; })
      ? initialClass
      : (state.activeClassId || classes[0].id);

    selectedCourseId = initialCourse;
    selectedWeek =
      initialWeek === "all" || /^\d{1,2}(?::quiz[12])?$/i.test(String(initialWeek))
        ? initialWeek
        : "all";

    fillProgrammes();
    fillCourses();
    fillWeeks();
    renderReport();
    bindEvents();
  }

  function fillProgrammes() {
    var sel = document.getElementById("report-programme-select");
    if (!sel) return;
    var classes = Attendify.load().classes || [];
    sel.innerHTML = classes
      .map(function (c) {
        var selected = c.id === selectedClassId ? " selected" : "";
        var level =
          c.teachLevel != null && c.teachLevel !== "" ? " · L" + String(c.teachLevel) : "";
        return (
          '<option value="' +
          esc(c.id) +
          '"' +
          selected +
          ">" +
          esc(c.code + " · " + c.name + level) +
          "</option>"
        );
      })
      .join("");
  }

  function semesterWeekTotal() {
    var info = Attendify.semesterInfo();
    return Number(info && info.totalWeeks) > 0 ? Number(info.totalWeeks) : 15;
  }

  function ensureCourseSelection() {
    var courses = Attendify.coursesForProgramme(selectedClassId) || [];
    if (!courses.length) {
      selectedCourseId = "";
      return;
    }
    if (!selectedCourseId || !courses.some(function (c) { return c.id === selectedCourseId; })) {
      selectedCourseId = courses[0].id;
    }
  }

  function fillCourses() {
    var sel = document.getElementById("report-course-select");
    if (!sel) return;
    ensureCourseSelection();
    var courses = Attendify.coursesForProgramme(selectedClassId) || [];
    if (!courses.length) {
      sel.innerHTML = '<option value="">No courses in this programme</option>';
      return;
    }
    sel.innerHTML = courses
      .map(function (c) {
        var selected = c.id === selectedCourseId ? " selected" : "";
        return '<option value="' + esc(c.id) + '"' + selected + '>' + esc(c.code + " · " + c.name) + "</option>";
      })
      .join("");
  }

  function sessionsForFilters(state, programmeId, courseId, weekFilter) {
    var sessionList = Object.values(state.sessions || {}).filter(function (s) {
      return s.classId === programmeId || (s.linkedClassIds && s.linkedClassIds.indexOf(programmeId) !== -1);
    });
    sessionList = sessionList.filter(function (s) {
      return String(s.courseId || "") === String(courseId || "");
    });
    if (weekFilter !== "all") {
      var parsed = Attendify.parseReportWeekFilter(weekFilter);
      if (parsed.mode === "week") {
        sessionList = sessionList.filter(function (s) {
          if (Number(s.weekNumber) !== parsed.weekNumber) return false;
          return Attendify.sessionKindFromLectureName(s.lectureName) === parsed.sessionKind;
        });
      }
    }
    return sessionList;
  }

  /** Roll-call slots (week + optional quiz) where attendance was taken or session ended. */
  function rollCallSlotsFromSessions(sessionList) {
    var seen = {};
    var slots = [];
    sessionList.forEach(function (sess) {
      var w = Number(sess.weekNumber);
      if (!w || w < 1) return;
      var hasRecords = (sess.records || []).length > 0;
      var ended = !!(sess.closedAt || sess.endedAt);
      if (!hasRecords && !ended) return;
      var kind = Attendify.sessionKindFromLectureName(sess.lectureName);
      var key = w + ":" + kind;
      if (seen[key]) return;
      seen[key] = true;
      slots.push({ weekNumber: w, sessionKind: kind });
    });
    var kindOrder = { lecture: 0, quiz1: 1, quiz2: 2 };
    slots.sort(function (a, b) {
      if (a.weekNumber !== b.weekNumber) return a.weekNumber - b.weekNumber;
      return (kindOrder[a.sessionKind] || 0) - (kindOrder[b.sessionKind] || 0);
    });
    return slots;
  }

  function slotTitle(slot, present) {
    var label = Attendify.reportWeekFilterLabel(
      slot.weekNumber + (slot.sessionKind !== "lecture" ? ":" + slot.sessionKind : "")
    );
    return label + (present ? ": Present" : ": Absent");
  }

  function buildWeekMarkBoxesHtml(studentId, slotsTaken, sessionList) {
    if (!slotsTaken.length) return "";
    return slotsTaken
      .map(function (slot) {
        var hasScan = studentAttendedSlot(studentId, slot, sessionList);
        var title = slotTitle(slot, hasScan);
        var isQuiz = slot.sessionKind === "quiz1" || slot.sessionKind === "quiz2";
        if (hasScan) {
          return (
            '<span class="w-3 h-3.5 rounded-sm ' +
            (isQuiz ? "bg-blue-500" : "bg-emerald-500") +
            ' inline-block shadow-sm" title="' +
            esc(title) +
            '"></span>'
          );
        }
        return (
          '<span class="w-3 h-3.5 rounded-sm bg-rose-500 inline-block shadow-sm" title="' +
          esc(title) +
          '"></span>'
        );
      })
      .join("");
  }

  function studentAttendedSlot(studentId, slot, sessionList) {
    return sessionList.some(function (sess) {
      if (Number(sess.weekNumber) !== slot.weekNumber) return false;
      if (Attendify.sessionKindFromLectureName(sess.lectureName) !== slot.sessionKind) return false;
      return (sess.records || []).some(function (r) {
        return r.studentId === studentId;
      });
    });
  }

  function attendedSlotCount(studentId, slotsTaken, sessionList) {
    var count = 0;
    slotsTaken.forEach(function (slot) {
      if (studentAttendedSlot(studentId, slot, sessionList)) count += 1;
    });
    return count;
  }

  /** Per-student rank from their present weeks vs roll-call weeks only (not class/course/semester). */
  function studentAggregateTier(presentRollCallWeeks, rollCallWeeksTotal) {
    if (rollCallWeeksTotal <= 0 || presentRollCallWeeks == null) {
      return {
        box: "bg-slate-100 text-slate-600 border-slate-200",
        label: "…"
      };
    }
    var pct = (Number(presentRollCallWeeks) / rollCallWeeksTotal) * 100;
    if (pct >= 75) {
      return { box: "bg-emerald-100 text-emerald-800 border-emerald-300", tier: "good", label: "Good" };
    }
    if (pct >= 50) {
      return { box: "bg-amber-100 text-amber-800 border-amber-300", tier: "fair", label: "Fair" };
    }
    return { box: "bg-rose-100 text-rose-800 border-rose-300", tier: "bad", label: "Poor" };
  }

  function syncTableHeader(isAggregate) {
    var col = document.getElementById("report-col-scanned");
    if (col) col.textContent = isAggregate ? "Aggregate" : "Scanned At";
    var weekCol = document.getElementById("report-col-week");
    if (weekCol) weekCol.textContent = isAggregate ? "Weeks roll call" : "Week";
    var statusCol = document.getElementById("report-col-status");
    if (statusCol) statusCol.textContent = isAggregate ? "Week marks" : "Status";
  }

  function fillWeeks() {
    var sel = document.getElementById("report-week-select");
    if (!sel) return;
    var total = semesterWeekTotal();
    var html = '<option value="all">All Weeks (Aggregate)</option>';
    var w;
    for (w = 1; w <= total; w++) {
      var keys = [
        { value: String(w), label: "Week " + w },
        { value: w + ":quiz1", label: "Week " + w + " · Quiz 1" },
        { value: w + ":quiz2", label: "Week " + w + " · Quiz 2" }
      ];
      var i;
      for (i = 0; i < keys.length; i++) {
        var selected = String(keys[i].value) === String(selectedWeek) ? " selected" : "";
        html += '<option value="' + esc(keys[i].value) + '"' + selected + ">" + esc(keys[i].label) + "</option>";
      }
    }
    sel.innerHTML = html;
  }

  function renderReport() {
    ensureCourseSelection();
    var state = Attendify.load();
    var programme = Attendify.classById(selectedClassId);
    if (!programme) return;

    var teachLevel = programme.teachLevel != null && programme.teachLevel !== "" ? programme.teachLevel : null;
    var levelSuffix =
      teachLevel != null ? " · Level " + String(teachLevel) : "";
    var semesterWeeks = semesterWeekTotal();
    var courseObj =
      (Attendify.coursesForProgramme(selectedClassId) || []).find(function (c) {
        return c.id === selectedCourseId;
      }) || null;
    var courseLabel = courseObj ? courseObj.code + " · " + courseObj.name : "Select a course";
    var weekLabel =
      selectedWeek === "all"
        ? "All Weeks (aggregate)"
        : Attendify.reportWeekFilterLabel
          ? Attendify.reportWeekFilterLabel(selectedWeek)
          : "Week " + selectedWeek;
    var isAggregate = selectedWeek === "all";
    var weekParsed = isAggregate ? null : Attendify.parseReportWeekFilter(selectedWeek);

    syncTableHeader(isAggregate);

    var tbody = document.getElementById("report-table-body");
    var presentSub = document.getElementById("stat-present-sub");
    var absentSub = document.getElementById("stat-absent-sub");
    var rateSub = document.getElementById("stat-rate-sub");

    if (!selectedCourseId || !courseObj) {
      currentFilteredRows = [];
      document.getElementById("stat-enrolled").textContent = "0";
      document.getElementById("stat-present").textContent = "0";
      document.getElementById("stat-absent").textContent = "0";
      document.getElementById("stat-rate").textContent = "0.0%";
      if (presentSub) presentSub.textContent = "…";
      if (absentSub) absentSub.textContent = "…";
      if (rateSub) rateSub.textContent = "Select a course";
      document.getElementById("report-filter-summary").textContent =
        programme.code + levelSuffix + " • " + weekLabel;
      document.getElementById("report-count-badge").textContent = "0 students";
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="7" class="py-12 text-center text-slate-400 text-xs font-semibold">Choose a course under this programme to load the report.</td></tr>';
      }
      return;
    }

    var allStudents = Attendify.studentsFor(selectedClassId, teachLevel) || [];
    var sessionList = sessionsForFilters(state, selectedClassId, selectedCourseId, selectedWeek);
    var courseSessionsForAggregate = isAggregate
      ? sessionsForFilters(state, selectedClassId, selectedCourseId, "all")
      : sessionList;
    var weeksTaken = isAggregate ? rollCallSlotsFromSessions(courseSessionsForAggregate) : [];
    var weeksTakenCount = weeksTaken.length;
    var classWeeksLabel = weeksTakenCount + "/" + semesterWeeks;
    var singleWeekNumber = weekParsed && weekParsed.mode === "week" ? weekParsed.weekNumber : Number(selectedWeek);
    var singleSessionKind =
      weekParsed && weekParsed.mode === "week" ? weekParsed.sessionKind : "lecture";
    var singleWeekHasScans = sessionList.some(function (s) {
      return (s.records || []).length > 0;
    });
    var singleWeekClosed =
      !isAggregate &&
      courseObj &&
      Attendify.isCourseWeekSessionClosed(
        selectedClassId,
        courseObj,
        singleWeekNumber,
        singleSessionKind
      );
    var singleWeekActive = !isAggregate && singleWeekHasScans && !singleWeekClosed;

    var scanMap = {};
    sessionList.forEach(function (sess) {
      (sess.records || []).forEach(function (rec) {
        if (!scanMap[rec.studentId] || rec.scannedAt > scanMap[rec.studentId].scannedAt) {
          scanMap[rec.studentId] = {
            present: true,
            scannedAt: rec.scannedAt,
            lectureName: sess.lectureName || "",
            weekNumber: sess.weekNumber
          };
        }
      });
    });

    var rows = allStudents.map(function (student) {
      var scan = scanMap[student.id];
      var isPresent = !!scan;
      var attendedWeeks = 0;
      var miniBoxesHtml = "";

      if (isAggregate) {
        attendedWeeks = attendedSlotCount(student.id, weeksTaken, courseSessionsForAggregate);
        miniBoxesHtml = buildWeekMarkBoxesHtml(student.id, weeksTaken, courseSessionsForAggregate);
      }

      var semesterPct =
        semesterWeeks > 0 ? Math.round((attendedWeeks / semesterWeeks) * 1000) / 10 : 0;
      var absentInTaken = weeksTakenCount > 0 ? weeksTakenCount - attendedWeeks : 0;
      var tier = isAggregate ? studentAggregateTier(attendedWeeks, weeksTakenCount) : null;

      return {
        student: student,
        name: student.name,
        index: student.index,
        level: fmtLevel(student),
        course: courseLabel,
        week: isAggregate ? classWeeksLabel : weekLabel,
        present: isPresent,
        attendedWeeks: attendedWeeks,
        absentInTaken: absentInTaken,
        weeksTakenCount: weeksTakenCount,
        semesterWeeks: semesterWeeks,
        semesterPct: semesterPct,
        tier: tier,
        miniBoxesHtml: miniBoxesHtml,
        scannedAt: scan ? scan.scannedAt : "",
        photo: student.photo || "",
        statusLabel: isAggregate
          ? ""
          : isPresent
            ? "Present"
            : singleWeekActive
              ? "Waiting"
              : singleWeekClosed || singleWeekHasScans
                ? "Absent"
                : "…",
        aggregateLabel: isAggregate && tier && tier.label ? tier.label : "",
        weekMarksLabel: isAggregate
          ? attendedWeeks + "/" + weeksTakenCount + " present · " + absentInTaken + " absent"
          : ""
      };
    });

    var query = searchQuery.trim().toLowerCase();
    var filtered = rows.filter(function (r) {
      if (!query) return true;
      return (
        (r.name && r.name.toLowerCase().indexOf(query) !== -1) ||
        (r.index && r.index.toLowerCase().indexOf(query) !== -1)
      );
    });

    currentFilteredRows = filtered;

    var enrolled = allStudents.length;
    var presentCount;
    var absentCount;
    var rate;

    if (isAggregate) {
      var totalMarks = rows.reduce(function (sum, r) {
        return sum + (r.attendedWeeks || 0);
      }, 0);
      var slotsTaken = enrolled * weeksTakenCount;
      presentCount =
        weeksTakenCount > 0
          ? rows.filter(function (r) {
              return r.attendedWeeks >= weeksTakenCount;
            }).length
          : 0;
      absentCount = enrolled - presentCount;
      rate = slotsTaken > 0 ? ((totalMarks / slotsTaken) * 100).toFixed(1) : "0.0";
      if (presentSub) {
        presentSub.textContent =
          weeksTakenCount > 0
            ? "Present every week attendance was taken"
            : "No roll-call weeks yet";
      }
      if (absentSub) {
        absentSub.textContent =
          weeksTakenCount > 0 ? "Missed at least one recorded week" : "…";
      }
      if (rateSub) {
        rateSub.textContent =
          "Of " +
          weeksTakenCount +
          " week(s) taken · " +
          semesterWeeks +
          "-week semester";
      }
    } else {
      presentCount = rows.filter(function (r) {
        return r.present;
      }).length;
      var waitingCount = rows.filter(function (r) {
        return !r.present;
      }).length;
      if (singleWeekActive) {
        absentCount = waitingCount;
        rate = enrolled > 0 ? ((presentCount / enrolled) * 100).toFixed(1) : "0.0";
        if (presentSub) presentSub.textContent = "Marked present · session open";
        if (absentSub) absentSub.textContent = "Waiting (not absent until session ends)";
      } else if (singleWeekClosed || singleWeekHasScans) {
        absentCount = waitingCount;
        rate = enrolled > 0 ? ((presentCount / enrolled) * 100).toFixed(1) : "0.0";
        if (presentSub) presentSub.textContent = "Marked present this week";
        if (absentSub) absentSub.textContent = "Absent · session ended";
      } else {
        absentCount = 0;
        rate = enrolled > 0 ? ((presentCount / enrolled) * 100).toFixed(1) : "0.0";
        if (presentSub) presentSub.textContent = "No roll call this week yet";
        if (absentSub) absentSub.textContent = "…";
      }
      if (rateSub) rateSub.textContent = "Week " + selectedWeek + " of " + semesterWeeks;
    }

    document.getElementById("stat-enrolled").textContent = String(enrolled);
    document.getElementById("stat-present").textContent = String(presentCount);
    document.getElementById("stat-absent").textContent = String(absentCount);
    document.getElementById("stat-rate").textContent = rate + "%";

    document.getElementById("report-filter-summary").textContent =
      programme.code + levelSuffix + " • " + courseLabel + " • " + weekLabel;
    document.getElementById("report-count-badge").textContent =
      filtered.length + " student" + (filtered.length === 1 ? "" : "s");

    var printSub = document.getElementById("print-subtitle");
    if (printSub) {
      printSub.textContent =
        programme.name + " (" + programme.code + ")" + levelSuffix + " · " + courseLabel + " · " + weekLabel;
    }
    var printTime = document.getElementById("print-timestamp");
    if (printTime) {
      printTime.textContent =
        "Generated on " +
        new Date().toLocaleString() +
        " • " +
        (isAggregate
          ? "Aggregate " +
            rate +
            "% across " +
            weeksTakenCount +
            " recorded week(s) · " +
            semesterWeeks +
            "-week semester"
          : presentCount + " present / " + absentCount + " absent (" + rate + "%)");
    }

    if (!filtered.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="py-12 text-center text-slate-400 text-xs font-semibold">No students match this programme level and filters.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map(function (row) {
        var statusBox;
        var lastCol;
        if (isAggregate) {
          statusBox = row.miniBoxesHtml
            ? '<div class="flex items-center gap-0.5 flex-wrap" title="One box per roll-call session. Green = class present, blue = quiz present, red = absent (skipped weeks not shown).">' +
              row.miniBoxesHtml +
              "</div>"
            : '<span class="text-slate-400 text-xs">…</span>';
          var aggClass =
            row.tier && row.tier.box ? row.tier.box : "bg-slate-100 text-slate-600 border-slate-200";
          var aggLabel =
            weeksTakenCount > 0 && row.tier && row.tier.label ? row.tier.label : "…";
          lastCol =
            '<span class="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold border shadow-xs ' +
            aggClass +
            '">' +
            esc(aggLabel) +
            "</span>";
        } else {
          if (row.present) {
            statusBox =
              '<span class="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 shadow-xs">Present ✓</span>';
          } else if (singleWeekActive) {
            statusBox =
              '<span class="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 shadow-xs">Waiting…</span>';
          } else if (singleWeekClosed || singleWeekHasScans) {
            statusBox =
              '<span class="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold text-rose-800 bg-rose-100 border border-rose-300 shadow-xs">Absent ✕</span>';
          } else {
            statusBox = '<span class="text-slate-400">…</span>';
          }
          lastCol =
            '<span class="font-mono text-slate-500 text-xs">' +
            (row.present ? fmtTime(row.scannedAt) : "…") +
            "</span>";
        }

        var listUi = window.AttendifyStudentList;
        var student = row.student || { name: row.name, index: row.index, level: row.level };
        var mobileIdentity =
          listUi && listUi.identityHtml
            ? listUi.identityHtml(student, { index: true, level: true })
            : esc(row.name);
        var extraMeta =
          '<div class="student-roster-extra">' +
          '<span class="student-roster-col-course">' +
          esc(row.course) +
          "</span>" +
          (row.week ? " · <span class=\"student-roster-col-week\">" + esc(row.week) + "</span>" : "") +
          "</div>";
        return (
          '<tr class="student-roster-row hover:bg-slate-50/80 transition">' +
          '<td class="py-3 px-4 student-roster-main">' +
          '<div class="student-roster-mobile-only">' +
          mobileIdentity +
          extraMeta +
          "</div>" +
          '<div class="hidden md:flex md:items-center md:gap-2.5 min-w-0">' +
          renderAvatar(row.student, "w-8 h-8") +
          '<span class="font-bold text-slate-900 truncate text-xs">' +
          esc(row.name) +
          "</span></div></td>" +
          '<td class="student-roster-col-index py-3 px-4 font-mono text-slate-600 text-xs">' +
          esc(row.index) +
          "</td>" +
          '<td class="student-roster-col-level py-3 px-4 text-slate-600 text-xs tabular-nums">' +
          esc(row.level) +
          "</td>" +
          '<td class="student-roster-col-course py-3 px-4 text-slate-600 text-xs truncate max-w-[160px]">' +
          esc(row.course) +
          "</td>" +
          '<td class="student-roster-col-week py-3 px-4 text-slate-600 text-xs font-mono">' +
          esc(row.week) +
          "</td>" +
          '<td class="student-roster-report-status py-3 px-4">' +
          statusBox +
          "</td>" +
          '<td class="student-roster-time-col py-3 px-4">' +
          lastCol +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function bindEvents() {
    var progSelect = document.getElementById("report-programme-select");
    if (progSelect) {
      progSelect.addEventListener("change", function (e) {
        selectedClassId = e.target.value;
        selectedCourseId = "";
        selectedWeek = "all";
        fillCourses();
        fillWeeks();
        renderReport();
      });
    }

    var courseSelect = document.getElementById("report-course-select");
    if (courseSelect) {
      courseSelect.addEventListener("change", function (e) {
        selectedCourseId = e.target.value;
        selectedWeek = "all";
        fillWeeks();
        renderReport();
      });
    }

    var weekSelect = document.getElementById("report-week-select");
    if (weekSelect) {
      weekSelect.addEventListener("change", function (e) {
        selectedWeek = e.target.value;
        renderReport();
      });
    }

    var searchInput = document.getElementById("report-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", function (e) {
        searchQuery = e.target.value || "";
        renderReport();
      });
    }

    var exportBtn = document.getElementById("btn-export-csv");
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        if (!currentFilteredRows.length) {
          window.alert("No attendance rows to export.");
          return;
        }
        var programme = Attendify.classById(selectedClassId);
        var pCode = programme ? programme.code : "attendance";
        var filename = (pCode + "-report-" + selectedCourseId + "-w" + selectedWeek + "-" + Attendify.today()).replace(/[^a-zA-Z0-9_-]/g, "_") + ".csv";

        var isAgg = selectedWeek === "all";
        var csvRows = [
          isAgg
            ? ["Student name", "Index no.", "Level", "Weeks roll call", "Present/Absent marks", "Aggregate"]
            : ["Student name", "Index no.", "Level", "Status", "Time"]
        ];
        currentFilteredRows.forEach(function (r) {
          if (isAgg) {
            csvRows.push([
              r.name,
              r.index,
              r.level,
              r.week,
              r.weekMarksLabel || "",
              r.aggregateLabel || (r.tier && r.tier.label) || "…"
            ]);
          } else {
            csvRows.push([
              r.name,
              r.index,
              r.level,
              r.statusLabel || (r.present ? "Present" : "Absent"),
              r.present ? fmtTime(r.scannedAt) : "…"
            ]);
          }
        });
        Attendify.downloadCsv(filename, csvRows);
      });
    }

    var printBtn = document.getElementById("btn-print-report");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        if (!currentFilteredRows.length) {
          window.alert("No attendance rows to export.");
          return;
        }
        var programme = Attendify.classById(selectedClassId);
        var courseObj =
          selectedCourseId !== "all"
            ? (Attendify.coursesForProgramme(selectedClassId) || []).find(function (c) {
                return c.id === selectedCourseId;
              })
            : null;
        var courseLabel = courseObj ? courseObj.code + " · " + courseObj.name : "";
        var weekLabel =
          selectedWeek === "all"
            ? "All weeks"
            : Attendify.reportWeekFilterLabel
              ? Attendify.reportWeekFilterLabel(selectedWeek)
              : "Week " + selectedWeek;
        Attendify.printAttendanceReport({
          title: "Attendance report, " + (programme ? programme.code : ""),
          subtitle: (programme ? programme.name + " · " : "") + courseLabel + " · " + weekLabel,
          rows: currentFilteredRows.map(function (r) {
            if (selectedWeek === "all") {
              return {
                name: r.name,
                index: r.index,
                level: r.level,
                status: r.weekMarksLabel || "…",
                time: r.aggregateLabel || (r.tier && r.tier.label) || "…"
              };
            }
            return {
              name: r.name,
              index: r.index,
              level: r.level,
              status: r.statusLabel || (r.present ? "Present" : "Absent"),
              time: r.present ? fmtTime(r.scannedAt) : "…"
            };
          })
        });
      });
    }
  }

  Attendify.ready().then(function () {
    var session = Attendify.requireLecturerSession && Attendify.requireLecturerSession();
    if (session && session.lecturer) Attendify.paintLecturerChrome(session.lecturer, { sidebar: true, header: true });
    init();
  });
})();
