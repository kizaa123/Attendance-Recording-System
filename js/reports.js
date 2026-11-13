var params = new URLSearchParams(window.location.search);
var classId = Attendify.requestedClassId();
var course = Attendify.classById(classId);
var sessionId = params.get("session");
var lectureHint = params.get("lecture");

function renderSessionBanner() {
  var banner = document.getElementById("report-session-banner");
  if (!banner) return;
  if (!sessionId) {
    banner.classList.add("hidden");
    return;
  }
  Attendify.ready().then(function () {
    var session = Attendify.attendanceSessionById(classId, sessionId);
    if (!session) {
      banner.textContent = "Attendance session not found.";
      banner.classList.remove("hidden");
      return;
    }
    var title = session.lectureName || lectureHint || "Course attendance";
    banner.innerHTML =
      "<strong>" +
      title +
      "</strong> · Programme " +
      (course ? course.code : "") +
      " · Week " +
      (session.weekNumber != null ? session.weekNumber : "—") +
      " · " +
      Attendify.formatShortDate(session.date) +
      " · " +
      session.presentCount +
      " present (session #" +
      session.sessionId +
      ")";
    banner.classList.remove("hidden");
  });
}

Attendify.ready().then(function () {
  classId = Attendify.requestedClassId();
  course = Attendify.classById(classId);
  renderSessionBanner();
});

document.getElementById("btn-quick-scan").addEventListener("click", function () {
  window.location.href = "dashboard.html?scan=1&class=" + encodeURIComponent(classId);
});

document.getElementById("btn-refresh").addEventListener("click", function () {
  window.location.reload();
});

document.getElementById("btn-download-pdf").addEventListener("click", function () {
  window.print();
});

document.getElementById("btn-export-csv").addEventListener("click", function () {
  var present = {};
  var dateForExport = Attendify.today();
  var label = course ? course.code : "programme";

  if (sessionId) {
    var session = Attendify.attendanceSessionById(classId, sessionId);
    if (session) {
      dateForExport = session.date;
      label = (session.lectureName || label).replace(/\s+/g, "-");
      (session.records || []).forEach(function (record) {
        present[record.studentId] = record.scannedAt;
      });
    }
  } else {
    Attendify.attendanceRows(classId).forEach(function (row) {
      present[row.student.id] = row.scannedAt;
    });
  }

  var rows = [["Name", "Index Number", "Email", "Status", "Time Reported", "Date", "SessionId"]];
  Attendify.studentsFor(classId).forEach(function (student) {
    var time = present[student.id];
    rows.push([
      student.name,
      student.index,
      student.email,
      time ? "P" : "A",
      time ? Attendify.formatTime(time) : "",
      dateForExport,
      sessionId || ""
    ]);
  });
  Attendify.downloadCsv(label + "-attendance-" + dateForExport + ".csv", rows);
});
