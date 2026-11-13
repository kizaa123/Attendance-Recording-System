var uccPhotoForSubmit = "";

Attendify.ready().then(function () {
  var classId = Attendify.requestedClassId();
  var course = Attendify.classById(classId);
  if (!course) {
    document.getElementById("enroll-course").textContent = "Unknown programme";
    return;
  }
  document.getElementById("enroll-course").textContent = course.code + " — " + course.name;

  var indexInput = document.getElementById("index");
  Attendify.bindUccPhotoPreview(indexInput, {
    previewEl: document.getElementById("ucc-photo-preview"),
    imgEl: document.getElementById("ucc-photo-img"),
    spinnerEl: document.getElementById("ucc-photo-spinner"),
    statusEl: document.getElementById("ucc-photo-status"),
    onChange: function (result) {
      uccPhotoForSubmit = result.url || Attendify.uccPhotoUrl(indexInput.value);
      var existing = Attendify.findStudent(classId, indexInput.value);
      if (existing && result.ok) {
        document.getElementById("ucc-photo-status").textContent =
          "Official profile photo ready · index matches programme roster.";
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

  var photo = uccPhotoForSubmit || Attendify.uccPhotoUrl(index);

  Attendify.addStudent({
    classId: classId,
    name: document.getElementById("name").value,
    index: index,
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
