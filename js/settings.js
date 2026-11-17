(function () {
  var programmeOptions = [];
  var draftAssignments = [];
  var pendingPhoto;
  var draftLecturer = null;
  var uiBound = false;

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function effectivePhoto(lecturer) {
    if (pendingPhoto !== undefined) return pendingPhoto;
    return lecturer && lecturer.photo ? String(lecturer.photo) : "";
  }

  function lecturerForDisplay() {
    var base = draftLecturer || (Attendify.getSession() || {}).lecturer || {};
    return {
      id: base.id,
      username: base.username,
      fullName: base.fullName,
      photo: effectivePhoto(base)
    };
  }

  function refreshProfileVisuals() {
    var host = document.getElementById("settings-profile-avatar");
    if (!host || !window.Attendify) return;
    var person = Attendify.lecturerAvatarPerson(lecturerForDisplay());
    host.innerHTML = Attendify.avatarMarkup(person, "w-full h-full", "ring-0");
    Attendify.hydrateAvatars(host);
    Attendify.paintLecturerChrome(lecturerForDisplay(), { sidebar: true, header: true });
  }

  function fillView(lecturer) {
    if (!lecturer) return;
    draftLecturer = lecturer;
    var nameEl = document.getElementById("view-full-name");
    var userEl = document.getElementById("view-username");
    if (nameEl) nameEl.textContent = lecturer.fullName || "…";
    if (userEl) userEl.textContent = lecturer.username || "…";
    var editName = document.getElementById("edit-full-name");
    var editUser = document.getElementById("edit-username");
    if (editName) editName.value = lecturer.fullName || "";
    if (editUser) editUser.value = lecturer.username || "";
    refreshProfileVisuals();
    renderProgrammeSummary();
  }

  function assignmentKey(item) {
    return String(item.uccProgrammeId) + ":" + String(item.level);
  }

  function cloneAssignments(list) {
    return (list || []).map(function (item) {
      return {
        uccProgrammeId: item.uccProgrammeId,
        level: Number(item.level),
        code: item.code,
        name: item.name
      };
    });
  }

  function programmeDisplayLabel(p) {
    if (!p) return "";
    return (p.code || "") + " · " + (p.name || "");
  }

  function programmeCardHtml(item, opts) {
    opts = opts || {};
    var title = item.name || item.code || "Programme";
    var code = item.code || "";
    var level = item.level != null ? item.level : item.teachLevel;
    var note = "";
    if (opts.showStudentNote && item.studentCountAtLevel > 0) {
      note =
        ' · <span class="text-teal-700 font-semibold">' +
        escapeHtml(String(item.studentCountAtLevel)) +
        " student" +
        (item.studentCountAtLevel === 1 ? "" : "s") +
        "</span>";
    }
    var meta = "";
    if (code || level != null) {
      meta =
        '<p class="settings-prog-meta text-[11px] text-slate-500 mt-0.5 leading-snug">' +
        (code ? '<span class="prog-code">' + escapeHtml(code) + "</span>" : "") +
        (code && level != null ? " · " : "") +
        (level != null ? "Level " + escapeHtml(String(level)) : "") +
        note +
        "</p>";
    }
    return (
      '<div class="settings-prog-card">' +
      '<p class="settings-prog-title text-sm font-semibold text-slate-800 leading-snug">' +
      escapeHtml(title) +
      "</p>" +
      meta +
      "</div>"
    );
  }

  function programmeById(id) {
    return programmeOptions.filter(function (p) {
      return p.id === id;
    })[0];
  }

  var settingsProgCombo = null;
  var settingsProgTrigger = null;
  var settingsProgTriggerLabel = null;
  var settingsProgPanel = null;
  var settingsProgSearch = null;
  var settingsProgList = null;
  var settingsProgValue = null;

  function currentPickProgrammeId() {
    return settingsProgValue ? String(settingsProgValue.value || "") : "";
  }

  function setPickProgrammeId(id) {
    if (settingsProgValue) settingsProgValue.value = id || "";
  }

  function updateSettingsProgrammeTriggerLabel() {
    if (!settingsProgTriggerLabel) return;
    var pick = programmeById(currentPickProgrammeId());
    if (pick) {
      settingsProgTriggerLabel.textContent = programmeDisplayLabel(pick);
      settingsProgTriggerLabel.classList.add("is-selected");
      settingsProgTriggerLabel.classList.remove("text-slate-400");
    } else {
      settingsProgTriggerLabel.textContent = "Choose programme";
      settingsProgTriggerLabel.classList.remove("is-selected");
      settingsProgTriggerLabel.classList.add("text-slate-400");
    }
  }

  function setSettingsProgrammeOpen(open) {
    if (!settingsProgCombo || !settingsProgPanel || !settingsProgTrigger) return;
    var on = !!open;
    settingsProgCombo.classList.toggle("is-open", on);
    settingsProgPanel.hidden = !on;
    settingsProgTrigger.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) {
      renderSettingsProgrammeList(filterSettingsProgrammes(settingsProgSearch ? settingsProgSearch.value : ""), currentPickProgrammeId());
      if (settingsProgSearch) {
        window.setTimeout(function () {
          settingsProgSearch.focus();
        }, 0);
      }
    }
    if (!on && settingsProgSearch) settingsProgSearch.value = "";
    if (!on) renderSettingsProgrammeList(programmeOptions, currentPickProgrammeId());
  }

  function filterSettingsProgrammes(query) {
    var q = String(query || "")
      .trim()
      .toLowerCase();
    if (!q) return programmeOptions.slice();
    return programmeOptions.filter(function (p) {
      return (
        String(p.code || "")
          .toLowerCase()
          .indexOf(q) >= 0 ||
        String(p.name || "")
          .toLowerCase()
          .indexOf(q) >= 0 ||
        String(p.department || "")
          .toLowerCase()
          .indexOf(q) >= 0
      );
    });
  }

  function renderSettingsProgrammeList(list, selectedId) {
    var empty = document.getElementById("programme-catalogue-empty");
    if (!settingsProgList) return;
    if (!programmeOptions.length) {
      settingsProgList.innerHTML = '<p class="auth-programme-empty">No programmes available</p>';
      if (empty) {
        empty.textContent = "Could not load programmes.";
        empty.classList.remove("hidden");
      }
      return;
    }
    if (empty) empty.classList.add("hidden");
    if (!list.length) {
      settingsProgList.innerHTML = '<p class="auth-programme-empty">No matching programmes</p>';
      updateSettingsProgrammeTriggerLabel();
      return;
    }
    var groups = {};
    var order = [];
    list.forEach(function (p) {
      var dept = p.department || "Other programmes";
      if (!groups[dept]) {
        groups[dept] = [];
        order.push(dept);
      }
      groups[dept].push(p);
    });
    order.sort(function (a, b) {
      if (a.indexOf("Computer Science") === 0) return -1;
      if (b.indexOf("Computer Science") === 0) return 1;
      return a.localeCompare(b);
    });
    var html = "";
    order.forEach(function (dept) {
      html += '<div class="auth-programme-group">';
      html += '<div class="auth-programme-group-title">' + escapeHtml(dept) + "</div>";
      groups[dept].forEach(function (p) {
        var chosen = selectedId === p.id;
        html +=
          '<button type="button" class="auth-programme-option' +
          (chosen ? " is-selected" : "") +
          '" role="option" aria-selected="' +
          (chosen ? "true" : "false") +
          '" data-programme-id="' +
          escapeHtml(p.id) +
          '">' +
          escapeHtml(programmeDisplayLabel(p)) +
          "</button>";
      });
      html += "</div>";
    });
    settingsProgList.innerHTML = html;
    updateSettingsProgrammeTriggerLabel();
  }

  function pickSettingsProgramme(id) {
    setPickProgrammeId(id);
    updateSettingsProgrammeTriggerLabel();
    setSettingsProgrammeOpen(false);
    rebuildPickLevelOptions(false);
  }

  function rebuildPickLevelOptions(keepLevel) {
    var levelEl = document.getElementById("pick-level");
    if (!levelEl) return;
    var pick = programmeById(currentPickProgrammeId());
    var html = '<option value="" disabled selected>Choose level</option>';
    if (!pick) {
      levelEl.innerHTML = html;
      return;
    }
    var max = pick.maxLevel ? Number(pick.maxLevel) : 400;
    if (!max || max < 400) max = 400;
    var prev = keepLevel ? levelEl.value : "";
    for (var lvl = 100; lvl <= max; lvl += 100) {
      var label =
        lvl >= 500 && max >= 600
          ? "Level " + lvl + (lvl === 500 ? " / clinical" : lvl === 600 ? " / final" : "")
          : "Level " + lvl;
      html += '<option value="' + lvl + '">' + label + "</option>";
    }
    levelEl.innerHTML = html;
    if (prev && Number(prev) <= max) levelEl.value = prev;
  }

  function resetSettingsProgrammePicker() {
    setPickProgrammeId("");
    rebuildPickLevelOptions(false);
    renderSettingsProgrammeList(programmeOptions, "");
  }

  function initSettingsProgrammePickerRefs() {
    settingsProgCombo = document.getElementById("settings-programme-combo");
    settingsProgTrigger = document.getElementById("settings-programme-trigger");
    settingsProgTriggerLabel = document.getElementById("settings-programme-trigger-label");
    settingsProgPanel = document.getElementById("settings-programme-panel");
    settingsProgSearch = document.getElementById("settings-programme-search");
    settingsProgList = document.getElementById("settings-programme-list");
    settingsProgValue = document.getElementById("pick-programme");
  }

  function renderProgrammeSelect() {
    renderSettingsProgrammeList(programmeOptions, currentPickProgrammeId());
    rebuildPickLevelOptions(true);
  }

  function renderAssignmentDraftList() {
    var host = document.getElementById("assignment-draft-list");
    if (!host) return;
    if (!draftAssignments.length) {
      host.innerHTML = '<li class="text-xs text-slate-400 py-2">No programmes added yet.</li>';
      return;
    }
    host.innerHTML = draftAssignments
      .map(function (item, index) {
        return (
          '<li class="flex items-start justify-between gap-3 py-2.5 px-2.5 rounded-lg bg-slate-50 border border-slate-100">' +
          '<div class="min-w-0 flex-1">' +
          programmeCardHtml(item, { showStudentNote: true }) +
          "</div>" +
          '<button type="button" class="text-xs font-semibold text-rose-600 hover:underline shrink-0 mt-0.5" data-remove-assignment="' +
          index +
          '">Remove</button></li>'
        );
      })
      .join("");
  }

  function loadProgrammeCatalogueFetch() {
    return Attendify.fetchLecturerProgrammeCatalogue().then(function (pack) {
      programmeOptions = (pack && pack.programmes) || [];
      if (pack && pack.assignments && pack.assignments.length) {
        draftAssignments = cloneAssignments(pack.assignments);
      } else {
        draftAssignments = [];
      }
      resetSettingsProgrammePicker();
      renderProgrammeSelect();
      renderAssignmentDraftList();
      return pack;
    });
  }

  function renderProgrammeSummary() {
    var host = document.getElementById("programme-selected-summary");
    if (!host) return;
    var classes = [];
    try {
      classes = Attendify.load().classes || [];
    } catch (_) {
      classes = [];
    }
    if (!classes.length) {
      host.textContent = "None selected yet";
      host.classList.remove("settings-prog-summary");
      host.classList.add("font-normal", "text-slate-500");
      return;
    }
    host.classList.remove("font-normal", "text-slate-500");
    host.classList.add("settings-prog-summary");
    host.innerHTML =
      '<ul class="settings-prog-summary-list">' +
      classes
        .map(function (c) {
          return (
            '<li class="settings-prog-summary-item">' +
            programmeCardHtml({ code: c.code, name: c.name, teachLevel: c.teachLevel }) +
            "</li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function addAssignmentFromPickers() {
    var progEl = document.getElementById("pick-programme");
    var levelEl = document.getElementById("pick-level");
    var err = document.getElementById("profile-error");
    if (err) err.classList.add("hidden");
    if (!progEl || !progEl.value) {
      if (err) {
        err.textContent = "Choose a programme first.";
        err.classList.remove("hidden");
      }
      return;
    }
    var uccId = progEl.value;
    var level = levelEl ? Number(levelEl.value) : 0;
    if (!level) {
      if (err) {
        err.textContent = "Choose a level.";
        err.classList.remove("hidden");
      }
      return;
    }
    var pick = programmeOptions.filter(function (p) {
      return p.id === uccId;
    })[0];
    var next = {
      uccProgrammeId: uccId,
      level: level,
      code: pick ? pick.code : "",
      name: pick ? pick.name : ""
    };
    var exists = draftAssignments.some(function (item) {
      return assignmentKey(item) === assignmentKey(next);
    });
    if (exists) {
      if (err) {
        err.textContent = "That programme and level is already in your list.";
        err.classList.remove("hidden");
      }
      return;
    }
    draftAssignments.push(next);
    renderAssignmentDraftList();
    resetSettingsProgrammePicker();
  }

  function clearPhotoError() {
    var el = document.getElementById("profile-photo-error");
    if (el) {
      el.classList.add("hidden");
      el.textContent = "";
    }
  }

  function setEditing(on) {
    var form = document.getElementById("profile-form");
    var view = document.getElementById("profile-view");
    var editBtn = document.getElementById("btn-edit-profile");
    if (form) form.classList.toggle("hidden", !on);
    if (view) view.classList.toggle("hidden", on);
    if (editBtn) editBtn.classList.toggle("hidden", on);
    var err = document.getElementById("profile-error");
    var ok = document.getElementById("profile-success");
    if (err) err.classList.add("hidden");
    if (ok) ok.classList.add("hidden");
    clearPhotoError();
    if (on) {
      pendingPhoto = undefined;
      var cur = document.getElementById("edit-current-password");
      var neu = document.getElementById("edit-new-password");
      if (cur) cur.value = "";
      if (neu) neu.value = "";
      var fileInput = document.getElementById("profile-photo-file");
      if (fileInput) fileInput.value = "";
      loadProgrammeCatalogueFetch();
    } else {
      pendingPhoto = undefined;
      refreshProfileVisuals();
    }
  }

  function bindUi() {
    if (uiBound) return;
    uiBound = true;

    var editBtn = document.getElementById("btn-edit-profile");
    if (editBtn) {
      editBtn.addEventListener("click", function (event) {
        event.preventDefault();
        setEditing(true);
      });
    }

    var cancelBtn = document.getElementById("btn-cancel-edit");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        pendingPhoto = undefined;
        draftAssignments = [];
        resetSettingsProgrammePicker();
        fillView((Attendify.getSession() || {}).lecturer);
        setEditing(false);
      });
    }

    initSettingsProgrammePickerRefs();

    if (settingsProgTrigger) {
      settingsProgTrigger.addEventListener("click", function () {
        var open = settingsProgCombo && settingsProgCombo.classList.contains("is-open");
        setSettingsProgrammeOpen(!open);
      });
    }
    document.addEventListener("click", function (e) {
      if (!settingsProgCombo || !settingsProgCombo.classList.contains("is-open")) return;
      if (settingsProgCombo.contains(e.target)) return;
      setSettingsProgrammeOpen(false);
    });
    if (settingsProgSearch) {
      settingsProgSearch.addEventListener("input", function () {
        renderSettingsProgrammeList(filterSettingsProgrammes(settingsProgSearch.value), currentPickProgrammeId());
      });
      settingsProgSearch.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }
    if (settingsProgList) {
      settingsProgList.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-programme-id]");
        if (!btn) return;
        e.stopPropagation();
        pickSettingsProgramme(btn.getAttribute("data-programme-id"));
      });
    }

    var addBtn = document.getElementById("btn-add-assignment");
    if (addBtn) addBtn.addEventListener("click", addAssignmentFromPickers);

    var draftList = document.getElementById("assignment-draft-list");
    if (draftList) {
      draftList.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-remove-assignment]");
        if (!btn) return;
        var index = Number(btn.getAttribute("data-remove-assignment"));
        if (index >= 0 && index < draftAssignments.length) {
          draftAssignments.splice(index, 1);
          renderAssignmentDraftList();
        }
      });
    }

    var photoBtn = document.getElementById("btn-profile-photo");
    var photoFile = document.getElementById("profile-photo-file");
    var photoRemove = document.getElementById("btn-profile-photo-remove");

    if (photoBtn && photoFile) {
      photoBtn.addEventListener("click", function () {
        photoFile.click();
      });
      photoFile.addEventListener("change", function () {
        var file = photoFile.files && photoFile.files[0];
        if (!file) return;
        clearPhotoError();
        Attendify.photoFromFile(file)
          .then(function (dataUrl) {
            pendingPhoto = dataUrl;
            refreshProfileVisuals();
          })
          .catch(function (err) {
            var el = document.getElementById("profile-photo-error");
            if (el) {
              el.textContent = (err && err.message) || "Could not use that image.";
              el.classList.remove("hidden");
            }
          });
      });
    }

    if (photoRemove) {
      photoRemove.addEventListener("click", function () {
        pendingPhoto = "";
        if (photoFile) photoFile.value = "";
        clearPhotoError();
        refreshProfileVisuals();
      });
    }

    var profileForm = document.getElementById("profile-form");
    if (profileForm) {
      profileForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var err = document.getElementById("profile-error");
        var ok = document.getElementById("profile-success");
        if (err) err.classList.add("hidden");
        if (ok) ok.classList.add("hidden");
        var payload = {
          fullName: document.getElementById("edit-full-name").value.trim(),
          username: document.getElementById("edit-username").value.trim(),
          currentPassword: document.getElementById("edit-current-password").value,
          password: document.getElementById("edit-new-password").value
        };
        if (draftAssignments.length) {
          payload.teachingAssignments = draftAssignments.map(function (item) {
            return { uccProgrammeId: item.uccProgrammeId, level: item.level };
          });
        }
        if (pendingPhoto !== undefined) {
          if (pendingPhoto === "") payload.clearPhoto = true;
          else payload.photo = pendingPhoto;
        }
        Attendify.updateLecturerProfile(payload).then(function (result) {
          if (!result.ok) {
            if (err) {
              err.textContent = result.error || "Could not save.";
              err.classList.remove("hidden");
            }
            return;
          }
          pendingPhoto = undefined;
          draftAssignments = [];
          resetSettingsProgrammePicker();
          fillView(result.lecturer);
          setEditing(false);
          if (ok) {
            ok.textContent = "Saved successfully.";
            ok.classList.remove("hidden");
          }
          window.dispatchEvent(new CustomEvent("attendify:programmes-updated"));
        });
      });
    }
  }

  function bootAfterAuth() {
    var session = Attendify.getSession();
    if (!session || !session.lecturer) return;
    fillView(session.lecturer);

    var params = new URLSearchParams(window.location.search);
    if (params.get("setup") === "1") {
      var hint = document.getElementById("settings-setup-hint");
      if (hint) hint.classList.remove("hidden");
      setEditing(true);
    } else {
      setEditing(false);
    }
  }

  bindUi();

  if (!window.Attendify) return;

  Attendify.ready()
    .then(function () {
      return Attendify.validateSession();
    })
    .then(function (result) {
      if (!result || !result.ok) return;
      bootAfterAuth();
    });
})();