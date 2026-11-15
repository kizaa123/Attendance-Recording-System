var uccPhotoForSubmit = "";
var enrollLevel = "";

function levelFromQuery() {
  return new URLSearchParams(window.location.search).get("level") || "";
}

function syncEnrollLevel(course) {
  enrollLevel = levelFromQuery();
  if (!enrollLevel && course && course.teachLevel != null && course.teachLevel !== "") {
    enrollLevel = String(course.teachLevel);
  }
  var warn = document.getElementById("enroll-link-warning");
  var submit = document.getElementById("enroll-submit");
  if (enrollLevel) {
    if (warn) warn.classList.add("hidden");
    if (submit) submit.disabled = false;
  } else {
    if (warn) warn.classList.remove("hidden");
    if (submit) submit.disabled = true;
  }
  return enrollLevel;
}

function setIntro(course) {
  var intro = document.getElementById("enroll-intro");
  if (!intro || !course) return;
  var label = (course.code ? course.code + " — " : "") + (course.name || "this programme");
  intro.innerHTML =
    'Register for <strong class="text-slate-800">' +
    label +
    "</strong>. Enter your index number, name, and confirm your photo.";
}

function updatePhotoPlaceholder(show) {
  var placeholder = document.getElementById("ucc-photo-placeholder");
  if (!placeholder) return;
  placeholder.classList.toggle("hidden", !show);
}

Attendify.ready().then(function () {
  var classId = Attendify.requestedClassId();
  var level = levelFromQuery();
  var course = Attendify.classById(classId, level);
  if (!course) {
    var intro = document.getElementById("enroll-intro");
    if (intro) intro.textContent = "This registration link is not valid. Ask your lecturer to send the link again.";
    var form = document.getElementById("enroll-form");
    if (form) form.classList.add("hidden");
    return;
  }

  level = syncEnrollLevel(course);
  setIntro(course);

  var indexInput = document.getElementById("index");
  Attendify.bindUccPhotoPreview(indexInput, {
    keepPreviewVisible: true,
    previewEl: document.getElementById("ucc-photo-preview"),
    imgEl: document.getElementById("ucc-photo-img"),
    spinnerEl: document.getElementById("ucc-photo-spinner"),
    statusEl: document.getElementById("ucc-photo-status"),
    onChange: function (result) {
      uccPhotoForSubmit = result.url || Attendify.uccPhotoUrl(indexInput.value);
      updatePhotoPlaceholder(!(result.ok && result.url));
      var statusEl = document.getElementById("ucc-photo-status");
      if (statusEl && !result.ok && !String(indexInput.value || "").trim()) {
        statusEl.textContent = "Enter your index number to load your profile photo.";
      }
      var existing = Attendify.findStudent(classId, indexInput.value);
      if (existing && result.ok) {
        document.getElementById("ucc-photo-status").textContent =
          "Profile photo loaded. Confirm your name below.";
        if (!document.getElementById("name").value) {
          document.getElementById("name").value = existing.name;
        }
        if (!document.getElementById("email").value && existing.email) {
          document.getElementById("email").value = existing.email;
        }
      }
    }
  });
});

document.getElementById("enroll-form").addEventListener("submit", function (event) {
  event.preventDefault();
  var classId = Attendify.requestedClassId();
  var index = document.getElementById("index").value;
  document.getElementById("enroll-error").textContent = "";

  if (!enrollLevel) {
    document.getElementById("enroll-error").textContent =
      "This registration link is not valid. Ask your lecturer to resend the link from their programme page.";
    return;
  }

  var photo = uccPhotoForSubmit || Attendify.uccPhotoUrl(index);

  Attendify.addStudent({
    classId: classId,
    name: document.getElementById("name").value,
    index: index,
    level: enrollLevel,
    email: document.getElementById("email").value,
    photo: photo,
    source: "link"
  }).then(function (result) {
    if (!result.ok) {
      document.getElementById("enroll-error").textContent = result.error;
      return;
    }

    document.getElementById("enroll-form").classList.add("hidden");
    document.getElementById("enroll-success").classList.remove("hidden");
    document.getElementById("success-name").textContent = result.student.name;
    document.getElementById("success-index").textContent = result.student.index;

    var cardPhoto = Attendify.studentPhotoUrl(result.student);
    Attendify.drawQr(
      document.getElementById("success-qr"),
      Attendify.qrText(result.student),
      document.getElementById("success-download"),
      result.student.index + "-attendance-card.png",
      cardPhoto
    );
  });
});