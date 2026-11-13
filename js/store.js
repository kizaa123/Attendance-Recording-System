(function (global) {
  var KEY = "attendify-v1";
  var cache = null;
  var shareOrigin = "";
  var DEFAULT_PORT = "3000";
  var API_BASE = "http://localhost:" + DEFAULT_PORT;

  function apiUrl(path) {
    if (window.location.protocol === "file:") return API_BASE + path;
    var host = window.location.hostname;
    var port = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
    if ((host === "localhost" || host === "127.0.0.1") && (!port || port === DEFAULT_PORT)) return path;
    return API_BASE + path;
  }

  function connectionHint() {
    if (window.location.protocol === "file:") {
      return "Start the server (npm start), then open " + API_BASE + "/ — do not open HTML files directly.";
    }
    if (window.location.port && window.location.port !== DEFAULT_PORT) {
      return "Use " + API_BASE + "/ with the server running (not Live Server on another port).";
    }
    return "Start the server: npm start or npm run serve:bg";
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
      activeClassId: "cs101",
      classes: [
        { id: "cs101", code: "CS 101", name: "Introduction to Computer Science" },
        { id: "cs210", code: "CS 210", name: "Data Structures & Algorithms" }
      ],
      students: seedStudents(),
      sessions: {},
      courses: [],
      semester: { totalWeeks: 15, currentWeek: 8 }
    };
  }

  cache = defaultState();

  function load() {
    return cache;
  }

  function applyState(state) {
    if (state && state.classes && state.students && state.sessions) {
      if (!state.courses) state.courses = [];
      cache = state;
    }
  }

  function ready() {
    return fetch(apiUrl("/api/host")).then(function (response) { return response.json(); }).then(function (host) {
      if (host && host.origin) shareOrigin = host.origin;
      return fetch(apiUrl("/api/state"));
    }).then(function (response) { return response.json(); }).then(function (state) {
      var local = null;
      try { local = JSON.parse(localStorage.getItem(KEY)); } catch (error) { local = null; }
      if (local && local.students && state.students && local.students.length > state.students.length && !sessionStorage.getItem("attendify-migrated")) {
        return fetch(apiUrl("/api/state"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(local)
        }).then(function (response) { return response.json(); }).then(function (saved) {
          sessionStorage.setItem("attendify-migrated", "1");
          applyState(saved.state || local);
          return cache;
        });
      }
      applyState(state);
      return cache;
    }).catch(function () {
      if (!shareOrigin) shareOrigin = window.location.origin;
      return cache;
    });
  }

  function classById(id) {
    var state = load();
    var found = state.classes.filter(function (item) { return item.id === id; })[0];
    return found || state.classes[0];
  }

  function studentsFor(classId) {
    return load().students.filter(function (student) { return student.classId === classId; });
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
    return String(course.code || "").trim() + " — " + String(course.name || "").trim();
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

  function sessionsForCourseWeek(classId, course, weekNumber) {
    if (!course) return [];
    var label = courseLectureLabel(course).toLowerCase();
    var week = Number(weekNumber) || 1;
    var state = load();
    var matches = [];
    Object.keys(state.sessions || {}).forEach(function (key) {
      if (key.indexOf(classId + ":") !== 0) return;
      var session = state.sessions[key];
      if (!session || Number(session.weekNumber) !== week) return;
      if (session.courseId && session.courseId === course.id) {
        matches.push(session);
        return;
      }
      if (String(session.lectureName || "").trim().toLowerCase() === label) {
        matches.push(session);
      }
    });
    matches.sort(function (a, b) {
      var byDate = String(b.date || "").localeCompare(String(a.date || ""));
      if (byDate) return byDate;
      return (b.sessionId || 0) - (a.sessionId || 0);
    });
    return matches;
  }

  function findSessionForCourseWeek(classId, course, weekNumber) {
    var matches = sessionsForCourseWeek(classId, course, weekNumber);
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

  function ensureAvatarLoad(src, callback) {
    if (!src) {
      callback("error");
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
        settle(probe.naturalWidth > 8 && probe.naturalHeight > 8 ? "loaded" : "error");
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

  function printAttendanceReport(meta) {
    meta = meta || {};
    var rows = meta.rows || [];
    var bodyRows = rows
      .map(function (row) {
        return (
          "<tr><td>" +
          htmlText(row.name) +
          "</td><td>" +
          htmlText(row.index) +
          "</td><td>" +
          htmlText(row.status) +
          "</td><td>" +
          htmlText(row.time || "—") +
          "</td></tr>"
        );
      })
      .join("");
    var html =
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" +
      htmlText(meta.title || "Attendance") +
      "</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 16px;color:#475569;font-size:13px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left}th{background:#f8fafc;text-transform:uppercase;font-size:10px;letter-spacing:.04em}</style></head><body>" +
      "<h1>" +
      htmlText(meta.title || "Attendance") +
      "</h1>" +
      "<p>" +
      htmlText(meta.subtitle || "") +
      "</p>" +
      "<table><thead><tr><th>Student</th><th>Index</th><th>Status</th><th>Time</th></tr></thead><tbody>" +
      bodyRows +
      "</tbody></table></body></html>";
    var win = window.open("", "_blank");
    if (!win) {
      window.alert("Allow pop-ups to export PDF, then use Print → Save as PDF.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function () {
      win.print();
    }, 350);
  }

  function addStudent(input) {
    return fetch(apiUrl("/api/students"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }).then(function (response) { return response.json(); }).then(function (result) {
      if (result.state) applyState(result.state);
      return result;
    }).catch(function () {
      return { ok: false, error: "Could not save the student. Keep this page open through the attendance link." };
    });
  }

  function findStudent(classId, index) {
    var needle = String(index || "").trim().toLowerCase();
    return load().students.filter(function (student) {
      return student.classId === classId && student.index.toLowerCase() === needle;
    })[0] || null;
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
    var payload = { classId: classId };
    if (options.courseId) payload.courseId = options.courseId;
    else payload.lectureName = lectureName;
    if (options.weekNumber != null) payload.weekNumber = options.weekNumber;
    return fetch(apiUrl("/api/sessions/start"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
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
    var payload = { classId: classId };
    if (courseId) payload.courseId = courseId;
    else if (lectureName) payload.lectureName = lectureName;
    if (weekNumber != null) payload.weekNumber = weekNumber;
    return fetch(apiUrl("/api/sessions/close"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
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

  function isCourseWeekSessionClosed(classId, course, weekNumber) {
    var sessions = sessionsForCourseWeek(classId, course, weekNumber);
    var i;
    for (i = 0; i < sessions.length; i++) {
      if (sessions[i].closedAt) return true;
    }
    return false;
  }

  function removeAttendance(classId, studentId, lectureName, weekNumber, courseId) {
    var payload = { classId: classId, studentId: studentId };
    if (courseId) payload.courseId = courseId;
    else payload.lectureName = lectureName;
    if (weekNumber != null) payload.weekNumber = weekNumber;
    return fetch(apiUrl("/api/attendance/remove"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
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

  function markPresent(scannerClassId, index, qrToken, lectureName, weekNumber) {
    var payload = { classId: scannerClassId };
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
    return fetch(apiUrl("/api/attendance"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (response) { return response.json(); }).then(function (result) {
      if (result.state) applyState(result.state);
      return result;
    }).catch(function () {
      return { ok: false, error: "unknown" };
    });
  }

  function attendanceRows(classId, lectureName, weekNumber) {
    var state = load();
    var session = state.sessions[sessionKey(classId, lectureName, weekNumber)];
    if (!session) return [];
    return session.records.map(function (record) {
      var student = state.students.filter(function (item) { return item.id === record.studentId; })[0];
      if (!student) return null;
      return { student: student, scannedAt: record.scannedAt };
    }).filter(Boolean);
  }

  function enrollUrl(classId) {
    var origin = shareOrigin || window.location.origin;
    return origin.replace(/\/$/, "") + "/enroll.html?class=" + encodeURIComponent(classId);
  }

  function createTaShareLink(classId, sessionId) {
    return fetch(apiUrl("/api/host")).then(function (r) { return r.json(); }).catch(function () { return {}; })
      .then(function (host) {
        return fetch(apiUrl("/api/ta/create"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId: classId, sessionId: sessionId })
        }).then(function (r) { return r.json(); }).then(function (result) {
          if (!result.ok) return result;
          // Prefer HTTPS origin so phone camera works (requires HTTPS)
          var origin = (host && host.httpsOrigin) ? host.httpsOrigin
                     : (host && host.origin) ? host.origin
                     : shareOrigin || window.location.origin;
          // If still localhost, use window.location as fallback
          if (!origin || origin.indexOf("localhost") !== -1 || origin.indexOf("127.0.0.1") !== -1) {
            if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
              origin = window.location.origin;
            }
          }
          var url = origin.replace(/\/$/, "") + "/ta-scanner.html?token=" + encodeURIComponent(result.taToken);
          return { ok: true, taToken: result.taToken, url: url };
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
      if (previewEl) previewEl.classList.add("hidden");
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
        if (previewEl) previewEl.classList.remove("hidden");
        if (statusEl) statusEl.textContent = "Looking up UCC photo…";
        if (spinnerEl) spinnerEl.classList.remove("hidden");
        if (imgEl) imgEl.classList.add("hidden");
        resolveUccPhoto(index).then(function (result) {
          if (run !== token) return;
          if (spinnerEl) spinnerEl.classList.add("hidden");
          if (options.onChange) options.onChange(result);
          if (result.ok && imgEl) {
            imgEl.src = result.url;
            imgEl.classList.remove("hidden");
            if (statusEl) statusEl.textContent = "Official profile photo ready.";
          } else if (imgEl) {
            imgEl.removeAttribute("src");
            imgEl.classList.add("hidden");
            if (statusEl) {
              statusEl.textContent = "No UCC photo for this index — you can still register.";
            }
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
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function drawQr(element, text, downloadLink, filename, photoUrl) {
    if (!element) return;
    var size = 224;
    var avatar = 46;
    element.innerHTML = "";
    element.classList.add("relative", "inline-flex", "items-center", "justify-center");
    new QRCode(element, {
      text: text,
      width: size,
      height: size,
      correctLevel: photoUrl ? QRCode.CorrectLevel.H : QRCode.CorrectLevel.M
    });

    function setDownloadFromCanvas(canvas) {
      if (!downloadLink || !canvas) return;
      try {
        downloadLink.href = canvas.toDataURL("image/png");
        downloadLink.download = filename;
      } catch (e) {
        /* canvas may be tainted if CDN blocks CORS */
      }
    }

    function paintAvatarOn(ctx, centerX, centerY) {
      if (!photoUrl) return Promise.resolve(false);
      return new Promise(function (resolve) {
        var face = new Image();
        face.crossOrigin = "anonymous";
        face.onload = function () {
          var pad = 4;
          var r = avatar / 2;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(centerX, centerY, r + pad, 0, Math.PI * 2);
          ctx.fill();
          ctx.save();
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(face, centerX - r, centerY - r, avatar, avatar);
          ctx.restore();
          resolve(true);
        };
        face.onerror = function () {
          resolve(false);
        };
        face.src = photoUrl;
      });
    }

    function renderComposite(sourceCanvas) {
      var composite = document.createElement("canvas");
      composite.width = size;
      composite.height = size;
      var ctx = composite.getContext("2d");
      ctx.drawImage(sourceCanvas, 0, 0, size, size);
      paintAvatarOn(ctx, size / 2, size / 2).then(function (painted) {
        var holder = document.createElement("div");
        holder.className = "relative inline-block";
        holder.appendChild(composite);
        if (!painted && photoUrl) {
          var overlay = document.createElement("img");
          overlay.src = photoUrl;
          overlay.alt = "";
          overlay.className =
            "absolute left-1/2 top-1/2 w-11 h-11 -translate-x-1/2 -translate-y-1/2 rounded-full object-cover ring-2 ring-white shadow-sm pointer-events-none";
          overlay.referrerPolicy = "no-referrer";
          holder.appendChild(overlay);
        }
        element.innerHTML = "";
        element.appendChild(holder);
        setDownloadFromCanvas(painted ? composite : sourceCanvas);
      });
    }

    setTimeout(function () {
      var canvas = element.querySelector("canvas");
      var img = element.querySelector("img");
      if (canvas) {
        if (photoUrl) renderComposite(canvas);
        else setDownloadFromCanvas(canvas);
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
    }, 90);
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  }

  function semesterInfo() {
    var state = load();
    return state.semester || { totalWeeks: 16, currentWeek: 1 };
  }

  function dashboardStats() {
    var state = load();
    var attendanceTaken = 0;
    var sessionDays = 0;
    Object.keys(state.sessions || {}).forEach(function (key) {
      var session = state.sessions[key];
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

  function classStats(classId) {
    var state = load();
    var students = studentsFor(classId);
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
    var state = load();
    if (requested && state.classes.some(function (item) { return item.id === requested; })) return requested;
    return state.activeClassId || (state.classes[0] && state.classes[0].id) || "";
  }

  function classIdFromCode(code) {
    var id = String(code || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return id || "c" + Date.now();
  }

  function saveState(state) {
    return fetch(apiUrl("/api/state"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
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
    return fetch(apiUrl("/api/classes/" + encodeURIComponent(id)), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id, code: code, name: name })
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
    return fetch(apiUrl("/api/classes/" + encodeURIComponent(id)), { method: "DELETE" })
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
    return fetch(apiUrl("/api/classes/" + encodeURIComponent(classId) + "/courses"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: classId, code: code, name: name })
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
    return fetch(apiUrl("/api/classes"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code, name: name })
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

  global.Attendify = {
    load: load,
    ready: ready,
    classById: classById,
    studentsFor: studentsFor,
    findStudent: findStudent,
    addStudent: addStudent,
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
    coursesForProgramme: coursesForProgramme,
    courseById: courseById,
    findSessionForCourseWeek: findSessionForCourseWeek,
    addProgrammeCourse: addProgrammeCourse,
    attendanceRows: attendanceRows,
    enrollUrl: enrollUrl,
    createTaShareLink: createTaShareLink,
    activeSessionFor: activeSessionFor,
    photoFromFile: photoFromFile,
    uccPhotoUrl: uccPhotoUrl,
    studentPhotoUrl: studentPhotoUrl,
    resolveUccPhoto: resolveUccPhoto,
    bindUccPhotoPreview: bindUccPhotoPreview,
    avatarMarkup: avatarMarkup,
    hydrateAvatars: hydrateAvatars,
    onAvatarError: onAvatarError,
    initials: initials,
    downloadCsv: downloadCsv,
    printAttendanceReport: printAttendanceReport,
    formatTime: formatTime,
    drawQr: drawQr,
    requestedClassId: requestedClassId,
    today: today,
    dashboardStats: dashboardStats,
    classStats: classStats,
    semesterInfo: semesterInfo,
    addClass: addClass,
    updateProgramme: updateProgramme,
    deleteProgramme: deleteProgramme,
    programmeAttendanceSessions: programmeAttendanceSessions,
    attendanceSessionById: attendanceSessionById,
    formatShortDate: formatShortDate
  };
})(window);
