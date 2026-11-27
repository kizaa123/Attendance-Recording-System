(function (global) {
  var KEY = "attendify-v1";
  var cache = null;
  var shareOrigin = "";
  var DEFAULT_PORT = "3000";
  var API_BASE = "http://localhost:" + DEFAULT_PORT;

  function isLoopbackHost(hostname) {
    var h = String(hostname || "").toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  }

  function isLoopbackOrigin(origin) {
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(String(origin || "").trim());
  }

  function apiUrl(path) {
    if (window.location.protocol === "file:") return API_BASE + path;
    return path;
  }

  function authApiUrl(path) {
    var p = String(path || "");
    if (p.indexOf("/") !== 0) p = "/" + p;
    if (window.location.protocol === "file:") return API_BASE + p;
    return window.location.origin + p;
  }

  function parseJsonResponse(response) {
    return response.text().then(function (text) {
      if (!text) return { ok: false, error: connectionHint() };
      try {
        return JSON.parse(text);
      } catch (e) {
        return { ok: false, error: connectionHint() };
      }
    });
  }

  function rememberShareOrigins(host) {
    if (!host) return;
    var pick = "";
    if (host.shareOrigin && !isLoopbackOrigin(host.shareOrigin)) pick = host.shareOrigin;
    else if (host.publicOrigin && !isLoopbackOrigin(host.publicOrigin)) pick = host.publicOrigin;
    else if (host.origin && !isLoopbackOrigin(host.origin)) pick = host.origin;
    else if (host.httpsOrigin && !isLoopbackOrigin(host.httpsOrigin)) pick = host.httpsOrigin;
    else if (host.shareOrigin) pick = host.shareOrigin;
    else if (host.publicOrigin) pick = host.publicOrigin;
    else if (host.origin) pick = host.origin;
    else if (host.requestOrigin) pick = host.requestOrigin;
    if (pick) shareOrigin = String(pick).replace(/\/$/, "");
  }

  function connectionHint() {
    if (window.location.protocol === "file:") {
      return "No connection. Open Attendify from your server link.";
    }
    return "Connection lost. Check Wi‑Fi and try again.";
  }

  var API_TIMEOUT_MS = 12000;
  var syncInFlight = null;
  var syncCooldownUntil = 0;
  var networkDegraded = false;

  function isNetworkDegraded() {
    if (global.navigator && global.navigator.onLine === false) return true;
    return networkDegraded;
  }

  function markNetworkDegraded(on) {
    networkDegraded = !!on;
    if (global.AttendifyConnectivity && global.AttendifyConnectivity.reflect) {
      global.AttendifyConnectivity.reflect();
    }
  }

  function isNetworkError(err) {
    if (!err) return true;
    if (err.code === "NETWORK" || err.name === "AbortError") return true;
    return false;
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    timeoutMs = timeoutMs == null ? API_TIMEOUT_MS : timeoutMs;
    options = options || {};
    if (typeof AbortController === "undefined") {
      return fetch(url, options);
    }
    var controller = new AbortController();
    var timer = global.setTimeout(function () {
      try {
        controller.abort();
      } catch (_) {}
    }, timeoutMs);
    var opts = Object.assign({}, options, { signal: controller.signal });
    return fetch(url, opts)
      .catch(function (err) {
        if (err && err.name === "AbortError") {
          var timeoutErr = new Error("timeout");
          timeoutErr.code = "NETWORK";
          throw timeoutErr;
        }
        throw err;
      })
      .finally(function () {
        global.clearTimeout(timer);
      });
  }

  function pendingScanCount() {
    if (!global.AttendifyScanCache || !AttendifyScanCache.queueDepth) return 0;
    try {
      return AttendifyScanCache.queueDepth("lecturer") || 0;
    } catch (_) {
      return 0;
    }
  }

  function seedStudents() {
    return [
      { id: "s1", classId: "cs101", name: "Elena Rostova", index: "CS2024-0012", email: "e.rostova@student.ac.edu", photo: "", source: "lecturer" },
      { id: "s2", classId: "cs101", name: "Marcus Adebayo", index: "CS2024-0089", email: "m.adebayo@student.ac.edu", photo: "", source: "lecturer" },
      { id: "s3", classId: "cs101", name: "Julian Lawrence", index: "CS2024-0104", email: "j.lawrence@student.ac.edu", photo: "", source: "link" },
      { id: "s4", classId: "cs101", name: "Mei Ling Chen", index: "CS2024-0122", email: "m.chen@student.ac.edu", photo: "", source: "link" },
      { id: "s5", classId: "cs101", name: "Siddharth Kumar", index: "CS2024-0138", email: "s.kumar@student.ac.edu", photo: "", source: "lecturer" },
      { id: "s6", classId: "cs101", name: "Ananya Banerjee", index: "CS2024-0152", email: "a.banerjee@student.ac.edu", photo: "", source: "link" }
    ];
  }

  function defaultState() {
    return {
      activeClassId: "",
      classes: [],
      students: [],
      sessions: {},
      courses: [],
      semester: { totalWeeks: 15, currentWeek: 1 }
    };
  }

  cache = defaultState();

  function load() {
    return cache;
  }

  function applyState(state) {
    if (!state || !state.classes || !state.students || !state.sessions) return;
    if (state.public) {
      var live = getSession();
      if (live && live.token) return;
    }
    if (!state.courses) state.courses = [];
    cache = state;
  }

  function mergeStudentIntoCache(student) {
    if (!student || !student.id) return;
    var state = load();
    state.students = state.students || [];
    var id = String(student.id);
    var i;
    for (i = 0; i < state.students.length; i++) {
      if (String(state.students[i].id) === id) {
        state.students[i] = Object.assign({}, state.students[i], student);
        cache = state;
        return;
      }
    }
    state.students.push(student);
    cache = state;
  }

  function lectureNameForScan(explicitName) {
    var name = explicitName != null && String(explicitName).trim() !== "" ? String(explicitName).trim() : activeLectureName;
    if (!name && activeCourseId) {
      var course = courseById(activeCourseId);
      if (course) name = courseLectureLabel(course);
    }
    return name;
  }

  function currentLecturerId() {
    try {
      var session = getSession();
      var id = session && session.lecturer && session.lecturer.id ? String(session.lecturer.id) : "";
      if (!id || id.indexOf("demo-") === 0) return "";
      return id;
    } catch (_) {
      return "";
    }
  }

  function withLecturer(payload) {
    var body = Object.assign({}, payload || {});
    var lecturerId = currentLecturerId();
    if (lecturerId) body.lecturerId = lecturerId;
    return body;
  }

  function authHeaders(extra) {
    var headers = Object.assign({ "Content-Type": "application/json" }, extra || {});
    try {
      var session = getSession();
      if (session && session.token) headers["X-Attendify-Token"] = session.token;
    } catch (_) {}
    return headers;
  }

  function apiFetch(path, options) {
    options = options || {};
    var opts = Object.assign({}, options);
    opts.credentials = options.credentials || "same-origin";
    opts.headers = authHeaders(options.headers || {});
    if (options.body && typeof options.body === "object" && !(options.body instanceof Blob)) {
      opts.body = JSON.stringify(options.body);
    }
    var url = apiUrl(path);
    return fetchWithTimeout(url, opts, options.timeoutMs)
      .then(function (response) {
        if (response.status === 401) {
          markNetworkDegraded(true);
          return response.json().catch(function () {
            return { ok: false, code: "AUTH_REQUIRED" };
          }).then(function (body) {
            var page = (window.location.pathname || "").toLowerCase();
            var isPublic =
              page.indexOf("login.html") !== -1 ||
              page.indexOf("signup.html") !== -1 ||
              page.indexOf("enroll.html") !== -1 ||
              page.indexOf("ta-scanner.html") !== -1;
            var hasLocal =
              !!(function () {
                try {
                  var s = getSession();
                  return s && s.token && s.lecturer;
                } catch (_) {
                  return false;
                }
              })();
            var hardRedirect =
              !hasLocal &&
              !options.skipAuthRedirect &&
              !options.silentAuth &&
              !(global.AttendifyScannerHud && AttendifyScannerHud.isLiveScanPage && AttendifyScannerHud.isLiveScanPage());
            if (!isPublic && hardRedirect) {
              clearSession();
              var next = encodeURIComponent(
                (window.location.pathname.split("/").pop() || "dashboard.html") + (window.location.search || "")
              );
              window.location.replace("login.html?next=" + next);
            }
            return Promise.reject(body || { ok: false, code: "AUTH_REQUIRED" });
          });
        }
        if (response.ok) markNetworkDegraded(false);
        return response;
      })
      .catch(function (err) {
        if (isNetworkError(err)) markNetworkDegraded(true);
        return Promise.reject(err);
      });
  }

  function ready() {
    return apiFetch("/api/host", { skipAuthRedirect: true, silentAuth: true, timeoutMs: 8000 })
      .then(function (response) {
        return response.json();
      })
      .then(function (host) {
        rememberShareOrigins(host);
        return syncFromServer();
      })
      .then(function () {
        flushPendingAttendanceScans();
        return cache;
      })
      .catch(function () {
        markNetworkDegraded(true);
        if (!shareOrigin) shareOrigin = window.location.origin;
        return cache;
      });
  }

  function syncBackoffMs() {
    if (global.navigator && global.navigator.onLine === false) return 20000;
    if (networkDegraded) return 12000;
    return 0;
  }

  /** Pull latest attendance from server (TA scans, second device) without /api/host round-trip. */
  function syncFromServer() {
    var now = Date.now();
    var wait = syncCooldownUntil - now;
    if (wait > 0) return Promise.resolve(cache);
    if (syncInFlight) return syncInFlight;
    syncInFlight = apiFetch("/api/state", {
      skipAuthRedirect: true,
      silentAuth: true,
      timeoutMs: 10000
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (state) {
        if (state && typeof state === "object" && !state.public) applyState(state);
        markNetworkDegraded(false);
        syncCooldownUntil = Date.now() + 1200;
        return cache;
      })
      .catch(function () {
        markNetworkDegraded(true);
        syncCooldownUntil = Date.now() + syncBackoffMs() || 8000;
        return cache;
      })
      .then(function (result) {
        syncInFlight = null;
        return result;
      });
    return syncInFlight;
  }

  function softReconnect() {
    markNetworkDegraded(false);
    syncCooldownUntil = 0;
    return syncFromServer()
      .then(function () {
        return flushPendingAttendanceScans();
      })
      .then(function () {
        return validateSession({ soft: true });
      })
      .catch(function () {
        markNetworkDegraded(true);
        return { ok: false, code: "NETWORK" };
      });
  }

  function classById(id, level) {
    var state = load();
    var needle = String(id || "");
    if (level != null && level !== "") {
      var withLevel = state.classes.filter(function (item) {
        return item.id === needle && Number(item.teachLevel) === Number(level);
      })[0];
      if (withLevel) return withLevel;
    }
    var found = state.classes.filter(function (item) {
      return item.id === needle;
    })[0];
    return found || state.classes[0];
  }

  function studentsFor(classId, level) {
    return load().students.filter(function (student) {
      if (student.classId !== classId) return false;
      if (level == null || level === "") return true;
      return Number(student.level) === Number(level);
    });
  }

  function today() {
    var date = new Date();
    var month = String(date.getMonth() + 1);
    var day = String(date.getDate());
    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;
    return date.getFullYear() + "-" + month + "-" + day;
  }

  var activeLectureName = "";
  var activeWeekNumber = null;
  var activeCourseId = "";

  function setActiveLectureName(name) {
    activeLectureName = String(name || "").trim();
  }

  function getActiveLectureName() {
    return activeLectureName;
  }

  function setActiveWeekNumber(week) {
    activeWeekNumber = week != null && week !== "" ? Number(week) : null;
  }

  function getActiveWeekNumber() {
    return activeWeekNumber;
  }

  function setActiveCourseId(id) {
    activeCourseId = String(id || "").trim();
  }

  function getActiveCourseId() {
    return activeCourseId;
  }

  function courseLectureLabel(course) {
    if (!course) return "";
    return String(course.code || "").trim() + " · " + String(course.name || "").trim();
  }

  var SESSION_QUIZ_SUFFIX = { quiz1: " · Quiz 1", quiz2: " · Quiz 2" };

  function normalizeSessionKind(kind) {
    var k = String(kind || "lecture").trim().toLowerCase().replace(/\s+/g, "");
    if (k === "quiz1" || k === "quiz-1") return "quiz1";
    if (k === "quiz2" || k === "quiz-2") return "quiz2";
    return "lecture";
  }

  function sessionKindFromLectureName(lectureName) {
    var ln = String(lectureName || "").trim().toLowerCase();
    if (/\s·\s*quiz\s*2\s*$/i.test(ln)) return "quiz2";
    if (/\s·\s*quiz\s*1\s*$/i.test(ln)) return "quiz1";
    return "lecture";
  }

  function courseLectureNameForKind(course, sessionKind) {
    var base = courseLectureLabel(course);
    var kind = normalizeSessionKind(sessionKind);
    if (kind === "quiz1") return base + SESSION_QUIZ_SUFFIX.quiz1;
    if (kind === "quiz2") return base + SESSION_QUIZ_SUFFIX.quiz2;
    return base;
  }

  function parseReportWeekFilter(value) {
    if (value === "all" || value == null || value === "") return { mode: "all" };
    var raw = String(value).trim();
    var match = raw.match(/^(\d{1,2})(?::(quiz1|quiz2))?$/i);
    if (!match) {
      var n = Number(raw);
      if (n >= 1) return { mode: "week", weekNumber: n, sessionKind: "lecture" };
      return { mode: "all" };
    }
    return {
      mode: "week",
      weekNumber: Number(match[1]),
      sessionKind: match[2] ? normalizeSessionKind(match[2]) : "lecture"
    };
  }

  function reportWeekFilterLabel(filter) {
    var parsed = parseReportWeekFilter(filter);
    if (parsed.mode === "all") return "All Weeks (aggregate)";
    var label = "Week " + parsed.weekNumber;
    if (parsed.sessionKind === "quiz1") return label + " (Quiz1)";
    if (parsed.sessionKind === "quiz2") return label + " (Quiz2)";
    return label;
  }

  function coursesForProgramme(classId) {
    return (load().courses || [])
      .filter(function (item) {
        return item.classId === classId;
      })
      .sort(function (a, b) {
        return String(a.code).localeCompare(String(b.code));
      });
  }

  function courseById(courseId) {
    var id = String(courseId || "").trim();
    return (load().courses || []).filter(function (item) {
      return item.id === id;
    })[0] || null;
  }

  function sessionKey(classId, lectureName, weekNumber) {
    var ln = lectureName != null ? String(lectureName).trim() : activeLectureName;
    var week =
      weekNumber != null && weekNumber !== ""
        ? Number(weekNumber)
        : activeWeekNumber != null
          ? activeWeekNumber
          : semesterInfo().currentWeek || 1;
    return classId + ":" + today() + ":" + week + ":" + ln.toLowerCase();
  }

  function sessionsForCourseWeek(classId, course, weekNumber, sessionKind) {
    if (!course) return [];
    var baseLabel = courseLectureLabel(course).toLowerCase();
    var week = Number(weekNumber) || 1;
    var kind = sessionKind != null ? normalizeSessionKind(sessionKind) : null;
    var targetLabel = kind ? courseLectureNameForKind(course, kind).toLowerCase() : "";
    var state = load();
    var matches = [];
    Object.keys(state.sessions || {}).forEach(function (key) {
      if (key.indexOf(classId + ":") !== 0) return;
      var session = state.sessions[key];
      if (!session || Number(session.weekNumber) !== week) return;
      var lecture = String(session.lectureName || "").trim().toLowerCase();
      var courseHit = session.courseId && session.courseId === course.id;
      var labelHit =
        lecture === baseLabel ||
        lecture.indexOf(baseLabel) === 0;
      if (!courseHit && !labelHit) return;
      if (kind) {
        if (lecture !== targetLabel) return;
      }
      matches.push(session);
    });
    matches.sort(function (a, b) {
      var byDate = String(b.date || "").localeCompare(String(a.date || ""));
      if (byDate) return byDate;
      return (b.sessionId || 0) - (a.sessionId || 0);
    });
    return matches;
  }

  function findSessionForCourseWeek(classId, course, weekNumber, sessionKind) {
    var kind = normalizeSessionKind(sessionKind || "lecture");
    var exact = sessionsForCourseWeek(classId, course, weekNumber, kind);
    if (exact.length) return exact[0];
    if (kind !== "lecture") return null;
    var matches = sessionsForCourseWeek(classId, course, weekNumber);
    var base = courseLectureLabel(course).toLowerCase();
    var i;
    for (i = 0; i < matches.length; i++) {
      if (String(matches[i].lectureName || "").trim().toLowerCase() === base) return matches[i];
    }
    return matches.length ? matches[0] : null;
  }

  function qrText(student) {
    var token = student.qrPublicId;
    if (!token) {
      return "ATD|" + student.classId + "|" + student.index;
    }
    return "ATTENDIFY:v1:" + token;
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (!parts.length) return "ST";
    return parts.map(function (part) { return part.charAt(0).toUpperCase(); }).join("");
  }

  function htmlAttr(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function htmlText(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }

  var avatarPhotoCache = Object.create(null);

  function isInlineAvatarSrc(src) {
    return /^data:image\//i.test(String(src || "").trim());
  }

  function ensureAvatarLoad(src, callback) {
    if (!src) {
      callback("error");
      return;
    }
    if (isInlineAvatarSrc(src)) {
      avatarPhotoCache[src] = { status: "loaded", waiters: [] };
      callback("loaded");
      return;
    }
    var entry = avatarPhotoCache[src];
    if (!entry) {
      entry = avatarPhotoCache[src] = { status: "loading", waiters: [] };
      var probe = new Image();
      probe.referrerPolicy = "no-referrer";
      probe.decoding = "async";
      function settle(status) {
        entry.status = status;
        var list = entry.waiters.slice();
        entry.waiters = [];
        list.forEach(function (fn) {
          fn(status);
        });
      }
      probe.onload = function () {
        settle(probe.naturalWidth > 0 && probe.naturalHeight > 0 ? "loaded" : "error");
      };
      probe.onerror = function () {
        settle("error");
      };
      probe.src = src;
    }
    if (entry.status === "loaded" || entry.status === "error") {
      callback(entry.status);
      return;
    }
    entry.waiters.push(callback);
  }

  function applyAvatarSlot(wrap, status) {
    if (!wrap) return;
    var img = wrap.querySelector("[data-avatar-img]");
    var spinner = wrap.querySelector("[data-avatar-spinner]");
    var src = wrap.getAttribute("data-avatar-src");
    wrap.setAttribute("data-avatar-state", status);
    if (!img || !spinner) return;
    if (status === "loaded" && src) {
      if (img.getAttribute("src") !== src) img.setAttribute("src", src);
      img.classList.remove("opacity-0", "hidden");
      spinner.classList.add("hidden");
      return;
    }
    if (status === "error") {
      spinner.classList.add("hidden");
      img.classList.add("hidden");
    }
  }

  function hydrateAvatars(root) {
    if (!root) return;
    var slots = root.querySelectorAll("[data-avatar-slot]");
    var i;
    for (i = 0; i < slots.length; i++) {
      (function (wrap) {
        var src = wrap.getAttribute("data-avatar-src");
        if (!src) return;
        if (isInlineAvatarSrc(src)) {
          applyAvatarSlot(wrap, "loaded");
          return;
        }
        var cached = avatarPhotoCache[src];
        if (cached && cached.status === "loaded") {
          applyAvatarSlot(wrap, "loaded");
          return;
        }
        if (cached && cached.status === "error") {
          applyAvatarSlot(wrap, "error");
          return;
        }
        wrap.setAttribute("data-avatar-state", "loading");
        var spinner = wrap.querySelector("[data-avatar-spinner]");
        if (spinner) spinner.classList.remove("hidden");
        ensureAvatarLoad(src, function (status) {
          if (!wrap.isConnected) return;
          applyAvatarSlot(wrap, status);
        });
      })(slots[i]);
    }
  }

  function onAvatarError(img) {
    if (!img) return;
    var wrap = img.closest ? img.closest("[data-avatar-slot]") : null;
    var src = (wrap && wrap.getAttribute("data-avatar-src")) || img.getAttribute("src") || "";
    if (src) {
      avatarPhotoCache[src] = { status: "error", waiters: [] };
      if (wrap) applyAvatarSlot(wrap, "error");
      return;
    }
    if (img.getAttribute("data-avatar-fallback") === "1") return;
    var letters = img.getAttribute("data-initials") || "ST";
    var size = img.getAttribute("data-avatar-class") || "w-12 h-12";
    var span = document.createElement("span");
    span.setAttribute("data-avatar-fallback", "1");
    span.className =
      size + " rounded-full bg-brand-100 text-brand-800 font-bold text-sm flex items-center justify-center shrink-0";
    span.textContent = letters;
    if (img.parentNode) img.parentNode.replaceChild(span, img);
  }

  /** Profile image with initials fallback; load via hydrateAvatars (cached, no flicker on re-render). */
  function avatarMarkup(student, sizeClass, ringClass) {
    if (!student) return "";
    sizeClass = sizeClass || "w-12 h-12";
    ringClass = ringClass != null ? ringClass : "ring-2 ring-slate-100";
    var letters = initials(student.name);
    var initialsOnly =
      '<span class="' +
      sizeClass +
      ' rounded-full bg-brand-100 text-brand-800 font-bold text-sm inline-flex items-center justify-center shrink-0" data-avatar-fallback="1">' +
      htmlText(letters) +
      "</span>";
    var src = "";
    if (student.photo && String(student.photo).trim()) src = String(student.photo).trim();
    else if (student.index) src = uccPhotoUrl(student.index);
    if (!src) return initialsOnly;
    var ring = ringClass ? " " + ringClass : "";
    return (
      '<span class="avatar-slot relative inline-block shrink-0 overflow-hidden rounded-full ' +
      sizeClass +
      '" data-avatar-slot data-avatar-src="' +
      htmlAttr(src) +
      '" data-avatar-state="idle">' +
      '<span class="absolute inset-0 flex items-center justify-center rounded-full bg-brand-100 text-brand-800 font-bold text-sm" data-avatar-initials>' +
      htmlText(letters) +
      "</span>" +
      '<span class="avatar-spinner hidden" data-avatar-spinner aria-hidden="true"></span>' +
      '<img class="absolute inset-0 h-full w-full rounded-full object-cover opacity-0' +
      ring +
      '" data-avatar-img alt="" referrerpolicy="no-referrer" decoding="async" onerror="Attendify.onAvatarError(this)">' +
      "</span>"
    );
  }

  function lecturerAvatarPerson(lecturer) {
    var lec = lecturer || {};
    return {
      name: lec.fullName || lec.username || "Lecturer",
      photo: lec.photo && String(lec.photo).trim() ? String(lec.photo).trim() : ""
    };
  }

  function paintLecturerChrome(lecturer, opts) {
    opts = opts || {};
    if (!lecturer) return;
    var name = lecturer.fullName || lecturer.username || "Lecturer";
    var username = lecturer.username || "";
    var nameEl = document.getElementById("lecturer-name");
    var userEl = document.getElementById("lecturer-username");
    var avatarEl = document.getElementById("lecturer-avatar");
    if (nameEl) nameEl.textContent = name;
    if (userEl) userEl.textContent = username;
    if (avatarEl) {
      var size = opts.sizeClass || "w-10 h-10";
      var ring =
        opts.ringClass != null
          ? opts.ringClass
          : opts.sidebar
            ? "ring-2 ring-tealAccent-400/40"
            : "ring-2 ring-white/80";
      avatarEl.className =
        opts.avatarClass ||
        "w-10 h-10 shrink-0 inline-flex items-center justify-center overflow-hidden rounded-full";
      avatarEl.innerHTML = avatarMarkup(lecturerAvatarPerson(lecturer), size, ring);
      hydrateAvatars(avatarEl);
    }
    if (opts.header) {
      var headerAvatar = document.getElementById("faculty-header-avatar");
      if (headerAvatar) {
        headerAvatar.innerHTML = avatarMarkup(
          lecturerAvatarPerson(lecturer),
          "w-full h-full",
          "ring-2 ring-tealAccent-300/50"
        );
        hydrateAvatars(headerAvatar);
      }
    }
  }

  function formatStudentLevel(studentOrLevel) {
    var lv =
      studentOrLevel != null && typeof studentOrLevel === "object"
        ? studentOrLevel.level
        : studentOrLevel;
    if (lv == null || lv === "") return "…";
    return "L" + String(lv);
  }

  function printAttendanceReport(meta) {
    meta = meta || {};
    var rows = meta.rows || [];
    if (!rows.length) {
      window.alert("No rows to export.");
      return;
    }
    var bodyRows = rows
      .map(function (row) {
        return (
          "<tr><td>" +
          htmlText(row.name) +
          "</td><td>" +
          htmlText(row.index) +
          "</td><td>" +
          htmlText(row.level != null ? row.level : "…") +
          "</td><td>" +
          htmlText(row.status) +
          "</td><td>" +
          htmlText(row.time || "…") +
          "</td></tr>"
        );
      })
      .join("");
    var title = htmlText(meta.title || "Attendance");
    var html =
      "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
      "<title>" +
      title +
      "</title><style>" +
      "*,*::before,*::after{box-sizing:border-box}" +
      "body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:16px;color:#0f172a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      "h1{font-size:18px;margin:0 0 6px;line-height:1.25}" +
      "p{margin:0 0 14px;color:#475569;font-size:12px;line-height:1.4}" +
      "table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed}" +
      "th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;vertical-align:top;word-wrap:break-word}" +
      "th{background:#f8fafc;text-transform:uppercase;font-size:9px;letter-spacing:.04em}" +
      "td:nth-child(2){font-family:ui-monospace,monospace;font-size:10px}" +
      "@media print{body{padding:12px}table{font-size:10px}}" +
      "</style></head><body>" +
      "<h1>" +
      title +
      "</h1>" +
      "<p>" +
      htmlText(meta.subtitle || "") +
      "</p>" +
      "<table><thead><tr><th>Student name</th><th>Index no.</th><th>Level</th><th>Status</th><th>Time</th></tr></thead><tbody>" +
      bodyRows +
      "</tbody></table></body></html>";

    function printFromFrame(frame) {
      var printWin = frame.contentWindow;
      if (!printWin || !printWin.document) return false;
      var doc = printWin.document;
      doc.open();
      doc.write(html);
      doc.close();
      var delay = window.matchMedia("(max-width: 767px)").matches ? 450 : 300;
      var done = false;
      function triggerPrint() {
        if (done) return;
        done = true;
        try {
          printWin.focus();
          printWin.print();
        } catch (_) {}
        setTimeout(function () {
          frame.style.cssText = "position:fixed;left:-9999px;top:0;width:0;height:0;border:0;visibility:hidden";
        }, 1200);
      }
      if (printWin.document.readyState === "complete") {
        setTimeout(triggerPrint, delay);
      } else {
        frame.onload = function () {
          setTimeout(triggerPrint, delay);
        };
        setTimeout(triggerPrint, delay + 400);
      }
      return true;
    }

    function printFromBlobUrl() {
      var blob = new Blob([html], { type: "text/html;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var win = window.open(url, "_blank");
      if (!win) {
        URL.revokeObjectURL(url);
        return false;
      }
      var delay = window.matchMedia("(max-width: 767px)").matches ? 700 : 400;
      var fired = false;
      function go() {
        if (fired) return;
        fired = true;
        try {
          win.focus();
          win.print();
        } catch (_) {}
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 60000);
      }
      win.addEventListener("load", function () {
        setTimeout(go, delay);
      });
      setTimeout(go, delay + 500);
      return true;
    }

    var frame = document.getElementById("attendify-print-frame");
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = "attendify-print-frame";
      frame.setAttribute("title", "Print attendance");
      frame.setAttribute("aria-hidden", "true");
      document.body.appendChild(frame);
    }
    frame.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483646;background:#fff";

    if (printFromFrame(frame)) return;

    if (printFromBlobUrl()) return;

    window.alert("Could not open the print view. Allow pop-ups, or use Export CSV.");
  }

  function enrollApiUrl(path) {
    var p = String(path || "");
    if (p.indexOf("/") !== 0) p = "/" + p;
    if (window.location.protocol === "file:") return API_BASE + p;
    return window.location.origin + p;
  }

  function uccPhotoPageUrl(indexNumber) {
    var tag = String(indexNumber || "").trim();
    if (!tag) return "";
    if (window.location.protocol === "file:") return uccPhotoUrl(tag);
    return (
      enrollApiUrl("/api/ucc/photo") + "?tag=" + encodeURIComponent(tag)
    );
  }

  function fetchEnrollContext(classId, level) {
    var qs =
      "?class=" +
      encodeURIComponent(String(classId || "")) +
      "&level=" +
      encodeURIComponent(String(level || ""));
    return fetch(enrollApiUrl("/api/enroll/context" + qs), { credentials: "same-origin" })
      .then(function (response) {
        return response.json();
      })
      .catch(function () {
        return { ok: false, error: connectionHint() };
      });
  }

  function fetchEnrollStudent(classId, index) {
    var qs =
      "?class=" +
      encodeURIComponent(String(classId || "")) +
      "&index=" +
      encodeURIComponent(String(index || ""));
    return fetch(enrollApiUrl("/api/enroll/student" + qs), { credentials: "same-origin" })
      .then(function (response) {
        return response.json();
      })
      .catch(function () {
        return { ok: false };
      });
  }

  function addStudent(input) {
    return apiFetch("/api/students", {
      method: "POST",
      body: withLecturer(input)
    }).then(function (response) { return response.json(); }).then(function (result) {
      if (result.state) applyState(result.state);
      return result;
    }).catch(function () {
      return { ok: false, error: "Could not save the student. Keep this page open through the attendance link." };
    });
  }

  function deleteStudent(studentId) {
    studentId = String(studentId || "").trim();
    if (!studentId) return Promise.resolve({ ok: false, error: "Student not found." });
    return apiFetch("/api/students/" + encodeURIComponent(studentId), {
      method: "DELETE",
      body: withLecturer({ id: studentId })
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.state) applyState(result.state);
        return result;
      })
      .catch(function () {
        return { ok: false, error: connectionHint() };
      });
  }

  function findStudent(classId, index) {
    var needle = String(index || "").trim().toLowerCase();
    return load().students.filter(function (student) {
      return student.classId === classId && student.index.toLowerCase() === needle;
    })[0] || null;
  }

  function normalizeIndexSuffix(input) {
    var digits = String(input || "").replace(/\D/g, "");
    if (!digits.length) return "";
    if (digits.length > 4) return "";
    return digits.padStart(4, "0");
  }

  function resolveStudentIndexSuffix(classId, input, level) {
    var suffix = normalizeIndexSuffix(input);
    if (!suffix) {
      return { ok: false, error: "Enter the last four digits of the index (e.g. 0001)." };
    }
    var students = studentsFor(classId, level != null && level !== "" ? level : null);
    var matches = students.filter(function (student) {
      var tail = String(student.index || "")
        .replace(/\D/g, "")
        .slice(-4);
      return tail === suffix;
    });
    if (!matches.length) {
      return { ok: false, error: "No registered student with index ending in " + suffix + "." };
    }
    if (matches.length > 1) {
      return { ok: false, error: "More than one student matches. Scan the QR or use the full index." };
    }
    return { ok: true, student: matches[0], index: matches[0].index };
  }

  var LIVE_SCAN_KEY = "attendify-live-scan";

  function saveLiveScanSession(data) {
    try {
      sessionStorage.setItem(LIVE_SCAN_KEY, JSON.stringify(data || {}));
    } catch (_) {}
  }

  function getLiveScanSession() {
    try {
      var raw = sessionStorage.getItem(LIVE_SCAN_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function clearLiveScanSession() {
    try {
      sessionStorage.removeItem(LIVE_SCAN_KEY);
    } catch (_) {}
  }

  function isLiveScanSessionStillOpen(live) {
    if (!live || !live.classId) return false;
    var week = Number(live.weekNumber) || 1;
    if (live.courseId) {
      var course = courseById(live.courseId);
      if (!course) return false;
      return !isCourseWeekSessionClosed(live.classId, course, week);
    }
    if (live.lectureName) {
      var sessions = load().sessions || {};
      var key = sessionKey(live.classId, live.lectureName, week);
      var sess = sessions[key];
      if (sess && sess.closedAt) return false;
    }
    return true;
  }

  function parseQr(text) {
    var raw = String(text || "").trim();
    if (raw.indexOf("ATTENDIFY:v1:") === 0) {
      return { qrToken: raw.slice("ATTENDIFY:v1:".length) };
    }
    var parts = raw.split("|");
    if (parts.length >= 3 && parts[0] === "ATD") {
      return { classId: parts[1], index: parts.slice(2).join("|") };
    }
    return null;
  }

  function startAttendanceSession(classId, lectureName, options) {
    options = options || {};
    var payload = withLecturer({ classId: classId });
    if (options.courseId) payload.courseId = options.courseId;
    else payload.lectureName = lectureName;
    if (options.weekNumber != null) payload.weekNumber = options.weekNumber;
    if (options.sessionKind) payload.sessionKind = normalizeSessionKind(options.sessionKind);
    return apiFetch("/api/sessions/start", {
      method: "POST",
      body: payload
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.state) applyState(result.state);
        return result;
      })
      .catch(function () {
        return { ok: false, error: connectionHint() };
      });
  }

  function closeAttendanceSession(classId, lectureName, weekNumber, courseId) {
    var payload = withLecturer({ classId: classId });
    if (courseId) payload.courseId = courseId;
    else if (lectureName) payload.lectureName = lectureName;
    if (weekNumber != null) payload.weekNumber = weekNumber;
    return apiFetch("/api/sessions/close", {
      method: "POST",
      body: payload
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.state) applyState(result.state);
        return result;
      })
      .catch(function () {
        return { ok: false, error: "Could not end the session." };
      });
  }

  function isCourseWeekSessionClosed(classId, course, weekNumber, sessionKind) {
    var sessions = sessionsForCourseWeek(classId, course, weekNumber, sessionKind || "lecture");
    var i;
    for (i = 0; i < sessions.length; i++) {
      if (sessions[i].closedAt) return true;
    }
    return false;
  }

  function removeAttendance(classId, studentId, lectureName, weekNumber, courseId) {
    var payload = withLecturer({ classId: classId, studentId: studentId });
    if (courseId) payload.courseId = courseId;
    else payload.lectureName = lectureName;
    if (weekNumber != null) payload.weekNumber = weekNumber;
    return apiFetch("/api/attendance/remove", {
      method: "POST",
      body: payload
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.state) applyState(result.state);
        return result;
      })
      .catch(function () {
        return { ok: false, error: "Could not undo." };
      });
  }

  function findStudentForScan(classId, index, qrToken) {
    var students = load().students || [];
    var i;
    var token = String(qrToken || "").trim();
    if (token) {
      for (i = 0; i < students.length; i++) {
        if (students[i].qrPublicId === token) return students[i];
      }
      return null;
    }
    var idx = String(index || "").trim();
    if (!idx) return null;
    for (i = 0; i < students.length; i++) {
      if (students[i].classId === classId && String(students[i].index || "").toLowerCase() === idx.toLowerCase()) {
        return students[i];
      }
    }
    var digits = idx.replace(/\D/g, "");
    if (digits.length > 0 && digits.length <= 4) {
      var suffix = digits.padStart(4, "0").toLowerCase();
      var hits = students.filter(function (student) {
        if (student.classId !== classId) return false;
        var tail = String(student.index || "")
          .replace(/\D/g, "")
          .slice(-4)
          .toLowerCase();
        return tail === suffix;
      });
      if (hits.length === 1) return hits[0];
    }
    return null;
  }

  function appendLocalAttendanceRecord(classId, lectureName, weekNumber, courseId, student) {
    if (!student) return null;
    var state = load();
    var key = sessionKey(classId, lectureName, weekNumber);
    var session = state.sessions[key];
    if (!session || session.closedAt) return null;
    session.records = session.records || [];
    var j;
    for (j = 0; j < session.records.length; j++) {
      if (session.records[j].studentId === student.id) {
        return {
          ok: true,
          duplicate: true,
          student: student,
          record: { studentId: student.id, scannedAt: session.records[j].scannedAt }
        };
      }
    }
    var scannedAt = new Date().toISOString();
    session.records.push({ studentId: student.id, scannedAt: scannedAt });
    return {
      ok: true,
      duplicate: false,
      student: student,
      record: { studentId: student.id, scannedAt: scannedAt },
      optimistic: true
    };
  }

  var LECTURER_SCAN_QUEUE = "lecturer";

  function postAttendancePayload(payload) {
    var liveScan =
      global.AttendifyScannerHud &&
      AttendifyScannerHud.isLiveScanPage &&
      AttendifyScannerHud.isLiveScanPage();
    return apiFetch("/api/attendance", {
      method: "POST",
      body: withLecturer(payload),
      skipAuthRedirect: liveScan,
      silentAuth: liveScan
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.state) applyState(result.state);
        if (result.student) mergeStudentIntoCache(result.student);
        return result;
      });
  }

  function flushPendingAttendanceScans() {
    if (!global.AttendifyScanCache) return Promise.resolve(0);
    return AttendifyScanCache.flushQueue(LECTURER_SCAN_QUEUE, function (payload) {
      return postAttendancePayload(payload);
    });
  }

  function markPresent(scannerClassId, index, qrToken, lectureName, weekNumber) {
    var payload = withLecturer({ classId: scannerClassId });
    if (activeCourseId) payload.courseId = activeCourseId;
    else payload.lectureName = lectureName != null ? lectureName : activeLectureName;
    var week =
      weekNumber != null && weekNumber !== ""
        ? weekNumber
        : activeWeekNumber != null
          ? activeWeekNumber
          : null;
    if (week != null) payload.weekNumber = week;
    if (qrToken) payload.qrToken = qrToken;
    else if (index) payload.index = index;

    var student = findStudentForScan(scannerClassId, index, qrToken);
    var scanLecture = lectureNameForScan(lectureName != null ? lectureName : payload.lectureName);
    var scanKind = sessionKindFromLectureName(scanLecture);
    if (scanKind !== "lecture") payload.sessionKind = scanKind;

    function offlineOptimistic() {
      if (!student) return { ok: false, error: "unknown" };
      var local = appendLocalAttendanceRecord(scannerClassId, scanLecture, week, activeCourseId, student);
      if (local && local.ok) {
        mergeStudentIntoCache(student);
        if (global.AttendifyScanCache) AttendifyScanCache.enqueue(LECTURER_SCAN_QUEUE, payload);
        return Object.assign({ queued: true }, local);
      }
      if (global.AttendifyScanCache) AttendifyScanCache.enqueue(LECTURER_SCAN_QUEUE, payload);
      return { ok: false, error: "unknown", queued: true };
    }

    if (global.navigator && global.navigator.onLine === false) {
      return Promise.resolve(offlineOptimistic());
    }

    return postAttendancePayload(payload)
      .then(function (result) {
        if (result && result.student) mergeStudentIntoCache(result.student);
        if (result && result.ok) return result;
        var fallback = offlineOptimistic();
        if (fallback && fallback.ok) return fallback;
        return result || { ok: false, error: "unknown" };
      })
      .catch(function () {
        return offlineOptimistic();
      });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("offline", function () {
      markNetworkDegraded(true);
    });
    window.addEventListener("online", function () {
      softReconnect();
    });
  }

  function attendanceRows(classId, lectureName, weekNumber) {
    var state = load();
    var session = state.sessions[sessionKey(classId, lectureName, weekNumber)];
    if (!session) return [];
    return session.records.map(function (record) {
      var student = state.students.filter(function (item) { return item.id === record.studentId; })[0];
      if (!student) {
        student = {
          id: record.studentId,
          classId: classId,
          name: "Student",
          index: String(record.studentId || "")
        };
      }
      return { student: student, scannedAt: record.scannedAt };
    });
  }

  function publicShareOrigin(hostInfo) {
    hostInfo = hostInfo || {};
    var ordered = [
      hostInfo.shareOrigin,
      hostInfo.publicOrigin,
      shareOrigin,
      hostInfo.origin,
      hostInfo.httpsOrigin,
      hostInfo.requestOrigin
    ];
    var i;
    for (i = 0; i < ordered.length; i++) {
      if (!ordered[i]) continue;
      var candidate = String(ordered[i]).replace(/\/$/, "");
      if (!isLoopbackOrigin(candidate)) return candidate;
    }
    for (i = 0; i < ordered.length; i++) {
      if (ordered[i]) return String(ordered[i]).replace(/\/$/, "");
    }
    if (window.location.protocol !== "file:" && window.location.origin) {
      var pageOrigin = window.location.origin.replace(/\/$/, "");
      if (!isLoopbackOrigin(pageOrigin)) return pageOrigin;
    }
    if (hostInfo.localOrigin) return String(hostInfo.localOrigin).replace(/\/$/, "");
    return (shareOrigin || API_BASE).replace(/\/$/, "");
  }

  function refreshShareOrigin() {
    return apiFetch("/api/host")
      .then(function (r) {
        return r.json();
      })
      .then(function (host) {
        rememberShareOrigins(host);
        return host;
      })
      .catch(function () {
        return null;
      });
  }

  function displayShareUrl(url) {
    return String(url || "").replace(/^https?:\/\//i, "");
  }

  function enrollUrl(classId, level) {
    var origin = publicShareOrigin();
    var id = String(classId || "").trim();
    var url = origin + "/join/" + encodeURIComponent(id);
    var lvl = level != null && level !== "" ? Number(level) : null;
    if (lvl != null && !isNaN(lvl)) {
      url += "?level=" + encodeURIComponent(String(lvl));
    }
    return url;
  }

  function enrollShareSummary(course, level) {
    if (!course) return "Student registration for this programme";
    var label = (course.code || "") + (course.code && course.name ? " · " : "") + (course.name || "");
    label = label.trim() || "this programme";
    var lvl = level != null && level !== "" ? Number(level) : null;
    if (lvl != null && !isNaN(lvl)) {
      return "Level " + lvl + " · " + label;
    }
    return label;
  }

  function scanShareUrl(token) {
    var origin = publicShareOrigin();
    return origin + "/scan/" + encodeURIComponent(token);
  }

  function createTaShareLink(classId, sessionId) {
    return apiFetch("/api/host")
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return {};
      })
      .then(function (host) {
        return apiFetch("/api/ta/create", {
          method: "POST",
          body: { classId: classId, sessionId: sessionId }
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (result) {
            if (!result.ok) return result;
            var origin = publicShareOrigin(host);
            var url = origin + "/scan/" + encodeURIComponent(result.taToken);
            return {
              ok: true,
              taToken: result.taToken,
              url: url,
              displayUrl: displayShareUrl(url)
            };
          });
      });
  }

  function activeSessionFor(classId, lectureName, weekNumber) {
    var state = load();
    var key = sessionKey(classId, lectureName, weekNumber);
    return state.sessions ? state.sessions[key] : null;
  }

  var UCC_PHOTO_CDN = "https://cdn.ucc.edu.gh/photos/?tag=";

  function uccPhotoUrl(indexNumber) {
    var tag = String(indexNumber || "").trim();
    if (!tag) return "";
    return UCC_PHOTO_CDN + encodeURIComponent(tag).replace(/%2F/gi, "/");
  }

  function studentPhotoUrl(student) {
    if (!student) return "";
    if (student.photo) return student.photo;
    return uccPhotoUrl(student.index);
  }

  /** Same-origin photo URL safe for QR canvas + mobile (avoids UCC CDN CORS). */
  function qrCompositePhotoUrl(student) {
    if (!student) return "";
    var photo = String(student.photo || "").trim();
    var index = String(student.index || student.studentIndex || "").trim();
    if (photo.indexOf("data:") === 0) return photo;
    if (photo.indexOf("cdn.ucc.edu.gh") !== -1) return index ? uccPhotoPageUrl(index) : "";
    if (photo.indexOf("/api/ucc/photo") !== -1) {
      return /^https?:\/\//i.test(photo) ? photo : enrollApiUrl(photo);
    }
    if (photo && /^https?:\/\//i.test(photo)) return photo;
    if (index) return uccPhotoPageUrl(index);
    return "";
  }

  function resolveUccPhoto(indexNumber) {
    var url = uccPhotoUrl(indexNumber);
    if (!url) return Promise.resolve({ url: "", ok: false });
    return new Promise(function (resolve) {
      ensureAvatarLoad(url, function (status) {
        resolve({ url: url, ok: status === "loaded" });
      });
    });
  }

  function bindUccPhotoPreview(inputEl, options) {
    if (!inputEl) return;
    options = options || {};
    var previewEl = options.previewEl;
    var imgEl = options.imgEl;
    var spinnerEl = options.spinnerEl;
    var statusEl = options.statusEl;
    var timer = null;
    var token = 0;

    function resetPreview() {
      if (previewEl && !options.keepPreviewVisible) previewEl.classList.add("hidden");
      if (imgEl) {
        imgEl.removeAttribute("src");
        imgEl.classList.add("hidden");
      }
      if (spinnerEl) spinnerEl.classList.add("hidden");
      if (statusEl) statusEl.textContent = "";
      if (options.onChange) options.onChange({ url: "", ok: false });
    }

    inputEl.addEventListener("input", function () {
      clearTimeout(timer);
      var index = String(inputEl.value || "").trim();
      if (index.length < 4) {
        resetPreview();
        return;
      }
      timer = setTimeout(function () {
        var run = ++token;
        if (previewEl && !options.keepPreviewVisible) previewEl.classList.remove("hidden");
        if (statusEl) statusEl.textContent = "Looking up profile photo…";
        if (spinnerEl) spinnerEl.classList.remove("hidden");
        if (imgEl) imgEl.classList.add("hidden");
        resolveUccPhoto(index).then(function (result) {
          if (run !== token) return;
          if (spinnerEl) spinnerEl.classList.add("hidden");
          var url = result.url || uccPhotoUrl(index);
          function showLoaded() {
            if (options.onChange) options.onChange({ url: url, ok: true });
            if (statusEl) statusEl.textContent = "Profile photo ready.";
            if (options.hidePlaceholder && imgEl) options.hidePlaceholder(false);
          }
          function showMissing() {
            if (options.onChange) options.onChange({ url: url, ok: false });
            if (imgEl) {
              imgEl.removeAttribute("src");
              imgEl.classList.add("hidden");
            }
            if (statusEl) {
              statusEl.textContent = "No photo found for this index. You can still register.";
            }
            if (options.hidePlaceholder && imgEl) options.hidePlaceholder(true);
          }
          if (!url || !imgEl) {
            if (!result.ok) showMissing();
            else showLoaded();
            return;
          }
          imgEl.onload = function () {
            if (run !== token) return;
            imgEl.classList.remove("hidden");
            showLoaded();
          };
          imgEl.onerror = function () {
            if (run !== token) return;
            if (result.ok) {
              imgEl.classList.remove("hidden");
              showLoaded();
              return;
            }
            showMissing();
          };
          imgEl.src = url;
          if (result.ok) {
            imgEl.classList.remove("hidden");
          }
        });
      }, 450);
    });
  }

  function photoFromFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        resolve("");
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("Could not read the photo.")); };
      reader.onload = function () {
        var image = new Image();
        image.onload = function () {
          var size = 160;
          var canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          var scale = Math.max(size / image.width, size / image.height);
          var width = image.width * scale;
          var height = image.height * scale;
          canvas.getContext("2d").drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.72));
        };
        image.onerror = function () { reject(new Error("Could not read the photo.")); };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function csvEscape(value) {
    var text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function downloadCsv(filename, rows) {
    var csv = rows.map(function (row) {
      return row.map(csvEscape).join(",");
    }).join("\n");
    var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  var ATTENDIFY_BRAND_LOGO = "/icons/icon-192.svg";

  function roundRectPath(ctx, x, y, w, h, r) {
    var rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function drawBrandedShareQr(element, text, downloadLink, filename, opts) {
    opts = Object.assign({ size: 168, avatar: 40, roundLogo: true }, opts || {});
    drawQr(element, text, downloadLink, filename || "attendify-scanner-link.png", ATTENDIFY_BRAND_LOGO, opts);
  }

  var ATTENDANCE_CARD_QR_RENDER = 148;
  var ATTENDANCE_CARD_QR_PX = 142;
  var ATTENDANCE_CARD_QR_PX_MOBILE = 132;
  /** Downloaded PNG QR block (compact; same proportions as preview). */
  var ATTENDANCE_CARD_EXPORT_QR_PX = 142;
  var ATTENDANCE_CARD_AVATAR = 36;
  var ATTENDANCE_CARD_EXPORT_SCALE = 1;

  function attendanceCardDisplayPx(opts) {
    opts = opts || {};
    if (opts.displaySize != null && opts.displaySize !== "") return Number(opts.displaySize) || ATTENDANCE_CARD_QR_PX;
    if (opts.size != null && opts.size !== "" && !opts.attendanceCard) return Number(opts.size) || ATTENDANCE_CARD_QR_PX;
    try {
      if (global.matchMedia && global.matchMedia("(max-width: 480px)").matches) {
        return ATTENDANCE_CARD_QR_PX_MOBILE;
      }
    } catch (e) {}
    return ATTENDANCE_CARD_QR_PX;
  }

  function applyQrWrapDisplaySize(holder, displayPx, avatarPx, renderPx) {
    if (!holder) return;
    var px = Number(displayPx) || ATTENDANCE_CARD_QR_PX;
    holder.style.width = px + "px";
    holder.style.maxWidth = "100%";
    holder.style.height = "auto";
    holder.setAttribute("data-qr-display", String(px));
    if (avatarPx != null && renderPx != null && Number(renderPx) > 0) {
      var scaledAv = Math.max(28, Math.round((Number(avatarPx) * px) / Number(renderPx)));
      holder.style.setProperty("--qr-avatar-px", scaledAv + "px");
    }
  }

  function buildAttendanceCardPng(qrCanvas, opts) {
    if (!qrCanvas) return null;
    opts = opts || {};
    var qrPx =
      opts.exportQrPx != null
        ? Math.round(Number(opts.exportQrPx))
        : opts.exportScale != null && Number(opts.exportScale) > 1
          ? Math.round(qrCanvas.width * Number(opts.exportScale))
          : ATTENDANCE_CARD_EXPORT_QR_PX;
    var pad = 6;
    var gap = 3;
    var name = String(opts.studentName || "").trim();
    var index = String(opts.studentIndex || "").trim();
    var nameH = name ? 13 : 0;
    var indexH = index ? 11 : 0;
    var headerH = (name ? nameH + gap : 0) + (index ? indexH + gap : 0);
    var w = qrPx + pad * 2;
    var footer = 7;
    var h = pad + headerH + qrPx + pad + footer;
    var card = document.createElement("canvas");
    card.width = w;
    card.height = h;
    var ctx = card.getContext("2d");
    if (!ctx) return qrCanvas;
    roundRectPath(ctx, 0, 0, w, h, 8);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    roundRectPath(ctx, 0.5, 0.5, w - 1, h - 1, 8);
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    if (headerH > 0) {
      roundRectPath(ctx, 1, 1, w - 2, Math.max(20, headerH + pad), 7);
      ctx.fill();
    }
    var y = pad;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    if (name) {
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 10px system-ui,sans-serif";
      ctx.fillText(name.length > 26 ? name.slice(0, 24) + "…" : name, w / 2, y + 10);
      y += nameH + gap;
    }
    if (index) {
      ctx.fillStyle = "#64748b";
      ctx.font = "600 9px ui-monospace,monospace";
      ctx.fillText(index, w / 2, y + 9);
      y += indexH + gap;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrCanvas, 0, 0, qrCanvas.width, qrCanvas.height, pad, y, qrPx, qrPx);
    ctx.fillStyle = "#0d9488";
    ctx.font = "800 7px system-ui,sans-serif";
    ctx.fillText("Attendify", w / 2, h - 4);
    return card;
  }

  function mountAttendanceCardShell(element, holder, opts, downloadLink) {
    var card = document.createElement("div");
    card.className = "attendify-qr-card";
    if (!opts.hideCardMeta && (opts.studentName || opts.studentIndex)) {
      var meta = document.createElement("div");
      meta.className = "attendify-qr-card__meta";
      if (opts.studentName) {
        var nameEl = document.createElement("p");
        nameEl.className = "attendify-qr-card__name";
        nameEl.textContent = opts.studentName;
        meta.appendChild(nameEl);
      }
      if (opts.studentIndex) {
        var idxEl = document.createElement("p");
        idxEl.className = "attendify-qr-card__index";
        idxEl.textContent = opts.studentIndex;
        meta.appendChild(idxEl);
      }
      card.appendChild(meta);
    }
    var qrSlot = document.createElement("div");
    qrSlot.className = "attendify-qr-card__qr";
    qrSlot.appendChild(holder);
    card.appendChild(qrSlot);
    if (downloadLink) {
      downloadLink.classList.add("attendify-qr-card__download");
      if (!downloadLink.getAttribute("href")) downloadLink.setAttribute("href", "#");
      card.appendChild(downloadLink);
    }
    element.innerHTML = "";
    element.appendChild(card);
  }

  function drawQr(element, text, downloadLink, filename, photoUrl, opts) {
    if (!element) return;
    opts = opts || {};
    var attendanceCard = !!opts.attendanceCard;
    var displaySize = attendanceCard ? attendanceCardDisplayPx(opts) : Number(opts.size) || 224;
    var size = attendanceCard
      ? Number(opts.renderSize) || ATTENDANCE_CARD_QR_RENDER
      : Number(opts.size) || 224;
    if (!attendanceCard && opts.size) size = Number(opts.size) || size;
    var avatar =
      opts.avatar != null ? opts.avatar : attendanceCard ? ATTENDANCE_CARD_AVATAR : 50;
    var roundLogo = !!opts.roundLogo;
    var rawPhotoIn = String(photoUrl || "").trim();
    var plainAttendanceQr =
      attendanceCard && (opts.qrCenterPhoto === false || !rawPhotoIn);
    var rawPhoto = plainAttendanceQr ? "" : rawPhotoIn;
    if (rawPhoto.indexOf("cdn.ucc.edu.gh") !== -1) {
      var tagMatch = rawPhoto.match(/[?&]tag=([^&]+)/i);
      var tag = tagMatch ? decodeURIComponent(tagMatch[1]) : "";
      if (tag) rawPhoto = uccPhotoPageUrl(tag);
    }
    photoUrl = rawPhoto;

    var cardParent = element.closest && element.closest(".attendify-qr-card");
    var useCardShell = attendanceCard && !cardParent;

    element.innerHTML = "";
    element.classList.add("attendify-qr-host");

    var correctLevel =
      photoUrl || attendanceCard || plainAttendanceQr
        ? QRCode.CorrectLevel.H
        : QRCode.CorrectLevel.M;

    new QRCode(element, {
      text: text,
      width: size,
      height: size,
      correctLevel: correctLevel
    });

    function setDownloadFromCanvas(canvas) {
      if (!downloadLink || !canvas) return;
      try {
        var exportCanvas = attendanceCard ? buildAttendanceCardPng(canvas, opts) : canvas;
        if (!exportCanvas) exportCanvas = canvas;
        downloadLink.href = exportCanvas.toDataURL("image/png");
        downloadLink.download = filename;
      } catch (e) {
        /* canvas may be tainted if CDN blocks CORS */
      }
    }

    function paintAvatarOn(ctx, centerX, centerY) {
      if (!photoUrl) return Promise.resolve(false);
      return new Promise(function (resolve) {
        var face = new Image();
        if (photoUrl.indexOf("data:") !== 0) face.crossOrigin = "anonymous";
        face.onload = function () {
          var pad = 5;
          var half = avatar / 2;
          var x = centerX - half;
          var y = centerY - half;
          ctx.fillStyle = "#ffffff";
          if (roundLogo) {
            roundRectPath(ctx, x - pad, y - pad, avatar + pad * 2, avatar + pad * 2, avatar * 0.24 + pad);
            ctx.fill();
            ctx.save();
            roundRectPath(ctx, x, y, avatar, avatar, avatar * 0.24);
            ctx.clip();
            ctx.drawImage(face, x, y, avatar, avatar);
            ctx.restore();
          } else {
            var r = half;
            ctx.beginPath();
            ctx.arc(centerX, centerY, r + pad, 0, Math.PI * 2);
            ctx.fill();
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(face, centerX - r, centerY - r, avatar, avatar);
            ctx.restore();
          }
          resolve(true);
        };
        face.onerror = function () {
          resolve(false);
        };
        face.src = photoUrl;
      });
    }

    function addCenterOverlay(holder) {
      if (!photoUrl || !holder) return;
      var overlay = document.createElement("img");
      overlay.src = photoUrl;
      overlay.alt = "";
      overlay.className = "attendify-qr-avatar";
      overlay.referrerPolicy = "no-referrer";
      holder.appendChild(overlay);
    }

    function renderComposite(sourceCanvas) {
      var composite = document.createElement("canvas");
      composite.width = size;
      composite.height = size;
      composite.className = "attendify-qr-canvas";
      var ctx = composite.getContext("2d");
      ctx.drawImage(sourceCanvas, 0, 0, size, size);
      paintAvatarOn(ctx, size / 2, size / 2).then(function (painted) {
        var holder = document.createElement("div");
        holder.className = "attendify-qr-wrap attendify-qr-wrap--photo";
        applyQrWrapDisplaySize(
          holder,
          attendanceCard ? displaySize : size,
          avatar,
          size
        );
        holder.appendChild(composite);
        if (!painted) addCenterOverlay(holder);
        if (useCardShell) {
          mountAttendanceCardShell(element, holder, opts, downloadLink);
        } else if (cardParent && downloadLink) {
          element.innerHTML = "";
          element.appendChild(holder);
          if (!cardParent.contains(downloadLink)) cardParent.appendChild(downloadLink);
        } else {
          element.innerHTML = "";
          element.appendChild(holder);
        }
        if (painted) {
          setDownloadFromCanvas(composite);
        } else if (attendanceCard && photoUrl) {
          var exportCopy = document.createElement("canvas");
          exportCopy.width = size;
          exportCopy.height = size;
          var exCtx = exportCopy.getContext("2d");
          exCtx.drawImage(sourceCanvas, 0, 0, size, size);
          paintAvatarOn(exCtx, size / 2, size / 2).then(function (drew) {
            setDownloadFromCanvas(drew ? exportCopy : sourceCanvas);
          });
        } else {
          setDownloadFromCanvas(painted ? composite : sourceCanvas);
        }
      });
    }

    function finishQrRender(canvas, img) {
      if (canvas) {
        if (photoUrl) renderComposite(canvas);
        else {
          if (attendanceCard && useCardShell) {
            var holderPlain = document.createElement("div");
            holderPlain.className = "attendify-qr-wrap";
            applyQrWrapDisplaySize(holderPlain, displaySize, avatar, size);
            canvas.className = "attendify-qr-canvas";
            holderPlain.appendChild(canvas);
            mountAttendanceCardShell(element, holderPlain, opts, downloadLink);
          } else if (cardParent) {
            element.innerHTML = "";
            var wrap = document.createElement("div");
            wrap.className = "attendify-qr-wrap";
            applyQrWrapDisplaySize(wrap, attendanceCard ? displaySize : size, avatar, size);
            wrap.appendChild(canvas);
            element.appendChild(wrap);
          }
          setDownloadFromCanvas(canvas);
        }
        return;
      }
      if (img && photoUrl) {
        var scratch = document.createElement("canvas");
        scratch.width = size;
        scratch.height = size;
        var ctx = scratch.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        renderComposite(scratch);
        return;
      }
      if (img && downloadLink) {
        downloadLink.href = img.src;
        downloadLink.download = filename;
      }
    }

    function waitForQrNode(tries) {
      var canvas = element.querySelector("canvas");
      var img = element.querySelector("img");
      if (canvas || img || tries >= 30) {
        finishQrRender(canvas, img);
        return;
      }
      setTimeout(function () {
        waitForQrNode(tries + 1);
      }, tries < 5 ? 40 : 100);
    }

    waitForQrNode(0);
  }

  function formatTime(iso) {
    if (!iso) return "…";
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
    } catch (_) {
      return String(iso);
    }
  }

  function semesterInfo() {
    var state = load();
    return state.semester || { totalWeeks: 16, currentWeek: 1 };
  }

  function dashboardStats() {
    var state = load();
    var attendanceTaken = 0;
    var sessionDays = 0;
    var seen = {};
    Object.keys(state.sessions || {}).forEach(function (key) {
      var session = state.sessions[key];
      if (!session || !session.courseId) return;
      var sid = session.sessionId || key;
      if (seen[sid]) return;
      seen[sid] = true;
      sessionDays += 1;
      attendanceTaken += (session.records || []).length;
    });
    return {
      totalStudents: state.students.length,
      totalClasses: state.classes.length,
      semesterWeeks: semesterInfo().totalWeeks,
      currentWeek: semesterInfo().currentWeek,
      attendanceTaken: attendanceTaken,
      sessionDays: sessionDays
    };
  }

  function courseStats(classId, courseId) {
    var state = load();
    var semesterWeeks = semesterInfo().totalWeeks || 15;
    var sessionDays = 0;
    var attendanceRecords = 0;
    var weeks = {};
    var seen = {};
    var needleClass = String(classId || "");
    var needleCourse = String(courseId || "");
    Object.keys(state.sessions || {}).forEach(function (key) {
      var session = state.sessions[key];
      if (!session || String(session.courseId || "") !== needleCourse) return;
      var belongs =
        String(session.classId || "") === needleClass || key.indexOf(needleClass + ":") === 0;
      if (!belongs) return;
      var sid = session.sessionId || key;
      if (seen[sid]) return;
      seen[sid] = true;
      sessionDays += 1;
      attendanceRecords += (session.records || []).length;
      var w = Number(session.weekNumber);
      if (w > 0) weeks[w] = true;
    });
    return {
      sessionDays: sessionDays,
      attendanceRecords: attendanceRecords,
      weeksWithAttendance: Object.keys(weeks).length,
      semesterWeeks: semesterWeeks
    };
  }

  function attendanceSessionById(classId, sessionId) {
    var sessions = programmeAttendanceSessions(classId);
    var sid = String(sessionId || "");
    for (var i = 0; i < sessions.length; i++) {
      if (String(sessions[i].sessionId) === sid) return sessions[i];
    }
    return null;
  }

  function programmeAttendanceSessions(classId) {
    var state = load();
    var byId = {};
    Object.keys(state.sessions || {}).forEach(function (key) {
      if (key.indexOf(classId + ":") !== 0) return;
      var session = state.sessions[key];
      if (!session || !session.sessionId) return;
      if (byId[session.sessionId]) return;
      var name = (session.lectureName || "").trim();
      if (!name) return;
      byId[session.sessionId] = {
        sessionId: session.sessionId,
        lectureName: session.lectureName || "General",
        date: session.date,
        weekNumber: session.weekNumber,
        presentCount: (session.records || []).length,
        records: session.records || []
      };
    });
    return Object.keys(byId)
      .map(function (id) {
        return byId[id];
      })
      .sort(function (a, b) {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return String(a.lectureName).localeCompare(String(b.lectureName));
      });
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return "";
    var parts = String(dateStr).split("-");
    if (parts.length !== 3) return dateStr;
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var m = parseInt(parts[1], 10);
    return months[m - 1] + " " + parseInt(parts[2], 10) + ", " + parts[0];
  }

  function classStats(classId, level) {
    var state = load();
    var students = studentsFor(classId, level);
    var selfRegistered = students.filter(function (student) { return student.source === "link"; }).length;
    var sessionDays = 0;
    var attendanceRecords = 0;
    var seenSessionIds = {};
    Object.keys(state.sessions || {}).forEach(function (key) {
      if (key.indexOf(classId + ":") !== 0) return;
      var session = state.sessions[key];
      if (session.sessionId && seenSessionIds[session.sessionId]) return;
      if (session.sessionId) seenSessionIds[session.sessionId] = true;
      sessionDays += 1;
      attendanceRecords += (session.records || []).length;
    });
    var enrolled = students.length;
    var todayPresent = 0;
    Object.keys(state.sessions || {}).forEach(function (key) {
      if (key.indexOf(classId + ":" + today()) !== 0) return;
      todayPresent += (state.sessions[key].records || []).length;
    });
    var turnoutToday = enrolled ? Math.round((todayPresent / enrolled) * 1000) / 10 : null;
    return {
      enrolled: enrolled,
      selfRegistered: selfRegistered,
      sessionDays: sessionDays,
      attendanceRecords: attendanceRecords,
      turnoutToday: turnoutToday
    };
  }

  function requestedClassId() {
    var params = new URLSearchParams(window.location.search);
    var requested = params.get("programme") || params.get("class");
    if (!requested) {
      var joinMatch = String(window.location.pathname || "").match(/\/join\/([^/]+)\/?$/i);
      if (joinMatch) {
        try {
          requested = decodeURIComponent(joinMatch[1]);
        } catch (_) {
          requested = joinMatch[1];
        }
      }
    }
    var state = load();
    if (requested && state.classes.some(function (item) { return item.id === requested; })) return requested;
    if (requested) return requested;
    return state.activeClassId || (state.classes[0] && state.classes[0].id) || "";
  }

  function classIdFromCode(code) {
    var id = String(code || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return id || "c" + Date.now();
  }

  function saveState(state) {
    return apiFetch("/api/state", {
      method: "PUT",
      body: state
    }).then(function (response) { return response.json(); }).then(function (result) {
      if (result.state) applyState(result.state);
      else if (result.ok) applyState(state);
      return result;
    }).catch(function () {
      return { ok: false, error: "Could not save. Check that the server is running." };
    });
  }

  function updateProgramme(id, code, name) {
    id = String(id || "").trim();
    code = String(code || "").trim();
    name = String(name || "").trim();
    if (!id) return Promise.resolve({ ok: false, error: "Programme not found." });
    return apiFetch("/api/classes/" + encodeURIComponent(id), {
      method: "PATCH",
      body: { id: id, code: code, name: name }
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.state) applyState(result.state);
        return result;
      })
      .catch(function () {
        return { ok: false, error: connectionHint() };
      });
  }

  function deleteProgramme(id) {
    id = String(id || "").trim();
    if (!id) return Promise.resolve({ ok: false, error: "Programme not found." });
    return apiFetch("/api/classes/" + encodeURIComponent(id), { method: "DELETE" })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.state) applyState(result.state);
        return result;
      })
      .catch(function () {
        return { ok: false, error: connectionHint() };
      });
  }

  function addProgrammeCourse(classId, code, name) {
    classId = String(classId || "").trim();
    code = String(code || "").trim();
    name = String(name || "").trim();
    if (!classId) return Promise.resolve({ ok: false, error: "Programme not found." });
    return apiFetch("/api/classes/" + encodeURIComponent(classId) + "/courses", {
      method: "POST",
      body: withLecturer({ classId: classId, code: code, name: name })
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.state) applyState(result.state);
        return result;
      })
      .catch(function () {
        return { ok: false, error: connectionHint() };
      });
  }

  function updateProgrammeCourse(courseId, code, name) {
    courseId = String(courseId || "").trim();
    code = String(code || "").trim();
    name = String(name || "").trim();
    if (!courseId) return Promise.resolve({ ok: false, error: "Course not found." });
    return apiFetch("/api/courses/" + encodeURIComponent(courseId), {
      method: "PATCH",
      body: withLecturer({ courseId: courseId, code: code, name: name })
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.state) applyState(result.state);
        return result;
      })
      .catch(function () {
        return { ok: false, error: connectionHint() };
      });
  }

  function deleteProgrammeCourse(courseId) {
    courseId = String(courseId || "").trim();
    if (!courseId) return Promise.resolve({ ok: false, error: "Course not found." });
    return apiFetch("/api/courses/" + encodeURIComponent(courseId), {
      method: "DELETE",
      body: withLecturer({ courseId: courseId })
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.state) applyState(result.state);
        return result;
      })
      .catch(function () {
        return { ok: false, error: connectionHint() };
      });
  }

  function addClass(code, name) {
    code = String(code || "").trim();
    name = String(name || "").trim();
    if (!code || !name) return Promise.resolve({ ok: false, error: "Enter programme code and name." });
    return apiFetch("/api/classes", {
      method: "POST",
      body: withLecturer({ code: code, name: name })
    }).then(function (response) {
      return response.json().then(function (result) {
        if (!response.ok && result && result.error) return { ok: false, error: result.error };
        return result;
      });
    }).then(function (result) {
      if (result.state) applyState(result.state);
      if (result.ok) return { ok: true, classId: result.classId, state: load() };
      return { ok: false, error: result.error || "Could not create the programme." };
    }).catch(function () {
      return { ok: false, error: connectionHint() };
    });
  }

  var SESSION_KEY = "attendify-session";

  function saveSession(session) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (_) {}
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }

  function getSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function loginRedirectUrl() {
    var page =
      (window.location.pathname.split("/").pop() || "dashboard.html") + (window.location.search || "");
    return "login.html?next=" + encodeURIComponent(page);
  }

  function requireLecturerSession() {
    var session = getSession();
    if (session && session.lecturer && session.token) return session;
    if (global.navigator && global.navigator.onLine === false) return session || null;
    if (!session || !session.lecturer || !session.token) {
      clearSession();
      window.location.replace(loginRedirectUrl());
      return null;
    }
    return session;
  }

  function validateSession(options) {
    options = options || {};
    var local = getSession();
    if (global.navigator && global.navigator.onLine === false && local && local.token) {
      return Promise.resolve({
        ok: true,
        offline: true,
        lecturer: local.lecturer,
        token: local.token
      });
    }
    return fetchWithTimeout(
      apiUrl("/api/auth/me"),
      {
        method: "GET",
        headers: authHeaders(),
        credentials: "same-origin"
      },
      options.timeoutMs || API_TIMEOUT_MS
    )
      .then(function (response) {
        return response.json().then(function (body) {
          return { status: response.status, body: body };
        });
      })
      .then(function (pack) {
        if (!pack.body || !pack.body.ok) {
          if (pack.status === 401) markNetworkDegraded(true);
          if (local && local.token && local.lecturer) {
            return {
              ok: true,
              offline: true,
              stale: pack.status === 401,
              lecturer: local.lecturer,
              token: local.token
            };
          }
          return {
            ok: false,
            code: pack.status === 401 ? "AUTH_REQUIRED" : "AUTH_CHECK_FAILED",
            error: (pack.body && pack.body.error) || "Please sign in."
          };
        }
        markNetworkDegraded(false);
        var session = local || {};
        session.lecturer = pack.body.lecturer || session.lecturer;
        if (pack.body.programmeIds) session.programmeIds = pack.body.programmeIds;
        if (pack.body.expiresAt) session.expiresAt = pack.body.expiresAt;
        if (pack.body.token) session.token = pack.body.token;
        session.loggedInAt = session.loggedInAt || new Date().toISOString();
        saveSession(session);
        if (pack.body.lecturer && pack.body.lecturer.photo) {
          delete avatarPhotoCache[String(pack.body.lecturer.photo)];
        }
        return pack.body;
      })
      .catch(function () {
        markNetworkDegraded(true);
        if (local && local.token && local.lecturer) {
          return { ok: true, offline: true, lecturer: local.lecturer, token: local.token };
        }
        return { ok: false, error: connectionHint(), code: "NETWORK" };
      });
  }

  function listUccProgrammes() {
    return fetch(apiUrl("/api/ucc-programmes"), { credentials: "same-origin" })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        return result && result.programmes ? result.programmes : [];
      })
      .catch(function () {
        return [];
      });
  }

  function previewUccProgrammeRoster(uccProgrammeId, level) {
    var qs =
      "?uccProgrammeId=" +
      encodeURIComponent(String(uccProgrammeId || "")) +
      "&level=" +
      encodeURIComponent(String(level || ""));
    return fetch(apiUrl("/api/ucc-programmes/roster-preview" + qs), { credentials: "same-origin" })
      .then(function (response) {
        return response.json();
      })
      .catch(function () {
        return { ok: false, error: connectionHint() };
      });
  }

  function persistAuthSession(result) {
    if (!result || !result.ok || !result.lecturer || !result.token) return;
    saveSession({
      lecturer: result.lecturer,
      token: result.token,
      expiresAt: result.expiresAt || null,
      classId: result.classId || "",
      programmeIds: result.programmeIds || (result.classId ? [result.classId] : []),
      createCourse: !!result.createCourse,
      loggedInAt: new Date().toISOString()
    });
  }

  function signupLecturer(payload) {
    payload = payload || {};
    var body = Object.assign({}, payload);
    if (body.username != null) {
      body.username = String(body.username)
        .normalize("NFKC")
        .trim()
        .toLowerCase();
    }
    if (body.password != null) body.password = String(body.password).trim();
    return fetch(authApiUrl("/api/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin"
    })
      .then(function (response) {
        return parseJsonResponse(response);
      })
      .then(function (result) {
        if (result.state) applyState(result.state);
        persistAuthSession(result);
        return result;
      })
      .catch(function () {
        return { ok: false, error: connectionHint() };
      });
  }

  function loginLecturer(payload) {
    payload = payload || {};
    var body = {
      username: String(payload.username || "")
        .normalize("NFKC")
        .trim()
        .toLowerCase(),
      password: String(payload.password || "").trim()
    };
    if (payload.programmeId) body.programmeId = payload.programmeId;
    return fetch(authApiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin"
    })
      .then(function (response) {
        return parseJsonResponse(response);
      })
      .then(function (result) {
        if (result.state) applyState(result.state);
        persistAuthSession(result);
        return result;
      })
      .catch(function () {
        return { ok: false, error: connectionHint() };
      });
  }

  function logoutLecturer() {
    var session = getSession();
    var token = session && session.token ? session.token : "";
    clearSession();
    function go() {
      var href = "login.html";
      if (
        window.AttendifyAuthEntry &&
        AttendifyAuthEntry.isMobileAuth &&
        AttendifyAuthEntry.isMobileAuth()
      ) {
        href = AttendifyAuthEntry.mobileSplashHref("");
      } else if (window.matchMedia("(max-width: 1023px)").matches) {
        href = "splash.html";
      }
      window.location.replace(href);
    }
    fetch(apiUrl("/api/auth/logout"), {
      method: "POST",
      headers: authHeaders({ "X-Attendify-Token": token }),
      credentials: "same-origin",
      body: "{}"
    })
      .then(go)
      .catch(go);
  }

  function mergeProgrammeSelection(baseList) {
    var list = baseList || [];
    if (!list.length) return list;
    var session = getSession() || {};
    var linked = {};
    (session.programmeIds || []).forEach(function (id) {
      linked[String(id)] = true;
    });
    var classes = load().classes || [];
    return list.map(function (item) {
      var pick = Object.assign({}, item);
      if (pick.selected != null && pick.classId) return pick;
      var cls = classes.filter(function (c) {
        return String(c.code || "").toLowerCase() === String(pick.code || "").toLowerCase();
      })[0];
      var classId = pick.classId || (cls ? cls.id : "");
      pick.classId = classId;
      if (pick.selected == null) pick.selected = classId ? !!linked[classId] : false;
      if (pick.studentCount == null) pick.studentCount = 0;
      if (pick.sharedRoster == null) pick.sharedRoster = false;
      return pick;
    });
  }

  function fetchLecturerProgrammeCatalogue() {
    return apiFetch("/api/auth/programmes")
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result && result.ok) {
          return {
            programmes: result.programmes || [],
            assignments: result.assignments || []
          };
        }
        return listUccProgrammes().then(function (base) {
          return { programmes: mergeProgrammeSelection(base), assignments: [] };
        });
      })
      .catch(function () {
        return listUccProgrammes().then(function (base) {
          return { programmes: mergeProgrammeSelection(base), assignments: [] };
        });
      });
  }

  function addLecturerProgramme(assignment) {
    return apiFetch("/api/auth/programmes/add", {
      method: "POST",
      body: assignment || {}
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.ok && result.state) {
          applyState(result.state);
          var session = getSession() || {};
          if (result.programmeIds) session.programmeIds = result.programmeIds;
          saveSession(session);
        }
        return result;
      })
      .catch(function () {
        return { ok: false, error: connectionHint() };
      });
  }

  function updateLecturerProfile(payload) {
    return apiFetch("/api/auth/profile", {
      method: "PATCH",
      body: payload || {}
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.ok && result.lecturer) {
          var session = getSession() || {};
          var prevPhoto = session.lecturer && session.lecturer.photo ? String(session.lecturer.photo) : "";
          session.lecturer = result.lecturer;
          if (result.programmeIds) session.programmeIds = result.programmeIds;
          if (result.state) applyState(result.state);
          saveSession(session);
          if (prevPhoto && prevPhoto !== String(result.lecturer.photo || "")) {
            delete avatarPhotoCache[prevPhoto];
          }
          if (result.lecturer.photo) delete avatarPhotoCache[String(result.lecturer.photo)];
          paintLecturerChrome(result.lecturer, { sidebar: true, header: true });
        }
        return result;
      })
      .catch(function () {
        return { ok: false, error: connectionHint() };
      });
  }

  global.Attendify = {
    load: load,
    ready: ready,
    syncFromServer: syncFromServer,
    softReconnect: softReconnect,
    isNetworkDegraded: isNetworkDegraded,
    pendingScanCount: pendingScanCount,
    connectionHint: connectionHint,
    classById: classById,
    studentsFor: studentsFor,
    findStudent: findStudent,
    resolveStudentIndexSuffix: resolveStudentIndexSuffix,
    saveLiveScanSession: saveLiveScanSession,
    getLiveScanSession: getLiveScanSession,
    clearLiveScanSession: clearLiveScanSession,
    isLiveScanSessionStillOpen: isLiveScanSessionStillOpen,
    addStudent: addStudent,
    deleteStudent: deleteStudent,
    qrText: qrText,
    parseQr: parseQr,
    startAttendanceSession: startAttendanceSession,
    closeAttendanceSession: closeAttendanceSession,
    isCourseWeekSessionClosed: isCourseWeekSessionClosed,
    markPresent: markPresent,
    removeAttendance: removeAttendance,
    setActiveLectureName: setActiveLectureName,
    getActiveLectureName: getActiveLectureName,
    setActiveWeekNumber: setActiveWeekNumber,
    getActiveWeekNumber: getActiveWeekNumber,
    setActiveCourseId: setActiveCourseId,
    getActiveCourseId: getActiveCourseId,
    courseLectureLabel: courseLectureLabel,
    normalizeSessionKind: normalizeSessionKind,
    sessionKindFromLectureName: sessionKindFromLectureName,
    courseLectureNameForKind: courseLectureNameForKind,
    parseReportWeekFilter: parseReportWeekFilter,
    reportWeekFilterLabel: reportWeekFilterLabel,
    coursesForProgramme: coursesForProgramme,
    courseById: courseById,
    findSessionForCourseWeek: findSessionForCourseWeek,
    addProgrammeCourse: addProgrammeCourse,
    updateProgrammeCourse: updateProgrammeCourse,
    deleteProgrammeCourse: deleteProgrammeCourse,
    attendanceRows: attendanceRows,
    mergeStudentIntoCache: mergeStudentIntoCache,
    enrollUrl: enrollUrl,
    enrollShareSummary: enrollShareSummary,
    fetchEnrollContext: fetchEnrollContext,
    fetchEnrollStudent: fetchEnrollStudent,
    refreshShareOrigin: refreshShareOrigin,
    publicShareOrigin: publicShareOrigin,
    scanShareUrl: scanShareUrl,
    displayShareUrl: displayShareUrl,
    createTaShareLink: createTaShareLink,
    updateLecturerProfile: updateLecturerProfile,
    fetchLecturerProgrammeCatalogue: fetchLecturerProgrammeCatalogue,
    addLecturerProgramme: addLecturerProgramme,
    activeSessionFor: activeSessionFor,
    photoFromFile: photoFromFile,
    uccPhotoUrl: uccPhotoUrl,
    uccPhotoPageUrl: uccPhotoPageUrl,
    studentPhotoUrl: studentPhotoUrl,
    qrCompositePhotoUrl: qrCompositePhotoUrl,
    resolveUccPhoto: resolveUccPhoto,
    bindUccPhotoPreview: bindUccPhotoPreview,
    avatarMarkup: avatarMarkup,
    hydrateAvatars: hydrateAvatars,
    onAvatarError: onAvatarError,
    paintLecturerChrome: paintLecturerChrome,
    lecturerAvatarPerson: lecturerAvatarPerson,
    initials: initials,
    downloadCsv: downloadCsv,
    printAttendanceReport: printAttendanceReport,
    formatTime: formatTime,
    formatStudentLevel: formatStudentLevel,
    drawQr: drawQr,
    drawBrandedShareQr: drawBrandedShareQr,
    brandLogoUrl: ATTENDIFY_BRAND_LOGO,
    requestedClassId: requestedClassId,
    today: today,
    dashboardStats: dashboardStats,
    classStats: classStats,
    courseStats: courseStats,
    semesterInfo: semesterInfo,
    addClass: addClass,
    listUccProgrammes: listUccProgrammes,
    previewUccProgrammeRoster: previewUccProgrammeRoster,
    signupLecturer: signupLecturer,
    loginLecturer: loginLecturer,
    logoutLecturer: logoutLecturer,
    getSession: getSession,
    currentLecturerId: currentLecturerId,
    requireLecturerSession: requireLecturerSession,
    validateSession: validateSession,
    saveSession: saveSession,
    clearSession: clearSession,
    updateProgramme: updateProgramme,
    deleteProgramme: deleteProgramme,
    programmeAttendanceSessions: programmeAttendanceSessions,
    attendanceSessionById: attendanceSessionById,
    formatShortDate: formatShortDate
  };
})(window);
