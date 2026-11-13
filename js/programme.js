var classId = "";
var course = null;
var editingId = "";

var rosterBody = document.getElementById("roster-body");
var searchInput = document.getElementById("roster-search");
var addModal = document.getElementById("addModal");
var qrModal = document.getElementById("qrModal");

function syncCourse() {
  classId = Attendify.requestedClassId();
  course = Attendify.classById(classId);
}

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

var uccPhotoForSubmit = "";
var lastRosterSignature = "";

function avatar(student) {
  return Attendify.avatarMarkup(student, "w-10 h-10", "ring-2 ring-slate-100");
}

function renderRoster() {
  syncCourse();
  if (!course) {
    document.getElementById("programme-page-title").textContent = "Programme not found";
    return;
  }

  var query = (searchInput.value || "").trim().toLowerCase();
  var all = Attendify.studentsFor(classId);
  var students = all.filter(function (student) {
    if (!query) return true;
    return student.name.toLowerCase().indexOf(query) !== -1 || student.index.toLowerCase().indexOf(query) !== -1;
  });

  document.getElementById("programme-page-title").textContent = course.name;
  document.getElementById("programme-page-code").textContent = course.code;
  document.title = "Attendify — " + course.code;

  var url = Attendify.enrollUrl(classId);
  document.getElementById("course-registered-count").textContent = String(all.length);
  var enrollLink = document.getElementById("enroll-link");
  enrollLink.textContent = url;
  enrollLink.href = url;

  document.getElementById("roster-count").textContent = "Showing " + students.length + " of " + all.length;
  document.getElementById("roster-range").textContent =
    all.length ? all.length + " registered — used for all courses under this programme" : "No registrations yet";

  if (!students.length) {
    rosterBody.innerHTML =
      '<tr><td colspan="4" class="py-10 px-6 text-center text-sm text-slate-500">No students yet. Share the registration link or add manually.</td></tr>';
    return;
  }

  rosterBody.innerHTML = students
    .map(function (student, index) {
      var number = String(index + 1);
      if (number.length < 2) number = "0" + number;
      return (
        '<tr class="hover:bg-slate-50/80 border-t border-slate-100">' +
        '<td class="py-4 px-6 text-center text-xs font-semibold text-slate-400">' +
        number +
        "</td>" +
        '<td class="py-4 px-6"><div class="flex items-center gap-3">' +
        avatar(student) +
        '<div><div class="font-bold text-slate-900">' +
        esc(student.name) +
        "</div>" +
        '<div class="text-xs text-slate-500">' +
        esc(student.email || "—") +
        "</div></div></div></td>" +
        '<td class="py-4 px-6 font-mono text-xs font-bold text-slate-800">' +
        esc(student.index) +
        "</td>" +
        '<td class="py-4 px-6 text-right">' +
        '<button type="button" data-action="qr" data-id="' +
        esc(student.id) +
        '" class="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg">QR</button> ' +
        '<button type="button" data-action="edit" data-id="' +
        esc(student.id) +
        '" class="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg">Edit</button>' +
        "</td></tr>"
      );
    })
    .join("");
  Attendify.hydrateAvatars(rosterBody);
}

function rosterSignature() {
  syncCourse();
  return Attendify.studentsFor(classId)
    .map(function (student) {
      return [student.id, student.name, student.index, student.photo || "", student.email || ""].join("\u0001");
    })
    .join("\u0002");
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
}

function showQr(student) {
  document.getElementById("qr-name").textContent = student.name;
  document.getElementById("qr-index").textContent = student.index;
  document.getElementById("qr-course").textContent = course.code + " — " + course.name;
  qrModal.classList.remove("hidden");
  Attendify.drawQr(
    document.getElementById("qr-holder"),
    Attendify.qrText(student),
    document.getElementById("qr-download"),
    student.index + "-qr-card.png",
    Attendify.studentPhotoUrl(student)
  );
}

function copyLink() {
  var link = Attendify.enrollUrl(classId);
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
  var index = document.getElementById("student-index").value;
  var photo = uccPhotoForSubmit || Attendify.uccPhotoUrl(index);
  Attendify.addStudent({
    id: editingId,
    classId: classId,
    name: document.getElementById("student-name").value,
    index: index,
    email: document.getElementById("student-email").value,
    photo: photo,
    source: editingId ? undefined : "lecturer"
  }).then(function (result) {
    if (!result.ok) {
      document.getElementById("add-error").textContent = result.error;
      return;
    }
    closeAddModal();
    renderRoster();
    if (!editingId) showQr(result.student);
  });
});

rosterBody.addEventListener("click", function (event) {
  var button = event.target.closest("button[data-id]");
  if (!button) return;
  var student = Attendify.studentsFor(classId).filter(function (item) {
    return item.id === button.getAttribute("data-id");
  })[0];
  if (!student) return;
  if (button.getAttribute("data-action") === "edit") openAddModal(student);
  if (button.getAttribute("data-action") === "qr") showQr(student);
});

document.getElementById("btn-copy-link").addEventListener("click", copyLink);
document.getElementById("btn-export-roster").addEventListener("click", function () {
  syncCourse();
  var rows = [["Name", "Index", "Email", "Programme"]];
  Attendify.studentsFor(classId).forEach(function (student) {
    rows.push([student.name, student.index, student.email, course.code]);
  });
  Attendify.downloadCsv(course.code.replace(/\s+/g, "-") + "-roster.csv", rows);
});

Attendify.ready().then(function () {
  var params = new URLSearchParams(window.location.search);
  if (!params.get("programme") && !params.get("class")) {
    window.location.href = "dashboard.html";
    return;
  }
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
  setInterval(function () {
    if (document.hidden) return;
    Attendify.ready().then(function () {
      var sig = rosterSignature();
      if (sig === lastRosterSignature) return;
      lastRosterSignature = sig;
      renderRoster();
    });
  }, 5000);
});
