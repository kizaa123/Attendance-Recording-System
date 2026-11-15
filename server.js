const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const db = require("./db");
const os = require("os");

/** Render and most hosts set PORT; ATTENDIFY_PORT overrides for local scripts */
const PORT = Number(process.env.PORT || process.env.ATTENDIFY_PORT) || 3000;
const HTTPS_PORT = Number(process.env.ATTENDIFY_HTTPS_PORT) || 3443;
/** Bind dual-stack so http://localhost (IPv6) and http://127.0.0.1 both hit this app — not a second process on :: only. */
const HOST = process.env.ATTENDIFY_HOST || "::";
const LISTEN_IPV6_ONLY = process.env.ATTENDIFY_IPV6_ONLY === "1";
const root = __dirname;
const pfxFile = path.join(root, "certs", "server.pfx");

function isLoopbackHost(hostname) {
  const h = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0:0:0:0:0:0:0:1";
}

function hostNameFromHeader(hostHeader) {
  const raw = String(hostHeader || "").trim();
  if (!raw) return "";
  if (raw.charAt(0) === "[") {
    const end = raw.indexOf("]");
    if (end !== -1) return raw.slice(1, end).toLowerCase();
  }
  return raw.split(":")[0].toLowerCase();
}

function getNetworkIp() {
  const nets = os.networkInterfaces();
  const wifi = [];
  const ethernet = [];
  const other = [];
  for (const name of Object.keys(nets)) {
    const lower = name.toLowerCase();
    if (
      lower.includes("virtual") ||
      lower.includes("vbox") ||
      lower.includes("vmware") ||
      lower.includes("hyper-v") ||
      lower.includes("wsl")
    ) {
      continue;
    }
    for (const net of nets[name] || []) {
      const v4 = net.family === "IPv4" || net.family === 4;
      if (!v4 || net.internal) continue;
      if (String(net.address).startsWith("169.254.")) continue;
      if (String(net.address).startsWith("192.168.56.")) continue;
      const entry = { address: net.address, name: name };
      if (/wi-?fi|wlan|wireless/i.test(name)) wifi.push(entry);
      else if (/ethernet|eth\b/i.test(name)) ethernet.push(entry);
      else other.push(entry);
    }
  }
  const pick = wifi[0] || ethernet[0] || other[0];
  return pick ? pick.address : "127.0.0.1";
}

function studentShareOrigin(req, isHttps) {
  const lanIp = getNetworkIp();
  const hasHttps = fs.existsSync(pfxFile);
  const networkHttp = "http://" + lanIp + ":" + PORT;
  const envPublic = String(process.env.ATTENDIFY_PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL || "")
    .replace(/\/$/, "");
  if (envPublic) return envPublic;

  const reqHost = hostNameFromHeader(req.headers.host);
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const reqProto = forwardedProto || (isHttps ? "https:" : "http:");
  const hostHeader = String(req.headers.host || "").trim();
  const reqOrigin = hostHeader ? reqProto + "//" + hostHeader : "http://localhost:" + PORT;

  if (isLoopbackHost(reqHost) || !reqHost) {
    return networkHttp;
  }
  if (hasHttps && reqProto === "https:") {
    return networkHttp;
  }
  return reqOrigin.replace(/\/$/, "");
}

function sendJson(res, status, body, extraHeaders) {
  const data = JSON.stringify(body);
  const headers = Object.assign(
    {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Attendify-Token, Authorization"
    },
    extraHeaders || {}
  );
  res.writeHead(status, headers);
  res.end(data);
}

