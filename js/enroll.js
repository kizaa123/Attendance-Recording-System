var uccPhotoForSubmit = "";
var enrollLevel = "";
var enrollClassId = "";
var profileLookupTimer = null;

function levelFromQuery() {
  return new URLSearchParams(window.location.search).get("level") || "";
}

function applyEnrollLevel(level) {
  enrollLevel = level != null && level !== "" ? String(level) : "";
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
    "</strong>. Enter your index number, confirm your name, and check your profile photo.";
}

function updatePhotoPlaceholder(show) {
  var placeholder = document.getElementById("ucc-photo-placeholder");
  if (!placeholder) return;
  placeholder.classList.toggle("hidden", !show);
}

function showProfilePhoto(url) {
  var img = document.getElementById("ucc-photo-img");
  if (!img || !url) return;
  img.src = url;
  img.classList.remove("hidden");
  updatePhotoPlaceholder(false);
}

function applyStudentProfile(student) {
  if (!student) return;
  var nameInput = document.getElementById("name");
  var emailInput = document.getElementById("email");
  if (nameInput && !nameInput.value.trim() && student.name) {
    nameInput.value = student.name;
  }
  if (emailInput && !emailInput.value.trim() && student.email) {
    emailInput.value = student.email;
  }
  var photo = student.photo && String(student.photo).trim() ? student.photo : Attendify.uccPhotoUrl(student.index);
  if (photo) {
    uccPhotoForSubmit = photo;
    showProfilePhoto(photo);
  }
  var statusEl = document.getElementById("ucc-photo-status");
  if (statusEl && student.name) {
    statusEl.textContent = "Profile loaded. Confirm your name below.";
  }
}

function lookupProfileForIndex(index) {
  clearTimeout(profileLookupTimer);
  var needle = String(index || "").trim();
  if (!enrollClassId || needle.length < 4) return;
  profileLookupTimer = setTimeout(function () {
    Attendify.fetchEnrollStudent(enrollClassId, needle).then(function (result) {
      if (result && result.ok && result.student) {
        applyStudentProfile(result.student);
      }
    });
  }, 500);
}

function bindProfilePreview(indexInput) {
  if (!indexInput) return;
  Attendify.bindUccPhotoPreview(indexInput, {
    keepPreviewVisible: true,
    previewEl: document.getElementById("ucc-photo-preview"),
    imgEl: document.getElementById("ucc-photo-img"),
    spinnerEl: document.getElementById("ucc-photo-spinner"),
    statusEl: document.getElementById("ucc-photo-status"),
    hidePlaceholder: updatePhotoPlaceholder,
    onChange: function (result) {
      var index = String(indexInput.value || "").trim();
      uccPhotoForSubmit = result.url || Attendify.uccPhotoUrl(index);
      updatePhotoPlaceholder(!(result.ok && result.url));
      var statusEl = document.getElementById("ucc-photo-status");
      if (statusEl && !result.ok && !index) {
        statusEl.textContent = "Enter your index number to load your profile photo.";
      }
      if (result.ok) {
        lookupProfileForIndex(index);
      }
    }
  });
  indexInput.addEventListener("input", function () {
    lookupProfileForIndex(indexInput.value);
  });
}

function initEnrollPage() {
  enrollClassId = Attendify.requestedClassId();
  var indexInput = document.getElementById("index");
  bindProfilePreview(indexInput);

  var levelQ = levelFromQuery();
  Attendify.fetchEnrollContext(enrollClassId, levelQ).then(function (ctx) {
    if (!ctx || !ctx.ok || !ctx.course) {
      var intro = document.getElementById("enroll-intro");
      if (intro) {
        intro.textContent =
          (ctx && ctx.error) || "This registration link is not valid. Ask your lecturer to send the link again.";
      }
      var form = document.getElementById("enroll-form");
      if (form) form.classList.add("hidden");
      return;
    }
    enrollClassId = ctx.course.id;
    var level = ctx.level != null && ctx.level !== "" ? ctx.level : levelQ;
    applyEnrollLevel(level);
    setIntro(ctx.course);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initEnrollPage);
} else {
  initEnrollPage();
}

document.getElementById("enroll-form").addEventListener("submit", function (event) {
  event.preventDefault();
  var classId = enrollClassId || Attendify.requestedClassId();
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