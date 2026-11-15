(function () {
  var slider = document.getElementById("auth-slider");
  var tabLogin = document.getElementById("tab-login");
  var tabSignup = document.getElementById("tab-signup");
  var hintLogin = document.getElementById("auth-hint-login");
  var hintSignup = document.getElementById("auth-hint-signup");

  function setMode(signup) {
    if (!slider) return;
    try {
      var url = new URL(window.location.href);
      if (signup) url.searchParams.set("mode", "signup");
      else url.searchParams.delete("mode");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch (_) {}
    if (signup) {
      slider.classList.add("is-signup");
      if (tabLogin) {
        tabLogin.classList.remove("auth-tab-active");
        tabLogin.classList.add("auth-tab-idle");
      }
      if (tabSignup) {
        tabSignup.classList.add("auth-tab-active");
        tabSignup.classList.remove("auth-tab-idle");
      }
      if (hintLogin) hintLogin.classList.add("hidden");
      if (hintSignup) hintSignup.classList.remove("hidden");
    } else {
      slider.classList.remove("is-signup");
      if (tabSignup) {
        tabSignup.classList.remove("auth-tab-active");
        tabSignup.classList.add("auth-tab-idle");
      }
      if (tabLogin) {
        tabLogin.classList.add("auth-tab-active");
        tabLogin.classList.remove("auth-tab-idle");
      }
      if (hintSignup) hintSignup.classList.add("hidden");
      if (hintLogin) hintLogin.classList.remove("hidden");
    }
  }

  window.AttendifyAuthPage = { setMode: setMode };

  if (tabLogin) {
    tabLogin.addEventListener("click", function () {
      setMode(false);
    });
  }
  if (tabSignup) {
    tabSignup.addEventListener("click", function () {
      setMode(true);
    });
  }

  document.querySelectorAll("[data-auth-show]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      var mode = el.getAttribute("data-auth-show");
      if (mode === "signup") {
        e.preventDefault();
        setMode(true);
      } else if (mode === "login") {
        e.preventDefault();
        setMode(false);
      }
    });
  });

  var viewport = document.querySelector(".auth-viewport");
  var touchStartX = 0;
  var touchStartY = 0;
  var pointerStartX = 0;
  if (viewport) {
    viewport.addEventListener(
      "touchstart",
      function (e) {
        if (!e.touches || !e.touches[0]) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      },
      { passive: true }
    );
    viewport.addEventListener(
      "touchend",
      function (e) {
        if (document.body.classList.contains("auth-programme-sheet-open")) return;
        if (e.target && e.target.closest && e.target.closest(".auth-programme-combo")) return;
        if (!e.changedTouches || !e.changedTouches[0]) return;
        var dx = e.changedTouches[0].clientX - touchStartX;
        var dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0) setMode(true);
        else setMode(false);
      },
      { passive: true }
    );
    viewport.addEventListener("mousedown", function (e) {
      pointerStartX = e.clientX;
    });
    viewport.addEventListener("mouseup", function (e) {
      var dx = e.clientX - pointerStartX;
      if (Math.abs(dx) < 56) return;
      if (dx < 0) setMode(true);
      else setMode(false);
    });
  }

  var params = new URLSearchParams(window.location.search);
  var openSignup = params.get("mode") === "signup";
  try {
    var storedAuthMode = sessionStorage.getItem("attendify_auth_mode");
    if (storedAuthMode === "signup") openSignup = true;
    if (storedAuthMode === "signin") openSignup = false;
    sessionStorage.removeItem("attendify_auth_mode");
  } catch (e) {}
  setMode(!!openSignup);

  /* —— Login —— */
  var programmeSelect = document.getElementById("login-programme");
  var loginForm = document.getElementById("login-form");
  var usernameInput = document.getElementById("login-username");
  var passwordInput = document.getElementById("login-password");
  var rememberInput = document.getElementById("remember-me");
  var submitBtn = document.getElementById("btn-submit-login");
  var submitText = document.getElementById("btn-submit-text");
  var errorBanner = document.getElementById("login-error-banner");
  var errorMsg = document.getElementById("login-error-msg");
  var togglePwBtn = document.getElementById("toggle-pw-visibility");
  var pwEyeOpen = document.getElementById("pw-eye-open");
  var pwEyeClosed = document.getElementById("pw-eye-closed");

  if (togglePwBtn && passwordInput) {
    togglePwBtn.addEventListener("click", function () {
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        if (pwEyeOpen) pwEyeOpen.classList.add("hidden");
        if (pwEyeClosed) pwEyeClosed.classList.remove("hidden");
      } else {
        passwordInput.type = "password";
        if (pwEyeOpen) pwEyeOpen.classList.remove("hidden");
        if (pwEyeClosed) pwEyeClosed.classList.add("hidden");
      }
    });
  }

  function populateProgrammes(classes, preferredId) {
    if (!programmeSelect) return;
    programmeSelect.innerHTML = '<option value="">— Use my saved programme —</option>';
    (classes || []).forEach(function (cls) {
      var opt = document.createElement("option");
      opt.value = cls.id;
      opt.textContent = (cls.code ? cls.code + " — " : "") + cls.name;
      if (preferredId && cls.id === preferredId) opt.selected = true;
      programmeSelect.appendChild(opt);
    });
  }

  if (typeof Attendify !== "undefined") {
    Attendify.ready()
      .then(function (state) {
        var savedLogin = null;
        try {
          savedLogin = JSON.parse(localStorage.getItem("attendify-login") || "null");
        } catch (_) {}
        var activeId = (savedLogin && savedLogin.programme) || (state && state.activeClassId) || "";
        populateProgrammes((state && state.classes) || [], activeId);
        if (savedLogin && savedLogin.username && usernameInput) usernameInput.value = savedLogin.username;
      })
      .catch(function () {
        populateProgrammes([], "");
      });
  }

  function showLoginError(msg) {
    if (!errorMsg || !errorBanner) return;
    errorMsg.textContent = msg;
    errorBanner.classList.remove("hidden");
  }
  function hideLoginError() {
    if (errorBanner) errorBanner.classList.add("hidden");
  }

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      hideLoginError();
      var username = usernameInput ? String(usernameInput.value || "").trim().toLowerCase() : "";
      var password = passwordInput ? passwordInput.value : "";
      var selectedProgram = programmeSelect ? programmeSelect.value : "";
      if (!username) {
        showLoginError("Please enter your username.");
        return;
      }
      if (!password) {
        showLoginError("Please enter your password.");
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      if (submitText) submitText.innerHTML = '<span class="btn-spinner"></span> Authenticating…';

      Attendify.loginLecturer({
        username: username,
        password: password,
        programmeId: selectedProgram || undefined
      }).then(function (result) {
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.textContent = "Sign In";
        if (!result.ok) {
          showLoginError(result.error || "Could not sign in.");
          return;
        }
        if (rememberInput && rememberInput.checked) {
          localStorage.setItem(
            "attendify-login",
            JSON.stringify({
              username: username,
              programme: result.classId || selectedProgram || ""
            })
          );
        } else {
          localStorage.removeItem("attendify-login");
        }
        var params = new URLSearchParams(window.location.search);
        var nextRaw = params.get("next") || "";
        var safeNext = "";
        try {
          nextRaw = decodeURIComponent(nextRaw);
        } catch (_) {}
        if (/^[a-zA-Z0-9._-]+\.html(\?[a-zA-Z0-9._=&%-]*)?$/.test(nextRaw)) {
          safeNext = nextRaw;
        }
        var dest = safeNext;
        if (!dest) {
          dest = "dashboard.html";
          if (result.classId) dest += "?class=" + encodeURIComponent(result.classId);
          if (result.createCourse) dest += (result.classId ? "&" : "?") + "createCourse=1";
        }
        if (window.AttendifyPageTransitions && AttendifyPageTransitions.markPortalEnter) {
          AttendifyPageTransitions.markPortalEnter();
        }
        window.location.replace(dest);
      });
    });
  }

  var existing = Attendify.getSession && Attendify.getSession();
  if (existing && existing.token && Attendify.validateSession && params.get("mode") !== "signup") {
    Attendify.validateSession().then(function (me) {
      if (!me || !me.ok) return;
      var nextRaw = params.get("next") || "dashboard.html";
      try {
        nextRaw = decodeURIComponent(nextRaw);
      } catch (_) {}
      if (!/^[a-zA-Z0-9._-]+\.html(\?[a-zA-Z0-9._=&%-]*)?$/.test(nextRaw)) {
        nextRaw = "dashboard.html";
      }
      window.location.replace(nextRaw);
    });
  }

  /* —— Sign up: programme picker —— */
  var signupProgrammes = [];
  var rosterPreviewTimer = null;
  var signupProgCombo = document.getElementById("signup-programme-combo");
  var signupProgTrigger = document.getElementById("signup-programme-trigger");
  var signupProgTriggerLabel = document.getElementById("signup-programme-trigger-label");
  var signupProgPanel = document.getElementById("signup-programme-panel");
  var signupProgSearch = document.getElementById("signup-programme-search");
  var signupProgValue = document.getElementById("signup-programme");
  var signupProgList = document.getElementById("signup-programme-list");
  var signupProgBackdrop = null;
  var signupProgMobileSheet = null;
  var signupProgPanelAnchor = { parent: null, next: null };

  function isMobileAuthPicker() {
    return window.matchMedia("(max-width: 1023px)").matches;
  }

  function mountSignupProgrammeMobileSheet() {
    if (signupProgMobileSheet) return;
    signupProgBackdrop = document.createElement("div");
    signupProgBackdrop.className = "auth-programme-backdrop";
    signupProgBackdrop.setAttribute("hidden", "");
    signupProgBackdrop.addEventListener("click", function () {
      setSignupProgrammeOpen(false);
    });
    signupProgMobileSheet = document.createElement("div");
    signupProgMobileSheet.className = "auth-programme-mobile-sheet";
    signupProgMobileSheet.setAttribute("hidden", "");
    signupProgMobileSheet.innerHTML =
      '<div class="auth-programme-mobile-sheet-inner" role="dialog" aria-modal="true" aria-label="Choose programme">' +
      '<div class="auth-programme-sheet-grab" aria-hidden="true"></div>' +
      '<p class="auth-programme-sheet-title">UCC programme</p>' +
      '<div class="auth-programme-mobile-sheet-slot"></div></div>';
    document.body.appendChild(signupProgBackdrop);
    document.body.appendChild(signupProgMobileSheet);
  }

  function restoreSignupProgrammePanel() {
    if (!signupProgPanel || !signupProgPanelAnchor.parent) return;
    signupProgPanelAnchor.parent.insertBefore(signupProgPanel, signupProgPanelAnchor.next);
  }
  var signupLevelSelect = document.getElementById("signup-level");
  var signupRosterWrap = document.getElementById("signup-roster-wrap");
  var signupRosterHeading = document.getElementById("signup-roster-heading");
  var signupRosterEmpty = document.getElementById("signup-roster-empty");
  var signupRosterList = document.getElementById("signup-roster-list");

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function programmeLabel(p) {
    return (p.code || "") + " — " + (p.name || "");
  }

  function updateSignupProgrammeTriggerLabel() {
    if (!signupProgTriggerLabel) return;
    var pick = selectedSignupProgramme();
    if (pick) {
      signupProgTriggerLabel.textContent = programmeLabel(pick);
      signupProgTriggerLabel.classList.add("is-selected");
      signupProgTriggerLabel.classList.remove("text-slate-400");
    } else {
      signupProgTriggerLabel.textContent = "Choose programme";
      signupProgTriggerLabel.classList.remove("is-selected");
      signupProgTriggerLabel.classList.add("text-slate-400");
    }
  }

  function setSignupProgrammeOpen(open) {
    if (!signupProgCombo || !signupProgPanel || !signupProgTrigger) return;
    var on = !!open;
    signupProgCombo.classList.toggle("is-open", on);
    signupProgTrigger.setAttribute("aria-expanded", on ? "true" : "false");

    if (isMobileAuthPicker()) {
      mountSignupProgrammeMobileSheet();
      var slot = signupProgMobileSheet.querySelector(".auth-programme-mobile-sheet-slot");
      if (on) {
        if (!signupProgPanelAnchor.parent && signupProgPanel.parentNode) {
          signupProgPanelAnchor.parent = signupProgPanel.parentNode;
          signupProgPanelAnchor.next = signupProgPanel.nextSibling;
        }
        slot.appendChild(signupProgPanel);
        signupProgPanel.classList.add("auth-programme-panel--mobile-sheet");
        signupProgPanel.hidden = false;
        signupProgBackdrop.removeAttribute("hidden");
        signupProgMobileSheet.removeAttribute("hidden");
        document.body.classList.add("auth-programme-sheet-open");
      } else {
        restoreSignupProgrammePanel();
        signupProgPanel.classList.remove("auth-programme-panel--mobile-sheet");
        signupProgPanel.hidden = true;
        signupProgBackdrop.setAttribute("hidden", "");
        signupProgMobileSheet.setAttribute("hidden", "");
        document.body.classList.remove("auth-programme-sheet-open");
      }
    } else {
      signupProgPanel.hidden = !on;
    }

    if (on) {
      renderSignupProgrammeList(
        filterSignupProgrammes(signupProgSearch ? signupProgSearch.value : ""),
        currentSignupProgrammeId()
      );
      if (signupProgSearch) {
        window.setTimeout(function () {
          signupProgSearch.focus();
        }, isMobileAuthPicker() ? 120 : 0);
      }
    }
    if (!on && signupProgSearch) signupProgSearch.value = "";
    if (!on) renderSignupProgrammeList(signupProgrammes, currentSignupProgrammeId());
  }

  function currentSignupProgrammeId() {
    return signupProgValue ? String(signupProgValue.value || "") : "";
  }

  function setSignupProgrammeId(id) {
    if (signupProgValue) signupProgValue.value = id || "";
  }

  function pickSignupProgramme(id) {
    setSignupProgrammeId(id);
    updateSignupProgrammeTriggerLabel();
    setSignupProgrammeOpen(false);
    rebuildSignupLevelOptions(false);
    hideSignupRoster();
  }

  function filterSignupProgrammes(query) {
    var q = String(query || "")
      .trim()
      .toLowerCase();
    if (!q) return signupProgrammes.slice();
    return signupProgrammes.filter(function (p) {
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

  function renderSignupProgrammeList(list, selectedId) {
    if (!signupProgList) return;
    if (!list.length) {
      signupProgList.innerHTML = '<p class="auth-programme-empty">No matching programmes</p>';
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
          escapeHtml(programmeLabel(p)) +
          "</button>";
      });
      html += "</div>";
    });
    signupProgList.innerHTML = html;
    updateSignupProgrammeTriggerLabel();
  }

  function selectedSignupProgramme() {
    var id = currentSignupProgrammeId();
    if (!id) return null;
    return (
      signupProgrammes.filter(function (p) {
        return p.id === id;
      })[0] || null
    );
  }

  function rebuildSignupLevelOptions(keepLevel) {
    if (!signupLevelSelect) return;
    var pick = selectedSignupProgramme();
    var html = '<option value="" disabled selected>Choose level</option>';
    if (!pick) {
      signupLevelSelect.innerHTML = html;
      return;
    }
    var max = pick.maxLevel ? Number(pick.maxLevel) : 400;
    if (!max || max < 400) max = 400;
    var prev = keepLevel ? signupLevelSelect.value : "";
    for (var lvl = 100; lvl <= max; lvl += 100) {
      var label = lvl >= 500 && max >= 600 ? "Level " + lvl + (lvl === 500 ? " / clinical" : lvl === 600 ? " / final" : "") : "Level " + lvl;
      html += '<option value="' + lvl + '">' + label + "</option>";
    }
    signupLevelSelect.innerHTML = html;
    if (prev && Number(prev) <= max) {
      signupLevelSelect.value = prev;
    }
  }

  function hideSignupRoster() {
    if (signupRosterWrap) signupRosterWrap.classList.add("hidden");
    if (signupRosterList) signupRosterList.innerHTML = "";
    if (signupRosterEmpty) signupRosterEmpty.classList.add("hidden");
  }

  function refreshSignupRosterPreview() {
    if (rosterPreviewTimer) clearTimeout(rosterPreviewTimer);
    rosterPreviewTimer = setTimeout(function () {
      var pick = selectedSignupProgramme();
      var level = signupLevelSelect ? Number(signupLevelSelect.value) : 0;
      if (!pick || !level || typeof Attendify.previewUccProgrammeRoster !== "function") {
        hideSignupRoster();
        return;
      }
      Attendify.previewUccProgrammeRoster(pick.id, level).then(function (pack) {
        if (!pack || !pack.ok) {
          hideSignupRoster();
          return;
        }
        if (!signupRosterWrap) return;
        signupRosterWrap.classList.remove("hidden");
        if (signupRosterHeading) {
          if (pack.sharedRoster && pack.count > 0) {
            signupRosterHeading.textContent =
              pack.count +
              " student" +
              (pack.count === 1 ? "" : "s") +
              " already enrolled at " +
              pack.programme.code +
              " · Level " +
              pack.level +
              ". One programme QR covers this class.";
          } else {
            signupRosterHeading.textContent =
              "No students at " + pack.programme.code + " · Level " + pack.level + " yet. You can still register.";
          }
        }
        if (signupRosterEmpty) signupRosterEmpty.classList.add("hidden");
        if (signupRosterList) {
          if (!pack.students || !pack.students.length) {
            signupRosterList.innerHTML = "";
          } else {
            signupRosterList.innerHTML = pack.students
              .map(function (st) {
                return (
                  "<li><span>" +
                  escapeHtml(st.name) +
                  '</span><span class="font-mono text-[10px] text-slate-500">' +
                  escapeHtml(st.studentIndex) +
                  "</span></li>"
                );
              })
              .join("");
          }
        }
      });
    }, 220);
  }

  function loadSignupProgrammes() {
    if (typeof Attendify.listUccProgrammes !== "function") return;
    Attendify.listUccProgrammes().then(function (list) {
      signupProgrammes = list || [];
      renderSignupProgrammeList(signupProgrammes, "");
      rebuildSignupLevelOptions();
    });
  }

  if (signupProgTrigger) {
    signupProgTrigger.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = signupProgCombo && signupProgCombo.classList.contains("is-open");
      setSignupProgrammeOpen(!open);
    });
  }
  document.addEventListener("click", function (e) {
    if (!signupProgCombo || !signupProgCombo.classList.contains("is-open")) return;
    if (signupProgCombo.contains(e.target)) return;
    if (signupProgMobileSheet && signupProgMobileSheet.contains(e.target)) return;
    setSignupProgrammeOpen(false);
  });
  if (signupProgSearch) {
    signupProgSearch.addEventListener("input", function () {
      renderSignupProgrammeList(filterSignupProgrammes(signupProgSearch.value), currentSignupProgrammeId());
    });
    signupProgSearch.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }
  function onSignupProgrammeOptionPick(e) {
    var btn = e.target.closest("[data-programme-id]");
    if (!btn) return;
    e.stopPropagation();
    pickSignupProgramme(btn.getAttribute("data-programme-id"));
  }
  if (signupProgList) {
    signupProgList.addEventListener("click", onSignupProgrammeOptionPick);
    signupProgList.addEventListener(
      "touchend",
      function (e) {
        var btn = e.target.closest("[data-programme-id]");
        if (!btn) return;
        e.preventDefault();
        onSignupProgrammeOptionPick(e);
      },
      { passive: false }
    );
  }
  if (signupLevelSelect) {
    signupLevelSelect.addEventListener("change", refreshSignupRosterPreview);
  }
  loadSignupProgrammes();

  /* —— Sign up —— */
  var signupForm = document.getElementById("signup-form");
  var signupError = document.getElementById("signup-error");
  var signupBtn = document.getElementById("btn-signup");
  var signupBtnText = document.getElementById("btn-signup-text");

  function showSignupError(msg) {
    if (!signupError) return;
    signupError.textContent = msg;
    signupError.classList.remove("hidden");
  }
  function hideSignupError() {
    if (signupError) {
      signupError.classList.add("hidden");
      signupError.textContent = "";
    }
  }

  if (signupForm) {
    signupForm.addEventListener("submit", function (event) {
      event.preventDefault();
      hideSignupError();
      var username = String(document.getElementById("signup-username").value || "").trim().toLowerCase();
      var password = document.getElementById("signup-password").value;
      var fullName = document.getElementById("signup-name").value.trim();

      if (!username || username.length < 3) {
        showSignupError("Choose a username with at least 3 characters.");
        return;
      }
      if (username.length > 64) {
        showSignupError("Username must be 64 characters or fewer.");
        return;
      }
      if (password.length < 6) {
        showSignupError("Password must be at least 6 characters.");
        return;
      }

      var uccId = currentSignupProgrammeId();
      var teachLevel = signupLevelSelect ? Number(signupLevelSelect.value) : 0;
      if (!uccId) {
        showSignupError("Select the UCC programme you teach.");
        return;
      }
      if (!teachLevel) {
        showSignupError("Select the level you teach.");
        return;
      }

      if (signupBtn) signupBtn.disabled = true;
      if (signupBtnText) signupBtnText.innerHTML = '<span class="btn-spinner"></span> Creating account…';

      Attendify.signupLecturer({
        username: username,
        password: password,
        fullName: fullName,
        teachingAssignments: [{ uccProgrammeId: uccId, level: teachLevel }]
      }).then(function (result) {
        if (signupBtn) signupBtn.disabled = false;
        if (signupBtnText) signupBtnText.textContent = "Create account & continue";
        if (!result.ok) {
          showSignupError(result.error || "Could not create your account.");
          return;
        }
        if (window.AttendifyPageTransitions && AttendifyPageTransitions.markPortalEnter) {
          AttendifyPageTransitions.markPortalEnter();
        }
        window.location.href = "dashboard.html";
      });
    });
  }
})();