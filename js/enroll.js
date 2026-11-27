var uccPhotoForSubmit = "";
var enrollLevel = "";
var enrollClassId = "";
var profileLookupTimer = null;
var profilePhotoTimer = null;
var profilePhotoToken = 0;

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
  var label = (course.code ? course.code + " · " : "") + (course.name || "this programme");
  intro.innerHTML =
    'Register for <strong class="text-slate-800">' +
    label +
    "</strong>. Enter your index number, confirm your name, and check your profile photo.";
}

function profileEls() {
  return {
    placeholder: document.getElementById("ucc-photo-placeholder"),
    img: document.getElementById("ucc-photo-img"),
    spinner: document.getElementById("ucc-photo-spinner"),
    status: document.getElementById("ucc-photo-status"),
    card: document.getElementById("enroll-profile-card"),
    cardName: document.getElementById("enroll-profile-name"),
    cardIndex: document.getElementById("enroll-profile-index")
  };
}

function updatePhotoPlaceholder(show) {
  var placeholder = document.getElementById("ucc-photo-placeholder");
  if (!placeholder) return;
  placeholder.classList.toggle("hidden", !show);
}

function resetEnrollProfile() {
  var el = profileEls();
  uccPhotoForSubmit = "";
  if (el.img) {
    el.img.removeAttribute("src");
    el.img.classList.add("hidden");
  }
  updatePhotoPlaceholder(true);
  if (el.spinner) el.spinner.classList.add("hidden");
  if (el.status) el.status.textContent = "Enter your index number above to load your profile photo.";
  if (el.card) el.card.classList.add("hidden");
  if (el.cardName) el.cardName.textContent = "";
  if (el.cardIndex) el.cardIndex.textContent = "";
}

function showProfileCard(index, name) {
  var el = profileEls();
  if (!el.card) return;
  el.card.classList.remove("hidden");
  if (el.cardIndex) el.cardIndex.textContent = index;
  if (el.cardName) el.cardName.textContent = name || "Confirm your name below";
}