function runApi(handler) {
  return function (body) {
    try {
      return handler(body);
    } catch (error) {
      console.error(error);
      return { ok: false, error: error.message || "Server error." };
    }
  };
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on("data", function (chunk) {
      size += chunk.length;
      if (size > 6 * 1024 * 1024) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", function () {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };

try {
  db.openDb();
} catch (error) {
  console.error("Database failed to open:", error.message);
  process.exit(1);
}

function readCookieToken(req) {
  const cookie = String(req.headers.cookie || "");
  const match = cookie.match(/(?:^|;\s*)attendify_token=([^;]+)/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1].trim());
  } catch (_) {
    return match[1].trim();
  }
}

function readAuthToken(req) {
  const headerToken = String(req.headers["x-attendify-token"] || "").trim();
  if (headerToken) return headerToken;
  const auth = String(req.headers.authorization || "").trim();
  if (auth.toLowerCase().indexOf("bearer ") === 0) return auth.slice(7).trim();
  return readCookieToken(req);
}

function sessionCookieHeader(token, maxAgeSec) {
  const age = maxAgeSec != null ? maxAgeSec : 12 * 60 * 60;
  if (!token) {
    return "attendify_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
  }
  return (
    "attendify_token=" +
    encodeURIComponent(token) +
    "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" +
    age
  );
}

function requireFacultyAuth(req, res) {
  const auth = db.validateLecturerSession(readAuthToken(req));
  if (!auth.ok) {
    sendJson(res, 401, { ok: false, error: auth.error || "Please sign in.", code: "AUTH_REQUIRED" });
    return null;
  }
  return auth;
}

function isPublicApi(pathname, method) {
  if (pathname === "/api/host" && method === "GET") return true;
  if (pathname === "/api/ucc-programmes" && method === "GET") return true;
  if (pathname === "/api/ucc-programmes/roster-preview" && method === "GET") return true;
  if (pathname === "/api/auth/login" && method === "POST") return true;
  if (pathname === "/api/auth/signup" && method === "POST") return true;
  if (pathname === "/api/auth/logout" && method === "POST") return true;
  if (pathname === "/api/auth/me" && method === "GET") return true;
  if (pathname === "/api/state" && method === "GET") return true;
  if (pathname === "/api/enroll/context" && method === "GET") return true;
  if (pathname === "/api/enroll/student" && method === "GET") return true;
  if (pathname === "/api/ucc/photo" && method === "GET") return true;
  if (pathname === "/api/students" && method === "POST") return true;
  if (pathname === "/api/attendance" && method === "POST") return true;
  if (pathname.indexOf("/api/ta/") === 0 && method === "GET") return true;
  return false;
}

function pipeUccPhoto(uccRes, res) {
  if (!uccRes || !uccRes.statusCode || uccRes.statusCode !== 200) {
    res.writeHead(uccRes && uccRes.statusCode ? uccRes.statusCode : 404);
    res.end();
    return;
  }
  const type = String(uccRes.headers["content-type"] || "image/jpeg");
  if (type.indexOf("image/") !== 0) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": "public, max-age=1800",
    "Access-Control-Allow-Origin": "*"
  });
  uccRes.pipe(res);
}

