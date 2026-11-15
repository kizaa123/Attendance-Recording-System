(function (global) {
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function metaLine(parts) {
    return parts
      .filter(function (p) {
        return p != null && String(p).trim() !== "";
      })
      .map(function (p) {
        return esc(p);
      })
      .join(" · ");
  }

  function identityHtml(student, options) {
    if (!global.Attendify || !student) return "";
    options = options || {};
    var avatarSize = options.avatarSize || "w-10 h-10";
    var ring = options.ring != null ? options.ring : "ring-2 ring-white";
    var parts = [];
    if (options.index !== false) {
      var idx = student.index != null ? student.index : student.studentIndex;
      if (idx) parts.push(idx);
    }
    if (options.level && student.level != null && student.level !== "") {
      parts.push("L" + student.level);
    }
    if (options.email && student.email) parts.push(student.email);
    if (options.extra) parts.push(options.extra);
    var meta = metaLine(parts);
    var sessionCard = !!options.sessionCard;
    var identityCls =
      "student-list-identity flex items-center min-w-0" + (sessionCard ? " student-session-identity" : " gap-3");
    var textCls = "min-w-0 flex-1" + (sessionCard ? " student-session-identity-text" : "");
    return (
      '<div class="' +
      identityCls +
      '">' +
      global.Attendify.avatarMarkup(student, avatarSize, ring) +
      '<div class="' +
      textCls +
      '">' +
      '<p class="student-list-name font-semibold text-slate-900 text-sm truncate">' +
      esc(student.name) +
      "</p>" +
      (meta
        ? '<p class="student-list-meta text-[11px] text-slate-500 font-mono truncate">' + meta + "</p>"
        : "") +
      "</div></div>"
    );
  }

  var sessionBadgeGlyphs = {
    present:
      '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="#22c55e"/><path d="M6.25 10.15l2.35 2.35 5.15-5.5" stroke="#fff" stroke-width="1.65" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    waiting:
      '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="#f59e0b"/><circle cx="10" cy="10" r="4.25" stroke="#fff" stroke-width="1.5" fill="none"/><path d="M10 6.2V10l2.4 1.4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>',
    absent:
      '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="#f43f5e"/><path d="M7 7l6 6M13 7l-6 6" stroke="#fff" stroke-width="1.65" stroke-linecap="round"/></svg>'
  };

  function studentIndexValue(student) {
    if (!student) return "";
    var idx = student.index != null ? student.index : student.studentIndex;
    return idx != null && String(idx).trim() !== "" ? String(idx).trim() : "";
  }

  function attendanceSessionTableRow(student, badgeKind, scannedAt, options, rowIndex) {
    options = options || {};
    if (!global.Attendify || !student) return "";
    var indexVal = studentIndexValue(student);
    var timeStr = scannedAt ? global.Attendify.formatTime(scannedAt) : "—";
    var ring = options.ring != null ? options.ring : "ring-2 ring-slate-100";
    var badge = attendanceSessionBadge(badgeKind);
    var removeBtn = options.removeButtonHtml || "";
    var num = rowIndex != null ? String(rowIndex) : "";
    if (num.length < 2 && num) num = "0" + num;
    return (
      '<tr class="scan-present-table-row border-t border-slate-100 hover:bg-slate-50/80" data-student-id="' +
      esc(student.id) +
      '">' +
      (options.showNumber !== false
        ? '<td class="scan-present-table-num py-3 px-3 text-center text-xs font-semibold text-slate-400 tabular-nums w-12">' +
          esc(num) +
          "</td>"
        : "") +
      '<td class="scan-present-table-student py-3 px-3 min-w-0">' +
      '<div class="flex items-center gap-2.5 min-w-0">' +
      global.Attendify.avatarMarkup(student, "w-9 h-9", ring) +
      '<span class="font-semibold text-slate-900 text-sm truncate">' +
      esc(student.name) +
      "</span></div></td>" +
      '<td class="scan-present-table-index py-3 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">' +
      esc(indexVal) +
      "</td>" +
      '<td class="scan-present-table-time py-3 px-3 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">' +
      esc(timeStr) +
      "</td>" +
      '<td class="scan-present-table-status py-3 px-3">' +
      badge +
      "</td>" +
      '<td class="scan-present-table-actions py-3 px-2 text-right w-12">' +
      removeBtn +
      "</td></tr>"
    );
  }

  function attendanceSessionRosterCard(student, badgeKind, scannedAt, options) {
    options = options || {};
    if (!global.Attendify || !student) return "";
    var indexVal = studentIndexValue(student);
    var timeStr = scannedAt ? global.Attendify.formatTime(scannedAt) : "";
    var ring = options.ring != null ? options.ring : "ring-2 ring-white";
    var badge = attendanceSessionBadge(badgeKind);
    var removeBtn = options.removeButtonHtml || "";
    var metaIndex = indexVal
      ? '<p class="student-list-meta student-list-meta-index font-mono text-slate-500 truncate">' + esc(indexVal) + "</p>"
      : "";
    var metaTime = timeStr
      ? '<p class="student-list-meta student-list-meta-time font-mono text-slate-400 tabular-nums truncate">' +
        esc(timeStr) +
        "</p>"
      : "";
    return (
      '<div class="attendance-session-card attendance-session-card--roster">' +
      global.Attendify.avatarMarkup(student, "w-10 h-10", ring) +
      '<div class="attendance-session-card__main student-session-identity-text">' +
      '<p class="student-list-name font-semibold text-slate-900 text-sm leading-tight truncate">' +
      esc(student.name) +
      "</p>" +
      (metaIndex || metaTime
        ? '<div class="attendance-session-card__meta">' + metaIndex + metaTime + "</div>"
        : "") +
      "</div>" +
      badge +
      removeBtn +
      "</div>"
    );
  }

  function attendanceSessionBadge(kind) {
    var labels = { present: "Present", waiting: "Waiting...", absent: "Absent" };
    var key = labels[kind] ? kind : "";
    if (!key) {
      return '<span class="attendance-session-badge attendance-session-badge--neutral" role="status">—</span>';
    }
    return (
      '<span class="attendance-session-badge attendance-session-badge--' +
      key +
      '" role="status">' +
      '<span class="attendance-session-badge__glyph">' +
      sessionBadgeGlyphs[key] +
      "</span>" +
      '<span class="attendance-session-badge__text">' +
      esc(labels[key]) +
      "</span></span>"
    );
  }

  var menuDotsSvg =
    '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>';

  global.AttendifyStudentList = {
    esc: esc,
    identityHtml: identityHtml,
    menuDotsSvg: menuDotsSvg,
    attendanceSessionBadge: attendanceSessionBadge,
    attendanceSessionRosterCard: attendanceSessionRosterCard,
    attendanceSessionTableRow: attendanceSessionTableRow,
    studentIndexValue: studentIndexValue
  };
})(window);