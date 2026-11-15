var classId = "";
var course = null;
var editingId = "";

var rosterBody = document.getElementById("roster-body");
var searchInput = document.getElementById("roster-search");
var addModal = document.getElementById("addModal");
var qrModal = document.getElementById("qrModal");

function courseTitle() {
  return "Programme — " + course.code + ": " + course.name;
}

function syncCourse() {
  classId = Attendify.requestedClassId();
  course = Attendify.classById(classId);
}

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function avatar(student) {
  if (student.photo) {
    return '<img class="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 shadow-sm" src="' + esc(student.photo) + '" alt="' + esc(student.name) + '">';
  }
  return '<div class="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm shadow-sm">' + esc(Attendify.initials(student.name)) + "</div>";
}

function renderRoster() {
  syncCourse();
  var query = (searchInput.value || "").trim().toLowerCase();
  var students = Attendify.studentsFor(classId).filter(function (student) {
    if (!query) return true;
    return student.name.toLowerCase().indexOf(query) !== -1 || student.index.toLowerCase().indexOf(query) !== -1;
  });

  var total = Attendify.studentsFor(classId).length;
  var title = courseTitle();
  var url = Attendify.enrollUrl(classId, course && course.teachLevel);

  document.getElementById("class-label").textContent = title;
  var enrollTitle = document.getElementById("enroll-course-title");
  if (enrollTitle) enrollTitle.textContent = title;
  var regBox = document.getElementById("course-registered-count");
  if (regBox) regBox.textContent = String(total);

  var enrollLink = document.getElementById("enroll-link");
  enrollLink.textContent = url;
  enrollLink.href = url;
  enrollLink.title = "Registration link for " + title;

  document.getElementById("roster-count").textContent = "Showing " + students.length + " of " + total + " registered students";
  var rosterRange = document.getElementById("roster-range");
  if (rosterRange) rosterRange.textContent = "Displaying " + students.length + " enrolled students in " + course.code;

  if (!students.length) {
    rosterBody.innerHTML = '<tr><td colspan="4" class="py-10 px-6 text-center text-sm text-slate-500">No students yet. Add one manually, or share the registration link.</td></tr>';
    return;
  }

  rosterBody.innerHTML = students.map(function (student, index) {
    var number = String(index + 1);
    if (number.length < 2) number = "0" + number;
    return (
      '<tr class="hover:bg-slate-50/80 transition-colors group">' +
        '<td class="py-4 px-6 text-center text-xs font-semibold text-slate-400">' + number + "</td>" +
        '<td class="py-4 px-6"><div class="flex items-center gap-3.5">' + avatar(student) +
          '<div><div class="font-bold text-slate-900">' + esc(student.name) + "</div>" +
          '<div class="text-xs text-slate-500">' + esc(student.email || "No email") + "</div></div></div></td>" +
        '<td class="py-4 px-6"><span class="inline-flex items-center px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-800 tracking-wide">' + esc(student.index) + "</span></td>" +
        '<td class="py-4 px-6 text-right"><div class="flex items-center justify-end gap-2">' +
          '<button data-action="qr" data-id="' + esc(student.id) + '" title="View QR Card" class="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg></button>' +
          '<button data-action="edit" data-id="' + esc(student.id) + '" title="Edit Record" class="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>' +
        "</div></td></tr>"
    );
  }).join("");
}

function openAddModal(student) {
  editingId = student ? student.id : "";
  document.getElementById("add-title").textContent = student ? "Edit student" : "Register a student";
  document.getElementById("student-name").value = student ? student.name : "";
  document.getElementById("student-index").value = student ? student.index : "";
  document.getElementById("student-email").value = student ? student.email : "";
  document.getElementById("student-photo").value = "";
  document.getElementById("add-error").textContent = "";
  addModal.classList.remove("hidden");
  document.getElementById("student-name").focus();
}

function closeAddModal() {
  addModal.classList.add("hidden");
}

function showQr(student) {
  document.getElementById("qr-name").textContent = student.name;
  document.getElementById("qr-index").textContent = student.index;
  var dept = course.department ? String(course.department).trim() : "";
  document.getElementById("qr-course").textContent = dept
    ? "Permanent for " + dept + " — all courses in this department"
    : "Permanent in this department — set department on the course for clarity";
  qrModal.classList.remove("hidden");
  Attendify.drawQr(
    document.getElementById("qr-holder"),
    Attendify.qrText(student),
    document.getElementById("qr-download"),
    student.index + "-qr-card.png"
  );
}

function copyLink() {
  var link = Attendify.enrollUrl(classId, course && course.teachLevel);
  var label = document.getElementById("copy-label");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link);
  }
  label.textContent = "Copied";
  setTimeout(function () { label.textContent = "Copy Link"; }, 1500);
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
  var photoInput = document.getElementById("student-photo");
  var file = photoInput.files && photoInput.files[0];
  Attendify.photoFromFile(file).then(function (photo) {
    return Attendify.addStudent({
      id: editingId,
      classId: classId,
      name: document.getElementById("student-name").value,
      index: document.getElementById("student-index").value,
      email: document.getElementById("student-email").value,
      photo: photo
    });
  }).then(function (result) {
    if (!result.ok) {
      document.getElementById("add-error").textContent = result.error;
      return;
    }
    closeAddModal();
    renderRoster();
    showQr(result.student);
  }).catch(function (error) {
    document.getElementById("add-error").textContent = error.message;
  });
});

rosterBody.addEventListener("click", function (event) {
  var button = event.target.closest("button[data-id]");
  if (!button) return;
  var student = Attendify.studentsFor(classId).filter(function (item) { return item.id === button.getAttribute("data-id"); })[0];
  if (!student) return;
  if (button.getAttribute("data-action") === "edit") openAddModal(student);
  if (button.getAttribute("data-action") === "qr") showQr(student);
});

document.getElementById("btn-copy-link").addEventListener("click", copyLink);

document.getElementById("btn-export-roster").addEventListener("click", function () {
  syncCourse();
  var rows = [["Name", "Index Number", "Email", "Class"]];
  Attendify.studentsFor(classId).forEach(function (student) {
    rows.push([student.name, student.index, student.email, course.code]);
  });
  Attendify.downloadCsv(course.code.replace(/\s+/g, "-") + "-roster.csv", rows);
});

document.getElementById("btn-open-camera").addEventListener("click", function () {
  syncCourse();
  window.location.href = "dashboard.html?scan=1&class=" + encodeURIComponent(classId);
});

Attendify.ready().then(function () {
  renderRoster();
  setInterval(function () { Attendify.ready().then(renderRoster); }, 5000);
});