function loadProfilePhoto(index) {
  clearTimeout(profilePhotoTimer);
  var needle = String(index || "").trim();
  if (needle.length < 4) {
    resetEnrollProfile();
    return;
  }
  uccPhotoForSubmit = Attendify.uccPhotoPageUrl(needle);
  profilePhotoTimer = setTimeout(function () {
    var el = profileEls();
    var run = ++profilePhotoToken;
    if (el.spinner) el.spinner.classList.remove("hidden");
    if (el.status) el.status.textContent = "Loading profile photo…";
    if (el.img) el.img.classList.add("hidden");
    updatePhotoPlaceholder(true);
    showProfileCard(needle, "");

    var photoUrl = Attendify.uccPhotoPageUrl(needle);
    if (!el.img || !photoUrl) {
      if (el.spinner) el.spinner.classList.add("hidden");
      if (el.status) el.status.textContent = "Enter a valid index number.";
      return;
    }

    el.img.onload = function () {
      if (run !== profilePhotoToken) return;
      if (el.spinner) el.spinner.classList.add("hidden");
      el.img.classList.remove("hidden");
      updatePhotoPlaceholder(false);
      if (el.status) el.status.textContent = "Profile photo loaded.";
    };
    el.img.onerror = function () {
      if (run !== profilePhotoToken) return;
      if (el.spinner) el.spinner.classList.add("hidden");
      el.img.classList.add("hidden");
      updatePhotoPlaceholder(true);
      if (el.status) {
        el.status.textContent = "No photo found for this index. You can still register.";
      }
    };
    el.img.src = photoUrl + (photoUrl.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now();
  }, 350);
}

function applyStudentProfile(student, index) {
  if (!student) return;
  var nameInput = document.getElementById("name");
  var emailInput = document.getElementById("email");
  var idx = student.index || index || "";
  if (nameInput && student.name && !nameInput.value.trim()) {
    nameInput.value = student.name;
  }
  if (emailInput && student.email && !emailInput.value.trim()) {
    emailInput.value = student.email;
  }
  if (student.photo && String(student.photo).trim()) {
    var el = profileEls();
    if (el.img) {
      el.img.src = student.photo;
      el.img.classList.remove("hidden");
      updatePhotoPlaceholder(false);
      uccPhotoForSubmit = student.photo;
    }
  }
  showProfileCard(idx, student.name || "");
  var statusEl = document.getElementById("ucc-photo-status");
  if (statusEl && student.name) {
    statusEl.textContent = "Profile loaded. Confirm your name below.";
  }
}

function lookupProfileForIndex(index) {
  clearTimeout(profileLookupTimer);
  var needle = String(index || "").trim();
  var classId = enrollClassId || Attendify.requestedClassId();
  if (!classId || needle.length < 4) return;
  profileLookupTimer = setTimeout(function () {
    Attendify.fetchEnrollStudent(classId, needle).then(function (result) {
      if (result && result.ok && result.student) {
        applyStudentProfile(result.student, needle);
      } else {
        showProfileCard(needle, document.getElementById("name").value.trim());
      }
    });
  }, 450);
}

function bindIndexInput(indexInput) {
  if (!indexInput) return;
  indexInput.addEventListener("input", function () {
    var index = indexInput.value;
    loadProfilePhoto(index);
    lookupProfileForIndex(index);
  });
  indexInput.addEventListener("blur", function () {
    loadProfilePhoto(indexInput.value);
    lookupProfileForIndex(indexInput.value);
  });
}

function initEnrollPage() {
  if (typeof Attendify === "undefined") return;
  enrollClassId = Attendify.requestedClassId();
  var indexInput = document.getElementById("index");
  bindIndexInput(indexInput);
  resetEnrollProfile();

  var levelQ = levelFromQuery();
  Attendify.fetchEnrollContext(enrollClassId, levelQ).then(function (ctx) {
    if (ctx && ctx.ok && ctx.course) {
      enrollClassId = ctx.course.id;
      var level = ctx.level != null && ctx.level !== "" ? ctx.level : levelQ;
      applyEnrollLevel(level);
      setIntro(ctx.course);
      return;
    }
    if (enrollClassId) {
      applyEnrollLevel(levelQ);
      setIntro({ code: "", name: "this programme" });
      var intro = document.getElementById("enroll-intro");
      if (intro && ctx && ctx.error) {
        intro.textContent =
          "Register for this programme. " + ctx.error + " If registration fails, ask your lecturer for a new link.";
      }
      return;
    }
    var intro = document.getElementById("enroll-intro");
    if (intro) {
      intro.textContent =
        (ctx && ctx.error) || "This registration link is not valid. Ask your lecturer to send the link again.";
    }
    var form = document.getElementById("enroll-form");
    if (form) form.classList.add("hidden");
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

  var photo = uccPhotoForSubmit || Attendify.uccPhotoPageUrl(index);

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

    showEnrollQrSuccess(result.student, !!result.alreadyRegistered);
  });
});

function showEnrollQrSuccess(student, alreadyRegistered) {
  if (!student) return;
  document.getElementById("enroll-error").textContent = "";
  document.getElementById("enroll-form").classList.add("hidden");
  document.getElementById("enroll-success").classList.remove("hidden");
  document.getElementById("success-name").textContent = student.name;
  document.getElementById("success-index").textContent = student.index;

  var lead = document.getElementById("success-lead");
  if (lead) {
    lead.textContent = alreadyRegistered
      ? "You are already registered for this programme. Here is your QR card again."
      : "You are registered. Save this card for attendance.";
  }

  Attendify.drawQr(
    document.getElementById("success-qr"),
    Attendify.qrText(student),
    document.getElementById("success-download"),
    student.index + "-attendance-card.png",
    null,
    {
      attendanceCard: true,
      hideCardMeta: false,
      studentName: student.name,
      studentIndex: student.index
    }
  );
  var success = document.getElementById("enroll-success");
  if (success && success.scrollIntoView) {
    success.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}