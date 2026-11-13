(function (global) {
  var lastVerifiedStudentId = "";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function avatarHtml(student, sizeClass, ringClass) {
    return global.Attendify.avatarMarkup(student, sizeClass || "w-12 h-12", ringClass || "ring-2 ring-white shadow");
  }

  function showVerified(student, scannedAt, duplicate) {
    var box = document.getElementById("scan-hud-verified");
    if (!box || !student) return;
    lastVerifiedStudentId = student.id;
    box.classList.remove("hidden");
    var time = global.Attendify.formatTime(scannedAt);
    var shell = duplicate
      ? "bg-amber-50 border border-amber-200"
      : "bg-teal-50 border border-teal-100";
    var badge = duplicate
      ? "text-amber-900 bg-amber-100"
      : "text-teal-800 bg-teal-100";
    var badgeLabel = duplicate ? "Duplicate scan" : "Verified";
    var titleHtml = duplicate
      ? '<p class="font-bold text-amber-950 mt-1 leading-snug">' + esc(student.name) + ", already marked present</p>"
      : '<p class="font-bold text-slate-900 mt-1 truncate">' + esc(student.name) + "</p>";
    var subtitle = duplicate
      ? '<p class="text-xs text-amber-800/90">First scan at <span class="font-mono">' + esc(time) + "</span></p>"
      : '<p class="text-xs text-slate-600">ID: <span class="font-mono">' +
        esc(student.index) +
        "</span> · Present</p>";

    box.innerHTML =
      '<div class="flex items-center gap-3 p-4 ' +
      shell +
      ' rounded-2xl shadow-sm">' +
      '<div class="relative shrink-0">' +
      avatarHtml(student) +
      (duplicate
        ? '<span class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">!</span>'
        : '<span class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">✓</span>') +
      "</div>" +
      '<div class="flex-1 min-w-0">' +
      '<div class="flex items-center gap-2 flex-wrap">' +
      '<span class="text-[10px] font-black uppercase tracking-wider ' +
      badge +
      ' px-2 py-0.5 rounded">' +
      badgeLabel +
      "</span>" +
      (!duplicate
        ? '<span class="text-[11px] text-slate-500 font-mono">' + esc(time) + "</span>"
        : "") +
      "</div>" +
      titleHtml +
      subtitle +
      "</div>" +
      '<button type="button" id="scan-hud-undo" class="text-xs font-bold text-teal-700 hover:text-teal-900 px-2 py-1 shrink-0">Undo</button></div>';
    global.Attendify.hydrateAvatars(box);
  }

  function hideVerified() {
    var box = document.getElementById("scan-hud-verified");
    if (box) {
      box.classList.add("hidden");
      box.innerHTML = "";
    }
    lastVerifiedStudentId = "";
  }

  function renderRecent(rows, onRemove) {
    var list = document.getElementById("scan-hud-recent-list");
    var subtitle = document.getElementById("scan-hud-recent-subtitle");
    if (!list) return;
    var count = rows ? rows.length : 0;
    if (subtitle) {
      subtitle.textContent = count ? count + (count === 1 ? " marked" : " marked in this session") : "Waiting for scans";
    }
    if (!count) {
      list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">Scanned students appear here.</p>';
      return;
    }
    list.innerHTML = rows
      .map(function (row) {
        return (
          '<div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100" data-student-id="' +
          esc(row.student.id) +
          '">' +
          avatarHtml(row.student, "w-10 h-10", "ring-2 ring-white") +
          '<div class="flex-1 min-w-0">' +
          '<p class="font-semibold text-slate-900 text-sm truncate">' +
          esc(row.student.name) +
          "</p>" +
          '<p class="text-[11px] text-slate-500 font-mono">' +
          esc(row.student.index) +
          " · " +
          esc(global.Attendify.formatTime(row.scannedAt)) +
          "</p></div>" +
          '<span class="text-[10px] font-bold uppercase text-teal-700 bg-teal-50 px-2 py-1 rounded-lg shrink-0">Present</span>' +
          '<button type="button" data-action="remove-scan" data-student-id="' +
          esc(row.student.id) +
          '" class="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-lg leading-none shrink-0" title="Remove">×</button></div>'
        );
      })
      .join("");

    list.querySelectorAll("[data-action=remove-scan]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (onRemove) onRemove(btn.getAttribute("data-student-id"));
      });
    });
    global.Attendify.hydrateAvatars(list);
  }

  function getLastVerifiedStudentId() {
    return lastVerifiedStudentId;
  }

  global.AttendifyScannerHud = {
    showVerified: showVerified,
    hideVerified: hideVerified,
    renderRecent: renderRecent,
    getLastVerifiedStudentId: getLastVerifiedStudentId
  };
})(window);
