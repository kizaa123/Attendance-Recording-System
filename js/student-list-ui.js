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
    return (
      '<div class="student-list-identity flex items-center gap-3 min-w-0">' +
      global.Attendify.avatarMarkup(student, avatarSize, ring) +
      '<div class="min-w-0 flex-1">' +
      '<p class="student-list-name font-semibold text-slate-900 text-sm truncate">' +
      esc(student.name) +
      "</p>" +
      (meta
        ? '<p class="student-list-meta text-[11px] text-slate-500 font-mono truncate">' + meta + "</p>"
        : "") +
      "</div></div>"
    );
  }

  var menuDotsSvg =
    '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>';

  global.AttendifyStudentList = {
    esc: esc,
    identityHtml: identityHtml,
    menuDotsSvg: menuDotsSvg
  };
})(window);