function isFacultyHtmlPage(pathname) {
  const name = String(pathname || "").toLowerCase().replace(/^\//, "");
  return (
    name === "dashboard.html" ||
    name === "course.html" ||
    name === "programme.html" ||
    name === "reports.html" ||
    name === "settings.html"
  );
}

function handleRequest(req, res) {
  const isHttps = !!(req.socket && req.socket.encrypted);
  const currentPort = isHttps ? HTTPS_PORT : PORT;
  const protocol = isHttps ? "https:" : "http:";
  const url = new URL(req.url, protocol + "//localhost:" + currentPort);
  if (url.pathname.indexOf("/api/") === 0 && req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }
  if (url.pathname.indexOf("/api/") === 0 && !isPublicApi(url.pathname, req.method)) {
    const auth = requireFacultyAuth(req, res);
    if (!auth) return;
    req.attendifyAuth = auth;
  }
  if (url.pathname === "/api/host") {
    const lanIp = getNetworkIp();
    const hasHttps = fs.existsSync(pfxFile);
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim();
    const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").trim();
    const reqProto = forwardedProto || (isHttps ? "https:" : "http:");
    const reqOrigin = forwardedHost ? reqProto + "//" + forwardedHost : protocol + "//localhost:" + PORT;
    const shareOrigin = studentShareOrigin(req, isHttps);
    sendJson(res, 200, {
      origin: "http://" + lanIp + ":" + PORT,
      httpsOrigin: hasHttps ? "https://" + lanIp + ":" + HTTPS_PORT : null,
      localOrigin: "http://localhost:" + PORT,
      shareOrigin: shareOrigin,
      publicOrigin: shareOrigin,
      requestOrigin: reqOrigin,
      lanIp: lanIp,
      port: PORT,
      httpsPort: hasHttps ? HTTPS_PORT : null
    });
    return;
  }
  if (url.pathname === "/api/enroll/context" && req.method === "GET") {
    sendJson(
      res,
      200,
      db.enrollPageContext(url.searchParams.get("class"), url.searchParams.get("level"))
    );
    return;
  }
  if (url.pathname === "/api/enroll/student" && req.method === "GET") {
    sendJson(
      res,
      200,
      db.enrollStudentLookup(url.searchParams.get("class"), url.searchParams.get("index"))
    );
    return;
  }
  if (url.pathname === "/api/ucc/photo" && req.method === "GET") {
    const tag = String(url.searchParams.get("tag") || url.searchParams.get("index") || "").trim();
    if (!tag || tag.length < 4) {
      res.writeHead(400);
      res.end("bad tag");
      return;
    }
    const remote =
      "https://cdn.ucc.edu.gh/photos/?tag=" + encodeURIComponent(tag).replace(/%2F/gi, "/");
    https
      .get(remote, function (uccRes) {
        if (uccRes.statusCode && uccRes.statusCode >= 300 && uccRes.statusCode < 400 && uccRes.headers.location) {
          const next = String(uccRes.headers.location);
          const follow = next.indexOf("https:") === 0 ? https : http;
          follow
            .get(next, function (uccRes2) {
              pipeUccPhoto(uccRes2, res);
            })
            .on("error", function () {
              res.writeHead(502);
              res.end();
            });
          return;
        }
        pipeUccPhoto(uccRes, res);
      })
      .on("error", function () {
        res.writeHead(502);
        res.end();
      });
    return;
  }
  if (url.pathname === "/api/state" && req.method === "GET") {
    const tokenAuth = db.validateLecturerSession(readAuthToken(req));
    if (tokenAuth.ok) {
      const lecturerId = tokenAuth.lecturerId;
      const scoped = lecturerId && String(lecturerId).indexOf("demo-") !== 0;
      sendJson(res, 200, db.loadState(scoped ? { lecturerId: lecturerId } : {}));
      return;
    }
    sendJson(res, 200, db.publicState());
    return;
  }
  if (url.pathname === "/api/state" && req.method === "PUT") {
    readBody(req).then(function (body) {
      if (!body.classes || !body.students || !body.sessions) {
        sendJson(res, 400, { ok: false, error: "Invalid roster." });
        return;
      }
      if (!body.courses) body.courses = [];
      const state = db.saveState(body);
      sendJson(res, 200, { ok: true, state: state });
    }).catch(function () { sendJson(res, 400, { ok: false, error: "Could not save the roster." }); });
    return;
  }
  if (url.pathname === "/api/ucc-programmes" && req.method === "GET") {
    sendJson(res, 200, { ok: true, programmes: db.listUccProgrammes() });
    return;
  }
  if (url.pathname === "/api/ucc-programmes/roster-preview" && req.method === "GET") {
    sendJson(
      res,
      200,
      db.rosterPreviewByUccProgramme(url.searchParams.get("uccProgrammeId"), url.searchParams.get("level"))
    );
    return;
  }
  if (url.pathname === "/api/auth/signup" && req.method === "POST") {
    readBody(req)
      .then(function (body) {
        const result = runApi(db.signupLecturer)(body || {});
        const headers = result && result.ok && result.token ? { "Set-Cookie": sessionCookieHeader(result.token) } : {};
        sendJson(res, 200, result, headers);
      })
      .catch(function () {
        sendJson(res, 400, { ok: false, error: "Could not create your account." });
      });
    return;
  }
  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    readBody(req)
      .then(function (body) {
        const result = runApi(db.loginLecturer)(body || {});
        const headers = result && result.ok && result.token ? { "Set-Cookie": sessionCookieHeader(result.token) } : {};
        sendJson(res, 200, result, headers);
      })
      .catch(function () {
        sendJson(res, 400, { ok: false, error: "Could not sign in." });
      });
    return;
  }
  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    db.destroyLecturerSession(readAuthToken(req));
    sendJson(res, 200, { ok: true }, { "Set-Cookie": sessionCookieHeader("") });
    return;
  }
  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    const me = db.validateLecturerSession(readAuthToken(req));
    if (!me.ok) {
      sendJson(res, 401, { ok: false, error: me.error || "Not signed in.", code: "AUTH_REQUIRED" });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      lecturer: me.lecturer,
      token: me.token,
      expiresAt: me.expiresAt,
      programmeIds:
        String(me.lecturerId).indexOf("demo-") === 0
          ? (db.loadState().classes || []).map(function (c) {
              return c.id;
            })
          : db.loadState({ lecturerId: me.lecturerId }).classes.map(function (c) {
              return c.id;
            })
    });
    return;
  }
  if (url.pathname === "/api/auth/programmes/add" && req.method === "POST") {
    readBody(req)
      .then(function (body) {
        body = body || {};
        const me = db.validateLecturerSession(readAuthToken(req));
        if (!me.ok) {
          sendJson(res, 401, { ok: false, error: me.error || "Not signed in.", code: "AUTH_REQUIRED" });
          return;
        }
        sendJson(res, 200, db.appendLecturerTeachingAssignment(me.lecturerId, body));
      })
      .catch(function () {
        sendJson(res, 400, { ok: false, error: "Could not add the programme." });
      });
    return;
  }
  if (url.pathname === "/api/auth/programmes" && req.method === "GET") {
    const me = db.validateLecturerSession(readAuthToken(req));
    if (!me.ok) {
      sendJson(res, 401, { ok: false, error: me.error || "Not signed in.", code: "AUTH_REQUIRED" });
      return;
    }
    if (String(me.lecturerId).indexOf("demo-") === 0) {
      sendJson(res, 200, {
        ok: true,
        programmes: db.listUccProgrammes().map(function (p) {
          return Object.assign({}, p, { selected: true, studentCount: 0, sharedRoster: false, classId: "" });
        })
      });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      programmes: db.lecturerProgrammeCatalogue(me.lecturerId),
      assignments: db.lecturerAssignmentsForApi(me.lecturerId)
    });
    return;
  }
  if (url.pathname === "/api/auth/profile" && req.method === "PATCH") {
    readBody(req)
      .then(function (body) {
        body = body || {};
        if (req.attendifyAuth && req.attendifyAuth.lecturerId) {
          body.lecturerId = req.attendifyAuth.lecturerId;
        }
        sendJson(res, 200, runApi(db.updateLecturerProfile)(body));
      })
      .catch(function () {
        sendJson(res, 400, { ok: false, error: "Could not update your profile." });
      });
    return;
  }
  if (url.pathname === "/api/classes" && req.method === "POST") {
    readBody(req).then(function (body) {
      body = body || {};
      if (req.attendifyAuth && req.attendifyAuth.lecturerId) {
        body.lecturerId = req.attendifyAuth.lecturerId;
      }
      sendJson(res, 200, runApi(db.addClass)(body));
    })
      .catch(function () { sendJson(res, 400, { ok: false, error: "Could not create the programme." }); });
    return;
  }
  var classMatch = url.pathname.match(/^\/api\/classes\/([^/]+)\/?$/);
  if (classMatch) {
    var classId = decodeURIComponent(classMatch[1]);
    if (req.method === "PATCH" || req.method === "PUT") {
      readBody(req)
        .then(function (body) {
          body = body || {};
          body.id = body.id || classId;
          sendJson(res, 200, runApi(db.updateClass)(body));
        })
        .catch(function () {
          sendJson(res, 400, { ok: false, error: "Could not update the programme." });
        });
      return;
    }
    if (req.method === "DELETE") {
      sendJson(res, 200, runApi(db.deleteClass)({ id: classId }));
      return;
    }
  }
  var courseIdMatch = url.pathname.match(/^\/api\/courses\/([^/]+)\/?$/);
  if (courseIdMatch && (req.method === "PATCH" || req.method === "PUT" || req.method === "DELETE")) {
    var cid = decodeURIComponent(courseIdMatch[1]);
    if (req.method === "DELETE") {
      var delBody = { courseId: cid };
      if (req.attendifyAuth && req.attendifyAuth.lecturerId) {
        delBody.lecturerId = req.attendifyAuth.lecturerId;
      }
      sendJson(res, 200, runApi(db.deleteProgrammeCourse)(delBody));
      return;
    }
    readBody(req)
      .then(function (body) {
        body = body || {};
        body.courseId = body.courseId || body.id || cid;
        if (req.attendifyAuth && req.attendifyAuth.lecturerId) {
          body.lecturerId = req.attendifyAuth.lecturerId;
        }
        sendJson(res, 200, runApi(db.updateProgrammeCourse)(body));
      })
      .catch(function () {
        sendJson(res, 400, { ok: false, error: "Could not update the course." });
      });
    return;
  }
  var programmeCoursesMatch = url.pathname.match(/^\/api\/classes\/([^/]+)\/courses\/?$/);
  if (programmeCoursesMatch && req.method === "POST") {
    var programmeId = decodeURIComponent(programmeCoursesMatch[1]);
    readBody(req)
      .then(function (body) {
        body = body || {};
        body.classId = body.classId || programmeId;
        if (req.attendifyAuth && req.attendifyAuth.lecturerId) {
          body.lecturerId = req.attendifyAuth.lecturerId;
        }
        sendJson(res, 200, runApi(db.addProgrammeCourse)(body));
      })
      .catch(function () {
        sendJson(res, 400, { ok: false, error: "Could not create the course." });
      });
    return;
  }
  if (url.pathname === "/api/students" && req.method === "POST") {
    readBody(req).then(function (body) { sendJson(res, 200, db.addStudent(body || {})); })
      .catch(function () { sendJson(res, 400, { ok: false, error: "Could not save the student." }); });
    return;
  }
  var studentIdMatch = url.pathname.match(/^\/api\/students\/([^/]+)\/?$/);
  if (studentIdMatch && req.method === "DELETE") {
    var studentId = decodeURIComponent(studentIdMatch[1]);
    var delStudentBody = { id: studentId };
    if (req.attendifyAuth && req.attendifyAuth.lecturerId) {
      delStudentBody.lecturerId = req.attendifyAuth.lecturerId;
    }
    sendJson(res, 200, runApi(db.deleteStudent)(delStudentBody));
    return;
  }
  if (url.pathname === "/api/attendance" && req.method === "POST") {
    readBody(req).then(function (body) {
      sendJson(res, 200, db.markPresent(body || {}));
    }).catch(function () { sendJson(res, 400, { ok: false, error: "Could not record attendance." }); });
    return;
  }
  if (url.pathname === "/api/attendance/remove" && req.method === "POST") {
    readBody(req)
      .then(function (body) {
        try {
          body = body || {};
          if (req.attendifyAuth && req.attendifyAuth.lecturerId) {
            body.lecturerId = req.attendifyAuth.lecturerId;
          }
          sendJson(res, 200, db.removeAttendanceRecord(body));
        } catch (error) {
          sendJson(res, 200, { ok: false, error: error.message || "Could not undo." });
        }
      })
      .catch(function () {
        sendJson(res, 400, { ok: false, error: "Could not read the request." });
      });
    return;
  }
  var sessionMatch = url.pathname.match(/^\/api\/sessions\/(\d+)\/?$/);
  if (sessionMatch && req.method === "GET") {
    sendJson(res, 200, db.getSessionDetail(sessionMatch[1]));
    return;
  }
  if (url.pathname === "/api/sessions/start" && req.method === "POST") {
    readBody(req)
      .then(function (body) {
        try {
          body = body || {};
          if (req.attendifyAuth && req.attendifyAuth.lecturerId) {
            body.lecturerId = req.attendifyAuth.lecturerId;
          }
          sendJson(res, 200, db.startAttendanceSession(body));
        } catch (error) {
          sendJson(res, 200, { ok: false, error: error.message || "Could not start attendance session." });
        }
      })
      .catch(function () {
        sendJson(res, 400, { ok: false, error: "Could not read the request. Try again." });
      });
    return;
  }
  if (url.pathname === "/api/sessions/close" && req.method === "POST") {
    readBody(req)
      .then(function (body) {
        try {
          body = body || {};
          if (req.attendifyAuth && req.attendifyAuth.lecturerId) {
            body.lecturerId = req.attendifyAuth.lecturerId;
          }
          sendJson(res, 200, db.closeAttendanceSession(body));
        } catch (error) {
          sendJson(res, 200, { ok: false, error: error.message || "Could not end attendance session." });
        }
      })
      .catch(function () {
        sendJson(res, 400, { ok: false, error: "Could not read the request. Try again." });
      });
    return;
  }
  if (url.pathname === "/api/sessions/share" && req.method === "POST") {
    readBody(req).then(function (body) {
      sendJson(res, 200, db.shareSessionClasses(body || {}));
    }).catch(function () { sendJson(res, 400, { ok: false, error: "Could not link shared lecture." }); });
    return;
  }

  // ── TA Share Token ──────────────────────────────────────────────────────
  if (url.pathname === "/api/ta/create" && req.method === "POST") {
    readBody(req).then(function (body) {
      sendJson(res, 200, db.createTaToken(body || {}));
    }).catch(function () { sendJson(res, 400, { ok: false, error: "Could not create TA token." }); });
    return;
  }

  var taTokenMatch = url.pathname.match(/^\/api\/ta\/([^/]+)$/);
  if (taTokenMatch && req.method === "GET") {
    sendJson(res, 200, db.getTaSession(decodeURIComponent(taTokenMatch[1])));
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";

  const joinMatch = rel.match(/^\/join\/([^/]+)\/?$/i);
  if (joinMatch) {
    const enrollParams = new URLSearchParams(url.search || "");
    enrollParams.set("class", joinMatch[1]);
    res.writeHead(302, {
      Location: "/enroll.html?" + enrollParams.toString(),
      "Cache-Control": "no-store"
    });
    res.end();
    return;
  }
  const scanMatch = rel.match(/^\/scan\/([^/]+)\/?$/i);
  if (scanMatch) {
    let scanToken = scanMatch[1];
    try {
      scanToken = decodeURIComponent(scanToken);
    } catch (_) {}
    if (!db.resolveTaToken(scanToken)) {
      const enrollRedirect = db.enrollRedirectForScanToken(scanToken);
      if (enrollRedirect.ok) {
        const enrollParams = new URLSearchParams(url.search || "");
        enrollParams.set("class", enrollRedirect.classId);
        if (enrollRedirect.level != null && enrollRedirect.level !== "") {
          enrollParams.set("level", String(enrollRedirect.level));
        }
        res.writeHead(302, {
          Location: "/enroll.html?" + enrollParams.toString(),
          "Cache-Control": "no-store"
        });
        res.end();
        return;
      }
    }
    rel = "/ta-scanner.html";
  }

  if (isFacultyHtmlPage(rel)) {
    const pageAuth = db.validateLecturerSession(readAuthToken(req));
    if (!pageAuth.ok) {
      const nextPage = rel.replace(/^\//, "");
      const next = encodeURIComponent(nextPage + (url.search || ""));
      res.writeHead(302, {
        Location: "/login.html?next=" + next,
        "Cache-Control": "no-store"
      });
      res.end();
      return;
    }
    if (rel === "/index.html") {
      res.writeHead(302, { Location: "/dashboard.html", "Cache-Control": "no-store" });
      res.end();
      return;
    }
  }

  const file = path.resolve(root, "." + rel);
  if (!file.toLowerCase().startsWith(path.resolve(root).toLowerCase())) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  fs.readFile(file, function (error, data) {
    if (error) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const headers = {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": path.extname(file) === ".html" ? "no-store" : "public, max-age=300"
    };
    res.writeHead(200, headers);
    res.end(data);
  });
}

const httpServer = http.createServer(handleRequest);
httpServer.listen({ port: PORT, host: HOST, ipv6Only: LISTEN_IPV6_ONLY }, function () {
  const lanIp = getNetworkIp();
  console.log("Database: data/attendify.db");
  console.log("Local:    http://localhost:" + PORT + "/");
  console.log("          http://127.0.0.1:" + PORT + "/");
  console.log("Network:  http://" + lanIp + ":" + PORT + "/");
  console.log("Students: use http://" + lanIp + ":" + PORT + "/join/<programme-id> on the same Wi-Fi (not localhost).");
});

if (fs.existsSync(pfxFile)) {
  try {
    const httpsServer = https.createServer({
      pfx: fs.readFileSync(pfxFile),
      passphrase: "attendify123"
    }, handleRequest);
    httpsServer.listen({ port: HTTPS_PORT, host: HOST, ipv6Only: LISTEN_IPV6_ONLY }, function () {
      const lanIp = getNetworkIp();
      console.log("HTTPS Local:   https://localhost:" + HTTPS_PORT + "/");
      console.log("HTTPS Network: https://" + lanIp + ":" + HTTPS_PORT + "/");
    });
  } catch (err) {
    console.warn("Could not start HTTPS server:", err.message);
  }
}
