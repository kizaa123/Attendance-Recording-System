(function (global) {
  var QUEUE_PREFIX = "attendify-scan-queue:";
  var TA_SESSION_PREFIX = "attendify-ta-session:";

  function parseQrFallback(text) {
    var raw = String(text || "").trim();
    if (raw.indexOf("ATTENDIFY:v1:") === 0) return { qrToken: raw.slice("ATTENDIFY:v1:".length) };
    var parts = raw.split("|");
    if (parts.length >= 3 && parts[0] === "ATD") {
      return { classId: parts[1], index: parts.slice(2).join("|") };
    }
    return null;
  }

  function normalizeStudent(row) {
    if (!row) return null;
    return {
      id: row.id,
      classId: row.classId,
      name: row.name,
      index: row.index != null ? row.index : row.studentIndex,
      photo: row.photo || "",
      qrPublicId: row.qrPublicId || row.qr_public_id || ""
    };
  }

  function rosterIndex(roster, classId) {
    var byQr = Object.create(null);
    var byIndex = Object.create(null);
    var classStudents = [];
    var i;
    var s;
    for (i = 0; i < roster.length; i++) {
      s = normalizeStudent(roster[i]);
      if (!s) continue;
      classStudents.push(s);
      if (s.qrPublicId) byQr[s.qrPublicId] = s;
      if (s.index) byIndex[String(s.index).toLowerCase()] = s;
    }
    return { list: classStudents, byQr: byQr, byIndex: byIndex, classId: classId };
  }

  function resolveScan(text, roster, classId, parseQrFn) {
    var parse = parseQrFn || parseQrFallback;
    var parsed = parse(text);
    var idx = rosterIndex(roster, classId);
    var qrToken = parsed && parsed.qrToken ? String(parsed.qrToken).trim() : "";
    if (qrToken && idx.byQr[qrToken]) return idx.byQr[qrToken];

    var index = parsed && parsed.index ? String(parsed.index).trim() : !qrToken ? String(text || "").trim() : "";
    if (!index) return null;

    if (idx.byIndex[index.toLowerCase()]) return idx.byIndex[index.toLowerCase()];

    var digits = index.replace(/\D/g, "");
    if (digits.length > 0 && digits.length <= 4) {
      var suffix = digits.padStart(4, "0").toLowerCase();
      var hits = [];
      for (var j = 0; j < idx.list.length; j++) {
        s = idx.list[j];
        if (classId && s.classId !== classId) continue;
        var tail = String(s.index || "")
          .replace(/\D/g, "")
          .slice(-4)
          .toLowerCase();
        if (tail === suffix) hits.push(s);
      }
      if (hits.length === 1) return hits[0];
    }
    return null;
  }

  function queueKey(scope) {
    return QUEUE_PREFIX + String(scope || "default");
  }

  function loadQueue(scope) {
    try {
      var raw = localStorage.getItem(queueKey(scope));
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveQueue(scope, items) {
    try {
      localStorage.setItem(queueKey(scope), JSON.stringify(items || []));
    } catch (_) {}
  }

  function enqueue(scope, payload) {
    var items = loadQueue(scope);
    items.push({
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      payload: payload,
      createdAt: new Date().toISOString()
    });
    saveQueue(scope, items);
    return items.length;
  }

  function saveTaSessionCache(token, data) {
    try {
      localStorage.setItem(TA_SESSION_PREFIX + String(token || ""), JSON.stringify(data || {}));
    } catch (_) {}
  }

  function loadTaSessionCache(token) {
    try {
      var raw = localStorage.getItem(TA_SESSION_PREFIX + String(token || ""));
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function flushQueue(scope, postFn, onEach) {
    var items = loadQueue(scope);
    if (!items.length) return Promise.resolve(0);
    var chain = Promise.resolve();
    var synced = 0;
    var remaining = [];

    items.forEach(function (item) {
      chain = chain.then(function () {
        return postFn(item.payload)
          .then(function (result) {
            if (result && result.ok) {
              synced += 1;
              if (onEach) onEach(result, item);
              return;
            }
            remaining.push(item);
          })
          .catch(function () {
            remaining.push(item);
          });
      });
    });

    return chain.then(function () {
      saveQueue(scope, remaining);
      return synced;
    });
  }

  global.AttendifyScanCache = {
    resolveScan: resolveScan,
    normalizeStudent: normalizeStudent,
    enqueue: enqueue,
    loadQueue: loadQueue,
    saveQueue: saveQueue,
    flushQueue: flushQueue,
    saveTaSessionCache: saveTaSessionCache,
    loadTaSessionCache: loadTaSessionCache,
    queueDepth: function (scope) {
      return loadQueue(scope).length;
    }
  };
})(typeof window !== "undefined" ? window : this);